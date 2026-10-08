/**
 * Hindivine Admin ↔ Google Sheets: the sheet is the app's data store.
 *
 * Every save from the app writes:
 *   - the complete app data (JSON) into the hidden sheet "_AppData", which the app loads back
 *     on every device, so all admins share one set of data;
 *   - the 15 readable sheets (Dashboard, Appointments, Leads, Patients, … Renewals, Activity Log), rebuilt from that data.
 *
 * Set-up (once):
 * 1. Open the Hindivine Google Sheet → Extensions → Apps Script, paste this file, Save.
 * 2. Run `setup` once and allow access. It creates the sheets and logs a secret (View → Logs).
 * 3. Deploy → New deployment → Web app: Execute as "Me", Who has access "Anyone".
 * 4. In the admin app: Settings → Google Sheet → paste the web app URL and the secret → Save.
 *
 * Edit data in the app, not in the sheets: each save rewrites the 15 sheets.
 *
 * Which spreadsheet holds the data:
 *  - By default the current Hindivine sheet (SHEET_ID below, or the sheet this script is attached to).
 *  - Run `useNewSpreadsheet` to create a brand-new spreadsheet, copy all app data into it and use it from now on
 *    (its link is in the log). Run `useCurrentSheet` to go back. Missing tabs are always created automatically.
 *  The app's Settings → Google Sheet shows which spreadsheet is in use.
 *
 * Leads in a separate spreadsheet (optional): from the app (Settings → Google Sheet → Leads spreadsheet) create a new
 * "Hindivine Leads" spreadsheet or connect an existing one. The Leads tab and the WhatsApp tab then go there instead
 * of this sheet (property LEADS_SHEET_ID). The app's own data still lives in this sheet's hidden _AppData.
 *
 * WhatsApp (Heyo / MyOperator):
 *  - Webhook: in the Heyo / MyOperator panel set the incoming-message webhook to
 *      <this web app URL>?hook=whatsapp&key=<secret>
 *    (the app shows the exact link in Settings → Google Sheet). Every message is saved in the "WhatsApp" tab.
 *  - Optional pull from the API: Project Settings → Script Properties → add MYOP_API_KEY, MYOP_COMPANY_ID and
 *    MYOP_LIST_PATH (the "list messages" endpoint path MyOperator gives you, e.g. /chat/messages), then run
 *    `installWhatsAppPull` once (every 5 minutes). Keys stay in Script Properties, never in the app or the code.
 */
const SHEET_ID = '1_aKPoHJaJfQ6awuoG7ihufQzOBhw8I84yipErlWO1_Y';
const SHEETS = ['Dashboard', 'Appointments', 'Leads', 'Patients', 'Injection Sales', 'Protein Sales', 'Diet Support', 'Purchases',
  'Inventory', 'Team', 'Incentives', 'Salary', 'Expenses', 'Renewals', 'Activity Log'];
const DATA_SHEET = '_AppData';
const CHUNK = 40000; // a cell holds up to 50,000 characters
const NAVY = '#0a2f55';

function book() {
  const id = PropertiesService.getScriptProperties().getProperty('DATA_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  let active = null;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { active = null; }
  return active || SpreadsheetApp.openById(SHEET_ID);
}

function ensureTabs(ss) {
  SHEETS.forEach((name, i) => { if (!ss.getSheetByName(name)) ss.insertSheet(name, Math.min(i, ss.getSheets().length)); });
  dataSheet(ss);
}

/** Create a new spreadsheet, copy all app data into it and store everything there from now on. */
function useNewSpreadsheet() {
  const from = book();
  const d = readData(from);
  const ss = SpreadsheetApp.create('Hindivine Admin Data ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  ensureTabs(ss);
  const blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);
  if (d.state) writeData(ss, d.state, 'Moved from ' + from.getName());
  PropertiesService.getScriptProperties().setProperty('DATA_SHEET_ID', ss.getId());
  Logger.log('Now using the new spreadsheet: ' + ss.getUrl() + '. The 15 readable tabs fill in on the next save from the app.');
  return ss.getUrl();
}

/** Go back to the current Hindivine sheet (SHEET_ID / the sheet this script is attached to). */
function useCurrentSheet() {
  PropertiesService.getScriptProperties().deleteProperty('DATA_SHEET_ID');
  const ss = book();
  ensureTabs(ss);
  Logger.log('Now using: ' + ss.getUrl());
  return ss.getUrl();
}

function setup() {
  const ss = book();
  ensureTabs(ss);
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty('SECRET', secret);
  }
  Logger.log('Secret for the admin app: ' + secret);
  return secret;
}

function dataSheet(ss) {
  let sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DATA_SHEET);
    sh.getRange('A1').setValue('{"updated":0}');
    sh.hideSheet();
    sh.protect().setDescription('Hindivine Admin app data: do not edit').setWarningOnly(true);
  }
  return sh;
}

function checkSecret(given) {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  return !!secret && given === secret;
}

function readData(ss) {
  const sh = dataSheet(ss);
  const meta = JSON.parse(sh.getRange('A1').getValue() || '{"updated":0}');
  if (!meta.chunks) return { updated: meta.updated || 0, state: null };
  const parts = sh.getRange(2, 1, meta.chunks, 1).getValues().map((r) => r[0]).join('');
  return { updated: meta.updated, by: meta.by || '', state: JSON.parse(parts) };
}

function writeData(ss, state, by) {
  const sh = dataSheet(ss);
  const text = JSON.stringify(state);
  const parts = [];
  for (let i = 0; i < text.length; i += CHUNK) parts.push([text.slice(i, i + CHUNK)]);
  sh.getRange('A2:A').clearContent();
  if (parts.length) sh.getRange(2, 1, parts.length, 1).setNumberFormat('@').setValues(parts);
  const meta = { updated: Date.now(), chunks: parts.length, by: by || '' };
  sh.getRange('A1').setValue(JSON.stringify(meta));
  return meta.updated;
}

// Tabs that go to the separate leads spreadsheet when one is connected.
const LEAD_TABS = ['Leads'];
/** The separate leads spreadsheet, or null when leads stay in the main sheet. */
function leadsBook() {
  const id = PropertiesService.getScriptProperties().getProperty('LEADS_SHEET_ID');
  if (!id) return null;
  try { return SpreadsheetApp.openById(id); } catch (err) { return null; }
}
function leadsInfo() {
  const lb = leadsBook();
  return lb ? { name: lb.getName(), url: lb.getUrl(), separate: true } : { separate: false };
}

function writeSheets(ss, sheets) {
  const written = {};
  const lb = leadsBook();
  SHEETS.forEach((name, i) => {
    const rows = (sheets || {})[name];
    if (!rows) return;
    const target = lb && LEAD_TABS.indexOf(name) >= 0 ? lb : ss;
    if (target !== ss) {
      // Leave a pointer in the main sheet instead of an old copy.
      const old = ss.getSheetByName(name);
      if (old) { old.clearContents(); old.getRange('A1').setValue('Leads are kept in the separate spreadsheet: ' + lb.getUrl()); }
    }
    const sh = target.getSheetByName(name) || target.insertSheet(name, target === ss ? i : 0);
    sh.clearContents();
    if (!rows.length) return;
    const width = Math.max.apply(null, rows.map((r) => r.length));
    const data = rows.map((r) => { const x = r.slice(); while (x.length < width) x.push(''); return x; });
    sh.getRange(1, 1, data.length, width).setValues(data);
    sh.getRange(1, 1, 1, width).setFontWeight('bold').setBackground(NAVY).setFontColor('#ffffff');
    sh.setFrozenRows(1);
    written[name] = data.length - 1;
  });
  return written;
}

/** GET ?action=load&secret=… → the app data; ?action=wa&since=… → WhatsApp messages; GET without action → health check. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'myopprobe') {
    if (!checkSecret(p.secret)) return json({ ok: false, error: 'Wrong secret.' });
    try { return json({ ok: true, probe: probeMyOperator() }); } catch (err) { return json({ ok: false, error: String(err.message || err) }); }
  }
  if (p.action === 'wa' || p.action === 'wapull') {
    if (!checkSecret(p.secret)) return json({ ok: false, error: 'Wrong secret.' });
    let pulled = null;
    if (p.action === 'wapull') { try { pulled = pullWhatsApp(); } catch (err) { pulled = { error: String(err.message || err) }; } }
    return json({ ok: true, messages: waRead(Number(p.since) || 0), pulled: pulled });
  }
  if (p.action !== 'load') return json({ ok: true, app: 'hindivine-admin-sheets', sheets: SHEETS });
  if (!checkSecret(p.secret)) return json({ ok: false, error: 'Wrong secret. Run setup and copy the secret again.' });
  const ss = book();
  const d = readData(ss);
  return json({ ok: true, updated: d.updated, by: d.by, state: d.state, sheetName: ss.getName(), sheetUrl: ss.getUrl(), leadsSheet: leadsInfo() });
}

/**
 * POST {action:'save', secret, state, sheets, base, by}. `base` is the version the app last loaded;
 * if another device saved since then the save is refused (conflict) so no one's work is overwritten.
 */
function doPost(e) {
  const q = (e && e.parameter) || {};
  if (q.hook === 'whatsapp') return waWebhook(e, q);
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'Bad JSON' }); }
  if (!checkSecret(body.secret)) return json({ ok: false, error: 'Wrong secret. Run setup and copy the secret again.' });
  if (body.action === 'leadsSheet') {
    try { return json({ ok: true, leadsSheet: setLeadsSheet(body.mode, body.ref) }); } catch (err) { return json({ ok: false, error: String(err.message || err) }); }
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = book();
    let updated = null;
    if (body.action === 'save') {
      const current = JSON.parse(dataSheet(ss).getRange('A1').getValue() || '{"updated":0}');
      if (current.updated && !body.force && body.base !== current.updated) {
        return json({ ok: false, conflict: true, updated: current.updated, by: current.by || '' });
      }
      updated = writeData(ss, body.state, body.by);
    }
    const written = writeSheets(ss, body.sheets);
    SpreadsheetApp.flush();
    return json({ ok: true, updated: updated, written: written });
  } finally {
    lock.releaseLock();
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ── WhatsApp messages (Heyo / MyOperator) ───────────────────────
const WA_SHEET = 'WhatsApp';
const WA_HEAD = ['Received', 'At (ms)', 'Direction', 'Phone', 'Name', 'Message', 'Type', 'Message ID', 'Raw'];
const MYOP_BASE = 'https://publicapi.myoperator.co';

function waSheet(ss) {
  ss = leadsBook() || ss;
  let sh = ss.getSheetByName(WA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(WA_SHEET);
    sh.getRange(1, 1, 1, WA_HEAD.length).setValues([WA_HEAD]).setFontWeight('bold').setBackground(NAVY).setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.hideColumns(2);
  }
  return sh;
}

/** Webhook from Heyo / MyOperator: ?hook=whatsapp&key=<secret>. Saves every message it can find in the payload. */
function waWebhook(e, q) {
  if (!checkSecret(q.key)) return json({ ok: false, error: 'Wrong key' });
  let body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { body = { text: String((e.postData && e.postData.contents) || '') }; }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const n = waStore(waExtract(body), body);
    return json({ ok: true, saved: n });
  } finally { lock.releaseLock(); }
}

/** Finds messages in any common WhatsApp payload shape (Meta Cloud API, MyOperator / Heyo, flat objects). */
function waExtract(body) {
  const out = [];
  const names = {};
  const digits = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
  const str = (v) => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
  // Meta format: entry[].changes[].value.{contacts, messages}
  (body.entry || []).forEach((en) => (en.changes || []).forEach((ch) => {
    const v = ch.value || {};
    (v.contacts || []).forEach((c) => { names[digits(c.wa_id)] = c.profile && c.profile.name; });
    (v.messages || []).forEach((m) => out.push(waMsg(m, names[digits(m.from)], 'in')));
  }));
  if (out.length) return out;
  // Anything else: every object that has a phone-like and a text-like field.
  const seen = new Set();
  const walk = (o, depth) => {
    if (!o || typeof o !== 'object' || depth > 6) return;
    if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
    const text = str(o.text && o.text.body) || str(o.text) || str(o.body) || str(o.message) || str(o.message_text) || str(o.content) || str(o.msg) || str(o.caption)
      || str(o.data && o.data.text) || '';
    const phone = digits(o.from || o.wa_id || o.mobile || o.phone || o.phone_number || o.customer_number || o.customer_phone || o.contact_number || o.sender || o.number || o.msisdn || o.to);
    if (text && phone.length >= 10) {
      const m = waMsg(o, str(o.name || o.customer_name || o.contact_name || o.profile_name || (o.profile && o.profile.name) || (o.contact && o.contact.name)), '');
      if (!seen.has(m.id)) { seen.add(m.id); out.push(m); }
      return;
    }
    Object.keys(o).forEach((k) => walk(o[k], depth + 1));
  };
  walk(body, 0);
  return out;
}

function waMsg(m, name, dir) {
  const digits = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
  const text = (m.text && m.text.body) || (typeof m.text === 'string' ? m.text : '') || m.body || m.message || m.message_text || m.content || m.msg || m.caption
    || (m.image && (m.image.caption || '[photo]')) || (m.document && '[document]') || (m.audio && '[voice message]') || (m.button && m.button.text) || (m.interactive && JSON.stringify(m.interactive).slice(0, 200)) || '';
  const outgoing = dir === 'out' || /out|sent|agent|business/i.test(String(m.direction || m.message_direction || m.source || '')) || m.from_me === true || m.fromMe === true;
  const phone = digits(outgoing ? (m.to || m.recipient || m.customer_number || m.phone || m.mobile) : (m.from || m.wa_id || m.customer_number || m.phone || m.mobile || m.sender || m.msisdn));
  const ts = Number(m.timestamp || m.time || m.created_at_ts || 0);
  const at = ts ? (ts < 1e12 ? ts * 1000 : ts) : (Date.parse(m.created_at || m.createdAt || m.date || '') || Date.now());
  const id = String(m.id || m.message_id || m.wamid || m.messageId || `${phone}-${at}-${String(text).length}`);
  return { id: id, at: at, dir: outgoing ? 'out' : 'in', phone: phone.slice(-12), name: String(name || ''), text: String(text).slice(0, 2000), type: String(m.type || m.message_type || 'text') };
}

/** Appends new messages (skips ids already saved). */
function waStore(msgs, raw) {
  const ss = book();
  const sh = waSheet(ss);
  const last = sh.getLastRow();
  const from = Math.max(2, last - 1500);
  const known = new Set(last >= 2 ? sh.getRange(from, 8, last - from + 1, 1).getValues().map((r) => String(r[0])) : []);
  const rows = msgs.filter((m) => m.text && !known.has(m.id)).map((m) => [new Date(m.at), m.at, m.dir === 'out' ? 'Sent' : 'Received', m.phone, m.name, m.text, m.type, m.id, JSON.stringify(raw || '').slice(0, 4000)]);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, WA_HEAD.length).setValues(rows);
  return rows.length;
}

/** Messages saved after `since` (ms), newest 1000. */
function waRead(since) {
  const sh = (leadsBook() || book()).getSheetByName(WA_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const last = sh.getLastRow();
  const from = Math.max(2, last - 3000);
  return sh.getRange(from, 1, last - from + 1, 8).getValues()
    .filter((r) => Number(r[1]) > since)
    .map((r) => ({ at: Number(r[1]), dir: r[2] === 'Sent' ? 'out' : 'in', phone: String(r[3]), name: String(r[4] || ''), text: String(r[5] || ''), type: String(r[6] || ''), id: String(r[7]) }))
    .slice(-1000);
}

/**
 * Optional: fetch messages from the MyOperator public API. Needs Script Properties MYOP_API_KEY, MYOP_COMPANY_ID and
 * MYOP_LIST_PATH (ask MyOperator support for the "list WhatsApp messages / conversations" endpoint).
 */
function pullWhatsApp() {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('MYOP_API_KEY'); const company = props.getProperty('MYOP_COMPANY_ID'); const path = props.getProperty('MYOP_LIST_PATH');
  if (!key || !path) return { skipped: 'Add MYOP_API_KEY and MYOP_LIST_PATH in Script Properties to fetch from the MyOperator API.' };
  const url = MYOP_BASE + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'company_id=' + encodeURIComponent(company || '') + '&limit=100';
  const res = UrlFetchApp.fetch(url, { method: 'get', headers: { 'x-api-key': key, Authorization: 'Bearer ' + key, Accept: 'application/json' }, muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code >= 300) return { error: 'MyOperator replied ' + code + ': ' + res.getContentText().slice(0, 200) };
  const body = JSON.parse(res.getContentText() || '{}');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return { saved: waStore(waExtract(body), null) }; } finally { lock.releaseLock(); }
}

/** Run once to fetch from the MyOperator API every 5 minutes (only needed if the webhook is not set up). */
function installWhatsAppPull() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'pullWhatsApp').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pullWhatsApp').timeBased().everyMinutes(5).create();
  Logger.log(JSON.stringify(pullWhatsApp()));
}

/**
 * Choose where leads go: mode 'new' creates a "Hindivine Leads" spreadsheet, 'connect' uses an existing one
 * (link or id in ref), 'main' brings leads back to this sheet. Existing WhatsApp messages are copied across.
 */
function setLeadsSheet(mode, ref) {
  const props = PropertiesService.getScriptProperties();
  const main = book();
  const before = leadsBook() || main;
  let target = null;
  if (mode === 'main') props.deleteProperty('LEADS_SHEET_ID');
  else {
    if (mode === 'new') target = SpreadsheetApp.create('Hindivine Leads');
    else {
      const m = String(ref || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/) || String(ref || '').match(/^([a-zA-Z0-9_-]{20,})$/);
      if (!m) throw new Error('Paste the Google Sheet link (or its id)');
      try { target = SpreadsheetApp.openById(m[1]); } catch (err) { throw new Error('Cannot open that sheet: share it with the Google account that runs this script'); }
      if (target.getId() === main.getId()) { props.deleteProperty('LEADS_SHEET_ID'); return leadsInfo(); }
    }
    props.setProperty('LEADS_SHEET_ID', target.getId());
  }
  const after = leadsBook() || main;
  // Move the WhatsApp messages with the leads.
  const from = before.getSheetByName(WA_SHEET);
  if (from && before.getId() !== after.getId() && from.getLastRow() > 1) {
    const to = waSheet(after);
    const rows = from.getRange(2, 1, from.getLastRow() - 1, WA_HEAD.length).getValues();
    if (to.getLastRow() < 2) to.getRange(2, 1, rows.length, WA_HEAD.length).setValues(rows);
  }
  if (mode === 'new') { const blank = target.getSheetByName('Sheet1'); waSheet(target); if (blank && target.getSheets().length > 1) target.deleteSheet(blank); }
  return leadsInfo();
}

/**
 * Tries the likely MyOperator / Heyo endpoints with MYOP_API_KEY and reports which answer (status + a short sample).
 * Read-only GET calls. Run it from the app (Settings → Google Sheet → WhatsApp → Test MyOperator API) or here.
 * When one returns messages, put its path in MYOP_LIST_PATH and run installWhatsAppPull.
 */
function probeMyOperator() {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('MYOP_API_KEY'); const company = props.getProperty('MYOP_COMPANY_ID') || '';
  if (!key) return { error: 'Add MYOP_API_KEY (and MYOP_COMPANY_ID) in Apps Script → Project Settings → Script Properties first.' };
  const paths = ['/chat/messages', '/chat/conversations', '/chat/contacts', '/chats', '/messages', '/conversations', '/contacts',
    '/whatsapp/messages', '/whatsapp/conversations', '/whatsapp/contacts', '/whatsapp/chats', '/wa/messages', '/v1/messages',
    '/v1/conversations', '/v1/chats', '/v1/contacts', '/v2/messages', '/api/v1/messages', '/api/v1/conversations', '/leads', '/v1/leads'];
  const out = [];
  paths.forEach((path) => {
    const url = MYOP_BASE + path + '?company_id=' + encodeURIComponent(company) + '&limit=5';
    try {
      const res = UrlFetchApp.fetch(url, { method: 'get', headers: { 'x-api-key': key, Authorization: 'Bearer ' + key, Accept: 'application/json' }, muteHttpExceptions: true, followRedirects: true });
      const body = res.getContentText() || '';
      let found = 0;
      try { found = waExtract(JSON.parse(body)).length; } catch (e) { found = 0; }
      out.push({ path: path, status: res.getResponseCode(), messages: found, sample: body.replace(/\s+/g, ' ').slice(0, 160) });
    } catch (err) { out.push({ path: path, status: 0, messages: 0, sample: String(err.message || err).slice(0, 160) }); }
  });
  Logger.log(JSON.stringify(out, null, 1));
  return out;
}
