/*
 * Hindivine Admin — data and business rules: team, products, sales, stock,
 * purchases, incentives, salary, expenses, renewals, reports and the rows for
 * Google Sheets. Everything lives in one JSON document in localStorage.
 * No DOM access: works in the browser and in Node (tests).
 */
(function (root) {
  const KEY = 'hindivine.admin.v1';
  // Settings that stay on each device and never go to the shared Google Sheet.
  const LOCAL_SETTINGS = ['sheetsUrl', 'sheetsSecret', 'autoSync', 'lastSync'];

  const KINDS = { injection: 'Injection', protein: 'Protein', other: 'Other' };
  const SALE_TYPES = { injection: 'Injection', protein: 'Protein', diet: 'Diet Support' };
  const EXPENSE_CATEGORIES = ['Salary', 'Incentive', 'Rent', 'Electricity', 'Courier', 'Marketing',
    'Protein Purchase', 'Injection Purchase', 'Miscellaneous'];
  const SHEETS = ['Dashboard', 'Appointments', 'Leads', 'Patients', 'Injection Sales', 'Protein Sales', 'Diet Support', 'Purchases',
    'Inventory', 'Team', 'Incentives', 'Salary', 'Expenses', 'Renewals', 'Activity Log'];

  // Login roles. Every person can have their own login (name + PIN), shared through the Google Sheet.
  const ROLES = { super: 'Super Admin', admin: 'Admin', manager: 'Manager', desk: 'Front Desk' };
  // Choice lists that the admins can extend ("+ Add new") from any form.
  const DEFAULT_LISTS = {
    expenseCategories: EXPENSE_CATEGORIES,
    services: ['Weight loss consultation', 'Mounjaro injection', 'Wegovy injection', 'Ozempic injection', 'Diet plan', 'Follow-up visit', 'Body composition analysis'],
    leadSources: ['Instagram', 'Facebook', 'Google', 'Website', 'WhatsApp', 'Walk-in', 'Referral', 'Phone call', 'Other'],
    leadStatuses: ['New', 'Contacted', 'Interested', 'Follow-up', 'Appointment booked', 'Converted', 'Not interested', 'Lost'],
    payMethods: ['Cash', 'UPI', 'Card', 'Bank transfer'],
    doctors: ['Consulting Doctor'],
    clinics: ['Hindivine Healthcare'],
    designations: ['Doctor', 'Dietitian', 'Counsellor', 'Front Desk', 'Manager', 'Nurse', 'Pharmacist'],
  };
  // Built-in expense categories the app books by itself; they can't be removed.
  const LOCKED_LIST_ITEMS = { expenseCategories: ['Salary', 'Incentive', 'Protein Purchase', 'Injection Purchase', 'Miscellaneous'], leadStatuses: ['New', 'Converted'] };
  const LEAD_PRIORITIES = { hot: 'Hot', warm: 'Warm', cold: 'Cold' };
  // What each role can open. Super Admin always has everything; the others are editable in Settings.
  const DEFAULT_PERMS = {
    admin: { screens: ['dashboard', 'today', 'appointments', 'leads', 'sell', 'sales', 'patients', 'renewals', 'products', 'inventory', 'purchases', 'team', 'incentives', 'salary', 'expenses', 'reports', 'activity'], del: true },
    manager: { screens: ['dashboard', 'today', 'appointments', 'leads', 'sell', 'sales', 'patients', 'renewals', 'products', 'inventory', 'purchases', 'expenses', 'reports', 'activity'], del: false },
    desk: { screens: ['appointments', 'leads'], del: false },
  };
  const KIT_DEFAULTS = [['Travel Bags', 1], ['Ice Gel Packs', 1], ['Alcohol Swabs', 16], ['Needles', 2]];
  const LOG_MAX = 3000;
  const DEFAULT_LEGAL_NOTE = 'This is a computer-generated document and does not require a signature. GST is not applicable on this invoice (non-GST). '
    + 'Medicines and products once sold are not returnable. All treatment is given on the advice of the consulting doctor. Subject to local jurisdiction.';
  const APPT_MODES = { clinic: 'Clinic visit', online: 'Online' };
  const APPT_STATUS = { booked: 'Booked', completed: 'Completed', cancelled: 'Cancelled', noshow: 'No-show' };
  const PAY_METHODS = ['Cash', 'UPI', 'Card', 'Bank transfer'];

  const INJECTIONS = [
    ['Mounjaro', ['2.5mg', '5mg', '10mg', '15mg']],
    ['Wegovy', ['0.25mg', '1mg', '2.4mg']],
    ['Ozempic', ['0.25mg', '1mg']],
  ];
  const OTHER_CATEGORIES = ['Needles', 'Alcohol Swabs', 'Insulin Syringes', 'Ice Gel Packs', 'Travel Bags'];

  function defaultState() {
    const items = [];
    let n = 0;
    const add = (o) => items.push({
      id: 'i' + (++n), price: 0, incentive: null, opening: 0, lowAt: 5, unit: 'pcs', disabled: false, ...o,
    });
    INJECTIONS.forEach(([brand, doses]) => doses.forEach((dose) => add({
      kind: 'injection', category: 'Injection', brand, name: `${brand} ${dose}`, unit: 'pen', lowAt: 2,
    })));
    add({ kind: 'protein', category: 'Protein', brand: '', name: 'Protein Sachets', unit: 'sachet', lowAt: 20 });
    OTHER_CATEGORIES.forEach((c) => add({ kind: 'other', category: c, brand: '', name: c, lowAt: 20 }));
    applyItemDefaults(items);
    return {
      version: 1,
      settings: {
        clinic: 'Hindivine Healthcare',
        clinicAddress: '', clinicPhone: '', clinicEmail: '',
        waOn: false, waAutoLead: true, // WhatsApp (Heyo / MyOperator) inbox; new numbers become leads
        waLeadPhrases: ['Hello! Can I get more info on this?'], // a new number becomes a lead only if its message contains one (empty = any message)
        // MyOperator / Heyo panel opened inside the Android app: chats it loads are read and synced.
        heyoUrl: 'https://in.app.myoperator.com/chat', heyoAuto: true, heyoEvery: 5, heyoAssign: true, waNumber: '',
        heyoAgents: {}, heyoSeen: [], // panel agent name (lower case) → login id; agent names seen so far
        invoicePrefix: 'HV',
        invoiceItemName: 'Weight Loss Program', // what purchase invoices call the item (instead of the product name) // invoice numbers: HV/INV/26-27/0001 (purchases), HV/OPD/26-27/0001 (OPD)
        legalNote: DEFAULT_LEGAL_NOTE, // terms printed on invoices
        docNote: 'This is a computer-generated document and does not require a signature. Confidential: for clinic use only.', // on reports and slips
        incentive: { injection: 1000, protein: 500 },
        dietPlans: [
          { id: 'd1', name: '1 Month', months: 1, price: 0, incentive: 1000, disabled: false },
          { id: 'd3', name: '3 Month', months: 3, price: 0, incentive: 2000, disabled: false },
        ],
        renewalDays: [75, 90], // renewal alert at 75 days, overdue at 90
        consultFee: 1000, // OPD consultation fee (₹)
        activeDays: 90,
        purchaseExpense: true, // purchases also book an expense
        stockAlerts: true, // low-stock alerts (each item can also be switched off)
        kitOn: true, // every injection sold also takes its kit out of stock
        kit: kitDefaults(items), // [{ itemId, qty }] per injection pen
        lists: JSON.parse(JSON.stringify(DEFAULT_LISTS)),
        perms: JSON.parse(JSON.stringify(DEFAULT_PERMS)),
        sheetsUrl: '', sheetsSecret: '', autoSync: false, lastSync: 0,
      },
      categories: [{ name: 'Injection', kind: 'injection' }, { name: 'Protein', kind: 'protein' },
        ...OTHER_CATEGORIES.map((name) => ({ name, kind: 'other' }))],
      items, team: [], patients: [], sales: [], purchases: [], expenses: [], moves: [], renewalsDone: {}, appointments: [],
      leads: [], log: [],
      accounts: [
        { id: 'super', name: 'Super Admin', role: 'super', hash: '', salt: '', len: 0, pin: '' },
        { id: 'admin', name: 'Admin', role: 'admin', hash: '', salt: '', len: 0, pin: '' },
        { id: 'manager', name: 'Manager', role: 'manager', hash: '', salt: '', len: 0, pin: '' },
        { id: 'desk', name: 'Front Desk', role: 'desk', hash: '', salt: '', len: 0, pin: '' },
      ],
    };
  }
  // "Order required" when stock falls below 2 for protein and Mounjaro 10mg / 15mg (editable per item).
  function applyItemDefaults(items) {
    items.forEach((it) => {
      if (it.orderAt === undefined) it.orderAt = it.kind === 'protein' || /^mounjaro (10|15)\s*mg$/i.test(it.name) ? 2 : null;
      if (it.alertOff === undefined) it.alertOff = false;
    });
  }
  function kitDefaults(items) {
    return KIT_DEFAULTS.map(([name, qty]) => { const it = items.find((i) => i.name === name); return it ? { itemId: it.id, qty } : null; }).filter(Boolean);
  }

  // ── Small helpers ─────────────────────────────────────────────
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
  const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f ? f(x) : x) || 0), 0);
  const low = (s) => String(s == null ? '' : s).trim().toLowerCase();
  const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
  const pad = (x) => String(x).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
  const inRange = (date, range) => !range || ((!range.from || date >= range.from) && (!range.to || date <= range.to));
  const monthOf = (date) => String(date).slice(0, 7);

  /** Named periods for filters: today, month, lastMonth, year, all. */
  function rangeFor(name, today) {
    const t = parseDate(today);
    const y = t.getFullYear(); const m = t.getMonth();
    switch (name) {
      case 'today': return { from: today, to: today };
      case 'month': return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) };
      case 'lastMonth': return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) };
      case 'year': return { from: `${y}-01-01`, to: `${y}-12-31` };
      default: return null;
    }
  }

  function monthRange(month) {
    const [y, m] = month.split('-').map(Number);
    return { from: `${month}-01`, to: isoDate(new Date(y, m, 0)) };
  }

  /**
   * Split an incentive between references. refs: [{memberId, pct}]; percentages
   * are normalised to 100 and the rounding remainder goes to the first reference.
   */
  function splitIncentive(total, refs) {
    const list = refs.filter((r) => r && r.memberId);
    if (!list.length) return [];
    const pctSum = sum(list, (r) => r.pct);
    const pcts = pctSum > 0 ? list.map((r) => (Number(r.pct) || 0) * 100 / pctSum) : list.map(() => 100 / list.length);
    const amounts = pcts.map((p) => Math.floor(total * p / 100));
    amounts[0] += Math.round(total - sum(amounts));
    return list.map((r, i) => ({ memberId: r.memberId, pct: r2(pcts[i]), amount: amounts[i] }));
  }

  // Product matching for scanned invoices: "MOUNJARO KWIKPEN 2.5 MG/0.5ML" → Mounjaro 2.5mg.
  const doseOf = (s) => {
    const m = low(s).match(/(\d+(?:\.\d+)?)\s*mg\b/);
    return m ? String(Number(m[1])) : null;
  };
  const words = (s) => low(s).replace(/(\d)\s*mg\b/g, '$1mg').split(/[^a-z0-9.]+/).filter((w) => w.length > 1);

  function matchItem(items, name) {
    const text = low(name);
    if (!text) return null;
    const exact = items.find((i) => low(i.name) === text);
    if (exact) return exact;
    const dose = doseOf(text);
    let best = null; let bestScore = 0;
    for (const it of items) {
      if (it.brand) {
        if (!text.includes(low(it.brand))) continue;
        const d = doseOf(it.name);
        if (d && dose) { if (d === dose) return it; continue; }
      }
      const iw = words(it.name);
      const tw = new Set(words(text).map((w) => w.replace(/s$/, '')));
      const hits = iw.filter((w) => tw.has(w.replace(/s$/, ''))).length;
      const score = iw.length ? hits / iw.length : 0;
      if (score > bestScore) { best = it; bestScore = score; }
    }
    return bestScore >= 0.5 ? best : null;
  }

  // ── Store ─────────────────────────────────────────────────────
  function createAdmin(storage, clock) {
    const today = () => isoDate(clock ? clock() : new Date());
    let S = load();
    const listeners = [];
    // Change tracking for merging with other devices: every record that changes gets _t (time);
    // every record that disappears is remembered in S.deleted so a merge can drop it everywhere.
    let seen = new Map();
    const remember = () => { seen = new Map(); eachRecord(S, (key, rec) => seen.set(key, recHash(rec))); seen.set('settings', recHash(sharedSettings(S.settings))); };
    function stampChanges() {
      const now = clock ? clock().getTime() : Date.now();
      const keys = new Set();
      eachRecord(S, (key, rec) => { keys.add(key); const h = recHash(rec); if (seen.get(key) !== h) { rec._t = now; seen.set(key, recHash(rec)); } });
      seen.forEach((_, key) => { if (key !== 'settings' && !keys.has(key)) { S.deleted = S.deleted || {}; S.deleted[key] = now; seen.delete(key); } });
      const sh = recHash(sharedSettings(S.settings));
      if (seen.get('settings') !== sh) { S.settings._t = now; seen.set('settings', recHash(sharedSettings(S.settings))); }
      // Forget deletions older than 90 days.
      if (S.deleted) Object.keys(S.deleted).forEach((k) => { if (now - S.deleted[k] > 90 * 86400000) delete S.deleted[k]; });
    }
    remember();

    function load() {
      let s = null;
      try { s = JSON.parse(storage.getItem(KEY) || 'null'); } catch (_) { s = null; }
      const d = defaultState();
      if (!s || typeof s !== 'object') return d;
      Object.keys(d).forEach((k) => { if (s[k] == null) s[k] = d[k]; });
      const hadKit = s.settings && s.settings.kit;
      s.settings = { ...d.settings, ...s.settings, incentive: { ...d.settings.incentive, ...(s.settings || {}).incentive } };
      s.settings.lists = { ...JSON.parse(JSON.stringify(DEFAULT_LISTS)), ...(s.settings.lists || {}) };
      s.settings.perms = { ...JSON.parse(JSON.stringify(DEFAULT_PERMS)), ...(s.settings.perms || {}) };
      if (!hadKit) s.settings.kit = kitDefaults(s.items);
      applyItemDefaults(s.items);
      // Older versions: logins were three fixed roles (and before that one PIN in settings).
      if (s.users) {
        s.accounts = d.accounts.map((acc) => {
          const u = s.users[acc.id];
          return u ? { ...acc, name: u.name || acc.name, hash: u.hash || '', salt: u.salt || '', len: u.len || 0 } : acc;
        });
        delete s.users;
      }
      if (s.settings.pinHash && !s.accounts.find((a) => a.id === 'super').hash) Object.assign(s.accounts.find((a) => a.id === 'super'), { hash: s.settings.pinHash, salt: s.settings.pinSalt });
      ['pinHash', 'pinSalt', 'apiKey', 'aiModel', 'autoSaveScan'].forEach((k) => { delete s.settings[k]; });
      if (s.settings.renewalDays[0] === 60 && s.settings.renewalDays[1] === 90) s.settings.renewalDays = [75, 90];
      return s;
    }
    function save(source) {
      if (source === 'remote') remember(); else stampChanges();
      try { storage.setItem(KEY, JSON.stringify(S)); } catch (_) { throw new Error('Storage is full: export a backup and remove old data.'); }
      listeners.forEach((f) => f(source || 'local'));
    }
    const fail = (msg) => { throw new Error(msg); };
    let actor = '';
    /** Every change is written to the activity log with who made it. */
    function log(action, detail) {
      S.log.push({ at: clock ? clock().getTime() : Date.now(), by: actor || 'System', action, detail: String(detail || '') });
      if (S.log.length > LOG_MAX) S.log.splice(0, S.log.length - LOG_MAX);
    }

    // Team
    const member = (id) => S.team.find((m) => m.id === id) || null;
    const memberName = (id) => (member(id) || {}).name || '—';
    const TEAM_FIELDS = ['name', 'designation', 'mobile', 'salary', 'incentiveOn', 'joiningDate', 'incInjection', 'incProtein', 'payMode'];
    const numOrNull = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
    function saveMember(input) {
      if (!low(input.name)) fail('Name is required');
      let m = input.id && member(input.id);
      const isNew = !m;
      if (!m) { m = { id: uid('m'), disabled: false, created: Date.now() }; S.team.push(m); }
      TEAM_FIELDS.forEach((k) => { if (k in input) m[k] = input[k]; });
      m.salary = Number(m.salary) || 0;
      m.incentiveOn = m.incentiveOn !== false;
      // Personal incentive rates; blank = the clinic default (₹1000 per injection, ₹500 per protein sale).
      m.incInjection = numOrNull(m.incInjection);
      m.incProtein = numOrNull(m.incProtein);
      // What counts in this person's monthly pay: salary + incentive, salary only or incentive only.
      if (!['both', 'salary', 'incentive'].includes(m.payMode)) m.payMode = 'both';
      log(isNew ? 'Team member added' : 'Team member updated', m.name);
      save();
      return m;
    }
    function setMemberDisabled(id, disabled) { const m = member(id); if (m) { m.disabled = !!disabled; log(disabled ? 'Team member disabled' : 'Team member enabled', m.name); save(); } }
    function deleteMember(id) {
      // Sales keep the reference name, so history stays readable.
      const m = member(id);
      S.team = S.team.filter((x) => x.id !== id);
      S.accounts.forEach((a) => { if (a.memberId === id) a.memberId = ''; });
      log('Team member deleted', m ? m.name : id);
      save();
    }
    /** Incentive rate for one person: their own rate, else the product's, else the clinic default. */
    // Incentive per unit: this person for this product → this product → this person's rate → the default.
    function rateFor(m, type, it) {
      const pp = m && it && m.rates ? m.rates[it.id] : null;
      if (pp != null) return pp;
      if (it && it.incentive != null) return it.incentive;
      const own = m && (type === 'injection' ? m.incInjection : type === 'protein' ? m.incProtein : null);
      if (own != null) return own;
      return S.settings.incentive[type] || 0;
    }
    /** Product-wise incentive: memberId '' sets the product's rate for everyone; value '' clears it. */
    function setRate(memberId, itemId, value) {
      const v = numOrNull(value);
      if (v != null && v < 0) fail('Incentive cannot be negative');
      const plan = S.settings.dietPlans.find((p) => p.id === itemId);
      const it = item(itemId);
      if (!plan && !it) fail('Product not found');
      if (!memberId) {
        if (plan) plan.incentive = v == null ? 0 : v; else it.incentive = v;
        log('Incentive changed', `${(plan || it).name}: ${v == null ? 'default' : `₹${v}`}`);
      } else {
        const m = member(memberId);
        if (!m) fail('Team member not found');
        m.rates = m.rates || {};
        if (v == null) delete m.rates[itemId]; else m.rates[itemId] = v;
        log('Incentive changed', `${m.name} · ${(plan || it).name}: ${v == null ? 'default' : `₹${v}`}`);
      }
      save();
    }

    // Items, categories, stock
    const item = (id) => S.items.find((i) => i.id === id) || null;
    const itemsOf = (kind, all) => S.items.filter((i) => i.kind === kind && (all || !i.disabled));
    function saveItem(input) {
      if (!low(input.name)) fail('Name is required');
      let it = input.id && item(input.id);
      if (!it) {
        it = { id: uid('i'), brand: '', price: 0, incentive: null, opening: 0, lowAt: 5, unit: 'pcs', disabled: false };
        S.items.push(it);
      }
      const isNew = !input.id;
      ['name', 'brand', 'category', 'kind', 'price', 'incentive', 'opening', 'lowAt', 'unit', 'disabled', 'alertOff', 'orderAt'].forEach((k) => {
        if (k in input) it[k] = input[k];
      });
      it.alertOff = !!it.alertOff;
      it.orderAt = it.orderAt === '' || it.orderAt == null ? null : Number(it.orderAt);
      const cat = S.categories.find((c) => c.name === it.category);
      if (!cat) S.categories.push({ name: it.category || 'Other', kind: it.kind || 'other' });
      it.kind = it.kind || (cat ? cat.kind : 'other');
      ['price', 'opening', 'lowAt'].forEach((k) => { it[k] = Number(it[k]) || 0; });
      it.incentive = it.incentive === '' || it.incentive == null ? null : Number(it.incentive);
      log(isNew ? 'Item added' : 'Item updated', it.name);
      save();
      return it;
    }
    function deleteItem(id) {
      if (S.moves.some((mv) => mv.itemId === id)) fail('This item has stock history. Disable it instead.');
      const it = item(id);
      S.items = S.items.filter((i) => i.id !== id);
      S.settings.kit = S.settings.kit.filter((k) => k.itemId !== id);
      log('Item deleted', it ? it.name : id);
      save();
    }
    function addCategory(name, kind) {
      const n = String(name || '').trim();
      if (!n) fail('Category name is required');
      if (S.categories.some((c) => low(c.name) === low(n))) fail('That category already exists');
      S.categories.push({ name: n, kind: kind || 'other' });
      log('Category added', n);
      save();
    }
    function renameCategory(oldName, name) {
      const n = String(name || '').trim();
      const c = S.categories.find((x) => x.name === oldName);
      if (!c || !n) fail('Enter a category name');
      if (S.categories.some((x) => x !== c && low(x.name) === low(n))) fail('That category already exists');
      S.items.forEach((i) => { if (i.category === oldName) i.category = n; });
      c.name = n;
      log('Category renamed', `${oldName} → ${n}`);
      save();
    }
    function deleteCategory(name) {
      if (S.items.some((i) => i.category === name)) fail('Move or delete the items in this category first');
      S.categories = S.categories.filter((c) => c.name !== name);
      log('Category deleted', name);
      save();
    }
    /** Kit taken out of stock with every injection pen (needles, swabs, ice gel, travel bag…). */
    function setKit(kit) {
      S.settings.kit = (kit || []).filter((k) => k.itemId && item(k.itemId) && Number(k.qty) > 0).map((k) => ({ itemId: k.itemId, qty: Number(k.qty) }));
      log('Injection kit updated', S.settings.kit.map((k) => `${item(k.itemId).name} ${k.qty}`).join(', '));
      save();
    }
    function stockOf(itemId, until) {
      const it = item(itemId);
      if (!it) return 0;
      return it.opening + sum(S.moves.filter((m) => m.itemId === itemId && (!until || m.date <= until)), (m) => m.qty);
    }
    function adjustStock(itemId, qty, note, date) {
      if (!item(itemId)) fail('Unknown item');
      if (!Number(qty)) fail('Enter a quantity');
      S.moves.push({ id: uid('v'), itemId, qty: Number(qty), type: 'adjust', ref: note || '', date: date || today() });
      log('Stock adjusted', `${item(itemId).name} ${Number(qty) > 0 ? '+' : ''}${qty}${note ? ` (${note})` : ''}`);
      save();
    }
    // Low-stock alerts can be switched off for the whole clinic or per item.
    const lowStock = () => (S.settings.stockAlerts === false ? [] : S.items.filter((i) => !i.disabled && !i.alertOff && stockOf(i.id) <= i.lowAt)
      .map((i) => ({ item: i, stock: stockOf(i.id) })));
    const orderRequired = () => S.items.filter((i) => !i.disabled && i.orderAt != null && stockOf(i.id) < i.orderAt)
      .map((i) => ({ item: i, stock: stockOf(i.id) }));

    // Patients
    // Patient details given with a sale or appointment (age, gender, city, weight, height) update the patient record.
    const PATIENT_EXTRA = ['age', 'gender', 'city', 'weight', 'height'];
    function findOrCreatePatient(name, mobile, extra) {
      const nm = String(name || '').trim();
      if (!nm) fail('Patient name is required');
      const ph = digits(mobile);
      let p = (ph && S.patients.find((x) => digits(x.mobile) === ph && low(x.name) === low(nm)))
        || (ph && S.patients.find((x) => digits(x.mobile) === ph))
        || (!ph && S.patients.find((x) => low(x.name) === low(nm) && !digits(x.mobile)));
      if (!p) { p = { id: uid('p'), name: nm, mobile: String(mobile || '').trim(), created: today() }; S.patients.push(p); }
      if (extra) PATIENT_EXTRA.forEach((k) => { const v = extra[k]; if (v != null && String(v).trim() !== '') p[k] = String(v).trim(); });
      return p;
    }
    const patientSales = (pid) => S.sales.filter((s) => s.patientId === pid).sort((a, b) => (a.date < b.date ? -1 : 1));
    function updatePatient(id, input) {
      const p = S.patients.find((x) => x.id === id);
      if (!p) fail('Patient not found');
      const nm = String(input.name || '').trim();
      if (!nm) fail('Patient name is required');
      p.name = nm; p.mobile = String(input.mobile || '').trim();
      ['age', 'gender', 'city', 'notes', 'weight', 'height'].forEach((k) => { if (k in input) p[k] = input[k]; });
      S.sales.forEach((x) => { if (x.patientId === id) { x.patientName = p.name; x.mobile = p.mobile; } });
      S.appointments.forEach((x) => { if (x.patientId === id) { x.patientName = p.name; x.mobile = p.mobile; } });
      log('Patient updated', p.name);
      save();
      return p;
    }
    /** Delete a patient. With withRecords, their sales (stock goes back) and appointments go too. */
    function deletePatient(id, withRecords) {
      const p = S.patients.find((x) => x.id === id);
      if (!p) fail('Patient not found');
      const saleIds = S.sales.filter((x) => x.patientId === id).map((x) => x.id);
      const appts = S.appointments.filter((x) => x.patientId === id).length;
      if ((saleIds.length || appts) && !withRecords) fail(`${p.name} has ${saleIds.length} sales and ${appts} appointments`);
      S.sales = S.sales.filter((x) => x.patientId !== id);
      S.moves = S.moves.filter((m) => !saleIds.includes(m.ref));
      S.appointments = S.appointments.filter((x) => x.patientId !== id);
      S.leads.forEach((l) => { if (l.patientId === id) l.patientId = ''; });
      S.patients = S.patients.filter((x) => x.id !== id);
      log('Patient deleted', `${p.name}${saleIds.length || appts ? ` with ${saleIds.length} sales and ${appts} appointments` : ''}`);
      save();
    }

    // Sales
    function incentiveFor(input) {
      if (input.type === 'diet') {
        const plan = S.settings.dietPlans.find((p) => p.id === input.planId);
        return plan ? Number(plan.incentive) || 0 : 0;
      }
      const it = item(input.itemId);
      const base = it && it.incentive != null ? it.incentive : S.settings.incentive[input.type] || 0;
      // Injections pay per pen; a protein sale pays once, whatever the quantity.
      return input.type === 'injection' ? base * (Number(input.qty) || 1) : base;
    }

    /**
     * Each reference earns their own rate × their share: injection per pen, protein once per sale,
     * diet support by plan. Incentive status Off = ₹0.
     */
    function splitsFor(input, refs) {
      const units = input.type === 'injection' ? (Number(input.qty) || 1) : 1;
      const plan = input.type === 'diet' ? S.settings.dietPlans.find((p) => p.id === input.planId) : null;
      const it = input.type === 'diet' ? null : item(input.itemId);
      const planRate = (m) => { const own = plan && m && m.rates ? m.rates[plan.id] : null; return own != null ? own : plan ? Number(plan.incentive) || 0 : 0; };
      const bases = refs.map((r) => (input.type === 'diet' ? planRate(member(r.memberId)) : rateFor(member(r.memberId), input.type, it) * units));
      const same = bases.every((b) => b === bases[0]);
      // Same rate for everyone: split exactly (remainder to the first); otherwise each gets rate × share.
      const parts = same ? splitIncentive(bases[0], refs) : refs.map((r, i) => ({ memberId: r.memberId, pct: r.pct, amount: Math.round(bases[i] * r.pct / 100) }));
      return parts.map((x) => {
        const m = member(x.memberId);
        return { ...x, name: m ? m.name : '—', amount: m && m.incentiveOn === false ? 0 : x.amount };
      });
    }
    function previewSplits(input) {
      if (!input.refId) return [];
      const refs = [{ memberId: input.refId, pct: 100 }];
      if (input.sharedId && input.sharedId !== input.refId) {
        const pct = input.sharePct == null || input.sharePct === '' ? 50 : Math.min(100, Math.max(0, Number(input.sharePct)));
        refs[0].pct = 100 - pct; refs.push({ memberId: input.sharedId, pct });
      }
      return splitsFor(input, refs);
    }
    /** Kit moves for an injection sale (per pen), when switched on. */
    const kitFor = (sale) => (sale.type === 'injection' && S.settings.kitOn !== false ? S.settings.kit.filter((k) => item(k.itemId)).map((k) => ({ itemId: k.itemId, qty: k.qty * sale.qty })) : []);

    function buildSale(input, id) {
      const type = input.type;
      if (!SALE_TYPES[type]) fail('Unknown sale type');
      const date = input.date || today();
      const amount = Number(input.amount);
      if (!(amount >= 0) || input.amount === '' || input.amount == null) fail('Sale amount is required');
      const qty = type === 'diet' ? 1 : Number(input.qty) || 1;
      if (qty <= 0) fail('Quantity must be more than 0');
      let product = '';
      if (type === 'diet') {
        const plan = S.settings.dietPlans.find((p) => p.id === input.planId);
        if (!plan) fail('Choose a diet plan');
        product = `Diet Support ${plan.name}`;
      } else {
        const it = item(input.itemId);
        if (!it || it.kind !== type) fail(`Choose a ${SALE_TYPES[type].toLowerCase()} product`);
        product = it.name;
      }
      if (!input.refId) fail('Choose the reference team member');
      const refs = [{ memberId: input.refId, pct: 100 }];
      if (input.sharedId && input.sharedId !== input.refId) {
        const pct = input.sharePct == null || input.sharePct === '' ? 50 : Math.min(100, Math.max(0, Number(input.sharePct)));
        refs[0].pct = 100 - pct;
        refs.push({ memberId: input.sharedId, pct });
      }
      const splits = splitsFor({ ...input, type, qty }, refs);
      const patient = findOrCreatePatient(input.patientName, input.mobile, input);
      // New / Renewal: injections count earlier injections; protein has no new / renewal.
      const earlier = S.sales.some((s) => s.patientId === patient.id && s.id !== id && s.date <= date && (type !== 'injection' || s.type === 'injection'));
      return {
        id, type, date, patientId: patient.id, patientName: patient.name, mobile: patient.mobile,
        patientType: type === 'protein' ? '' : input.patientType || (earlier ? 'renewal' : 'new'),
        itemId: type === 'diet' ? null : input.itemId, planId: type === 'diet' ? input.planId : null,
        product, qty, amount,
        refId: input.refId, sharedId: refs[1] ? refs[1].memberId : '', sharePct: refs[1] ? refs[1].pct : 0,
        dietitianId: input.dietitianId || '', notes: String(input.notes || '').trim(), payMethod: String(input.payMethod || '').trim(), programMonths: Number(input.programMonths) > 0 ? Number(input.programMonths) : (existingMonths(id) || ''),
        amountPaid: paidOf(input, amount), due: Math.max(0, amount - paidOf(input, amount)),
        incentive: sum(splits, (x) => x.amount), splits, created: Date.now(),
      };
    }

    /** Record (or update) a sale: stock out, incentive split and revenue in one step. */
    function saveSale(input) {
      const existing = input.id ? S.sales.find((s) => s.id === input.id) : null;
      const sale = buildSale(input, existing ? existing.id : uid('s'));
      if (sale.itemId) {
        const other = existing && existing.itemId === sale.itemId ? existing.qty : 0;
        const available = stockOf(sale.itemId) + other;
        if (available < sale.qty && !input.allowNegative) {
          fail(`Only ${available} ${item(sale.itemId).unit} of ${sale.product} in stock`);
        }
      }
      if (existing) {
        S.moves = S.moves.filter((m) => m.ref !== existing.id);
        Object.assign(existing, sale, { created: existing.created });
      } else S.sales.push(sale);
      if (sale.itemId) S.moves.push({ id: uid('v'), itemId: sale.itemId, qty: -sale.qty, type: 'sale', ref: sale.id, date: sale.date });
      kitFor(sale).forEach((k) => S.moves.push({ id: uid('v'), itemId: k.itemId, qty: -k.qty, type: 'kit', ref: sale.id, date: sale.date }));
      log(existing ? 'Sale updated' : 'Sale added', `${sale.product} × ${sale.qty} · ${sale.patientName} · ₹${sale.amount}`);
      save();
      return existing || sale;
    }
    function deleteSale(id) {
      const x = S.sales.find((s) => s.id === id);
      S.sales = S.sales.filter((s) => s.id !== id);
      S.moves = S.moves.filter((m) => m.ref !== id);
      if (x) log('Sale deleted', `${x.product} · ${x.patientName} · ₹${x.amount}`);
      save();
    }
    /** Record a payment towards a sale's pending balance (add to amount received). */
    function settleSale(id, add, payMethod) {
      const s = S.sales.find((x) => x.id === id);
      if (!s) fail('Sale not found');
      const total = Number(s.amount) || 0;
      const was = Number(s.amountPaid) || 0;
      const amt = Number(add) > 0 ? Number(add) : (Number(s.due) || 0); // blank = clear the whole balance
      const paid = Math.max(0, Math.min(total, was + amt));
      s.amountPaid = paid;
      s.due = Math.max(0, total - paid);
      if (payMethod) s.payMethod = payMethod;
      log('Payment received', `${s.patientName} · ₹${paid - was} · ${s.due > 0 ? `₹${s.due} still due` : 'cleared'}`);
      save();
      return s;
    }
    /** All sales that still have money due (newest first), with the total pending. */
    function pendingSales() {
      const list = S.sales.filter((s) => (Number(s.due) || 0) > 0).slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
      return { list, total: sum(list, (s) => Number(s.due) || 0) };
    }

    // Purchases
    const lineTotal = (l) => r2((Number(l.qty) || 0) * (Number(l.rate) || 0) * (1 + (Number(l.gst) || 0) / 100));
    function findDuplicatePurchase(p) {
      if (!p.invoiceNo) return null;
      return S.purchases.find((x) => x.id !== p.id && low(x.invoiceNo) === low(p.invoiceNo) && low(x.vendor) === low(p.vendor)) || null;
    }
    /** Save an invoice: every line adds stock; optionally books a purchase expense. */
    function savePurchase(input) {
      const lines = (input.lines || []).filter((l) => l.itemId && Number(l.qty) > 0);
      if (!lines.length) fail('Add at least one product line with a quantity');
      lines.forEach((l) => { if (!item(l.itemId)) fail('Unknown product in the invoice'); });
      if (findDuplicatePurchase(input) && !input.allowDuplicate) fail(`Invoice ${input.invoiceNo} from ${input.vendor} is already saved`);
      const existing = input.id ? S.purchases.find((p) => p.id === input.id) : null;
      const p = {
        id: existing ? existing.id : uid('b'),
        vendor: String(input.vendor || '').trim(), invoiceNo: String(input.invoiceNo || '').trim(),
        date: input.date || today(), scanned: !!input.scanned,
        lines: lines.map((l) => ({
          itemId: l.itemId, name: item(l.itemId).name, invoiceName: l.invoiceName || '', qty: Number(l.qty),
          batch: l.batch || '', expiry: l.expiry || '', rate: Number(l.rate) || 0, gst: Number(l.gst) || 0, total: lineTotal(l),
        })),
      };
      p.total = r2(sum(p.lines, (l) => l.total));
      if (existing) {
        S.moves = S.moves.filter((m) => m.ref !== existing.id);
        S.expenses = S.expenses.filter((e) => e.ref !== existing.id);
        Object.assign(existing, p);
      } else S.purchases.push(p);
      p.lines.forEach((l) => S.moves.push({ id: uid('v'), itemId: l.itemId, qty: l.qty, type: 'purchase', ref: p.id, date: p.date }));
      if (S.settings.purchaseExpense && p.total > 0) {
        const byCat = {};
        p.lines.forEach((l) => {
          const k = item(l.itemId).kind;
          const cat = k === 'injection' ? 'Injection Purchase' : k === 'protein' ? 'Protein Purchase' : 'Miscellaneous';
          byCat[cat] = (byCat[cat] || 0) + l.total;
        });
        Object.entries(byCat).forEach(([category, amount]) => S.expenses.push({
          id: uid('e'), date: p.date, category, amount: r2(amount), note: `Invoice ${p.invoiceNo || ''} ${p.vendor}`.trim(), ref: p.id, auto: true,
        }));
      }
      log(existing ? 'Purchase updated' : 'Purchase added', `${p.vendor || 'Vendor'} ${p.invoiceNo} · ${p.lines.map((l) => `${l.name} +${l.qty}`).join(', ')}`);
      save();
      return existing || p;
    }
    function deletePurchase(id) {
      const x = S.purchases.find((p) => p.id === id);
      S.purchases = S.purchases.filter((p) => p.id !== id);
      S.moves = S.moves.filter((m) => m.ref !== id);
      S.expenses = S.expenses.filter((e) => e.ref !== id);
      if (x) log('Purchase deleted', `${x.vendor} ${x.invoiceNo}`);
      save();
    }

    // Expenses
    function saveExpense(input) {
      if (!(Number(input.amount) > 0)) fail('Enter an amount');
      if (!input.category) fail('Choose a category');
      let e = input.id && S.expenses.find((x) => x.id === input.id);
      if (!e) { e = { id: uid('e') }; S.expenses.push(e); }
      Object.assign(e, { date: input.date || today(), category: input.category, amount: r2(input.amount), note: String(input.note || '').trim() });
      if (!S.settings.lists.expenseCategories.includes(e.category)) S.settings.lists.expenseCategories.push(e.category);
      log(input.id ? 'Expense updated' : 'Expense added', `${e.category} ₹${e.amount}${e.note ? ` · ${e.note}` : ''}`);
      save();
      return e;
    }
    function deleteExpense(id) {
      const x = S.expenses.find((e) => e.id === id);
      S.expenses = S.expenses.filter((e) => e.id !== id);
      if (x) log('Expense deleted', `${x.category} ₹${x.amount}`);
      save();
    }

    // OPD appointments
    const appointment = (id) => S.appointments.find((a) => a.id === id) || null;
    const VITALS = ['weight', 'height', 'bp', 'pulse', 'sugar'];
    function saveAppointment(input) {
      if (!input.date) fail('Choose the appointment date');
      if (!APPT_MODES[input.mode]) fail('Choose clinic visit or online');
      const patient = findOrCreatePatient(input.patientName, input.mobile, input);
      let a = input.id && appointment(input.id);
      if (!a) { a = { id: uid('a'), created: Date.now(), status: 'booked', paid: false }; S.appointments.push(a); }
      const fee = input.fee === '' || input.fee == null ? S.settings.consultFee : Number(input.fee);
      if (!(fee >= 0)) fail('Enter the consultation fee');
      Object.assign(a, {
        date: input.date, time: input.time || '', patientId: patient.id, patientName: patient.name, mobile: patient.mobile,
        mode: input.mode, fee, link: String(input.link || '').trim(), notes: String(input.notes || '').trim(),
        service: String(input.service || '').trim(),
        doctor: String(input.doctor || '').trim(), branch: String(input.branch || '').trim(),
        vitals: VITALS.reduce((o, k) => { const v = String((input.vitals || {})[k] == null ? '' : input.vitals[k]).trim(); if (v) o[k] = v; return o; }, {}),
      });
      ['status', 'paid', 'payMethod', 'by', 'leadId'].forEach((k) => { if (k in input) a[k] = input[k]; });
      if (!APPT_STATUS[a.status]) a.status = 'booked';
      a.paid = !!a.paid;
      if (a.service && !S.settings.lists.services.includes(a.service)) S.settings.lists.services.push(a.service);
      if (a.doctor && !S.settings.lists.doctors.includes(a.doctor)) S.settings.lists.doctors.push(a.doctor);
      if (a.branch && !S.settings.lists.clinics.includes(a.branch)) S.settings.lists.clinics.push(a.branch);
      log(input.id ? 'Appointment updated' : 'Appointment booked', `${a.patientName} · ${a.date} ${a.time}${a.service ? ` · ${a.service}` : ''}${a.doctor ? ` · ${a.doctor}` : ''}`);
      save();
      return a;
    }
    function updateAppointment(id, patch) {
      const a = appointment(id);
      if (!a) fail('Appointment not found');
      Object.assign(a, patch);
      const what = patch.status ? `status ${APPT_STATUS[patch.status]}` : patch.paid ? `paid ₹${a.fee}${a.payMethod ? ` ${a.payMethod}` : ''}` : 'changed';
      log('Appointment updated', `${a.patientName} · ${what}`);
      save();
      return a;
    }
    function deleteAppointment(id) {
      const a = appointment(id);
      S.appointments = S.appointments.filter((x) => x.id !== id);
      if (a) log('Appointment deleted', `${a.patientName} · ${a.date}`);
      save();
    }
    const appointmentsIn = (range) => S.appointments.filter((a) => inRange(a.date, range))
      .sort((a, b) => (a.date === b.date ? String(a.time).localeCompare(String(b.time)) : a.date < b.date ? -1 : 1));
    // Fees count as revenue once paid, unless the appointment was cancelled.
    const feeEarned = (a) => (a.paid && a.status !== 'cancelled' ? Number(a.fee) || 0 : 0);
    function appointmentStats(range) {
      const list = appointmentsIn(range);
      const n = (f) => list.filter(f).length;
      return {
        total: list.length, booked: n((a) => a.status === 'booked'), completed: n((a) => a.status === 'completed'),
        cancelled: n((a) => a.status === 'cancelled'), noshow: n((a) => a.status === 'noshow'),
        clinic: n((a) => a.mode === 'clinic' && a.status !== 'cancelled'), online: n((a) => a.mode === 'online' && a.status !== 'cancelled'),
        fees: r2(sum(list, feeEarned)), unpaid: n((a) => !a.paid && a.status !== 'cancelled'),
      };
    }

    // Logins: one per person (name, role, PIN). Staff PINs are visible to the Super Admin.
    const account = (id) => S.accounts.find((a) => a.id === id) || null;
    function saveAccount(input) {
      const name = String(input.name || '').trim();
      if (!name) fail('Enter a name for the login');
      if (!ROLES[input.role]) fail('Choose a role');
      if (S.accounts.some((a) => a.id !== input.id && low(a.name) === low(name))) fail('Another login already has this name');
      let a = input.id && account(input.id);
      const isNew = !a;
      if (!a) { a = { id: uid('u'), hash: '', salt: '', len: 0, pin: '', created: Date.now() }; S.accounts.push(a); }
      if (a.role === 'super' && input.role !== 'super' && S.accounts.filter((x) => x.role === 'super' && !x.disabled).length === 1) fail('Keep at least one Super Admin');
      Object.assign(a, { name, role: input.role, memberId: input.memberId || '', disabled: !!input.disabled });
      log(isNew ? 'Login added' : 'Login updated', `${a.name} (${ROLES[a.role]})`);
      save();
      return a;
    }
    function setAccountPin(id, hash, salt, len, plain) {
      const a = account(id);
      if (!a) fail('Unknown login');
      Object.assign(a, { hash, salt, len: len || 0, pin: a.role === 'super' ? '' : (plain || '') });
      log(hash ? 'PIN changed' : 'PIN removed', a.name);
      save();
    }
    function deleteAccount(id) {
      const a = account(id);
      if (!a) return;
      if (a.role === 'super' && S.accounts.filter((x) => x.role === 'super').length === 1) fail('Keep at least one Super Admin');
      S.accounts = S.accounts.filter((x) => x.id !== id);
      log('Login deleted', a.name);
      save();
    }
    const setActor = (name) => { actor = name || ''; };
    /** Sign-in, sign-out, wrong PIN… recorded in the activity log (and the Google Sheet). */
    function logEvent(action, detail, by) {
      const keep = actor; if (by) actor = by;
      log(action, detail);
      actor = keep;
      save();
    }
    // Indian financial year (April – March) of a date, e.g. 2026-10-02 → "26-27".
    const finYear = (d) => { const [y, m] = String(d).split('-').map(Number); const a = m >= 4 ? y : y - 1; return `${String(a).slice(2)}-${String(a + 1).slice(2)}`; };
    /**
     * Invoice number for a sale or an OPD appointment, given once and kept: PREFIX/INV/26-27/0001.
     * The next number is one more than the highest already used (so numbers survive syncing).
     */
    /** What a purchase invoice shows: description (default "Weight Loss Program") and program months, kept on the sale. */
    const existingMonths = (id) => { const x = S.sales.find((y) => y.id === id); return x ? x.programMonths : ''; };
    // Amount actually received. Blank / missing = fully paid; a given amount is clamped to [0, total].
    const paidOf = (input, amount) => {
      if (input.amountPaid === '' || input.amountPaid == null) return amount;
      return Math.max(0, Math.min(amount, Number(input.amountPaid) || 0));
    };
    function setInvoiceInfo(id, info) {
      const rec = S.sales.find((x) => x.id === id);
      if (!rec) fail('Sale not found');
      rec.invoiceDesc = String(info.desc || '').trim();
      const m = Number(info.months);
      rec.programMonths = m > 0 ? Math.round(m * 10) / 10 : '';
      save();
      return rec;
    }
    function invoiceFor(kind, id) {
      const rec = kind === 'opd' ? appointment(id) : S.sales.find((x) => x.id === id);
      if (!rec) fail('Record not found');
      if (rec.invoiceNo) return rec.invoiceNo;
      const prefix = String(S.settings.invoicePrefix || 'HV').trim().replace(/\//g, '-') || 'HV';
      const head = `${prefix}/${kind === 'opd' ? 'OPD' : 'INV'}/${finYear(rec.date)}/`;
      const used = [...S.sales, ...S.appointments].map((x) => x.invoiceNo).filter((n) => n && n.startsWith(head)).map((n) => Number(n.slice(head.length)) || 0);
      rec.invoiceNo = `${head}${String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0')}`;
      rec.invoiceDate = rec.invoiceDate || today();
      log('Invoice created', `${rec.invoiceNo} · ${rec.patientName}`);
      save();
      return rec.invoiceNo;
    }

    // Choice lists ("+ Add new" everywhere)
    function addListItem(list, name) {
      const n = String(name || '').trim();
      if (!S.settings.lists[list]) fail('Unknown list');
      if (!n) fail('Enter a name');
      if (S.settings.lists[list].some((x) => low(x) === low(n))) return n;
      S.settings.lists[list].push(n);
      log('Option added', `${list}: ${n}`);
      save();
      return n;
    }
    function removeListItem(list, name) {
      if ((LOCKED_LIST_ITEMS[list] || []).includes(name)) fail(`"${name}" is used by the app and can't be removed`);
      S.settings.lists[list] = S.settings.lists[list].filter((x) => x !== name);
      log('Option removed', `${list}: ${name}`);
      save();
    }
    function renameListItem(list, oldName, name) {
      const n = String(name || '').trim();
      if (!n) fail('Enter a name');
      if ((LOCKED_LIST_ITEMS[list] || []).includes(oldName)) fail(`"${oldName}" is used by the app and can't be renamed`);
      const l = S.settings.lists[list]; const i = l.indexOf(oldName);
      if (i < 0) fail('Option not found');
      l[i] = n;
      if (list === 'expenseCategories') S.expenses.forEach((e) => { if (e.category === oldName) e.category = n; });
      if (list === 'leadSources') S.leads.forEach((x) => { if (x.source === oldName) x.source = n; });
      if (list === 'leadStatuses') S.leads.forEach((x) => { if (x.status === oldName) x.status = n; });
      if (list === 'doctors') S.appointments.forEach((x) => { if (x.doctor === oldName) x.doctor = n; });
      if (list === 'clinics') S.appointments.forEach((x) => { if (x.branch === oldName) x.branch = n; });
      if (list === 'services') { S.appointments.forEach((x) => { if (x.service === oldName) x.service = n; }); S.leads.forEach((x) => { if (x.interest === oldName) x.interest = n; }); }
      log('Option renamed', `${list}: ${oldName} → ${n}`);
      save();
    }

    // Lead management (CRM)
    const lead = (id) => S.leads.find((l) => l.id === id) || null;
    const LEAD_FIELDS = ['name', 'mobile', 'altMobile', 'age', 'gender', 'city', 'source', 'interest', 'priority', 'assignedTo', 'followUp', 'followTime', 'weight', 'targetWeight', 'height', 'budget', 'notes', 'email'];
    function findLeadByMobile(mobile, exceptId) {
      const ph = digits(mobile);
      return ph ? S.leads.find((l) => l.id !== exceptId && digits(l.mobile) === ph) || null : null;
    }
    function saveLead(input) {
      const name = String(input.name || '').trim();
      if (!name) fail('Enter the lead name');
      if (!digits(input.mobile)) fail('Enter a mobile number');
      const dup = findLeadByMobile(input.mobile, input.id);
      if (dup && !input.allowDuplicate) fail(`${dup.name} already has this mobile number (status: ${dup.status})`);
      let l = input.id && lead(input.id);
      const isNew = !l;
      if (!l) { l = { id: uid('l'), created: clock ? clock().getTime() : Date.now(), createdBy: actor, date: today(), status: 'New', history: [] }; S.leads.push(l); }
      LEAD_FIELDS.forEach((k) => { if (k in input) l[k] = typeof input[k] === 'string' ? input[k].trim() : input[k]; });
      l.name = name;
      if (!LEAD_PRIORITIES[l.priority]) l.priority = 'warm';
      if (input.status && input.status !== l.status) setLeadStatusRaw(l, input.status);
      if (l.source && !S.settings.lists.leadSources.includes(l.source)) S.settings.lists.leadSources.push(l.source);
      if (l.interest && !S.settings.lists.services.includes(l.interest)) S.settings.lists.services.push(l.interest);
      if (isNew) l.history.push({ at: l.created, by: actor, type: 'created', text: `Lead added${l.source ? ` from ${l.source}` : ''}` });
      log(isNew ? 'Lead added' : 'Lead updated', `${l.name} · ${l.mobile}`);
      save();
      return l;
    }
    /**
     * WhatsApp messages from the Google Sheet (Heyo / MyOperator): a message from a lead goes into its history;
     * a new number (not a patient) becomes a "New" lead from WhatsApp when waAutoLead is on.
     * Lead ids come from the number, so two devices importing the same message make one lead.
     */
    // A real contact name, or the number itself when the "name" is junk (HTML from a template message,
    // a button like "Talk to us on", a URL, or just the number). Numbers are mandatory, so the number
    // is always a safe fallback and goes in the name box too.
    function cleanLeadName(raw, mobile) {
      let s = String(raw == null ? '' : raw);
      s = s.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
      const low = s.toLowerCase();
      const letters = (s.match(/[A-Za-zÀ-ɏऀ-ॿ]/g) || []).length;
      const junk = !s || s.length > 40 || letters < 2
        || /[<>{}=]/.test(s) || /style|img |width|height|display|http|www\.|\.com|href|<img/i.test(s)
        || /^(whats ?app|talk to us|click here|hi there|hello there|message us|chat with us|learn more|get started|know more|contact us|view|reply|call now|no name)/i.test(low)
        || digits(s).length >= 10;
      return junk ? String(mobile) : s;
    }
    /** One-time tidy of WhatsApp leads: fix junk names (use the number) and drop any without a valid number. */
    function fixWhatsAppNames() {
      let fixed = 0; let removed = 0;
      S.leads = S.leads.filter((l) => {
        if (l.source !== 'WhatsApp') return true;
        const d = digits(l.mobile);
        if (d.length < 10 || /^[0-5]/.test(d)) { removed++; return false; } // number is mandatory
        const nm = cleanLeadName(l.name, d);
        if (nm !== l.name) { l.name = nm; fixed++; }
        return true;
      });
      if (fixed || removed) { log('WhatsApp leads tidied', `${fixed} name${fixed === 1 ? '' : 's'} fixed · ${removed} without a number removed`); save(); }
      return { fixed, removed };
    }
    function importWhatsApp(msgs) {
      let created = 0; let updated = 0;
      (msgs || []).filter((m) => m && m.dir !== 'out' && m.text).sort((a, b) => a.at - b.at).forEach((m) => {
        const d = digits(m.phone);
        if (d.length < 10) return;
        let l = S.leads.find((x) => digits(x.mobile) === d);
        if (!l) {
          if (S.settings.waAutoLead === false || S.patients.some((p) => digits(p.mobile) === d)) return;
          const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
          const phrases = (S.settings.waLeadPhrases || []).map(norm).filter(Boolean);
          if (phrases.length && !phrases.some((ph) => norm(m.text).includes(ph))) return;
          l = { id: `wa${d}`, created: m.at, createdBy: 'WhatsApp', date: isoDate(new Date(m.at)), status: 'New', priority: 'warm', name: cleanLeadName(m.name, d),
            mobile: d, source: 'WhatsApp', followUp: isoDate(new Date(m.at)), history: [{ at: m.at, by: 'WhatsApp', type: 'created', text: 'Lead added from WhatsApp' }] };
          S.leads.push(l);
          if (!S.settings.lists.leadSources.includes('WhatsApp')) S.settings.lists.leadSources.push('WhatsApp');
          created++;
        }
        l.history = l.history || [];
        if (l.history.some((h) => h.mid === m.id)) return;
        l.history.push({ at: m.at, by: m.name || 'WhatsApp', type: 'whatsapp', text: `WhatsApp: ${String(m.text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)}`, mid: m.id });
        // Keep the latest 40 WhatsApp lines per lead (the full chat stays in the sheet's WhatsApp tab).
        const wa = l.history.filter((h) => h.type === 'whatsapp');
        if (wa.length > 40) { const drop = new Set(wa.slice(0, wa.length - 40)); l.history = l.history.filter((h) => !drop.has(h)); }
        l.lastWhatsApp = Math.max(l.lastWhatsApp || 0, m.at);
        updated++;
      });
      if (created || updated) { if (created) log('WhatsApp leads', `${created} new lead${created > 1 ? 's' : ''} from WhatsApp`); save(); }
      return { created, updated };
    }
    /**
     * Import leads from a file (Heyo / MyOperator export, any CSV / Excel): rows {phone, name, message, date}.
     * Skips numbers that are already leads or patients and repeated numbers in the file; onlyPhrases keeps rows whose
     * message contains a WhatsApp lead phrase. Returns { added, skipped, dupes }.
     */
    /** Login for a MyOperator / Heyo agent: the saved mapping, else the same name, else a unique first-name match. */
    function heyoAccount(agent) {
      const k = String(agent || '').trim().toLowerCase();
      if (!k) return null;
      const map = S.settings.heyoAgents || {};
      if (map[k]) return S.accounts.find((a) => a.id === map[k]) || null;
      if (k in map) return null; // mapped to "nobody"
      const live = S.accounts.filter((a) => !a.disabled);
      const exact = live.find((a) => String(a.name || '').trim().toLowerCase() === k);
      if (exact) return exact;
      const first = k.split(/[\s@._]+/)[0];
      const byFirst = live.filter((a) => String(a.name || '').trim().toLowerCase().split(/\s+/)[0] === first);
      return first.length > 2 && byFirst.length === 1 ? byFirst[0] : null;
    }
    /**
     * Chats read from the MyOperator / Heyo panel: messages go through importWhatsApp (lead rules and history);
     * each conversation's assigned agent becomes the lead's "Assigned to" whenever the agent changes on the panel.
     */
    function heyoSync(data) {
      const msgs = (data && data.msgs) || []; const convs = (data && data.convs) || [];
      const res = importWhatsApp(msgs);
      let assigned = 0; let created = 0; const unknown = new Set();
      const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const phrases = (S.settings.waLeadPhrases || []).map(norm).filter(Boolean);
      const seen = S.settings.heyoSeen || (S.settings.heyoSeen = []);
      const now = clock ? clock().getTime() : Date.now();
      convs.forEach((c) => {
        const d = digits(c.phone);
        if (d.length < 10) return;
        let l = S.leads.find((x) => digits(x.mobile) === d);
        if (!l && S.settings.waAutoLead !== false && !S.patients.some((x) => digits(x.mobile) === d)
          && (!phrases.length || (c.text && phrases.some((ph) => norm(c.text).includes(ph))))) {
          const at = c.at || now;
          l = { id: `wa${d}`, created: at, createdBy: 'WhatsApp', date: isoDate(new Date(at)), status: 'New', priority: 'warm', name: cleanLeadName(c.name, d),
            mobile: d, source: 'WhatsApp', followUp: isoDate(new Date(at)), history: [{ at, by: 'WhatsApp', type: 'created', text: 'Lead added from WhatsApp (MyOperator panel)' }].concat(c.text ? [{ at, by: cleanLeadName(c.name, d), type: 'whatsapp', text: `WhatsApp: ${String(c.text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)}` }] : []) };
          S.leads.push(l);
          if (!S.settings.lists.leadSources.includes('WhatsApp')) S.settings.lists.leadSources.push('WhatsApp');
          created++;
        }
        if (!l) return;
        // When we later learn a real name for a number-named lead, use it.
        const cn = cleanLeadName(c.name, d);
        if (cn !== d && (l.name === d || /^WhatsApp \d+$/.test(l.name) || digits(l.name).length >= 10)) l.name = cn;
        const agent = String(c.assignee || '').trim();
        if (!agent || S.settings.heyoAssign === false) return;
        if (!seen.some((x) => x.toLowerCase() === agent.toLowerCase())) { seen.push(agent); if (seen.length > 60) seen.shift(); }
        const acc = heyoAccount(agent);
        if (!acc) { if (!(agent.toLowerCase() in (S.settings.heyoAgents || {}))) unknown.add(agent); return; }
        // Follow the panel only when its agent changes, so a hand-made change in the app is kept until then.
        if (l.heyoAgent === agent && l.assignedTo) return;
        l.heyoAgent = agent;
        if (l.assignedTo === acc.id) return;
        l.assignedTo = acc.id;
        l.history = l.history || [];
        l.history.push({ at: now, by: 'MyOperator', type: 'note', text: `Assigned to ${acc.name} (as on MyOperator / Heyo)` });
        assigned++;
      });
      if (created || assigned) { log('MyOperator sync', `${created} new lead${created === 1 ? '' : 's'} · ${assigned} assigned`); save(); }
      return { created: res.created + created, updated: res.updated, assigned, unknown: [...unknown] };
    }
    function importLeads(rows, opts) {
      const o = opts || {};
      const source = String(o.source || 'WhatsApp').trim() || 'WhatsApp';
      const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const phrases = o.onlyPhrases ? (S.settings.waLeadPhrases || []).map(norm).filter(Boolean) : [];
      let added = 0; let skipped = 0; let dupes = 0;
      const now = clock ? clock().getTime() : Date.now();
      const seenNums = new Set();
      (rows || []).forEach((r) => {
        const d = digits(r.phone);
        if (d.length < 10) { skipped++; return; }
        if (phrases.length && !phrases.some((ph) => norm(r.message).includes(ph))) { skipped++; return; }
        if (seenNums.has(d) || S.leads.some((x) => digits(x.mobile) === d) || S.patients.some((x) => digits(x.mobile) === d)) { dupes++; return; }
        seenNums.add(d);
        const at = Number(new Date(r.date)) || now;
        const day = isoDate(new Date(at));
        const l = { id: source === 'WhatsApp' ? `wa${d}` : uid('l'), created: at, createdBy: actor || 'Import', date: day, status: 'New', priority: 'warm',
          name: cleanLeadName(r.name, d), mobile: d, source, followUp: today(), history: [{ at: now, by: actor || 'Import', type: 'created', text: `Lead imported from ${o.fileName || 'a file'}` }] };
        if (r.message) l.history.push({ at, by: l.name, type: 'whatsapp', text: `${source}: ${String(r.message).slice(0, 300)}` });
        if (r.city) l.city = String(r.city).trim();
        S.leads.push(l);
        added++;
      });
      if (!S.settings.lists.leadSources.includes(source)) S.settings.lists.leadSources.push(source);
      if (added) { log('Leads imported', `${added} from ${o.fileName || 'a file'}${dupes ? ` · ${dupes} already known` : ''}`); save(); }
      return { added, skipped, dupes };
    }
    function setLeadStatusRaw(l, status) {
      if (!S.settings.lists.leadStatuses.includes(status)) S.settings.lists.leadStatuses.push(status);
      const from = l.status;
      l.status = status;
      l.history.push({ at: clock ? clock().getTime() : Date.now(), by: actor, type: 'status', text: `${from || 'New'} → ${status}` });
    }
    function setLeadStatus(id, status) {
      const l = lead(id);
      if (!l) fail('Lead not found');
      setLeadStatusRaw(l, status);
      log('Lead status', `${l.name}: ${status}`);
      save();
    }
    /** A call, WhatsApp message or note on a lead; optionally sets the next follow-up. */
    function addLeadActivity(id, input) {
      const l = lead(id);
      if (!l) fail('Lead not found');
      const text = String(input.text || '').trim();
      if (!text && !input.followUp) fail('Write a note or choose a follow-up date');
      const at = clock ? clock().getTime() : Date.now();
      if (text) l.history.push({ at, by: actor, type: input.type || 'note', text });
      if ('followUp' in input) { l.followUp = input.followUp || ''; l.followTime = input.followTime || ''; if (input.followUp) l.history.push({ at, by: actor, type: 'followup', text: `Follow-up set for ${input.followUp}${input.followTime ? ` ${input.followTime}` : ''}` }); }
      if (input.type === 'call' || input.type === 'whatsapp') l.lastContact = at;
      if (l.status === 'New' && (input.type === 'call' || input.type === 'whatsapp')) setLeadStatusRaw(l, 'Contacted');
      log('Lead activity', `${l.name} · ${input.type || 'note'}${text ? `: ${text.slice(0, 60)}` : ''}`);
      save();
      return l;
    }
    function deleteLead(id) {
      const l = lead(id);
      S.leads = S.leads.filter((x) => x.id !== id);
      if (l) log('Lead deleted', `${l.name} · ${l.mobile}`);
      save();
    }
    /** Delete several leads at once (bulk delete). Returns how many were removed. */
    function deleteLeads(ids) {
      const set = new Set(ids || []);
      const before = S.leads.length;
      S.leads = S.leads.filter((x) => !set.has(x.id));
      const removed = before - S.leads.length;
      if (removed) { log('Leads deleted', `${removed} lead${removed === 1 ? '' : 's'} removed`); save(); }
      return removed;
    }
    /** Convert a lead: creates (or finds) the patient and, optionally, books an OPD appointment. */
    function convertLead(id, appt) {
      const l = lead(id);
      if (!l) fail('Lead not found');
      const p = findOrCreatePatient(l.name, l.mobile, l);
      l.patientId = p.id;
      let a = null;
      if (appt) {
        a = saveAppointment({ ...appt, patientName: p.name, mobile: p.mobile, leadId: l.id, service: appt.service || l.interest || '' });
        l.apptId = a.id;
        setLeadStatusRaw(l, 'Appointment booked');
      } else setLeadStatusRaw(l, 'Converted');
      log('Lead converted', `${l.name}${a ? ` · appointment ${a.date}` : ''}`);
      save();
      return { patient: p, appointment: a };
    }
    const isClosedLead = (l) => ['Converted', 'Not interested', 'Lost'].includes(l.status);
    function leadStats(range, filter) {
      const all = S.leads.filter((l) => !filter || filter(l));
      const inR = all.filter((l) => inRange(l.date, range));
      const d = today();
      const open = all.filter((l) => !isClosedLead(l));
      const won = inR.filter((l) => l.status === 'Converted' || l.status === 'Appointment booked' || l.apptId || l.patientId).length;
      return {
        total: inR.length, open: open.length, won, conversion: inR.length ? Math.round((won / inR.length) * 100) : 0,
        dueToday: open.filter((l) => l.followUp === d).length, overdue: open.filter((l) => l.followUp && l.followUp < d).length,
        hot: open.filter((l) => l.priority === 'hot').length, newToday: all.filter((l) => l.date === d).length,
      };
    }

    /** Today's summary: sales, purchases, OPD, stock available / not available, order required. */
    function daySummary(date) {
      const d = date || today();
      const r = { from: d, to: d };
      const sales = S.sales.filter((x) => x.date === d);
      const purchases = S.purchases.filter((x) => x.date === d);
      const stock = S.items.filter((i) => !i.disabled).map((i) => ({ item: i, stock: stockOf(i.id, d) }));
      return {
        date: d, sales, purchases, appointments: appointmentsIn(r), appt: appointmentStats(r),
        salesTotal: r2(sum(sales, (x) => x.amount)), purchaseTotal: r2(sum(purchases, (x) => x.total)),
        expenses: S.expenses.filter((e) => e.date === d), expenseTotal: r2(sum(S.expenses.filter((e) => e.date === d), (e) => e.amount)),
        available: stock.filter((x) => x.stock > 0), notAvailable: stock.filter((x) => x.stock <= 0),
        order: stock.filter((x) => x.item.orderAt != null && x.stock < x.item.orderAt),
        leads: S.leads.filter((l) => l.date === d).length,
      };
    }

    // Incentives, salary
    function incentiveLedger(range) {
      const rows = [];
      S.sales.filter((s) => inRange(s.date, range)).forEach((s) => s.splits.forEach((sp) => rows.push({
        date: s.date, memberId: sp.memberId, name: sp.name, type: s.type, patient: s.patientName, product: s.product,
        pct: sp.pct, amount: sp.amount, saleId: s.id,
      })));
      return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    function salarySheet(month) {
      const range = monthRange(month);
      const ledger = incentiveLedger(range);
      const ids = new Set([...S.team.filter((m) => !m.disabled).map((m) => m.id), ...ledger.map((l) => l.memberId)]);
      return [...ids].map((id) => {
        const m = member(id);
        const mode = (m && m.payMode) || 'both';
        const salary = m && !m.disabled && mode !== 'incentive' && (!m.joiningDate || m.joiningDate <= range.to) ? m.salary : 0;
        const incentive = mode === 'salary' ? 0 : sum(ledger.filter((l) => l.memberId === id), (l) => l.amount);
        return { memberId: id, name: m ? m.name : (ledger.find((l) => l.memberId === id) || {}).name, designation: m ? m.designation : '', mode, salary, incentive, total: salary + incentive };
      }).sort((a, b) => b.total - a.total);
    }
    /** Book the month's salary and incentive as expenses (replaces an earlier booking of the same month). */
    function postSalary(month) {
      const rows = salarySheet(month);
      const tag = `salary:${month}`;
      S.expenses = S.expenses.filter((e) => e.ref !== tag);
      const date = monthRange(month).to;
      const sal = sum(rows, (r) => r.salary); const inc = sum(rows, (r) => r.incentive);
      if (sal) S.expenses.push({ id: uid('e'), date, category: 'Salary', amount: sal, note: `Salary ${month} (${rows.filter((r) => r.salary).length} staff)`, ref: tag, auto: true });
      if (inc) S.expenses.push({ id: uid('e'), date, category: 'Incentive', amount: inc, note: `Incentives ${month}`, ref: tag, auto: true });
      log('Salary booked', `${month}: salary ₹${sal}, incentive ₹${inc}`);
      save();
      return { salary: sal, incentive: inc };
    }
    const salaryPosted = (month) => S.expenses.some((e) => e.ref === `salary:${month}`);

    // Renewals
    function renewals(onDate) {
      const d = onDate || today();
      const [first, second] = S.settings.renewalDays;
      const out = [];
      S.patients.forEach((p) => {
        const inj = patientSales(p.id).filter((s) => s.type === 'injection');
        const last = inj[inj.length - 1];
        if (!last) return;
        const days = daysBetween(last.date, d);
        const stage = days >= second ? second : days >= first ? first : 0;
        const dueIn = first - days;
        out.push({
          patientId: p.id, name: p.name, mobile: p.mobile, product: last.product, lastDate: last.date, days, stage,
          dueIn, ref: memberName(last.refId), saleId: last.id, done: !!S.renewalsDone[`${last.id}:${stage}`],
        });
      });
      return out.sort((a, b) => b.days - a.days);
    }
    function markRenewal(saleId, stage, done) {
      const k = `${saleId}:${stage}`;
      if (done) S.renewalsDone[k] = today(); else delete S.renewalsDone[k];
      const x = S.sales.find((y) => y.id === saleId);
      log(done ? 'Renewal contacted' : 'Renewal reopened', x ? x.patientName : saleId);
      save();
    }

    // Reports
    function teamReport(range) {
      const sales = S.sales.filter((s) => inRange(s.date, range));
      const ids = new Set([...S.team.map((m) => m.id), ...sales.flatMap((s) => s.splits.map((x) => x.memberId))]);
      return [...ids].map((id) => {
        const mine = sales.filter((s) => s.splits.some((x) => x.memberId === id));
        const share = (s) => (s.splits.find((x) => x.memberId === id).pct || 0) / 100;
        const m = member(id);
        const byType = (t) => r2(sum(mine.filter((s) => s.type === t), (s) => s.amount * share(s)));
        return {
          memberId: id, name: m ? m.name : mine[0] && mine[0].splits.find((x) => x.memberId === id).name,
          disabled: m ? m.disabled : true,
          orders: mine.length,
          totalSales: r2(sum(mine, (s) => s.amount * share(s))),
          newPatients: new Set(mine.filter((s) => s.patientType === 'new').map((s) => s.patientId)).size,
          renewals: mine.filter((s) => s.patientType === 'renewal').length,
          injectionSales: byType('injection'), proteinSales: byType('protein'), dietSales: byType('diet'),
          incentive: sum(mine, (s) => s.splits.find((x) => x.memberId === id).amount),
        };
      }).sort((a, b) => b.totalSales - a.totalSales);
    }
    function financialReport(range) {
      const sales = S.sales.filter((s) => inRange(s.date, range));
      const expenses = S.expenses.filter((e) => inRange(e.date, range));
      const appts = S.appointments.filter((a) => inRange(a.date, range));
      const consultation = r2(sum(appts, feeEarned));
      const revenue = r2(sum(sales, (s) => s.amount) + consultation);
      const totalExp = r2(sum(expenses, (e) => e.amount));
      const byCategory = {};
      S.settings.lists.expenseCategories.forEach((c) => { byCategory[c] = 0; });
      expenses.forEach((e) => { byCategory[e.category] = r2((byCategory[e.category] || 0) + e.amount); });
      const revenueByType = {};
      Object.keys(SALE_TYPES).forEach((t) => { revenueByType[t] = r2(sum(sales.filter((s) => s.type === t), (s) => s.amount)); });
      revenueByType.consultation = consultation;
      const months = {};
      appts.forEach((a) => { if (!feeEarned(a)) return; const m = monthOf(a.date); months[m] = months[m] || { revenue: 0, expenses: 0 }; months[m].revenue += feeEarned(a); });
      sales.forEach((s) => { const m = monthOf(s.date); months[m] = months[m] || { revenue: 0, expenses: 0 }; months[m].revenue += s.amount; });
      expenses.forEach((e) => { const m = monthOf(e.date); months[m] = months[m] || { revenue: 0, expenses: 0 }; months[m].expenses += e.amount; });
      const monthly = Object.keys(months).sort().map((m) => ({ month: m, revenue: r2(months[m].revenue), expenses: r2(months[m].expenses), profit: r2(months[m].revenue - months[m].expenses) }));
      return { revenue, expenses: totalExp, profit: r2(revenue - totalExp), byCategory, revenueByType, monthly };
    }
    function stockReport(range) {
      const from = range && range.from; const to = range && range.to;
      return S.items.map((it) => {
        const mv = S.moves.filter((m) => m.itemId === it.id);
        const before = from ? sum(mv.filter((m) => m.date < from), (m) => m.qty) : 0;
        const within = mv.filter((m) => inRange(m.date, range));
        const q = (t) => sum(within.filter((m) => m.type === t), (m) => m.qty);
        const opening = it.opening + before;
        const purchased = q('purchase'); const sold = -q('sale'); const used = -q('kit'); const adjusted = q('adjust');
        return {
          itemId: it.id, category: it.category, kind: it.kind, name: it.name, unit: it.unit, disabled: it.disabled, alertOff: it.alertOff, orderAt: it.orderAt,
          opening, purchased, sold, used, adjusted, current: opening + purchased - sold - used + adjusted, closingToday: stockOf(it.id, to), lowAt: it.lowAt,
        };
      });
    }

    function dashboard(range) {
      const d = today();
      const sales = S.sales.filter((s) => inRange(s.date, range));
      const fin = financialReport(range);
      const byType = (t) => sales.filter((s) => s.type === t);
      const uniq = (list) => new Set(list.map((s) => s.patientId)).size;
      const activeFrom = isoDate(new Date(parseDate(d) - S.settings.activeDays * 86400000));
      const team = teamReport(range);
      const top = team.find((t) => t.totalSales > 0) || null;
      const stockSum = (f) => sum(S.items.filter((i) => !i.disabled && f(i)), (i) => stockOf(i.id));
      const cat = (re) => (i) => re.test(i.category) || re.test(i.name);
      return {
        sales: {
          orders: sales.length, revenue: fin.revenue, expenses: fin.expenses, profit: fin.profit,
          injection: fin.revenueByType.injection, protein: fin.revenueByType.protein, diet: fin.revenueByType.diet, consultation: fin.revenueByType.consultation,
          injectionCount: byType('injection').length, proteinCount: byType('protein').length, dietCount: byType('diet').length,
        },
        patients: {
          total: S.patients.length,
          new: uniq(sales.filter((s) => s.patientType === 'new')),
          renewal: uniq(sales.filter((s) => s.patientType === 'renewal')),
          active: uniq(S.sales.filter((s) => s.date >= activeFrom && s.date <= d)),
        },
        team: {
          members: S.team.filter((m) => !m.disabled).length,
          incentives: sum(team, (t) => t.incentive),
          salary: sum(S.team.filter((m) => !m.disabled), (m) => m.salary),
          top,
        },
        stock: {
          injection: stockSum((i) => i.kind === 'injection'),
          protein: stockSum((i) => i.kind === 'protein'),
          needles: stockSum(cat(/needle/i)), swabs: stockSum(cat(/swab/i)), syringes: stockSum(cat(/syringe/i)),
          low: lowStock(),
          order: orderRequired(),
          available: S.items.filter((i) => !i.disabled && stockOf(i.id) > 0).map((i) => ({ item: i, stock: stockOf(i.id) })),
        },
        leads: leadStats(range),
        renewalsDue: renewals(d).filter((r) => r.stage && !r.done).length,
        appointments: appointmentStats(range),
        today: appointmentStats({ from: d, to: d }),
        monthly: fin.monthly,
      };
    }

    // Google Sheets rows (header first)
    function sheetsData() {
      const d = today();
      const refNames = (s) => [memberName(s.refId) === '—' ? (s.splits[0] || {}).name || '' : memberName(s.refId), s.sharedId ? ((s.splits[1] || {}).name || memberName(s.sharedId)) : ''];
      const split = (s) => s.splits.map((x) => `${x.name} ${x.pct}%`).join(' / ');
      const byDate = [...S.sales].sort((a, b) => (a.date < b.date ? -1 : 1));
      const month = rangeFor('month', d);
      const db = dashboard(month);
      const all = dashboard(null);
      const out = {};
      out.Dashboard = [
        ['Metric', 'This month', 'All time'],
        ['Total Orders', db.sales.orders, all.sales.orders],
        ['Total Revenue', db.sales.revenue, all.sales.revenue],
        ['Total Expenses', db.sales.expenses, all.sales.expenses],
        ['Net Profit', db.sales.profit, all.sales.profit],
        ['Injection Sales', db.sales.injection, all.sales.injection],
        ['Protein Sales', db.sales.protein, all.sales.protein],
        ['Diet Support Sales', db.sales.diet, all.sales.diet],
        ['Consultation Fees', db.sales.consultation, all.sales.consultation],
        ['Appointments', db.appointments.total, all.appointments.total],
        ['Clinic Visits', db.appointments.clinic, all.appointments.clinic],
        ['Online Consultations', db.appointments.online, all.appointments.online],
        ['New Leads', db.leads.total, all.leads.total],
        ['Leads Converted', db.leads.won, all.leads.won],
        ['Open Leads', db.leads.open, all.leads.open],
        ['Order Required', db.stock.order.map((l) => `${l.item.name} (${l.stock})`).join(', '), ''],
        ['Total Patients', db.patients.total, all.patients.total],
        ['New Patients', db.patients.new, all.patients.new],
        ['Renewal Patients', db.patients.renewal, all.patients.renewal],
        ['Active Patients', db.patients.active, all.patients.active],
        ['Team Members', db.team.members, all.team.members],
        ['Total Incentives', db.team.incentives, all.team.incentives],
        ['Monthly Salary', db.team.salary, all.team.salary],
        ['Top Performer', db.team.top ? db.team.top.name : '', all.team.top ? all.team.top.name : ''],
        ['Injection Stock', db.stock.injection, ''],
        ['Protein Stock', db.stock.protein, ''],
        ['Needles Stock', db.stock.needles, ''],
        ['Swabs Stock', db.stock.swabs, ''],
        ['Syringe Stock', db.stock.syringes, ''],
        ['Low Stock Alerts', db.stock.low.map((l) => `${l.item.name} (${l.stock})`).join(', '), ''],
        ['Updated', new Date(clock ? clock() : Date.now()).toISOString(), ''],
      ];
      out.Appointments = [['Date', 'Time', 'Patient', 'Mobile', 'Mode', 'Service', 'Doctor', 'Clinic', 'Fee', 'Payment', 'Payment Method', 'Status', 'Online Link', 'Notes']];
      appointmentsIn(null).forEach((a) => out.Appointments.push([a.date, a.time, a.patientName, a.mobile, APPT_MODES[a.mode], a.service || '', a.doctor || '', a.branch || '', a.fee,
        a.paid ? 'Paid' : 'Unpaid', a.payMethod || '', APPT_STATUS[a.status], a.link || '', a.notes || '']));
      const accName = (id) => (account(id) || {}).name || '';
      out.Leads = [['Date', 'Name', 'Mobile', 'Alt Mobile', 'Age', 'Gender', 'City', 'Source', 'Interested In', 'Priority', 'Status', 'Assigned To', 'Next Follow-up', 'Weight (kg)', 'Target (kg)', 'Height (cm)', 'Budget', 'Last Note', 'Added By']];
      [...S.leads].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((l) => {
        const note = [...(l.history || [])].reverse().find((h) => ['note', 'call', 'whatsapp'].includes(h.type));
        out.Leads.push([l.date, l.name, l.mobile, l.altMobile || '', l.age || '', l.gender || '', l.city || '', l.source || '', l.interest || '', LEAD_PRIORITIES[l.priority] || '',
          l.status, accName(l.assignedTo), l.followUp ? `${l.followUp} ${l.followTime || ''}`.trim() : '', l.weight || '', l.targetWeight || '', l.height || '', l.budget || '', note ? note.text : '', l.createdBy || '']);
      });
      out.Patients = [['Name', 'Mobile', 'First Purchase', 'Last Purchase', 'Orders', 'Total Spent', 'Last Product', 'Reference Team', 'Status', 'Age', 'Gender', 'City', 'Weight (kg)', 'Height (cm)', 'BMI']];
      const activeFrom = isoDate(new Date(parseDate(d) - S.settings.activeDays * 86400000));
      S.patients.forEach((p) => {
        const ps = patientSales(p.id);
        const last = ps[ps.length - 1];
        out.Patients.push([p.name, p.mobile, ps[0] ? ps[0].date : '', last ? last.date : '', ps.length, sum(ps, (s) => s.amount),
          last ? last.product : '', last ? refNames(last)[0] : '', last && last.date >= activeFrom ? 'Active' : 'Inactive',
          p.age || '', p.gender || '', p.city || '', p.weight || '', p.height || '', bmi(p.weight, p.height)]);
      });
      out['Injection Sales'] = [['Date', 'Patient', 'Mobile', 'New/Renewal', 'Product', 'Qty', 'Amount', 'Reference', 'Shared Reference', 'Split', 'Dietitian', 'Incentive', 'Notes']];
      out['Protein Sales'] = [['Date', 'Patient', 'Mobile', 'Protein Type', 'Qty', 'Amount', 'Reference', 'Shared Reference', 'Split', 'Incentive', 'Notes']];
      out['Diet Support'] = [['Date', 'Patient', 'Mobile', 'Plan', 'Amount', 'Reference', 'Shared Reference', 'Split', 'Incentive', 'Notes']];
      byDate.forEach((s) => {
        const [ref, shared] = refNames(s);
        if (s.type === 'injection') out['Injection Sales'].push([s.date, s.patientName, s.mobile, s.patientType === 'renewal' ? 'Renewal' : 'New', s.product, s.qty, s.amount, ref, shared, split(s), s.dietitianId ? memberName(s.dietitianId) : '', s.incentive, s.notes]);
        else if (s.type === 'protein') out['Protein Sales'].push([s.date, s.patientName, s.mobile, s.product, s.qty, s.amount, ref, shared, split(s), s.incentive, s.notes]);
        else out['Diet Support'].push([s.date, s.patientName, s.mobile, s.product.replace('Diet Support ', ''), s.amount, ref, shared, split(s), s.incentive, s.notes]);
      });
      out.Purchases = [['Date', 'Vendor', 'Invoice No', 'Product', 'Invoice Product Name', 'Qty', 'Batch', 'Expiry', 'Rate', 'GST %', 'Line Total']];
      [...S.purchases].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((p) => p.lines.forEach((l) => out.Purchases.push(
        [p.date, p.vendor, p.invoiceNo, l.name, l.invoiceName, l.qty, l.batch, l.expiry, l.rate, l.gst, l.total])));
      out.Inventory = [['Category', 'Item', 'Opening Stock', 'Purchased Stock', 'Sold Stock', 'Used (injection kit)', 'Adjusted', 'Available Stock', 'Low Stock At', 'Status', 'Order Required']];
      stockReport(null).forEach((r) => out.Inventory.push([r.category, r.name, r.opening, r.purchased, r.sold, r.used, r.adjusted, r.current, r.lowAt,
        r.disabled ? 'Disabled' : r.alertOff || S.settings.stockAlerts === false ? 'Alert off' : r.current <= r.lowAt ? 'LOW' : 'OK', r.orderAt != null && r.current < r.orderAt ? 'ORDER REQUIRED' : '']));
      out.Team = [['Name', 'Designation', 'Mobile', 'Salary', 'Incentive Status', 'Injection Incentive', 'Protein Incentive', 'Product-wise Incentive', 'Pay Counts', 'Joining Date', 'Status']];
      const PAY = { both: 'Salary + Incentive', salary: 'Salary only', incentive: 'Incentive only' };
      S.team.forEach((m) => out.Team.push([m.name, m.designation || '', m.mobile || '', m.salary, m.incentiveOn === false ? 'Off' : 'On',
        rateFor(m, 'injection', null), rateFor(m, 'protein', null),
        Object.entries(m.rates || {}).map(([k, v]) => `${(item(k) || S.settings.dietPlans.find((p) => p.id === k) || { name: k }).name} ₹${v}`).join(', '), PAY[m.payMode || 'both'], m.joiningDate || '', m.disabled ? 'Disabled' : 'Active']));
      out.Incentives = [['Date', 'Team Member', 'Sale Type', 'Patient', 'Product', 'Share %', 'Incentive']];
      incentiveLedger(null).reverse().forEach((l) => out.Incentives.push([l.date, l.name, SALE_TYPES[l.type], l.patient, l.product, l.pct, l.amount]));
      out.Salary = [['Month', 'Name', 'Designation', 'Salary', 'Incentive', 'Total Pay', 'Booked as Expense']];
      const months = new Set([monthOf(d), ...S.sales.map((s) => monthOf(s.date))]);
      [...months].sort().forEach((mo) => salarySheet(mo).forEach((r) => out.Salary.push([mo, r.name, r.designation || '', r.salary, r.incentive, r.total, salaryPosted(mo) ? 'Yes' : 'No'])));
      out.Expenses = [['Date', 'Category', 'Amount', 'Note']];
      [...S.expenses].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((e) => out.Expenses.push([e.date, e.category, e.amount, e.note || '']));
      out.Renewals = [['Patient', 'Mobile', 'Product', 'Last Purchase Date', 'Days Since', 'Reminder', 'Reference Team', 'Contacted']];
      renewals(d).forEach((r) => out.Renewals.push([r.name, r.mobile, r.product, r.lastDate, r.days, r.stage ? `${r.stage} Day alert` : `Due in ${r.dueIn} days`, r.ref, r.done ? 'Yes' : 'No']));
      out['Activity Log'] = [['Date & Time', 'By', 'Action', 'Details']];
      S.log.slice(-1500).reverse().forEach((x) => out['Activity Log'].push([new Date(x.at).toISOString().replace('T', ' ').slice(0, 16), x.by, x.action, x.detail]));
      return out;
    }

    // Settings and backup
    function updateSettings(patch) {
      Object.assign(S.settings, patch);
      const keys = Object.keys(patch).filter((k) => !LOCAL_SETTINGS.includes(k));
      if (keys.length) log('Settings changed', keys.join(', '));
      save();
    }
    function saveDietPlan(input) {
      let p = input.id && S.settings.dietPlans.find((x) => x.id === input.id);
      if (!p) { p = { id: uid('d'), disabled: false }; S.settings.dietPlans.push(p); }
      ['name', 'months', 'price', 'incentive', 'disabled'].forEach((k) => { if (k in input) p[k] = input[k]; });
      p.price = Number(p.price) || 0; p.incentive = Number(p.incentive) || 0;
      log('Diet plan saved', p.name);
      save();
      return p;
    }
    const exportBackup = () => JSON.stringify({ app: 'hindivine-admin', exported: new Date().toISOString(), data: exportState() });
    function importBackup(text) {
      const obj = JSON.parse(text);
      if (!obj || obj.app !== 'hindivine-admin' || !obj.data) fail('This is not a Hindivine Admin backup');
      const keep = {};
      LOCAL_SETTINGS.forEach((k) => { keep[k] = S.settings[k]; });
      const accounts = S.accounts;
      storage.setItem(KEY, JSON.stringify(obj.data));
      S = load();
      Object.assign(S.settings, keep);
      if (!S.accounts.some((a) => a.role === 'super' && a.hash)) S.accounts = accounts; // a backup without logins keeps this device's
      log('Backup imported', '');
      save();
    }
    /** Erase all data; the logins and this device's Google Sheet connection stay. */
    function resetAll() {
      const accounts = S.accounts; const keep = {};
      LOCAL_SETTINGS.forEach((k) => { keep[k] = S.settings[k]; });
      S = defaultState(); S.accounts = accounts; Object.assign(S.settings, keep);
      log('All data erased', '');
      save();
    }

    // Shared data for the Google Sheet store: everything except this device's own settings.
    function exportState() {
      const settings = { ...S.settings };
      LOCAL_SETTINGS.forEach((k) => { delete settings[k]; });
      return { ...S, settings };
    }
    /** Replace the data with a copy loaded from the Google Sheet, keeping this device's own settings. */
    function loadState(remote) {
      if (!remote || typeof remote !== 'object' || !Array.isArray(remote.sales)) fail('The Google Sheet data is not readable');
      const keep = {};
      LOCAL_SETTINGS.forEach((k) => { keep[k] = S.settings[k]; });
      storage.setItem(KEY, JSON.stringify(remote));
      S = load();
      Object.assign(S.settings, keep);
      save('remote');
    }

    return {
      get state() { return S; },
      today, onChange: (f) => listeners.push(f),
      member, memberName, saveMember, setMemberDisabled, deleteMember,
      item, itemsOf, saveItem, deleteItem, addCategory, stockOf, adjustStock, lowStock,
      matchItem: (name, kind) => matchItem(S.items.filter((i) => !i.disabled && (!kind || i.kind === kind)), name),
      findOrCreatePatient, patientSales, saveSale, deleteSale, settleSale, pendingSales, incentiveFor,
      savePurchase, deletePurchase, findDuplicatePurchase, lineTotal,
      saveExpense, deleteExpense,
      incentiveLedger, salarySheet, postSalary, salaryPosted,
      renewals, markRenewal,
      appointment, saveAppointment, updateAppointment, deleteAppointment, appointmentsIn, appointmentStats, feeEarned,
      account, saveAccount, setAccountPin, deleteAccount, setActor, logEvent, invoiceFor, setInvoiceInfo, importWhatsApp, importLeads, heyoSync, heyoAccount, fixWhatsAppNames, cleanLeadName,
      addListItem, removeListItem, renameListItem, renameCategory, deleteCategory, setKit, orderRequired, previewSplits, rateFor, setRate,
      updatePatient, deletePatient, daySummary,
      lead, saveLead, setLeadStatus, addLeadActivity, deleteLead, deleteLeads, convertLead, leadStats, findLeadByMobile, isClosedLead,
      teamReport, financialReport, stockReport, dashboard, sheetsData,
      updateSettings, saveDietPlan, exportBackup, importBackup, resetAll, exportState, loadState,
    };
  }

  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }

  // ── Merging two copies of the data (this device + Google Sheet) ──────────────
  const MERGE_COLLS = ['categories', 'items', 'team', 'patients', 'sales', 'purchases', 'expenses', 'moves', 'appointments', 'leads', 'accounts'];
  const recKey = (coll, rec) => `${coll}:${coll === 'categories' ? rec.name : rec.id}`;
  function eachRecord(st, fn) { MERGE_COLLS.forEach((c) => (st[c] || []).forEach((r) => { if (r && (r.id || r.name)) fn(recKey(c, r), r, c); })); }
  const sharedSettings = (set) => { const o = { ...set }; ['sheetsUrl', 'sheetsSecret', 'autoSync', 'lastSync', '_t'].forEach((k) => { delete o[k]; }); return o; };
  function recHash(rec) {
    const t = JSON.stringify(rec, (k, v) => (k === '_t' ? undefined : v));
    let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
    return `${t.length}:${h.toString(36)}`;
  }
  /**
   * Combine this device's data with the Google Sheet's: every record (sale, patient, appointment, lead…)
   * keeps its newest version, records deleted on either side stay deleted, logs are joined.
   */
  function mergeStates(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    const out = { ...remote };
    const deleted = { ...(remote.deleted || {}) };
    Object.entries(local.deleted || {}).forEach(([k, t]) => { if (!(deleted[k] >= t)) deleted[k] = t; });
    out.deleted = deleted;
    const alive = (key, rec) => !(deleted[key] >= (rec._t || 0));
    MERGE_COLLS.forEach((c) => {
      const map = new Map(); const order = [];
      (remote[c] || []).forEach((r) => { const k = recKey(c, r); map.set(k, r); order.push(k); });
      (local[c] || []).forEach((r) => {
        const k = recKey(c, r);
        const o = map.get(k);
        if (!o) { map.set(k, r); order.push(k); } else if ((r._t || 0) > (o._t || 0)) map.set(k, r);
      });
      out[c] = order.map((k) => map.get(k)).filter((r) => alive(recKey(c, r), r));
    });
    const ls = local.settings || {}; const rs = remote.settings || {};
    out.settings = (ls._t || 0) > (rs._t || 0) ? { ...ls } : { ...rs };
    out.renewalsDone = { ...(remote.renewalsDone || {}), ...(local.renewalsDone || {}) };
    const logKey = (x) => `${x.at}|${x.by}|${x.action}|${x.detail}`;
    const logs = new Map();
    [...(remote.log || []), ...(local.log || [])].forEach((x) => logs.set(logKey(x), x));
    out.log = [...logs.values()].sort((a, b) => a.at - b.at).slice(-3000);
    return out;
  }

  /**
   * Reads any JSON the MyOperator / Heyo panel loads and returns { msgs, convs }:
   * msgs [{id, at, dir, phone, name, text}] for single messages, convs [{phone, name, assignee, at, text}] for chat-list rows.
   * Field names differ between versions, so it matches them by pattern; ownNumbers are the clinic's own WhatsApp numbers.
   */
  function parseChatCapture(data, ownNumbers) {
    const dig = (v) => String(v == null ? '' : v).replace(/\D/g, '');
    const own = new Set((ownNumbers || []).map((x) => dig(x).slice(-10)).filter((x) => x.length === 10));
    const key = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    const PHONE = /^(phone|mobile|msisdn|wa_?id|contact_?(no|number|phone|mobile)|customer_?(no|number|phone|mobile)|number|phone_?(no|number)|mobile_?(no|number)|whatsapp_?(no|number)|from|to|sender|recipient|recipient_?id|user_?phone|lead_?(phone|mobile)|country_?phone)$/;
    const NAME = /^(name|full_?name|display_?name|contact_?name|customer_?name|profile_?name|wa_?name|push_?name|lead_?name)$/;
    const TEXT = /^(text|body|message|message_?text|content|msg|caption|last_?message|last_?msg|last_?message_?text|preview|snippet)$/;
    const TIME = /^(timestamp|time|ts|created_?at|updated_?at|sent_?at|received_?at|date|date_?time|last_?message_?(at|time)|last_?activity(_?at)?|last_?msg_?time)$/;
    const AGENT = /(assign|agent|owner|executive|handled_?by|operator|staff)/;
    const AGENT_NAME = ['name', 'full_name', 'fullname', 'display_name', 'username', 'user_name', 'first_name', 'email'];
    const phoneOf = (v) => { if (typeof v !== 'string' && typeof v !== 'number') return ''; const d = dig(v); return d.length >= 10 && d.length <= 13 && String(v).replace(/[\s+()-]/g, '').length <= 15 ? d.slice(-10) : ''; };
    const timeOf = (v) => {
      if (typeof v === 'number') return v > 1e12 ? v : v > 1e9 ? v * 1000 : 0;
      if (typeof v === 'string') { if (/^\d{10,13}$/.test(v)) return timeOf(Number(v)); const t = Date.parse(v); return Number.isFinite(t) && t > 946684800000 ? t : 0; }
      return 0;
    };
    const textOf = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' && typeof v.body === 'string' ? v.body : v && typeof v === 'object' && typeof v.text === 'string' ? v.text : '');
    const agentOf = (v) => {
      if (typeof v === 'string') return /^\d+$/.test(v) || v.length > 60 ? '' : v.trim();
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const k = Object.keys(v).find((x) => AGENT_NAME.includes(key(x)) && typeof v[x] === 'string' && v[x].trim());
        if (k) return key(k) === 'first_name' && v.last_name ? `${v[k]} ${v.last_name}`.trim() : v[k].trim();
      }
      return '';
    };
    // The first customer phone anywhere inside a node — used when a message's phone sits in a sibling
    // subtree (e.g. conversation.contact.phone next to conversation.message.body).
    const deepPhone = (node, d) => {
      if (!node || typeof node !== 'object' || d > 6) return '';
      if (Array.isArray(node)) { for (const x of node) { const p = deepPhone(x, d + 1); if (p) return p; } return ''; }
      for (const k0 of Object.keys(node)) {
        const v = node[k0];
        if (PHONE.test(key(k0))) { const ph = phoneOf(v) || (v && typeof v === 'object' ? phoneOf(v.phone || v.number || v.wa_id || v.mobile || v.phone_number) : ''); if (ph && !own.has(ph)) return ph; }
      }
      for (const k0 of Object.keys(node)) { const v = node[k0]; if (v && typeof v === 'object') { const p = deepPhone(v, d + 1); if (p) return p; } }
      return '';
    };
    const msgs = []; const convs = new Map(); let n = 0;
    const walk = (node, ctx, depth) => {
      if (!node || typeof node !== 'object' || depth > 12 || ++n > 50000) return;
      if (Array.isArray(node)) { node.forEach((x) => walk(x, ctx, depth + 1)); return; }
      const f = { phones: [], name: '', text: '', at: 0, agent: '', out: null, id: '' };
      Object.keys(node).forEach((k0) => {
        const k = key(k0); const v = node[k0];
        if (PHONE.test(k)) { const ph = phoneOf(v) || (v && typeof v === 'object' ? phoneOf(v.phone || v.number || v.wa_id || v.mobile) : ''); if (ph) f.phones.push([k, ph]); }
        if (!f.name && NAME.test(k) && typeof v === 'string' && v.trim() && !phoneOf(v)) f.name = v.trim();
        if (!f.text && TEXT.test(k)) f.text = textOf(v);
        if (!f.at && TIME.test(k)) f.at = timeOf(v);
        if (!f.agent && AGENT.test(k)) f.agent = agentOf(v);
        if (/^(id|message_?id|wamid|msg_?id|uuid|_id)$/.test(k) && (typeof v === 'string' || typeof v === 'number')) f.id = String(v);
        if (/^(direction|message_?direction|sender_?type|msg_?type|origin)$/.test(k) && typeof v === 'string') f.out = /out|sent|agent|business|user|operator|bot|template/i.test(v) && !/customer|contact|incoming|inbound|received/i.test(v);
        if (/^(from_?me|is_?outgoing|outgoing|is_?sent|sent_?by_?me|is_?agent)$/.test(k) && typeof v === 'boolean') f.out = v;
        if ((k === 'contact' || k === 'customer' || k === 'lead' || k === 'user' || k === 'profile') && v && typeof v === 'object' && !Array.isArray(v)) {
          const ph = phoneOf(v.phone || v.mobile || v.number || v.wa_id || v.phone_number || v.mobile_number);
          if (ph) f.phones.push(['contact', ph]);
          if (!f.name) { const nm = v.name || v.full_name || v.display_name || v.profile_name; if (typeof nm === 'string' && !phoneOf(nm)) f.name = nm.trim(); }
        }
      });
      // The customer's number: anything that is not the clinic's own; a message "from" the clinic is outgoing.
      const fromOwn = f.phones.some(([k, ph]) => (k === 'from' || k === 'sender') && own.has(ph));
      const cust = (f.phones.find(([, ph]) => !own.has(ph)) || [])[1] || '';
      // This node carries message content but no phone of its own: find the phone in its subtree.
      let ctxPhone = ctx.phone;
      if (!cust && !ctxPhone && (f.text || f.at || f.agent)) ctxPhone = deepPhone(node, 0);
      const phone = cust || ctxPhone;
      const name = cust ? f.name : ctx.name;
      if (phone) {
        if (f.text && f.at) {
          const out = f.out != null ? f.out : fromOwn;
          msgs.push({ id: f.id ? `p${f.id}` : `p${phone}-${f.at}-${f.text.length}`, at: f.at, dir: out ? 'out' : 'in', phone, name: out ? '' : (name || ''), text: f.text.slice(0, 2000) });
        }
        if (cust) {
          const c = convs.get(cust) || { phone: cust, name: '', assignee: '', at: 0, text: '' };
          if (f.name && !c.name) c.name = f.name;
          if (f.agent && (!c.assignee || f.at >= c.at)) c.assignee = f.agent;
          if (f.at >= c.at) { c.at = f.at || c.at; if (f.text) c.text = f.text.slice(0, 500); }
          convs.set(cust, c);
        }
      }
      const next = { phone: cust || ctxPhone, name: cust ? f.name : ctx.name };
      Object.keys(node).forEach((k) => { if (node[k] && typeof node[k] === 'object' && !AGENT.test(key(k))) walk(node[k], next, depth + 1); });
    };
    walk(data, { phone: '', name: '' }, 0);
    return { msgs, convs: [...convs.values()] };
  }

  /** Body-mass index from kg and cm, one decimal; '' when either is missing. */
  function bmi(weight, height) {
    const w = Number(weight); const h = Number(height) / 100;
    if (!(w > 0) || !(h > 0.5)) return '';
    return (w / (h * h)).toFixed(1);
  }
  const bmiLabel = (b) => (!b ? '' : b < 18.5 ? 'Underweight' : b < 23 ? 'Normal' : b < 25 ? 'Overweight' : b < 30 ? 'Obese I' : 'Obese II');
  const api = {
    bmi, bmiLabel, mergeStates, parseChatCapture, createAdmin, memoryStorage, defaultState, splitIncentive, matchItem, rangeFor, monthRange, isoDate, daysBetween,
    KINDS, SALE_TYPES, EXPENSE_CATEGORIES, SHEETS, KEY, ROLES, APPT_MODES, APPT_STATUS, PAY_METHODS, DEFAULT_PERMS, LEAD_PRIORITIES, DEFAULT_LISTS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ADMIN = api;
})(typeof window !== 'undefined' ? window : globalThis);
