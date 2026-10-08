/* Hindivine Diet — dashboard, step-by-step chart wizard, patients, saved charts, recipes. */
(function () {
  const P = window.Planner;
  const DB = window.FOODDB;
  const I = window.I18N;
  const RC = window.RECIPES;
  const ING = window.INGREDIENTS;
  const IC = window.ICONS;
  const BRAND = { company: 'Hindivine Healthcare Private Limited', website: 'www.hindivine.com', logo: 'img/logo.jpg' };
  const CURRENT_KEY = 'hindivine.chart.v5';
  const LEGACY_KEY = 'hindivine.chart.v3';
  const DIETITIAN_KEY = 'hindivine.dietitian';
  const DIETITIAN_FIELDS = ['dietitian', 'qualification', 'dietitianPhone'];
  const ALLERGIES = { gluten: 'Gluten', dairy: 'Dairy / lactose', nuts: 'Nuts & peanuts', soy: 'Soy', egg: 'Egg', fish: 'Fish / seafood' };
  const KCAL_PRESETS = [1000, 1200, 1400, 1500, 1600, 1800, 2000, 2200, 2500];
  const PROTEIN_PRESETS = [40, 50, 60, 70, 80, 100, 120, 150];
  const WATER_PRESETS = [2, 2.5, 3, 3.5, 4];
  const STEPS = ['s1', 's2', 's3', 's4', 's5'];
  const TOP = ['home', 'patients', 'charts', 'recipes', 'library', 'upload', 'settings'];
  const SCREENS = [...TOP, ...STEPS, 'chart', 'patient', 'recipe'];

  let storage;
  try { storage = window.localStorage; storage.getItem('x'); } catch (_) { storage = window.STORE.memoryStorage(); }
  const store = window.STORE.createStore(storage, P, DB);

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const form = $('#profile-form');
  const result = $('#result');
  const sheet = $('#print-sheet');
  const editor = $('#editor');
  const rdialog = $('#rdialog');
  const actionSheet = $('#sheet');

  let profile = null;
  let plan = null;
  let meta = { id: null, week: 1, parent: null };
  let activeDay = 0;
  let edit = null;
  let current = 'home';
  let pendingAvoid = null; // food names from an uploaded (non-Hindivine) chart
  let viewPatient = null;
  let viewRecipe = null;
  let servings = 1;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n).toLocaleString('en-IN');
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>'),
    swap: svg('<path d="M4 7h13l-3-3M20 17H7l3 3"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    unlock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>'),
    minus: svg('<path d="M6 12h12"/>'),
    plus: svg('<path d="M12 6v12M6 12h12"/>'),
    trash: svg('<path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3"/>'),
    chev: svg('<path d="M9 5l7 7-7 7"/>'),
    print: svg('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>'),
    book: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>'),
  };
  const chip = (value, label, pressed) => `<button type="button" class="chip" data-value="${esc(value)}" aria-pressed="${!!pressed}">${esc(label)}</button>`;
  const options = (entries, selected) => Object.entries(entries)
    .map(([k, v]) => `<option value="${esc(k)}"${k === selected ? ' selected' : ''}>${esc(typeof v === 'string' ? v : v.label || v.name)}</option>`).join('');
  const dateText = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const foodById = (id) => (id == null ? null : DB.FOODS[id]);
  const dishByName = {};
  DB.FOODS.forEach((f) => { if (f.recipe) dishByName[f.name] = f; });
  const DISHES = DB.FOODS.filter((f) => f.recipe);
  const iconOf = (item) => IC.foodIcon(foodById(item.fid) || { name: item.name, roles: [] });

  // ── Build controls ───────────────────────────────────────────────
  $('#plan').innerHTML = options(P.PLANS, 'weight_loss');
  $('#activity').innerHTML = options(P.ACTIVITY, 'light');
  $('#travel').innerHTML = options(P.TRAVEL, 'mixed');
  $('#chart-lang').innerHTML = options(I.LANGS, 'en');
  $('#chart-lang2').innerHTML = '<option value="">None</option>' + options(I.LANGS, '');
  $('#start-day').innerHTML = P.DAY_NAMES.map((d) => `<option value="${d}">${d}</option>`).join('');
  $('#diet-seg').innerHTML = Object.entries(P.DIETS).map(([k, v]) => `<button type="button" data-value="${k}" aria-pressed="${k === 'veg'}">${esc(v)}</button>`).join('');
  $('#kcal-chips').innerHTML = chip('', 'Auto', true) + KCAL_PRESETS.map((k) => chip(k, num(k))).join('');
  $('#protein-chips').innerHTML = chip('', 'Auto', true) + PROTEIN_PRESETS.map((g) => chip(g, `${g} g`)).join('');
  $('#water-chips').innerHTML = chip('', 'Auto', true) + WATER_PRESETS.map((l) => chip(l, `${l} L`)).join('');
  $('#mix-chips').innerHTML = chip('', 'None', true) + Object.entries(P.MIXES).map(([k, v]) => chip(k, v.label)).join('');
  $('#days-chips').innerHTML = [1, 2, 3, 4, 5, 6, 7].map((n) => chip(n, n === 1 ? '1 day' : `${n} days`, n === 7)).join('');
  $('#condition-chips').innerHTML = Object.entries(P.CONDITIONS).map(([k, v]) => chip(k, v)).join('');
  $('#region-chips').innerHTML = Object.entries(P.REGIONS).map(([k, v]) => chip(k, v.label)).join('');
  $('#exclude-chips').innerHTML = Object.entries(P.EXCLUDES).map(([k, v]) => chip(k, `No ${v.label.toLowerCase()}`)).join('');
  $('#allergy-chips').innerHTML = Object.entries(ALLERGIES).map(([k, v]) => chip(k, v)).join('');
  $('#times').innerHTML = Object.entries(P.SLOTS).map(([k, s]) => `<label>${IC.slotIcon(k)} ${esc(s.label)}<input type="time" name="time_${k}" value="${s.time}"></label>`).join('');
  $('#food-suggest').innerHTML = DB.FOODS.filter((f) => !f.ingKey).map((f) => `<option value="${esc(f.name)}">${esc(f.hi)}</option>`).join('');

  const REGION_LABEL = { IN: 'Pan-Indian', ...Object.fromEntries(Object.entries(P.REGIONS).map(([k, v]) => [k, v.label])) };
  const CAT_OPTIONS = '<option value="">All categories</option>' + Object.entries(P.CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  const DIET_OPTIONS = '<option value="">All</option><option value="vegan">Vegan</option><option value="veg">Vegetarian</option><option value="egg">Egg</option><option value="nonveg">Non-veg</option>';
  $('#lib-category').innerHTML = CAT_OPTIONS;
  $('#editor-category').innerHTML = CAT_OPTIONS;
  $('#rc-category').innerHTML = CAT_OPTIONS.replace(/<option value="ingredients">[^<]*<\/option>/, '');
  $('#lib-region').innerHTML = '<option value="">All cuisines</option>' + Object.entries(REGION_LABEL).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  $('#lib-diet').innerHTML = DIET_OPTIONS;
  $('#rc-diet').innerHTML = DIET_OPTIONS;

  function setSeg(name, value) {
    const seg = $(`.seg[data-name="${name}"]`);
    if (!seg || value == null) return;
    $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
    form.elements[name].value = value;
    if (name === 'chartType') $$('.travel-only').forEach((el) => { el.hidden = value !== 'travel'; });
  }
  $$('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { setSeg(seg.dataset.name, b.dataset.value); onFormChange(); }
  }));

  function setSingleChip(name, value) {
    $$(`[data-single="${name}"] .chip`).forEach((c) => c.setAttribute('aria-pressed', String(String(c.dataset.value) === String(value == null ? '' : value))));
  }
  $$('[data-single]').forEach((box) => {
    const input = form.elements[box.dataset.single];
    box.addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      input.value = c.dataset.value;
      setSingleChip(box.dataset.single, c.dataset.value);
      onFormChange();
    });
    input.addEventListener('input', () => setSingleChip(box.dataset.single, input.value));
  });
  $$('[data-multi]').forEach((box) => box.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (c) { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); onFormChange(); }
  }));
  const multi = (name) => $$(`[data-multi="${name}"] .chip[aria-pressed="true"]`).map((c) => c.dataset.value);
  const setMulti = (name, values) => $$(`[data-multi="${name}"] .chip`).forEach((c) => c.setAttribute('aria-pressed', String((values || []).includes(c.dataset.value))));

  // Tag inputs (foods the patient likes / avoids)
  const tagState = { likes: [], dislikes: [] };
  function renderTags(name) {
    const box = $(`[data-tags="${name}"] .tags-box`);
    box.innerHTML = tagState[name].map((t, i) => `<span class="tag">${esc(t)}<button type="button" data-remove="${i}" aria-label="Remove ${esc(t)}">✕</button></span>`).join('');
  }
  function addTag(name, text) {
    text.split(',').map((s) => s.trim()).filter(Boolean).forEach((t) => {
      if (!tagState[name].some((x) => x.toLowerCase() === t.toLowerCase())) tagState[name].push(t);
    });
    renderTags(name);
  }
  $$('.tag-input').forEach((wrap) => {
    const name = wrap.dataset.tags;
    const input = $('input', wrap);
    input.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        addTag(name, input.value);
        input.value = '';
      }
    });
    input.addEventListener('change', () => { if (input.value.trim()) { addTag(name, input.value); input.value = ''; } });
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-remove]');
      if (b) { tagState[name].splice(Number(b.dataset.remove), 1); renderTags(name); } else input.focus();
    });
  });

  // ── Form ⇄ profile ──────────────────────────────────────────────
  const PATIENT_KEYS = ['name', 'patientId', 'phone', 'age', 'sex', 'heightCm', 'weightKg', 'notes'];

  function readForm() {
    const fd = new FormData(form);
    const text = (k) => (fd.get(k) || '').trim();
    const times = {};
    Object.keys(P.SLOTS).forEach((k) => { times[k] = fd.get('time_' + k) || P.SLOTS[k].time; });
    const chartType = fd.get('chartType');
    const mixKey = fd.get('mixKey') || '';
    const lang = fd.get('chartLang') || 'en';
    const lang2 = fd.get('chartLang2') || '';
    return {
      patientRef: text('patientRef') || null,
      name: text('name'), patientId: text('patientId'), phone: text('phone'),
      age: Number(fd.get('age')) || 0, sex: fd.get('sex') || '', heightCm: Number(fd.get('heightCm')) || 0, weightKg: Number(fd.get('weightKg')) || 0,
      notes: text('notes'),
      chartType, travel: chartType === 'travel' ? fd.get('travel') : '',
      plan: fd.get('plan'), weightGoal: fd.get('weightGoal'), activity: fd.get('activity'),
      kcalTarget: Number(fd.get('kcalTarget')) || 0, proteinTarget: Number(fd.get('proteinTarget')) || 0, waterL: Number(fd.get('waterL')) || 0,
      conditions: multi('conditions'),
      diet: fd.get('diet'), mixKey, mix: mixKey && P.MIXES[mixKey] ? [...P.MIXES[mixKey].mix] : [],
      regions: multi('regions'), excludes: multi('excludes'), allergies: multi('allergies'),
      likes: [...tagState.likes], dislikes: [...tagState.dislikes],
      preferWl: fd.get('preferWl') === 'on',
      days: Number(fd.get('days')) || 7,
      chartLang: lang, chartLang2: lang2 === lang ? '' : lang2, startDay: fd.get('startDay') || 'Monday',
      meals: Number(fd.get('meals')), earlyDrink: fd.get('earlyDrink') === 'on', times,
      dietitian: text('dietitian'), qualification: text('qualification'), dietitianPhone: text('dietitianPhone'),
      recipes: [],
    };
  }

  function writeForm(p) {
    Object.entries(p).forEach(([key, val]) => {
      if (['conditions', 'regions', 'excludes', 'allergies'].includes(key)) return setMulti(key, val);
      if (key === 'likes' || key === 'dislikes') { tagState[key] = [...(val || [])]; return renderTags(key); }
      if (key === 'times') return Object.entries(val || {}).forEach(([k, t]) => { if (form.elements['time_' + k]) form.elements['time_' + k].value = t; });
      if (key === 'sex' || key === 'diet' || key === 'chartType') return setSeg(key, val || '');
      const el = form.elements[key];
      if (!el || !el.type) return;
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val === 0 ? '' : (val == null ? '' : val);
    });
    if (p.travel) form.elements.travel.value = p.travel;
    setSingleChip('kcalTarget', p.kcalTarget || '');
    setSingleChip('proteinTarget', p.proteinTarget || '');
    setSingleChip('waterL', p.waterL || '');
    setSingleChip('mixKey', p.mixKey || '');
    setSingleChip('days', p.days || 7);
    if (!p.days) form.elements.days.value = 7;
  }

  function clearPatientFields() {
    PATIENT_KEYS.forEach((k) => { if (k !== 'sex' && form.elements[k]) form.elements[k].value = ''; });
    setSeg('sex', 'female');
    form.elements.patientRef.value = '';
  }

  function validate(p, step) {
    if (!step || step === 's1') {
      if (p.age && !(p.age >= 14 && p.age <= 90)) return 'Age must be between 14 and 90 (or leave it blank).';
      if (p.heightCm && !(p.heightCm >= 120 && p.heightCm <= 230)) return 'Height must be between 120 and 230 cm (or leave it blank).';
      if (p.weightKg && !(p.weightKg >= 30 && p.weightKg <= 250)) return 'Weight must be between 30 and 250 kg (or leave it blank).';
    }
    if (!step || step === 's2') {
      if (P.PLANS[p.plan].femaleOnly && p.sex === 'male') return `${P.PLANS[p.plan].label} is only for female patients.`;
    }
    return '';
  }

  function onFormChange() {
    const p = readForm();
    if (current === 's1') liveBmi(p);
    if (current === 's2') liveTargets(p);
  }
  form.addEventListener('input', onFormChange);
  form.addEventListener('submit', (e) => e.preventDefault());

  function liveBmi(p) {
    const box = $('#bmi-live');
    if (!(p.heightCm > 0 && p.weightKg > 0)) { box.textContent = ''; return; }
    const t = P.computeTargets({ ...p, plan: 'balanced' });
    box.innerHTML = `<b>BMI ${t.bmi}</b> · ${t.bmiCategory} · ideal ${t.idealWeight[0]}–${t.idealWeight[1]} kg`;
  }
  function liveTargets(p) {
    if (validate(p, 's1')) return;
    const t = P.computeTargets(p);
    $('#target-live').innerHTML = `This chart: <b>${num(t.calories)} kcal</b> · <b>${t.protein} g protein</b> · <b>${t.waterL} L water</b> · ${esc(P.GOALS[t.goal].label)}${t.estimated && !t.customKcal ? '<br><span class="muted">Standard targets — add weight, height &amp; age for a personal calculation.</span>' : ''}${t.warnings.length ? `<br><span class="warn-text">${t.warnings.map(esc).join('<br>')}</span>` : ''}`;
  }

  function dietText(p, lang) {
    const l = lang || 'en';
    if (p.mixKey && P.MIXES[p.mixKey]) {
      if (l === 'en') return P.MIXES[p.mixKey].label;
      return p.mixKey.split('_').map((k) => (k === 'nonveg' ? I.label(l, 'diets', 'nonveg') : I.label(l, 'mix', k))).join(' + ');
    }
    return l === 'en' ? P.DIETS[p.diet] : I.label(l, 'diets', p.diet);
  }

  function review() {
    const p = readForm();
    const t = P.computeTargets(p);
    const row = (k, v) => (v ? `<div><span>${k}</span><b>${esc(v)}</b></div>` : '');
    const likes = p.likes.join(', ');
    const avoid = [...p.excludes.map((k) => 'No ' + P.EXCLUDES[k].label.toLowerCase()), ...p.dislikes].join(', ');
    const days = P.planDays(p.startDay, p.days);
    $('#review').innerHTML = `<h3>Review</h3><div class="review-grid">
      ${row('Patient', p.name || 'Generic chart')}
      ${row('Diet', P.PLANS[p.plan].label + (p.travel ? ' · ' + P.TRAVEL[p.travel] : ''))}
      ${row('Target', `${num(t.calories)} kcal · ${t.protein} g protein · ${t.waterL} L water`)}
      ${row('Food type', dietText(p))}
      ${row('Likes', likes)}
      ${row('Avoid', avoid)}
      ${row('Language', I.LANGS[p.chartLang].name + (p.chartLang2 ? ' + ' + I.LANGS[p.chartLang2].name : ''))}
      ${row('Days', days.length === 1 ? `1 day · ${days[0].day}` : `${days.length} days · ${days[0].day} → ${days[days.length - 1].day}`)}
      ${pendingAvoid ? row('Next week', `${pendingAvoid.length} foods from the uploaded chart will be changed`) : ''}
    </div>`;
  }

  // ── Router ───────────────────────────────────────────────────────
  const TITLES = { home: 'Dashboard' };
  function show(name) {
    if (!SCREENS.includes(name)) name = 'home';
    if (name === 'chart' && !plan) name = 'home';
    if (name === 'patient' && !viewPatient) name = 'patients';
    if (name === 'recipe' && !viewRecipe) name = 'recipes';
    current = name;
    closeDrawer();
    $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== name; });
    const sec = $(`.screen[data-screen="${name}"]`);
    const stepIdx = STEPS.indexOf(name);
    const top = TOP.includes(name);
    $('#back').hidden = top;
    $('#menu').hidden = !top;
    $('#appbar-logo').hidden = name !== 'home';
    $('#appbar-text').hidden = name === 'home';
    $('#screen-title').textContent = TITLES[name] || sec.dataset.title || '';
    let sub = '';
    if (stepIdx >= 0) sub = `Step ${stepIdx + 1} of ${STEPS.length}`;
    else if (name === 'chart' && profile) sub = `${profile.name || 'Generic chart'} · Week ${meta.week || 1}`;
    $('#screen-sub').textContent = sub;
    $('#progress').hidden = stepIdx < 0;
    $('#progress-bar').style.width = `${((stepIdx + 1) / STEPS.length) * 100}%`;
    $('#step-bar').hidden = stepIdx < 0 || name === 's5';
    $('#create-bar').hidden = name !== 's5';
    $('#chart-bar').hidden = name !== 'chart';
    $('#tab-bar').hidden = !top;
    $('#go-library').hidden = name === 'library';
    $('#step-back').textContent = stepIdx === 0 ? 'Home' : 'Back';
    document.body.dataset.screen = name;
    renderTabs();
    if (name === 's1') { renderPatientPick(); liveBmi(readForm()); }
    if (name === 's2') liveTargets(readForm());
    if (name === 's5') review();
    if (name === 'library') renderLibrary();
    if (name === 'chart') render();
    if (name === 'home') renderHome();
    if (name === 'patients') renderPatients();
    if (name === 'patient') renderPatient();
    if (name === 'charts') renderCharts();
    if (name === 'recipes') renderRecipes();
    if (name === 'recipe') renderRecipe();
    if (name === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }

  function go(name) {
    if (location.hash.slice(1) === name) show(name);
    else location.hash = name;
  }
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  $('#back').addEventListener('click', () => (history.length > 1 ? history.back() : go('home')));
  $('#go-library').addEventListener('click', () => go('library'));
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    if (b.dataset.go === 's1') newChart();
    else go(b.dataset.go);
  });
  $('#step-next').addEventListener('click', () => {
    const err = validate(readForm(), current);
    if (err) return toast(err);
    go(STEPS[STEPS.indexOf(current) + 1]);
  });
  $('#step-back').addEventListener('click', () => go(STEPS.indexOf(current) === 0 ? 'home' : STEPS[STEPS.indexOf(current) - 1]));

  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast no-print'; t.setAttribute('role', 'alert'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 3600);
  }

  // ── Menu ─────────────────────────────────────────────────────────
  const NAV = [
    ['home', '🏠', 'Dashboard'], ['s1', '➕', 'New diet chart'], ['patients', '👥', 'Patients'], ['charts', '📋', 'Saved charts'],
    ['upload', '📤', 'Upload previous chart'], ['recipes', '🍲', 'Recipes'], ['library', '🥗', 'Food library'], ['settings', '⚙️', 'Settings & backup'],
  ];
  $('#drawer-nav').innerHTML = NAV.map(([k, icon, label]) => `<button type="button" data-go="${k}" data-nav="${k}"><span class="nav-ico">${icon}</span>${esc(label)}</button>`).join('');
  const TABS = [['home', '🏠', 'Home'], ['patients', '👥', 'Patients'], ['s1', '➕', 'New'], ['charts', '📋', 'Charts'], ['recipes', '🍲', 'Recipes']];
  function renderTabs() {
    $('#tab-bar').innerHTML = TABS.map(([k, icon, label]) => `<button type="button" class="tab${k === 's1' ? ' tab-new' : ''}" data-go="${k}" aria-current="${k === current}"><span>${icon}</span><small>${label}</small></button>`).join('');
    $$('#drawer-nav button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.nav === current)));
  }
  function openDrawer() { $('#drawer').hidden = false; $('#scrim').hidden = false; requestAnimationFrame(() => document.body.classList.add('drawer-open')); }
  function closeDrawer() { document.body.classList.remove('drawer-open'); $('#drawer').hidden = true; $('#scrim').hidden = true; }
  $('#menu').addEventListener('click', openDrawer);
  $('#scrim').addEventListener('click', closeDrawer);

  // ── Dashboard ────────────────────────────────────────────────────
  const QUICK = [
    ['s1', '➕', 'New chart', 'Step by step', 'q-blue'],
    ['nextweek', '🗓️', 'Next week', 'Full food change', 'q-green'],
    ['upload', '📤', 'Upload PDF', 'Read last chart', 'q-orange'],
    ['patients', '👥', 'Patients', 'History & follow-up', 'q-purple'],
    ['charts', '📋', 'Saved charts', 'Edit or reprint', 'q-teal'],
    ['recipes', '🍲', 'Recipes', `${DISHES.length} dishes`, 'q-red'],
    ['library', '🥗', 'Food library', `${num(DB.FOODS.length)} foods`, 'q-lime'],
    ['settings', '⚙️', 'Settings', 'Dietitian & backup', 'q-grey'],
  ];
  $('#quick-grid').innerHTML = QUICK.map(([k, icon, label, sub, cls]) => `<button type="button" class="quick ${cls}" ${k === 'nextweek' ? 'id="quick-next"' : `data-go="${k}"`}><span class="q-ico">${icon}</span><b>${esc(label)}</b><small>${esc(sub)}</small></button>`).join('');
  $('#quick-next').addEventListener('click', () => {
    if (plan) return nextWeek();
    toast('Open a saved chart (or upload last week\'s PDF) to make next week\'s chart.');
    go('charts');
  });

  function chartRow(c, opts) {
    const o = opts || {};
    const pl = P.PLANS[c.plan];
    return `<div class="row-card" data-chart="${esc(c.id)}">
      <span class="rc-avatar">${esc((c.name || 'G').trim().charAt(0).toUpperCase())}</span>
      <button type="button" class="rc-main" data-open-chart="${esc(c.id)}">
        <b>${esc(c.name || 'Generic chart')}${o.hideWeek ? '' : ` <i class="wk">Week ${c.week || 1}</i>`}</b>
        <small>${esc(pl ? pl.label : c.plan)} · ${num(c.kcal)} kcal · ${c.protein} g protein · ${c.days || 7} ${c.days === 1 ? 'day' : 'days'}</small>
        <small class="date">${o.hideWeek ? `Week ${c.week || 1} · ` : ''}${dateText(c.updated)}</small>
      </button>
      <div class="rc-acts">
        <button type="button" class="chip mini" data-next-chart="${esc(c.id)}" title="Make next week's chart">Next week</button>
        <button type="button" class="icon-btn danger" data-del-chart="${esc(c.id)}" aria-label="Delete chart">${ICON.trash}</button>
      </div>
    </div>`;
  }

  function renderHome() {
    const dt = load(DIETITIAN_KEY) || {};
    const h = new Date().getHours();
    $('#dash-greet').textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    $('#dash-name').textContent = dt.dietitian || 'Hindivine Diet';
    const patients = store.listPatients();
    const charts = store.listCharts();
    $('#kpis').innerHTML = [
      ['👥', num(patients.length), 'Patients'], ['📋', num(charts.length), 'Charts'],
      ['🍲', num(DISHES.length), 'Recipes'], ['🥗', num(DB.FOODS.length), 'Foods'],
    ].map(([i, v, l]) => `<div class="kpi"><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join('');
    $('#continue-chart').hidden = !plan;
    if (plan) {
      $('#continue-title').textContent = profile.name || 'Generic chart';
      $('#continue-sub').textContent = `${P.PLANS[profile.plan].label} · Week ${meta.week || 1} · ${num(plan.targets.calories)} kcal`;
    }
    $('#recent-charts').innerHTML = charts.length ? charts.slice(0, 5).map((c) => chartRow(c)).join('') : '<div class="empty">No saved charts yet. Tap <b>New chart</b> to create the first one — every chart is saved automatically.</div>';
  }
  $('#continue-chart').addEventListener('click', () => go('chart'));

  // Chart rows (dashboard, charts list, patient page)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-chart],[data-next-chart],[data-del-chart]');
    if (!b) return;
    if (b.dataset.openChart) openSavedChart(b.dataset.openChart);
    else if (b.dataset.nextChart) {
      const c = store.loadChart(b.dataset.nextChart);
      if (!c) return toast('Chart not found.');
      setCurrent(c);
      nextWeek();
    } else if (b.dataset.delChart) {
      if (!confirm('Delete this saved chart?')) return;
      store.deleteChart(b.dataset.delChart);
      if (meta.id === b.dataset.delChart) meta.id = null;
      show(current);
      toast('Chart deleted.');
    }
  });

  function setCurrent(c) {
    profile = c.profile;
    plan = c.plan;
    meta = { id: c.id, week: c.week || 1, parent: c.parent || null };
    activeDay = 0;
    if (!profile.recipes) profile.recipes = [];
    writeForm(profile);
  }
  function openSavedChart(id) {
    const c = store.loadChart(id);
    if (!c) return toast('Chart not found.');
    setCurrent(c);
    saveCurrent();
    go('chart');
  }

  // ── Patients ─────────────────────────────────────────────────────
  function renderPatientPick() {
    const list = store.listPatients();
    $('#patient-pick-card').hidden = !list.length;
    const sel = form.elements.patientRef.value;
    $('#patient-pick').innerHTML = '<option value="">— New patient —</option>' + list.map((p) => `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(p.name)}${p.patientId ? ' · ' + esc(p.patientId) : ''}${p.phone ? ' · ' + esc(p.phone) : ''}</option>`).join('');
  }
  $('#patient-pick').addEventListener('change', (e) => {
    const p = store.getPatient(e.target.value);
    if (!p) { clearPatientFields(); return liveBmi(readForm()); }
    const last = store.listCharts(p.id)[0];
    if (last) writeForm({ ...last.profile, recipes: [] });
    const fields = {};
    PATIENT_KEYS.forEach((k) => { fields[k] = p[k]; });
    writeForm(fields);
    form.elements.patientRef.value = p.id;
    liveBmi(readForm());
    toast(last ? 'Patient and last chart preferences filled in.' : 'Patient details filled in.');
  });

  function renderPatients() {
    const q = $('#pt-search').value.trim().toLowerCase();
    const list = store.listPatients().filter((p) => !q || [p.name, p.patientId, p.phone].join(' ').toLowerCase().includes(q));
    const counts = {};
    store.listCharts().forEach((c) => { if (c.patientRef) counts[c.patientRef] = (counts[c.patientRef] || 0) + 1; });
    $('#pt-list').innerHTML = list.length ? list.map((p) => `
      <button type="button" class="row-card as-btn" data-patient="${esc(p.id)}">
        <span class="rc-avatar">${esc(p.name.charAt(0).toUpperCase())}</span>
        <span class="rc-main">
          <b>${esc(p.name)}</b>
          <small>${[p.age ? `${p.age} y` : '', p.sex ? (p.sex === 'male' ? 'Male' : 'Female') : '', p.weightKg ? `${p.weightKg} kg` : '', p.patientId, p.phone].filter(Boolean).map(esc).join(' · ') || 'No details'}</small>
          <small class="date">${counts[p.id] || 0} chart${counts[p.id] === 1 ? '' : 's'} · updated ${dateText(p.updated)}</small>
        </span>
        ${ICON.chev}
      </button>`).join('') : `<div class="empty">${q ? 'No patient matches your search.' : 'No patients yet. Patients are saved automatically when you create a chart with a patient name.'}</div>`;
  }
  $('#pt-search').addEventListener('input', renderPatients);
  $('#pt-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-patient]');
    if (b) { viewPatient = b.dataset.patient; go('patient'); }
  });

  function renderPatient() {
    const p = store.getPatient(viewPatient);
    if (!p) { $('#pt-detail').innerHTML = '<div class="empty">Patient not found.</div>'; return; }
    $('#screen-title').textContent = p.name;
    const charts = store.listCharts(p.id);
    const bmi = p.heightCm && p.weightKg ? P.computeTargets({ ...p, plan: 'balanced' }) : null;
    const facts = [['Age', p.age ? `${p.age} years` : '—'], ['Sex', p.sex ? (p.sex === 'male' ? 'Male' : 'Female') : '—'], ['Height', p.heightCm ? `${p.heightCm} cm` : '—'], ['Weight', p.weightKg ? `${p.weightKg} kg` : '—'], ['BMI', bmi ? `${bmi.bmi} · ${bmi.bmiCategory}` : '—'], ['Mobile', p.phone || '—']];
    $('#pt-detail').innerHTML = `
      <div class="pt-hero">
        <span class="rc-avatar lg">${esc(p.name.charAt(0).toUpperCase())}</span>
        <div><h2>${esc(p.name)}</h2><p>${p.patientId ? 'ID ' + esc(p.patientId) + ' · ' : ''}${charts.length} saved chart${charts.length === 1 ? '' : 's'}</p></div>
      </div>
      <div class="fact-grid">${facts.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
      ${p.notes ? `<div class="card soft"><b>Notes:</b> ${esc(p.notes)}</div>` : ''}
      <div class="btn-row">
        <button type="button" class="btn primary" id="pt-new">${ICON.plus} New chart</button>
        ${charts.length ? `<button type="button" class="btn" data-next-chart="${esc(charts[0].id)}">🗓️ Next week (Week ${(charts[0].week || 1) + 1})</button>` : ''}
      </div>
      <h2 class="sec-title">Diet chart history</h2>
      <div class="list">${charts.length ? charts.map((c) => chartRow(c, { hideWeek: false })).join('') : '<div class="empty">No charts yet.</div>'}</div>
      <button type="button" class="btn danger-btn" id="pt-delete">Delete patient</button>`;
    $('#pt-new').addEventListener('click', () => {
      newChart();
      const last = charts[0];
      if (last) writeForm({ ...last.profile, recipes: [] });
      const fields = {};
      PATIENT_KEYS.forEach((k) => { fields[k] = p[k]; });
      writeForm(fields);
      form.elements.patientRef.value = p.id;
    });
    $('#pt-delete').addEventListener('click', () => {
      if (!confirm(`Delete ${p.name}? Their ${charts.length} saved chart(s) will be deleted too.`)) return;
      store.deletePatient(p.id, true);
      toast('Patient deleted.');
      go('patients');
    });
  }

  function renderCharts() {
    const q = $('#ch-search').value.trim().toLowerCase();
    const list = store.listCharts().filter((c) => !q || [c.name || 'generic', P.PLANS[c.plan] ? P.PLANS[c.plan].label : ''].join(' ').toLowerCase().includes(q));
    $('#ch-list').innerHTML = list.length ? list.map((c) => chartRow(c)).join('') : `<div class="empty">${q ? 'No chart matches your search.' : 'No saved charts yet.'}</div>`;
  }
  $('#ch-search').addEventListener('input', renderCharts);

  // ── Chart helpers (chart language) ──────────────────────────────
  const L = () => (profile && profile.chartLang) || 'en';
  const L2 = () => (profile && profile.chartLang2 && profile.chartLang2 !== L() ? profile.chartLang2 : '');
  const itemName = (item, lang) => I.foodName(lang, item.name, item.custom);
  const itemQty = (item, lang) => I.unitText(lang, item.text, item.unit, item.qty);
  function time12(t) {
    const [h, m] = String(t).split(':').map(Number);
    if (isNaN(h)) return t;
    return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
  function macroPct(t) {
    const kp = t.protein * 4, kc = t.carbs * 4, kf = t.fat * 9, tot = kp + kc + kf || 1;
    return { p: Math.round((kp / tot) * 100), c: Math.round((kc / tot) * 100), f: Math.round((kf / tot) * 100) };
  }
  function tipList(t) {
    const list = P.tips(profile, t);
    const avg = Math.round(plan.days.reduce((s, d) => s + d.totals.p, 0) / plan.days.length);
    if (avg && avg < t.protein * 0.85) list.push({ k: 'proteinGap', v: { avg, target: t.protein } });
    return list;
  }
  function restrictionText(lang) {
    const r = P.resolveProfile(profile);
    return [...r.conditions.map((c) => I.label(lang, 'conditions', c)), ...profile.allergies.map((a) => I.label(lang, 'allergy', a))];
  }
  function exclusionText(lang) {
    return [...profile.excludes.map((k) => I.label(lang, 'excl', k)), ...profile.dislikes].join(', ');
  }
  function cuisineText(lang) {
    return profile.regions.length ? profile.regions.map((r) => I.label(lang, 'regions', r)).join(', ') : I.label(lang, 'regions', 'ALL');
  }
  const showWl = () => plan.targets.goal === 'lose' || profile.preferWl;
  const chartTitleKey = () => (profile.travel ? 'titleTravel' : 'title');
  const titleFor = (lang) => I.t(lang, chartTitleKey()).replace('7', String(plan.days.length));

  // ── Chart screen ─────────────────────────────────────────────────
  function mealCard(entry, di, mi) {
    const m = entry.meal;
    const lang = L();
    const lang2 = L2();
    const empty = !m || !m.items.length;
    const diff = m ? m.kcal - entry.target : 0;
    const sub = [lang !== 'en' ? I.label(lang, 'slots', entry.slot) : '', lang2 && lang2 !== 'en' ? I.label(lang2, 'slots', entry.slot) : ''].filter(Boolean).join(' · ');
    return `<article class="meal-card${entry.locked ? ' locked' : ''}">
      <header>
        <span class="slot-ico">${IC.slotIcon(entry.slot)}</span>
        <div class="mc-title"><h4>${esc(entry.label)}${sub ? ` <small>${esc(sub)}</small>` : ''}</h4><span class="time">${esc(time12(entry.time))}</span></div>
        <span class="target">${entry.target} kcal</span>
      </header>
      ${empty ? `<button type="button" class="empty-meal" data-edit="${di}:${mi}">${ICON.plus} Add foods</button>` : `
      <ul class="food-items">${m.items.map((i) => {
        const dish = !i.custom && dishByName[i.name];
        const alt = [lang !== 'en' && !i.custom ? itemName(i, lang) : '', lang2 && !i.custom ? itemName(i, lang2) : ''].filter((x) => x && x !== i.name);
        return `<li><span class="fi-ico">${iconOf(i)}</span><span class="fi-name">${dish ? `<button type="button" class="link-food" data-recipe="${esc(i.name)}">${esc(lang === 'en' ? i.name : itemName(i, lang))}</button>` : esc(lang === 'en' ? i.name : itemName(i, lang))}${alt.length ? `<small>${esc([lang !== 'en' ? i.name : '', ...alt.filter((x) => x !== itemName(i, lang))].filter(Boolean).join(' · '))}</small>` : ''}</span><b>${esc(itemQty(i, lang))}</b><em>${i.kcal}</em></li>`;
      }).join('')}</ul>`}
      <footer>
        <div class="nutri">
          <span class="kcal">${m ? m.kcal : 0} kcal</span>
          <span class="pill ${Math.abs(diff) > entry.target * 0.2 ? 'warn' : ''}">${diff >= 0 ? '+' : ''}${diff}</span>
          <span class="mac">P ${m ? m.p : 0} · C ${m ? m.c : 0} · F ${m ? m.f : 0}</span>
        </div>
        <div class="acts">
          <button type="button" class="icon-btn" data-edit="${di}:${mi}" title="Choose foods" aria-label="Edit ${esc(entry.label)}">${ICON.edit}</button>
          <button type="button" class="icon-btn" data-swap="${di}:${mi}" title="Swap for another option" aria-label="Swap ${esc(entry.label)}">${ICON.swap}</button>
          <button type="button" class="icon-btn${entry.locked ? ' on' : ''}" data-lock="${di}:${mi}" title="${entry.locked ? 'Unlock' : 'Lock (keep on New plan)'}" aria-pressed="${entry.locked}" aria-label="Lock ${esc(entry.label)}">${entry.locked ? ICON.lock : ICON.unlock}</button>
        </div>
      </footer>
    </article>`;
  }

  function render() {
    if (!plan) return;
    if (activeDay >= plan.days.length) activeDay = 0;
    const t = plan.targets;
    const pct = macroPct(t);
    const d = plan.days[activeDay];
    const conds = restrictionText('en');
    const n = plan.days.length;
    const recipes = profile.recipes || [];

    result.innerHTML = `
      <div class="summary">
        <div class="summary-main">
          <span class="eyebrow">${n}-Day ${profile.travel ? 'Travel Diet Chart · ' + esc(P.TRAVEL[profile.travel]) : 'Diet Chart'} · Week ${meta.week || 1}</span>
          <h2>${profile.name ? esc(profile.name) : 'Generic diet chart'}</h2>
          <p>${esc(P.PLANS[profile.plan].label)} · ${esc(dietText(profile))}</p>
          ${conds.length ? `<div class="tags">${conds.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="summary-kcal">
          <b>${num(t.calories)}</b><span>kcal / day${t.customKcal ? ' · custom' : ''}</span>
          <b class="sm">${t.protein} g</b><span>protein${t.customProtein ? ' · custom' : ''}</span>
        </div>
      </div>

      <div class="chart-controls card">
        <label>Language<select id="chart-lang-quick">${options(I.LANGS, L())}</select></label>
        <label>2nd language<select id="chart-lang2-quick"><option value="">None</option>${options(I.LANGS, L2())}</select></label>
        <label>Starts on<select id="start-day-quick">${P.DAY_NAMES.map((x) => `<option${x === profile.startDay ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
        <label>Water / day<select id="water-quick">${['', 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((w) => `<option value="${w}"${String(w) === String(profile.waterL || '') ? ' selected' : ''}>${w ? w + ' L' : `Auto (${P.computeTargets({ ...profile, waterL: 0 }).waterL} L)`}</option>`).join('')}</select></label>
      </div>

      <div class="tiles">
        <div class="tile"><span class="tile-label">BMI</span><span class="tile-value">${t.bmi || '—'}</span><span class="tile-sub">${t.bmi ? `${t.bmiCategory} · ideal ${t.idealWeight[0]}–${t.idealWeight[1]} kg` : 'Height/weight not given'}</span></div>
        <div class="tile"><span class="tile-label">Carbs · Fat</span><span class="tile-value">${t.carbs} · ${t.fat} g</span><span class="tile-sub">${pct.c}% · ${pct.f}% energy</span></div>
        <div class="tile"><span class="tile-label">💧 Water</span><span class="tile-value">${t.waterL} L</span><span class="tile-sub">${t.customWater ? 'Custom' : 'Auto'} · fibre ${t.fibre} g+</span></div>
        <div class="tile"><span class="tile-label">Options</span><span class="tile-value">${num(plan.combos.total)}</span><span class="tile-sub">meal combinations</span></div>
      </div>
      <div class="macro-bar" role="img" aria-label="Protein ${pct.p}%, carbs ${pct.c}%, fat ${pct.f}%"><span class="seg-p" style="width:${pct.p}%"></span><span class="seg-c" style="width:${pct.c}%"></span><span class="seg-f" style="width:${pct.f}%"></span></div>
      ${t.warnings.length ? `<div class="alert">${t.warnings.map(esc).join('<br>')}</div>` : ''}

      ${n > 1 ? `<div class="days" role="tablist" style="grid-template-columns:repeat(${n}, minmax(0, 1fr))">
        ${plan.days.map((day, i) => `<button type="button" role="tab" data-day="${i}" aria-selected="${i === activeDay}"><small>Day ${i + 1}</small><b>${day.day.slice(0, 3)}</b></button>`).join('')}
      </div>` : '<div class="spacer"></div>'}
      <div class="day-head">
        <h3>Day ${activeDay + 1} · ${d.day}${L() !== 'en' ? ` <small>${esc(I.dayName(L(), d.day))}</small>` : ''}</h3>
        <div class="day-total"><b>${d.totals.kcal}</b> / ${t.calories} kcal · P ${d.totals.p} g</div>
      </div>
      <div class="meal-list">${d.meals.map((e, mi) => mealCard(e, activeDay, mi)).join('')}</div>

      <div class="card recipe-strip">
        <div class="sec-row"><h3>📖 Recipes in the PDF</h3><button type="button" class="link-btn" id="pick-recipes">${recipes.length ? 'Change' : 'Add recipes'}</button></div>
        ${recipes.length ? `<div class="tags light">${recipes.map((r) => `<span>${IC.foodIcon(dishByName[r])} ${esc(r)}</span>`).join('')}</div><p class="muted">${recipes.length} recipe${recipes.length === 1 ? '' : 's'} will be printed on A4 pages after the chart.</p>` : '<p class="muted">Add recipes of this chart\'s dishes — they print on A4 pages after the diet chart.</p>'}
      </div>
      <div class="card soft">
        <h3>Guidelines</h3>
        <ul>${tipList(t).map((x) => `<li>${esc(I.tipText('en', x))}</li>`).join('')}</ul>
      </div>
      ${showWl() ? `<div class="card soft"><h3>Smart weight-loss foods</h3><div class="tags light">${P.weightLossPicks(DB.FOODS, profile, 14).map((f) => `<span>${IC.foodIcon(f)} ${esc(f.name)}</span>`).join('')}</div></div>` : ''}`;
  }

  result.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const pair = (v) => v.split(':').map(Number);
    if (b.dataset.day) { activeDay = Number(b.dataset.day); saveCurrent(); render(); }
    else if (b.dataset.edit) openEditor(...pair(b.dataset.edit));
    else if (b.dataset.recipe) openRecipeDialog(b.dataset.recipe);
    else if (b.id === 'pick-recipes') openRecipePicker();
    else if (b.dataset.swap) {
      const [di, mi] = pair(b.dataset.swap);
      if (P.swapMeal(DB, profile, plan, di, mi)) { savePlan(); render(); }
    } else if (b.dataset.lock) {
      const [di, mi] = pair(b.dataset.lock);
      plan.days[di].meals[mi].locked = !plan.days[di].meals[mi].locked;
      savePlan();
      render();
    }
  });
  result.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'chart-lang-quick') {
      profile.chartLang = e.target.value;
      if (profile.chartLang2 === profile.chartLang) profile.chartLang2 = '';
    } else if (id === 'chart-lang2-quick') {
      profile.chartLang2 = e.target.value === profile.chartLang ? '' : e.target.value;
    } else if (id === 'start-day-quick') {
      profile.startDay = e.target.value;
      P.planDays(profile.startDay, plan.days.length).forEach(({ day }, i) => { plan.days[i].day = day; });
    } else if (id === 'water-quick') {
      profile.waterL = Number(e.target.value) || 0;
      plan.targets = P.computeTargets(profile);
    } else return;
    writeForm({ chartLang: profile.chartLang, chartLang2: profile.chartLang2 || '', startDay: profile.startDay, waterL: profile.waterL || 0 });
    savePlan();
    render();
  });

  $('#regen').addEventListener('click', () => {
    plan = P.generatePlan(DB, profile, Math.floor(Math.random() * 1e9), { previous: plan });
    savePlan();
    render();
    toast('New plan created — locked meals were kept.');
  });
  $('#pdf-named').addEventListener('click', () => printChart('named'));
  $('#pdf-anon').addEventListener('click', () => printChart('anon'));
  $('#next-week').addEventListener('click', () => nextWeek());
  $('#more').addEventListener('click', () => openSheet([
    ['recipes', '📖', 'Add recipes to the PDF', 'Printed on A4 pages after the chart'],
    ['recipes-print', '🖨️', 'Print recipes only (A4)', 'Every dish in this chart, or the ones you added'],
    ['csv', '📊', 'Export CSV', 'Open in Excel / Google Sheets'],
    ['copy', '📄', 'Save as a copy', 'Keep this version and edit a new one'],
    ['patient', '👤', 'Patient history', 'All charts of this patient'],
  ]));

  function openSheet(items) {
    $('#sheet-body').innerHTML = items.map(([k, icon, label, sub]) => `<button type="button" class="sheet-item" data-sheet="${k}"><span>${icon}</span><span><b>${esc(label)}</b><small>${esc(sub)}</small></span></button>`).join('') + '<button type="button" class="btn ghost sheet-cancel" data-close>Cancel</button>';
    if (actionSheet.showModal) actionSheet.showModal(); else actionSheet.setAttribute('open', '');
  }
  const closeDialog = (d) => { if (d.close) d.close(); else d.removeAttribute('open'); };
  actionSheet.addEventListener('click', (e) => {
    if (e.target === actionSheet) return closeDialog(actionSheet);
    const b = e.target.closest('button');
    if (!b) return;
    closeDialog(actionSheet);
    const k = b.dataset.sheet;
    if (k === 'recipes') openRecipePicker();
    else if (k === 'recipes-print') printRecipes(profile.recipes && profile.recipes.length ? profile.recipes : chartDishes());
    else if (k === 'csv') toCsv();
    else if (k === 'copy') {
      meta = { id: null, week: meta.week, parent: meta.id };
      persistNewChart();
      toast('Saved as a new copy — you are now editing the copy.');
      render();
    } else if (k === 'patient') {
      if (!profile.patientRef) return toast('This is a generic chart (no patient name).');
      viewPatient = profile.patientRef;
      go('patient');
    }
  });

  /** Next week's chart: same patient and settings, every main food changed. */
  function nextWeek() {
    if (!plan) return;
    const prev = plan;
    const p = { ...profile, recipes: [] };
    const np = P.generatePlan(DB, p, Math.floor(Math.random() * 1e9), { avoidPrevious: prev });
    const same = Math.round(P.overlap(np, prev, DB) * 100);
    profile = p;
    plan = np;
    meta = { id: null, week: (meta.week || 1) + 1, parent: meta.id };
    activeDay = 0;
    persistNewChart();
    go('chart');
    render();
    toast(`Week ${meta.week} created — ${100 - same}% of foods changed from the previous week.`);
  }

  function chartDishes() {
    const seen = new Set();
    plan.days.forEach((d) => d.meals.forEach((e) => e.meal && e.meal.items.forEach((i) => { if (!i.custom && dishByName[i.name]) seen.add(i.name); })));
    return [...seen];
  }

  function start(blank) {
    const p = readForm();
    const err = validate(p);
    if (err) { $('#form-error').hidden = false; $('#form-error').textContent = err; return; }
    $('#form-error').hidden = true;
    profile = p;
    const dietitian = {};
    DIETITIAN_FIELDS.forEach((k) => { dietitian[k] = p[k]; });
    save(DIETITIAN_KEY, dietitian);
    activeDay = 0;
    const opts = { blank };
    if (pendingAvoid && !blank) opts.avoidPrevious = pendingAvoid;
    plan = P.generatePlan(DB, profile, Math.floor(Math.random() * 1e9), opts);
    meta = { id: null, week: pendingAvoid ? 2 : 1, parent: null };
    if (!pendingAvoid && p.patientRef) {
      const last = store.listCharts(p.patientRef)[0];
      if (last) meta.week = (last.week || 1) + 1;
    }
    pendingAvoid = null;
    persistNewChart();
    go('chart');
  }
  $('#generate').addEventListener('click', () => start(false));
  $('#manual-start').addEventListener('click', () => start(true));

  /** Start the wizard for a new chart (dietitian and preferences kept, patient cleared). */
  function newChart() {
    clearPatientFields();
    pendingAvoid = null;
    go('s1');
  }

  // ── Meal editor ──────────────────────────────────────────────────
  const editorFilters = { fit: true, wl: false, hp: false, indian: false, world: false, travel: false };
  const EDITOR_FILTER_LABELS = { fit: 'Fits patient', wl: 'Weight loss', hp: 'High protein', indian: 'Indian', world: 'Worldwide', travel: 'Travel' };
  $('#editor-filters').innerHTML = Object.entries(EDITOR_FILTER_LABELS).map(([k, v]) => chip(k, v, editorFilters[k])).join('');

  function openEditor(di, mi) {
    const entry = plan.days[di].meals[mi];
    edit = { di, mi, meal: JSON.parse(JSON.stringify(entry.meal || { items: [] })) };
    $('#editor-title').textContent = `${IC.slotIcon(entry.slot)} ${entry.label} · ${plan.days[di].day}`;
    $('#editor-sub').textContent = `${time12(entry.time)} · target ${entry.target} kcal, ${entry.targetP} g protein`;
    $('#apply-days').innerHTML = plan.days.length > 1 ? plan.days.map((d, i) => (i === di ? '' : chip(i, d.day.slice(0, 3)))).join('') + chip('all', 'All days') : '';
    $('.apply-days').hidden = plan.days.length < 2;
    $('#editor-q').value = '';
    renderEditor();
    renderEditorResults();
    if (editor.showModal) editor.showModal(); else editor.setAttribute('open', '');
  }
  function closeEditor() {
    edit = null;
    closeDialog(editor);
  }
  function renderEditor() {
    const m = P.recalcMeal(edit.meal);
    const entry = plan.days[edit.di].meals[edit.mi];
    $('#editor-items').innerHTML = m.items.length ? m.items.map((i, idx) => `
      <div class="ed-item">
        <div class="ed-name"><b><span class="fi-ico">${iconOf(i)}</span> ${esc(i.name)}</b><small>${i.kcal} kcal · P ${i.p} g · C ${i.c} g · F ${i.f} g</small></div>
        <div class="stepper">
          <button type="button" class="icon-btn" data-dec="${idx}" aria-label="Less">${ICON.minus}</button>
          <span>${esc(i.text)}</span>
          <button type="button" class="icon-btn" data-inc="${idx}" aria-label="More">${ICON.plus}</button>
        </div>
        <button type="button" class="icon-btn danger" data-del="${idx}" aria-label="Remove ${esc(i.name)}">${ICON.trash}</button>
      </div>`).join('') : '<p class="muted">No foods yet — search below to add.</p>';
    const diff = m.kcal - entry.target;
    $('#editor-totals').innerHTML = `<b>${m.kcal} kcal</b> <span class="pill ${Math.abs(diff) > entry.target * 0.2 ? 'warn' : ''}">${diff >= 0 ? '+' : ''}${diff}</span> · Protein ${m.p} g · Carbs ${m.c} g · Fat ${m.f} g`;
  }
  function badges(f) {
    return `${f.flags.includes('wl') ? ' <i class="badge wl">WL</i>' : ''}${P.isHighProtein(f) ? ' <i class="badge hp">HP</i>' : ''}${f.ingKey ? ' <i class="badge ing">Ingredient</i>' : ''}`;
  }
  function renderEditorResults() {
    const list = P.searchFoods(DB.FOODS, $('#editor-q').value, {
      profile: editorFilters.fit ? profile : null,
      wl: editorFilters.wl, hp: editorFilters.hp, indian: editorFilters.indian, world: editorFilters.world, travel: editorFilters.travel,
      category: $('#editor-category').value, sort: $('#editor-sort').value,
    });
    $('#editor-results').innerHTML = list.slice(0, 60).map((f) => `
      <button type="button" class="res" data-add="${f.id}">
        <span class="res-ico">${IC.foodIcon(f)}</span>
        <span class="res-text"><b>${esc(f.name)}</b><small>${esc(f.hi)} · ${esc(P.formatQty(f.qty))} ${esc(f.unit)} · ${f.kcal} kcal · P ${f.p} g${badges(f)}</small></span>
        <span class="add">${ICON.plus}</span>
      </button>`).join('') + (list.length > 60 ? `<p class="muted">${list.length - 60} more — refine your search.</p>` : '') + (list.length ? '' : '<p class="muted">No matching foods. Try another word, or add it below as your own food.</p>');
  }
  editor.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !edit) return;
    if (b.hasAttribute('data-close')) return closeEditor();
    const items = edit.meal.items;
    if (b.dataset.inc || b.dataset.dec) {
      const it = items[Number(b.dataset.inc || b.dataset.dec)];
      const step = P.unitStep(it.unit);
      P.setItemQty(it, Math.max(step, it.qty + (b.dataset.inc ? step : -step)));
      return renderEditor();
    }
    if (b.dataset.del) { items.splice(Number(b.dataset.del), 1); return renderEditor(); }
    if (b.dataset.add) { items.push(P.makeItem(DB.FOODS[Number(b.dataset.add)])); return renderEditor(); }
    if (b.closest('#editor-filters')) {
      const k = b.dataset.value;
      editorFilters[k] = !editorFilters[k];
      if (k === 'indian' && editorFilters.indian) editorFilters.world = false;
      if (k === 'world' && editorFilters.world) editorFilters.indian = false;
      $$('#editor-filters .chip').forEach((c) => c.setAttribute('aria-pressed', String(!!editorFilters[c.dataset.value])));
      return renderEditorResults();
    }
    if (b.closest('#apply-days')) {
      if (b.dataset.value === 'all') {
        const on = b.getAttribute('aria-pressed') !== 'true';
        $$('#apply-days .chip').forEach((c) => c.setAttribute('aria-pressed', String(on)));
      } else b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      return;
    }
    if (b.id === 'cf-add') {
      const name = $('#cf-name').value.trim();
      if (!name) return $('#cf-name').focus();
      const qtyText = $('#cf-qty').value.trim() || '1 serving';
      const m = qtyText.match(/^([\d.]+)\s*(.*)$/);
      items.push(P.customItem(name, m ? m[1] : 1, m ? m[2] || 'serving' : qtyText, $('#cf-kcal').value, $('#cf-protein').value));
      ['#cf-name', '#cf-qty', '#cf-kcal', '#cf-protein'].forEach((s) => { $(s).value = ''; });
      return renderEditor();
    }
    if (b.id === 'editor-save') {
      const { di, mi } = edit;
      const entry = plan.days[di].meals[mi];
      entry.meal = P.recalcMeal(edit.meal);
      entry.meal.name = entry.meal.items.map((i) => i.name).join(' + ');
      entry.locked = true;
      P.refreshDay(plan.days[di]);
      const days = $$('#apply-days .chip[aria-pressed="true"]').map((c) => c.dataset.value).filter((v) => v !== 'all').map(Number);
      if (days.length) P.copyMeal(plan, di, mi, days);
      closeEditor();
      savePlan();
      render();
    }
  });
  $('#editor-q').addEventListener('input', renderEditorResults);
  $('#editor-category').addEventListener('change', renderEditorResults);
  $('#editor-sort').addEventListener('change', renderEditorResults);
  editor.addEventListener('cancel', () => { edit = null; });

  // ── Food library ─────────────────────────────────────────────────
  const libFilters = { wl: 'Weight loss', hp: 'High protein', travel: 'Travel' };
  const libState = {};
  $('#lib-filters').innerHTML = Object.entries(libFilters).map(([k, v]) => chip(k, v)).join('');
  function renderLibrary() {
    const list = P.searchFoods(DB.FOODS, $('#lib-search').value, {
      wl: libState.wl, hp: libState.hp, travel: libState.travel,
      category: $('#lib-category').value, region: $('#lib-region').value, dietExact: $('#lib-diet').value,
      maxKcal: Number($('#lib-kcal').value) || 0, sort: $('#lib-sort').value,
    });
    const shown = list.slice(0, 240);
    $('#lib-count').textContent = `${num(list.length)} of ${num(DB.FOODS.length)} foods (${DISHES.length} dishes with recipes + ${DB.FOODS.length - DISHES.length} ingredients)${list.length > shown.length ? ` · showing first ${shown.length}` : ''}`;
    $('#lib-list').innerHTML = shown.map((f) => `
      <div class="food-card">
        <div class="fc-top"><span class="fc-ico">${IC.foodIcon(f)}</span><div><b>${esc(f.name)}</b><small class="hi">${esc(f.hi)}</small></div><i class="diet-dot ${f.diet}" title="${esc(P.DIETS[f.diet] || f.diet)}"></i></div>
        <small>${f.ingKey ? 'Ingredient · per ' : esc(REGION_LABEL[f.region] || f.region) + ' · '}${esc(P.formatQty(f.qty))} ${esc(f.unit)}</small>
        <div class="fc-nutri"><span><b>${f.kcal}</b> kcal</span><span>P ${f.p}</span><span>C ${f.c}</span><span>F ${f.f}</span></div>
        <div class="fc-badges">${f.flags.includes('wl') ? '<i class="badge wl">Weight loss</i>' : ''}${P.isHighProtein(f) ? '<i class="badge hp">High protein</i>' : ''}${f.flags.includes('tr') ? '<i class="badge tr">Travel</i>' : ''}${f.flags.includes('hgi') ? '<i class="badge warn">High GI</i>' : ''}${f.recipe ? `<button type="button" class="badge rcp" data-open-recipe="${esc(f.name)}">📖 Recipe</button>` : ''}</div>
      </div>`).join('');
  }
  $('#lib-search').addEventListener('input', renderLibrary);
  ['#lib-category', '#lib-region', '#lib-diet', '#lib-kcal', '#lib-sort'].forEach((s) => $(s).addEventListener('change', renderLibrary));
  $('#lib-filters').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    libState[c.dataset.value] = !libState[c.dataset.value];
    c.setAttribute('aria-pressed', String(libState[c.dataset.value]));
    renderLibrary();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-recipe]');
    if (b) { viewRecipe = b.dataset.openRecipe; servings = 1; go('recipe'); }
  });

  // ── Recipes ──────────────────────────────────────────────────────
  const ingName = (lang, x) => (lang === 'en' ? x.name : I.translit(x.hi, I.LANGS[lang].script));
  function recipeData(f, serves) {
    const k = serves || 1;
    return {
      f,
      ing: f.recipe.ing.map(([key, g]) => ({ x: ING[key], g: Math.round(g * k) })),
      steps: RC.steps(f.recipe, ING),
      n: { kcal: f.kcal, p: f.p, c: f.c, f: f.f },
    };
  }
  const gText = (x, g) => `${g} ${x.cat === 'drink' || /milk|water|juice/i.test(x.name) ? 'ml' : 'g'}`;

  function renderRecipes() {
    const list = P.searchFoods(DISHES, $('#rc-search').value, { category: $('#rc-category').value, dietExact: $('#rc-diet').value });
    const shown = list.slice(0, 200);
    $('#rc-count').textContent = `${num(list.length)} of ${num(DISHES.length)} recipes${list.length > shown.length ? ` · showing first ${shown.length}` : ''} · nutrition calculated from ingredients`;
    $('#rc-list').innerHTML = shown.map((f) => `
      <button type="button" class="recipe-card" data-open-recipe="${esc(f.name)}">
        <span class="rcard-ico">${IC.foodIcon(f)}</span>
        <span class="rcard-text"><b>${esc(f.name)}</b><small>${esc(f.hi)}</small>
          <span class="rcard-meta"><i class="diet-dot ${f.diet}"></i>${f.kcal} kcal · P ${f.p} g · ${f.recipe.ing.length} ingredients</span></span>
      </button>`).join('');
  }
  $('#rc-search').addEventListener('input', renderRecipes);
  ['#rc-category', '#rc-diet'].forEach((s) => $(s).addEventListener('change', renderRecipes));

  function recipeBody(f, serves) {
    const r = recipeData(f, serves);
    const k = serves || 1;
    return `
      <div class="rd-nutri">
        <div><b>${Math.round(r.n.kcal * k)}</b><small>kcal</small></div>
        <div><b>${Math.round(r.n.p * k * 10) / 10} g</b><small>protein</small></div>
        <div><b>${Math.round(r.n.c * k)} g</b><small>carbs</small></div>
        <div><b>${Math.round(r.n.f * k * 10) / 10} g</b><small>fat</small></div>
      </div>
      <p class="muted">Serving: ${esc(P.formatQty(f.qty * k))} ${esc(f.unit)} · ${k > 1 ? `${k} servings` : '1 serving'} · ${esc(P.DIETS[f.diet])}</p>
      <h3>Ingredients</h3>
      <ul class="ing-list">${r.ing.map(({ x, g }) => `<li><span>${IC.foodIcon({ name: x.name, cat: x.cat, roles: [] })} ${esc(x.name)} <small>${esc(x.hi)}</small></span><b>${gText(x, g)}</b></li>`).join('')}</ul>
      <h3>Method</h3>
      <ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
  }

  function renderRecipe() {
    const f = dishByName[viewRecipe];
    if (!f) { $('#rc-detail').innerHTML = '<div class="empty">Recipe not found.</div>'; return; }
    $('#screen-title').textContent = f.name;
    const inChart = plan && (profile.recipes || []).includes(f.name);
    $('#rc-detail').innerHTML = `
      <div class="rd-hero"><span class="rd-ico">${IC.foodIcon(f)}</span><div><h2>${esc(f.name)}</h2><p>${esc(f.hi)} · ${esc(REGION_LABEL[f.region] || '')}</p></div></div>
      <div class="card">
        <div class="serv"><span>Servings</span>
          <div class="stepper"><button type="button" class="icon-btn" id="sv-dec" aria-label="Fewer servings">${ICON.minus}</button><span>${servings}</span><button type="button" class="icon-btn" id="sv-inc" aria-label="More servings">${ICON.plus}</button></div>
        </div>
        ${recipeBody(f, servings)}
      </div>
      <div class="btn-row">
        <button type="button" class="btn primary" id="rd-print">${ICON.print} Print A4</button>
        ${plan ? `<button type="button" class="btn" id="rd-add">${inChart ? '✓ In chart PDF' : '📖 Add to chart PDF'}</button>` : ''}
      </div>`;
    $('#sv-dec').addEventListener('click', () => { servings = Math.max(1, servings - 1); renderRecipe(); });
    $('#sv-inc').addEventListener('click', () => { servings = Math.min(12, servings + 1); renderRecipe(); });
    $('#rd-print').addEventListener('click', () => printRecipes([f.name], servings));
    if ($('#rd-add')) $('#rd-add').addEventListener('click', () => { toggleChartRecipe(f.name); renderRecipe(); });
  }

  function toggleChartRecipe(name, on) {
    const list = profile.recipes || (profile.recipes = []);
    const has = list.includes(name);
    const want = on == null ? !has : on;
    if (want && !has) list.push(name);
    if (!want && has) list.splice(list.indexOf(name), 1);
    savePlan();
    toast(want ? `${name}: recipe added to the chart PDF.` : `${name}: recipe removed from the chart PDF.`);
  }

  function openRecipeDialog(name) {
    const f = dishByName[name];
    if (!f) return;
    $('#rd-title').textContent = `${IC.foodIcon(f)} ${f.name}`;
    $('#rd-sub').textContent = `${f.hi} · recipe for 1 serving`;
    $('#rd-body').innerHTML = recipeBody(f, 1);
    const inChart = (profile.recipes || []).includes(name);
    $('#rd-foot').innerHTML = `<button type="button" class="btn ghost" data-close>Close</button><button type="button" class="btn" data-rd-print="${esc(name)}">${ICON.print} Print A4</button><button type="button" class="btn primary" data-rd-toggle="${esc(name)}">${inChart ? 'Remove from PDF' : 'Add to chart PDF'}</button>`;
    if (rdialog.showModal) rdialog.showModal(); else rdialog.setAttribute('open', '');
  }

  function openRecipePicker() {
    const dishes = chartDishes();
    const chosen = new Set(profile.recipes || []);
    $('#rd-title').textContent = '📖 Recipes in the chart PDF';
    $('#rd-sub').textContent = 'Chosen recipes print on A4 pages after the diet chart.';
    const extra = [...chosen].filter((n) => !dishes.includes(n));
    $('#rd-body').innerHTML = `
      <div class="btn-row"><button type="button" class="chip" data-pick-all>Select all (${dishes.length})</button><button type="button" class="chip" data-pick-none>Clear</button></div>
      <div class="pick-list">${[...dishes, ...extra].map((n) => `<label class="pick"><input type="checkbox" value="${esc(n)}"${chosen.has(n) ? ' checked' : ''}><span>${IC.foodIcon(dishByName[n])} ${esc(n)}</span><small>${dishByName[n] ? dishByName[n].kcal + ' kcal' : ''}</small></label>`).join('')}</div>
      <p class="muted">Any other recipe can be added from the Recipes screen.</p>`;
    $('#rd-foot').innerHTML = '<button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn primary" data-pick-save>Save</button>';
    if (rdialog.showModal) rdialog.showModal(); else rdialog.setAttribute('open', '');
  }

  rdialog.addEventListener('click', (e) => {
    if (e.target === rdialog) return closeDialog(rdialog);
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) return closeDialog(rdialog);
    if (b.dataset.rdPrint) { closeDialog(rdialog); return printRecipes([b.dataset.rdPrint], 1); }
    if (b.dataset.rdToggle) { toggleChartRecipe(b.dataset.rdToggle); closeDialog(rdialog); return render(); }
    if (b.hasAttribute('data-pick-all') || b.hasAttribute('data-pick-none')) {
      $$('#rd-body input[type=checkbox]').forEach((c) => { c.checked = b.hasAttribute('data-pick-all'); });
      return;
    }
    if (b.hasAttribute('data-pick-save')) {
      profile.recipes = $$('#rd-body input[type=checkbox]:checked').map((c) => c.value);
      savePlan();
      closeDialog(rdialog);
      render();
      toast(profile.recipes.length ? `${profile.recipes.length} recipes will print after the chart.` : 'No recipes in the PDF.');
    }
  });

  // ── Upload previous chart (PDF) ─────────────────────────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }
  let pdfjsReady = null;
  function pdfjs() {
    if (!pdfjsReady) {
      // The worker script runs on the main thread (works from file:// in the Android and iOS apps).
      pdfjsReady = loadScript('vendor/pdfjs/pdf.worker.min.js').then(() => loadScript('vendor/pdfjs/pdf.min.js')).then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
        return window.pdfjsLib;
      });
    }
    return pdfjsReady;
  }
  async function pdfText(buf) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const parts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      parts.push(tc.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join(' '));
    }
    return parts.join('\n');
  }

  let uploaded = null;
  $('#pdf-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const out = $('#upload-result');
    out.innerHTML = '<div class="card"><div class="spinner"></div> Reading PDF…</div>';
    try {
      const text = await pdfText(await file.arrayBuffer());
      uploaded = store.readPdfText(text, I);
      renderUpload(file.name);
    } catch (err) {
      out.innerHTML = `<div class="alert">Could not read this PDF (${esc(err.message || err)}). Choose a diet chart PDF.</div>`;
    }
  });

  function renderUpload(fileName) {
    const out = $('#upload-result');
    const u = uploaded;
    if (u.exact) {
      const p = u.profile;
      const kcal = u.plan.targets.calories;
      out.innerHTML = `
        <div class="card ok-card">
          <div class="ok-head"><span>✅</span><div><b>Hindivine chart read exactly</b><small>${esc(fileName)}</small></div></div>
          <div class="review-grid">
            <div><span>Patient</span><b>${esc(p.name || 'Generic chart')}</b></div>
            <div><span>Diet</span><b>${esc(P.PLANS[p.plan] ? P.PLANS[p.plan].label : p.plan)} · ${esc(dietText(p))}</b></div>
            <div><span>Target</span><b>${num(kcal)} kcal · ${u.plan.targets.protein} g protein</b></div>
            <div><span>Week</span><b>Week ${u.week} · ${u.plan.days.length} days</b></div>
          </div>
        </div>
        <div class="btn-col">
          <button type="button" class="btn primary" id="up-next">🗓️ Generate next week (Week ${u.week + 1}) — all foods changed</button>
          <button type="button" class="btn" id="up-open">✏️ Open this chart to edit or reprint</button>
        </div>`;
      $('#up-next').addEventListener('click', () => {
        setCurrent({ id: null, week: u.week, parent: null, profile: { ...u.profile }, plan: u.plan });
        nextWeek();
      });
      $('#up-open').addEventListener('click', () => {
        setCurrent({ id: null, week: u.week, parent: null, profile: { ...u.profile }, plan: u.plan });
        persistNewChart();
        go('chart');
      });
    } else if (u.foods.length) {
      out.innerHTML = `
        <div class="card">
          <div class="ok-head"><span>🔎</span><div><b>${u.foods.length} foods found in this chart</b><small>${esc(fileName)} — not made with Hindivine Diet, so patient details are not included.</small></div></div>
          <div class="tags light">${u.foods.map((n) => `<span>${IC.foodIcon(dishByName[n])} ${esc(n)}</span>`).join('')}</div>
        </div>
        <button type="button" class="btn primary wide" id="up-wizard">🗓️ Create next week's chart without these foods</button>`;
      $('#up-wizard').addEventListener('click', () => {
        newChart();
        pendingAvoid = u.foods;
        toast('Fill in the patient details — the foods of the uploaded chart will be changed.');
      });
    } else {
      out.innerHTML = '<div class="alert">No diet chart foods were found in this PDF. If it is a scanned image, type the foods into "Foods to avoid" in a new chart instead.</div>';
    }
  }

  // ── Settings & backup ────────────────────────────────────────────
  function renderSettings() {
    const dt = load(DIETITIAN_KEY) || {};
    $('#set-dietitian').value = dt.dietitian || '';
    $('#set-qualification').value = dt.qualification || '';
    $('#set-phone').value = dt.dietitianPhone || '';
    const combos = P.countCombinations(DB, { plan: 'balanced', diet: 'nonveg', cuisine: 'mix', meals: 6, earlyDrink: true });
    $('#about').innerHTML = `<div class="review-grid">
      <div><span>Dishes with recipes</span><b>${num(DISHES.length)}</b></div>
      <div><span>Ingredients (searchable)</span><b>${num(DB.FOODS.length - DISHES.length)}</b></div>
      <div><span>Meal combinations</span><b>${num(combos.total)}</b></div>
      <div><span>Chart languages</span><b>${I.CODES.length}</b></div>
      <div><span>Saved patients · charts</span><b>${store.listPatients().length} · ${store.listCharts().length}</b></div>
      <div><span>Version</span><b>5.0</b></div>
    </div>`;
  }
  $('#set-save').addEventListener('click', () => {
    const dt = { dietitian: $('#set-dietitian').value.trim(), qualification: $('#set-qualification').value.trim(), dietitianPhone: $('#set-phone').value.trim() };
    save(DIETITIAN_KEY, dt);
    writeForm(dt);
    toast('Dietitian details saved.');
  });
  $('#backup-export').addEventListener('click', () => saveFile(`Hindivine-Diet-Backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', store.exportAll()));
  $('#backup-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = store.importAll(await file.text());
      toast(`Imported ${r.patients} patients and ${r.charts} charts.`);
      renderSettings();
    } catch (err) {
      toast(err.message || 'Not a valid backup file.');
    }
  });
  $('#wipe').addEventListener('click', () => {
    if (!confirm('Delete ALL saved patients and charts from this device? Export a backup first if you need them.')) return;
    storage.removeItem(store.KEYS.patients);
    storage.removeItem(store.KEYS.charts);
    meta.id = null;
    renderSettings();
    toast('All patients and charts deleted.');
  });

  // ── A4 print: diet chart (1–2 pages) + optional recipe pages ────
  const both = (k) => { const a = I.t(L(), k); const b = L2() ? I.t(L2(), k) : ''; return b && b !== a ? `${a} / ${b}` : a; };

  function chartPages(mode, split, tipLimit, wl, compact) {
    const lang = L();
    const lang2 = L2();
    const T = (k) => I.t(lang, k);
    const named = mode === 'named';
    const t = plan.targets;
    const pct = macroPct(t);
    const r = restrictionText(lang);
    const excl = exclusionText(lang);
    const dash = '—';
    const cell = (label, value) => `<th>${esc(label)}</th><td>${value ? esc(value) : '&nbsp;'}</td>`;
    const planLabel = I.label(lang, 'plans', profile.plan) + (profile.travel ? ' · ' + I.label(lang, 'travel', profile.travel) : '');
    const likes = profile.likes.join(', ');
    const sexText = profile.sex ? T(profile.sex === 'male' ? 'male' : 'female') : dash;

    const info = named ? `
      <table class="ps-grid">
        <tr>${cell(T('name'), profile.name)}${cell(T('ageSex'), `${profile.age ? profile.age + ' ' + T('years') : dash} / ${sexText}`)}${cell(T('pid'), profile.patientId)}</tr>
        <tr>${cell(T('height'), profile.heightCm ? `${profile.heightCm} cm` : dash)}${cell(T('weight'), profile.weightKg ? `${profile.weightKg} kg` : dash)}${cell(T('bmi'), t.bmi ? `${t.bmi} (${I.label(lang, 'bmi', t.bmiCategory)})` : dash)}</tr>
        <tr>${cell(T('foodType'), dietText(profile, lang))}${cell(T('ideal'), t.idealWeight ? `${t.idealWeight[0]}–${t.idealWeight[1]} kg` : dash)}${cell(T('mobile'), profile.phone)}</tr>
        <tr><th>${esc(T('conditions'))}</th><td colspan="5">${r.length ? esc(r.join(', ')) : esc(T('none'))}</td></tr>
        ${excl ? `<tr><th>${esc(T('excluded'))}</th><td colspan="5">${esc(excl)}</td></tr>` : ''}
        ${likes ? `<tr><th>${esc(T('likes'))}</th><td colspan="5">${esc(likes)}</td></tr>` : ''}
        ${profile.notes ? `<tr><th>${esc(T('notes'))}</th><td colspan="5">${esc(profile.notes)}</td></tr>` : ''}
      </table>` : `
      <table class="ps-grid">
        <tr>${cell(T('plan'), planLabel)}${cell(T('foodType'), dietText(profile, lang))}${cell(T('goal'), I.label(lang, 'goals', t.goal))}</tr>
        <tr><th>${esc(T('cuisine'))}</th><td colspan="5">${esc(cuisineText(lang))}</td></tr>
        ${r.length || excl ? `<tr><th>${esc(T('suitable'))}</th><td colspan="5">${esc([...r, excl].filter(Boolean).join(', '))}</td></tr>` : ''}
      </table>`;

    const foodCell = (i) => {
      const a = itemName(i, lang);
      const b = lang2 && !i.custom ? itemName(i, lang2) : '';
      return `${esc(a)}${b && b !== a ? ` <i class="l2">(${esc(b)})</i>` : ''} <b>${esc(itemQty(i, lang))}</b>`;
    };
    const dayTable = (d, di) => `
      <table class="ps-day">
        <caption>${esc(T('day'))} ${di + 1} · ${esc(I.dayName(lang, d.day))}${lang2 ? ` / ${esc(I.dayName(lang2, d.day))}` : ''}</caption>
        <tbody>
          ${d.meals.map((e) => `<tr>
            <th class="c-meal"><span class="ps-ico">${IC.slotIcon(e.slot)}</span>${esc(I.label(lang, 'slots', e.slot))}${lang2 && !compact ? `<i class="l2">${esc(I.label(lang2, 'slots', e.slot))}</i>` : ''}<small>${esc(time12(e.time))}${lang2 && compact ? ' · ' + esc(I.label(lang2, 'slots', e.slot)) : ''}</small></th>
            <td>${e.meal && e.meal.items.length ? e.meal.items.map(foodCell).join(' · ') : '&nbsp;'}</td>
            <td class="c-kcal">${e.meal && e.meal.items.length ? e.meal.kcal : ''}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="2">${esc(T('total'))} · ${esc(T('protein'))} ${d.totals.p} g · ${esc(T('carbs'))} ${d.totals.c} g · ${esc(T('fat'))} ${d.totals.f} g</td><td class="c-kcal">${d.totals.kcal}</td></tr></tfoot>
      </table>`;

    const tips = tipList(t).slice(0, tipLimit);
    const picks = wl ? P.weightLossPicks(DB.FOODS, profile, 10).map((f) => I.foodName(lang, f.name)) : [];
    const two = (fn, x) => { const a = fn(lang, x); const b = lang2 && !compact ? fn(lang2, x) : ''; return `${esc(a)}${b && b !== a ? `<i class="l2 blk">${esc(b)}</i>` : ''}`; };

    const head = `
      <header class="ps-head">
        <img src="${BRAND.logo}" alt="${esc(BRAND.company)}">
        <div class="ps-title">
          <h1>${esc(titleFor(lang))}${lang2 ? `<small>${esc(titleFor(lang2))}</small>` : ''}</h1>
          <div class="ps-plan">${esc(planLabel)}${(meta.week || 1) > 1 ? ` · ${esc(T('week'))} ${meta.week}` : ''}</div>
          <div class="ps-web">${esc(BRAND.website)}</div>
        </div>
      </header>
      ${info}
      <div class="ps-targets">
        <div><b>${num(t.calories)}</b>${esc(T('kcalDay'))}</div>
        <div><b>${t.protein} g</b>${esc(T('protein'))} ${pct.p}%</div>
        <div><b>${t.carbs} g</b>${esc(T('carbs'))} ${pct.c}%</div>
        <div><b>${t.fat} g</b>${esc(T('fat'))} ${pct.f}%</div>
        <div><b>💧 ${t.waterL} L</b>${esc(T('water'))}</div>
        <div><b>${t.fibre} g+</b>${esc(T('fibre'))}</div>
      </div>`;
    const notes = `
      <div class="ps-notes">
        <div>
          <h3>${esc(both('guidelines'))}</h3>
          <ul>${tips.map((x) => `<li>${two(I.tipText, x)}</li>`).join('')}</ul>
        </div>
        <div>
          <h3>${esc(both('avoid'))}</h3>
          <ul>${P.avoidList(profile).map((x) => `<li>${two(I.avoidText, x)}</li>`).join('')}</ul>
          ${picks.length ? `<h3 class="mt">${esc(T('wl'))}</h3><p class="ps-wl">${picks.map(esc).join(' · ')}</p>` : ''}
        </div>
      </div>
      <div class="ps-end">
        <div>${profile.dietitian ? `${esc(T('preparedBy'))}: <b>${esc(profile.dietitian)}</b>${profile.qualification ? ', ' + esc(profile.qualification) : ''} · ` : ''}${esc(BRAND.company)}</div>
        <div class="ps-disclaimer">${esc(T('computer'))} ${esc(T('portions'))}</div>
      </div>
      ${promo(lang, lang2)}
      <div class="ps-data" aria-hidden="true"><div>${esc(store.pdfPayload(named ? profile : { ...profile, name: '', patientId: '', phone: '', notes: '', patientRef: null }, plan, meta.week))}</div></div>`;

    const days = plan.days;
    if (split >= days.length) return [`${head}${days.map((d, i) => dayTable(d, i)).join('')}${notes}`];
    return [
      `${head}${days.slice(0, split).map((d, i) => dayTable(d, i)).join('')}`,
      `${days.slice(split).map((d, i) => dayTable(d, i + split)).join('')}${notes}`,
    ];
  }

  function promo(lang, lang2) {
    const a = I.t(lang, 'appPromo');
    const b = lang2 ? I.t(lang2, 'appPromo') : '';
    const en = lang !== 'en' && lang2 !== 'en' ? I.t('en', 'appPromo') : '';
    return `<div class="ps-promo"><span class="ps-promo-ico">📱</span><div><b>${esc(a)}</b>${b && b !== a ? `<small>${esc(b)}</small>` : ''}${en ? `<small>${esc(en)}</small>` : ''}</div><span class="ps-stores"><i>▶ Google Play</i><i> App Store</i></span></div>`;
  }

  function recipeCard(name, serves, big) {
    const f = dishByName[name];
    if (!f) return '';
    const lang = L() || 'en';
    const lang2 = L2();
    const r = recipeData(f, serves);
    const k = serves || 1;
    const nm = (l) => (l === 'en' ? f.name : I.foodName(l, f.name));
    const alt = [lang !== 'en' ? f.name : '', lang2 ? nm(lang2) : ''].filter((x) => x && x !== nm(lang));
    return `<article class="rcp${big ? ' big' : ''}">
      <h2><span class="ps-ico">${IC.foodIcon(f)}</span>${esc(nm(lang))}${alt.length ? `<small>${esc(alt.join(' · '))}</small>` : ''}</h2>
      <div class="rcp-meta"><span>${esc(P.formatQty(f.qty * k))} ${esc(f.unit)}${k > 1 ? ` (${k} × 1 serving)` : ''}</span><span><b>${Math.round(f.kcal * k)}</b> kcal</span><span>${esc(I.t(lang, 'protein'))} <b>${Math.round(f.p * k * 10) / 10} g</b></span><span>${esc(I.t(lang, 'carbs'))} ${Math.round(f.c * k)} g</span><span>${esc(I.t(lang, 'fat'))} ${Math.round(f.f * k * 10) / 10} g</span></div>
      <div class="rcp-body">
        <div><h3>${esc(I.t(lang, 'ingredients'))}</h3><ul>${r.ing.map(({ x, g }) => `<li><span>${esc(ingName(lang, x))}${lang !== 'en' ? ` <i class="l2">${esc(x.name)}</i>` : ''}</span><b>${gText(x, g)}</b></li>`).join('')}</ul></div>
        <div><h3>${esc(I.t(lang, 'method'))}</h3><ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
      </div>
    </article>`;
  }

  const pageHtml = (inner, cls) => `<div class="ps-page${cls ? ' ' + cls : ''}"><div class="ps-inner">${inner}</div></div>`;
  const recipeHead = (lang) => `<header class="ps-head sm"><img src="${BRAND.logo}" alt="${esc(BRAND.company)}"><div class="ps-title"><h1>${esc(I.t(lang, 'recipes'))}${L2() ? `<small>${esc(I.t(L2(), 'recipes'))}</small>` : ''}</h1><div class="ps-web">${esc(BRAND.website)}</div></div></header>`;

  /** Fit each page into one A4 sheet by scaling type down. */
  function fitPages(minScale) {
    let ok = true;
    $$('.ps-page', sheet).forEach((page) => {
      const inner = $('.ps-inner', page);
      let s = 1;
      page.style.setProperty('--s', s);
      while (inner.scrollHeight > page.clientHeight + 1 && s > minScale) {
        s = Math.round((s - 0.03) * 100) / 100;
        page.style.setProperty('--s', s);
      }
      if (inner.scrollHeight > page.clientHeight + 1) ok = false;
    });
    return ok;
  }

  /** Recipe pages: as many recipe cards per A4 page as fit. */
  function layoutRecipes(names, serves, big) {
    const lang = L();
    const pages = [];
    let cur = [];
    const fits = (list) => {
      sheet.innerHTML = pageHtml(recipeHead(lang) + list.map((n) => recipeCard(n, serves, big)).join(''), 'rp');
      return fitPages(0.97);
    };
    names.filter((n) => dishByName[n]).forEach((n) => {
      if (fits([...cur, n])) cur.push(n);
      else { if (cur.length) pages.push(cur); cur = [n]; }
    });
    if (cur.length) pages.push(cur);
    return pages.map((list, i) => recipeHead(lang) + list.map((n) => recipeCard(n, serves, big)).join('') + (i === pages.length - 1 ? promo(lang, L2()) : ''));
  }

  function setPageStyle(total) {
    const footer = [BRAND.company, BRAND.website, profile && profile.dietitianPhone].filter(Boolean).join('  ·  ');
    let st = document.getElementById('ps-page-style');
    if (!st) { st = document.createElement('style'); st.id = 'ps-page-style'; document.head.appendChild(st); }
    st.textContent = `@page { @bottom-left { content: ${JSON.stringify(footer)}; font: 7pt system-ui, sans-serif; color: #7d6f66; }
      @bottom-right { content: ${JSON.stringify(I.t(L(), 'page') + ' ')} counter(page) " / ${total}"; font: 7pt system-ui, sans-serif; color: #7d6f66; } }`;
  }

  function renderPrint(mode) {
    sheet.classList.add('measuring');
    const n = plan.days.length;
    const allTips = tipList(plan.targets).length;
    const splits = [...new Set([...(n <= 3 ? [n] : []), Math.ceil(n / 2), Math.floor(n / 2) || 1, n])].filter((x) => x >= 1);
    const minScale = L2() ? 0.6 : 0.66;
    let pages = null;
    let best = null; // closest layout, if none fits
    outer: for (const compact of L2() ? [false, true] : [false]) {
      for (const split of splits) {
        for (let tipLimit = allTips; tipLimit >= 3; tipLimit--) {
          for (const wl of showWl() ? [true, false] : [false]) {
            const list = chartPages(mode, split, tipLimit, wl, compact);
            sheet.innerHTML = list.map((h) => pageHtml(h)).join('');
            if (fitPages(compact ? minScale : 0.66)) { pages = list; break outer; }
            const over = $$('.ps-page', sheet).reduce((m, pg) => Math.max(m, $('.ps-inner', pg).scrollHeight - pg.clientHeight), 0);
            if (!best || over < best.over) best = { over, list };
          }
        }
      }
    }
    if (!pages) pages = best.list;
    const recipes = (profile.recipes || []).filter((r) => dishByName[r]);
    const rpages = recipes.length ? layoutRecipes(recipes, 1, false) : [];
    sheet.innerHTML = pages.map((h) => pageHtml(h)).join('') + rpages.map((h) => pageHtml(h, 'rp')).join('');
    fitPages(minScale);
    sheet.classList.remove('measuring');
    setPageStyle(pages.length + rpages.length);
  }

  function renderRecipePrint(names, serves) {
    sheet.classList.add('measuring');
    const big = names.length === 1;
    const pages = layoutRecipes(names, serves, big);
    sheet.innerHTML = pages.map((h) => pageHtml(h, 'rp')).join('');
    fitPages(0.7);
    sheet.classList.remove('measuring');
    setPageStyle(pages.length);
  }

  function fileTitle(mode) {
    const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const who = mode === 'named' && profile.name ? slug(profile.name) : 'Generic';
    return ['Hindivine', profile.travel ? 'Travel-Diet-Chart' : 'Diet-Chart', who, `Week${meta.week || 1}`, L().toUpperCase()].join('_');
  }

  function iosHandler(name) {
    const h = window.webkit && window.webkit.messageHandlers;
    return h && h[name] ? h[name] : null;
  }

  function doPrint(title) {
    if (window.AndroidBridge) return window.AndroidBridge.print(title);
    if (iosHandler('hindivinePrint')) return iosHandler('hindivinePrint').postMessage(title);
    const prev = document.title;
    document.title = title; // default PDF file name
    window.addEventListener('afterprint', () => { document.title = prev; }, { once: true });
    window.print();
  }

  function printChart(mode) {
    renderPrint(mode);
    doPrint(fileTitle(mode));
  }

  function printRecipes(names, serves) {
    if (!names.length) return toast('No recipes to print.');
    const saved = profile;
    if (!profile) profile = { chartLang: 'en', chartLang2: '' };
    renderRecipePrint(names, serves || 1);
    const slug = names.length === 1 ? names[0].replace(/[^A-Za-z0-9]+/g, '-') : `${names.length}-Recipes`;
    profile = saved;
    doPrint(`Hindivine_Recipe_${slug}`);
  }

  function saveFile(fileName, mime, content) {
    if (iosHandler('hindivineSave')) return iosHandler('hindivineSave').postMessage({ name: fileName, content });
    if (window.AndroidBridge) return window.AndroidBridge.saveFile(fileName, mime, content);
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function toCsv() {
    const lang = L();
    const rows = [['Day', 'Time', 'Meal', 'Items', `Items (${I.LANGS[lang].name})`, 'kcal', 'Protein (g)', 'Carbs (g)', 'Fat (g)']];
    plan.days.forEach((d) => d.meals.forEach((e) => {
      const m = e.meal;
      rows.push([d.day, time12(e.time), e.label,
        m ? m.items.map((i) => `${i.name} (${i.text})`).join('; ') : '',
        m ? m.items.map((i) => `${itemName(i, lang)} (${itemQty(i, lang)})`).join('; ') : '',
        m ? m.kcal : '', m ? m.p : '', m ? m.c : '', m ? m.f : '']);
    }));
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    saveFile(fileTitle('named') + '.csv', 'text/csv', csv);
  }

  // ── Persistence & start ──────────────────────────────────────────
  function save(key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (_) { /* storage full or unavailable */ }
  }
  function load(key) {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; }
  }
  function saveCurrent() {
    save(CURRENT_KEY, { profile, meta, activeDay, data: plan ? store.packPlan(plan) : null });
  }
  /** Save the current chart (and its patient) to the saved charts list. */
  function savePlan() {
    if (plan) {
      const rec = store.saveChart({ id: meta.id, profile, plan, week: meta.week, parent: meta.parent });
      if (rec) meta.id = rec.id;
      else toast('Storage is full — export a backup and delete old charts.');
    }
    saveCurrent();
  }
  function persistNewChart() {
    meta.id = null;
    savePlan();
  }

  const savedDietitian = load(DIETITIAN_KEY);
  if (savedDietitian) writeForm(savedDietitian);
  const saved = load(CURRENT_KEY);
  try {
    if (saved && saved.profile && saved.data && P.PLANS[saved.profile.plan]) {
      profile = saved.profile;
      plan = store.unpackPlan(saved.data, profile);
      meta = saved.meta || meta;
      activeDay = Math.min(saved.activeDay || 0, plan.days.length - 1);
      if (!profile.recipes) profile.recipes = [];
      writeForm(profile);
    } else {
      const old = load(LEGACY_KEY); // chart from version 4
      if (old && old.profile && old.plan && P.PLANS[old.profile.plan]) {
        profile = { ...old.profile, recipes: [] };
        plan = old.plan;
        writeForm(profile);
        persistNewChart();
      }
    }
  } catch (_) { plan = null; profile = null; }
  show(location.hash.slice(1) || 'home');

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }
})();
