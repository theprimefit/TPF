/*
 * Saved patients and diet charts (localStorage), compact plan packing, backups,
 * and the chart data hidden inside printed PDFs so a previous chart can be read
 * back to make next week's chart. No DOM access: works in the browser and in Node.
 */
(function (root) {
  const KEYS = { patients: 'hindivine.patients.v1', charts: 'hindivine.charts.v1' };
  const MARK = 'HDV5';

  function createStore(storage, P, DB) {
    const byName = {};
    DB.FOODS.forEach((f) => { byName[f.name] = f; });

    const read = (k) => { try { return JSON.parse(storage.getItem(k) || '[]') || []; } catch (_) { return []; } };
    const write = (k, v) => {
      try { storage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; }
    };
    const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    // ── Plan packing ─────────────────────────────────────────────
    const packItem = (i) => (i.custom || i.fid == null
      ? { c: i.name, q: i.qty, u: i.unit, k: i.per.kcal, p: i.per.p, pq: i.per.qty }
      : [i.name, i.qty]);

    function unpackItem(x) {
      if (Array.isArray(x)) {
        const f = byName[x[0]];
        return f ? P.makeItem(f, x[1]) : P.customItem(x[0], x[1], 'serving', 0, 0);
      }
      const it = P.customItem(x.c, x.q, x.u, x.k, x.p);
      if (x.pq) { it.per.qty = x.pq; P.setItemQty(it, x.q); }
      return it;
    }

    function packPlan(plan) {
      return plan.days.map((d) => ({
        n: d.day,
        m: d.meals.map((e) => [e.slot, e.time, e.target, e.targetP, e.locked ? 1 : 0, e.meal ? e.meal.items.map(packItem) : null]),
      }));
    }

    function unpackPlan(days, profile) {
      const plan = {
        targets: P.computeTargets(profile),
        days: days.map((d) => P.refreshDay({
          day: d.n,
          meals: d.m.map(([slot, time, target, targetP, locked, items]) => {
            const meal = items ? P.recalcMeal({ name: '', items: items.map(unpackItem) }) : null;
            if (meal) meal.name = meal.items.map((i) => i.name).join(' + ');
            return { slot, label: P.SLOTS[slot].label, time, target, targetP, locked: !!locked, meal };
          }),
        })),
      };
      plan.combos = P.countCombinations(DB, profile);
      return plan;
    }

    // ── Patients ─────────────────────────────────────────────────
    const PATIENT_FIELDS = ['name', 'patientId', 'phone', 'age', 'sex', 'heightCm', 'weightKg', 'notes'];
    const listPatients = () => read(KEYS.patients).sort((a, b) => b.updated - a.updated);
    const getPatient = (id) => read(KEYS.patients).find((p) => p.id === id) || null;

    /** Save (or update) the patient of a profile; returns the patient id. Generic charts return null. */
    function upsertPatient(profile) {
      if (!profile.name) return null;
      const all = read(KEYS.patients);
      const low = (s) => String(s || '').trim().toLowerCase();
      let p = all.find((x) => x.id === profile.patientRef)
        || (profile.patientId && all.find((x) => low(x.patientId) === low(profile.patientId)))
        || all.find((x) => low(x.name) === low(profile.name) && low(x.phone) === low(profile.phone));
      const now = Date.now();
      if (!p) { p = { id: uid('p'), created: now }; all.push(p); }
      PATIENT_FIELDS.forEach((k) => { p[k] = profile[k]; });
      p.updated = now;
      write(KEYS.patients, all);
      return p.id;
    }

    function deletePatient(id, withCharts) {
      write(KEYS.patients, read(KEYS.patients).filter((p) => p.id !== id));
      const charts = read(KEYS.charts);
      write(KEYS.charts, withCharts ? charts.filter((c) => c.patientRef !== id) : charts.map((c) => (c.patientRef === id ? { ...c, patientRef: null } : c)));
    }

    // ── Charts ───────────────────────────────────────────────────
    const listCharts = (patientRef) => read(KEYS.charts)
      .filter((c) => patientRef === undefined || c.patientRef === patientRef)
      .sort((a, b) => b.updated - a.updated);
    const getChart = (id) => read(KEYS.charts).find((c) => c.id === id) || null;

    /** Save a chart ({id?, profile, plan, week, parent}); returns the stored record (without the full plan). */
    function saveChart(rec) {
      const all = read(KEYS.charts);
      const now = Date.now();
      const patientRef = upsertPatient(rec.profile);
      if (patientRef) rec.profile.patientRef = patientRef;
      let c = rec.id && all.find((x) => x.id === rec.id);
      if (!c) { c = { id: rec.id || uid('c'), created: now }; all.push(c); }
      Object.assign(c, {
        patientRef, name: rec.profile.name || '', plan: rec.profile.plan, week: rec.week || 1, parent: rec.parent || null,
        kcal: rec.plan.targets.calories, protein: rec.plan.targets.protein, days: rec.plan.days.length,
        profile: rec.profile, data: packPlan(rec.plan), updated: now,
      });
      if (!write(KEYS.charts, all)) return null;
      return c;
    }

    function loadChart(id) {
      const c = getChart(id);
      if (!c) return null;
      return { id: c.id, week: c.week || 1, parent: c.parent, profile: c.profile, plan: unpackPlan(c.data, c.profile) };
    }

    const deleteChart = (id) => write(KEYS.charts, read(KEYS.charts).filter((c) => c.id !== id));

    // ── Backup ───────────────────────────────────────────────────
    function exportAll() {
      return JSON.stringify({ app: 'Hindivine Diet', v: 5, exported: new Date().toISOString(), patients: read(KEYS.patients), charts: read(KEYS.charts) });
    }

    /** Merge a backup into the saved data; returns counts added. */
    function importAll(json) {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!data || !Array.isArray(data.patients) || !Array.isArray(data.charts)) throw new Error('Not a Hindivine Diet backup file.');
      const merge = (key, list) => {
        const all = read(key);
        const ids = new Set(all.map((x) => x.id));
        const add = list.filter((x) => x && x.id && !ids.has(x.id));
        write(key, all.concat(add));
        return add.length;
      };
      return { patients: merge(KEYS.patients, data.patients), charts: merge(KEYS.charts, data.charts) };
    }

    // ── Data hidden in the PDF ───────────────────────────────────
    /** Compact chart data for the PDF: food ids (with the database size, to detect changes). */
    function pdfPayload(profile, plan, week) {
      const days = plan.days.map((d) => [d.day, d.meals.map((e) => [e.slot, e.meal ? e.meal.items.map((i) => (i.custom || i.fid == null
        ? ['c', i.name, i.qty, i.unit, i.per.kcal, i.per.p]
        : [i.fid, i.qty])) : []])]);
      const json = JSON.stringify({ v: 5, n: DB.FOODS.length, w: week || 1, p: profile, d: days });
      return MARK + '[' + b64encode(json) + ']' + MARK;
    }

    /**
     * Read a previous chart from PDF text. Returns
     *   { exact: true, profile, plan, week }                 when the hidden data is found, or
     *   { exact: false, foods: [names], name }               from the food names printed on it.
     */
    function readPdfText(text, I) {
      const compact = text.replace(/\s+/g, '');
      const m = compact.match(new RegExp(MARK + '\\[([A-Za-z0-9+/=]+)\\]' + MARK));
      if (m) {
        try {
          const data = JSON.parse(b64decode(m[1]));
          if (data.v === 5 && data.p && Array.isArray(data.d)) {
            const sameDb = data.n === DB.FOODS.length;
            const days = data.d.map(([day, meals]) => ({
              n: day,
              m: meals.map(([slot, items]) => {
                const s = P.SLOTS[slot] || P.SLOTS.lunch;
                return [slot, (data.p.times && data.p.times[slot]) || s.time, 0, 0, 0, items.map((x) => {
                  if (x[0] === 'c') return { c: x[1], q: x[2], u: x[3], k: x[4], p: x[5] };
                  const f = sameDb ? DB.FOODS[x[0]] : null;
                  return f ? [f.name, x[1]] : null;
                }).filter(Boolean)];
              }),
            }));
            const plan = unpackPlan(days, data.p);
            // Restore slot targets from the profile.
            const slots = P.slotTargets(plan.targets.calories, data.p.meals || 5, data.p.earlyDrink !== false);
            plan.days.forEach((d) => d.meals.forEach((e) => {
              const s = slots.find((x) => x.slot === e.slot);
              if (s) { e.target = Math.round(s.kcal); e.targetP = Math.round(plan.targets.protein * s.share); }
            }));
            if (sameDb || plan.days.some((d) => d.meals.some((e) => e.meal && e.meal.items.length))) {
              return { exact: true, profile: data.p, plan, week: data.w || 1 };
            }
          }
        } catch (_) { /* fall back to food names */ }
      }
      return { exact: false, foods: findFoodNames(text, I) };
    }

    /** Dishes whose name (English or any chart language) appears in the text. */
    function findFoodNames(text, I) {
      const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ');
      let hay = norm(text);
      const cands = [];
      DB.FOODS.forEach((f) => {
        if (f.ingKey) return;
        const names = new Set([f.name]);
        if (I) I.CODES.forEach((l) => names.add(I.foodName(l, f.name)));
        names.forEach((n) => { if (n && n.length >= 3) cands.push([norm(n), f.name]); });
      });
      cands.sort((a, b) => b[0].length - a[0].length); // "Dal tadka" before "Dal"
      const found = new Set();
      cands.forEach(([n, name]) => {
        if (hay.includes(n)) {
          found.add(name);
          hay = hay.split(n).join(' · ');
        }
      });
      return [...found];
    }

    return {
      KEYS, packPlan, unpackPlan, listPatients, getPatient, upsertPatient, deletePatient,
      listCharts, getChart, saveChart, loadChart, deleteChart, exportAll, importAll, pdfPayload, readPdfText, findFoodNames,
    };
  }

  function b64encode(str) {
    if (typeof Buffer !== 'undefined' && typeof btoa === 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decode(b64) {
    if (typeof Buffer !== 'undefined' && typeof atob === 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
    return decodeURIComponent(escape(atob(b64)));
  }

  /** In-memory storage with the localStorage interface (tests, private mode). */
  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }

  const api = { createStore, memoryStorage, MARK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.STORE = api;
})(typeof window !== 'undefined' ? window : globalThis);
