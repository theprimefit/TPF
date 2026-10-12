const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));
let mode = 'standalone';

$('open').onclick = () => send({ type: 'open' });
$('settings').onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
$('enabled').onchange = async () => { await chrome.storage.local.set({ enabled: $('enabled').checked }); load(); };

function showError(text, html) {
  $('err').hidden = !text;
  if (html) $('err').innerHTML = html; else $('err').textContent = text || '';
}

function render(stats, leads, footer) {
  $('tiles').innerHTML = [
    ['New today', stats.newToday], ['Hot', stats.hot], ['Booked', stats.booked],
    ['Verify payment', stats.toVerify, true], ['Need a person', stats.needsHuman, true], ['Conversion', `${stats.conversion}%`],
  ].map(([k, v, alert]) => `<div class="tile ${alert && v ? 'alert' : ''}"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('');
  const items = leads.map((l) => ({ l, why: HL.needsAttention(l) })).filter((x) => x.why)
    .sort((a, b) => (a.why === 'Verify payment' ? -1 : 0) - (b.why === 'Verify payment' ? -1 : 0));
  $('list').innerHTML = items.length ? items.slice(0, 20).map(({ l, why }) => `
    <li data-phone="${esc(l.phone)}">
      <span class="name">${esc(l.name || '+' + l.phone)}</span><span class="pill ${esc(l.temperature)}">${esc(l.score)}</span>
      <span class="why">${esc(why)} · ${esc(l.stage)}</span>
      <span class="acts">
        ${l.paymentStatus === 'to_verify' ? '<button data-act="paid" class="primary">Mark paid</button>' : ''}
        ${l.botPaused && !l.optedOut ? '<button data-act="resume">Resume bot</button>' : ''}
        <button data-act="open">Open</button>
      </span>
    </li>`).join('') : `<li><span class="muted">${leads.length ? 'Nothing needs you right now.' : 'No leads yet. They appear here when people message your WhatsApp.'}</span></li>`;
  $('foot').textContent = footer;
}

async function loadStandalone() {
  const { enabled } = await chrome.storage.local.get('enabled');
  $('status').hidden = false;
  $('enabled').checked = enabled !== false;
  const tab = await HL.whatsappTab();
  let health = null;
  if (tab) health = await chrome.tabs.sendMessage(tab.id, { type: 'agent:health' }).then((r) => r && r.data).catch(() => null);
  if (!tab) {
    $('statusText').innerHTML = '<span class="warn-text">WhatsApp Web is not open.</span> <a href="#" id="openWa">Open it</a>';
    $('openWa').onclick = (e) => { e.preventDefault(); chrome.tabs.create({ url: 'https://web.whatsapp.com/', pinned: true }); };
  } else if (!health) {
    $('statusText').innerHTML = '<span class="warn-text">Reload the WhatsApp Web tab</span> to start the agent.';
  } else if (!health.ready) {
    $('statusText').innerHTML = '<span class="warn-text">Log in to WhatsApp Web</span> (scan its QR with your phone).';
  } else if (health.problem) {
    $('statusText').innerHTML = `<span class="warn-text">${esc(health.problem)}</span>`;
  } else {
    $('statusText').innerHTML = $('enabled').checked ? '<span class="ok-text">● Agent is replying</span>' : '<span class="warn-text">Auto-reply is off</span>';
  }
  const leads = await HL.localLeads();
  render(HL.localStats(leads), leads, `${leads.length} leads · saved in this browser`);
}

async function loadServer() {
  $('status').hidden = true;
  const { server } = await HL.config();
  if (!server) return showError('x', 'Server mode needs an address. <a href="#" id="opt">Open settings</a>.'), ($('opt').onclick = () => chrome.runtime.openOptionsPage());
  const [s, leads] = await Promise.all([HL.api('/api/stats'), HL.api('/api/leads')]);
  $('wa').hidden = !s.whatsapp || s.whatsapp.state === 'connected';
  $('wa').textContent = 'WhatsApp is not linked, so the agent cannot reply. Open Setup on the agent to scan the QR code.';
  render({ newToday: s.newToday, hot: s.byTemp.hot || 0, booked: s.byStage.booked, toVerify: s.paymentsToVerify || 0, needsHuman: s.needsHuman, conversion: s.conversionRate }, leads, `${s.total} leads · ${server.replace(/^https?:\/\//, '')}`);
}

async function load() {
  mode = await HL.mode();
  try {
    showError('');
    if (mode === 'standalone') await loadStandalone(); else await loadServer();
  } catch (e) {
    showError(e.message);
  }
}

$('list').onclick = async (e) => {
  const li = e.target.closest('li[data-phone]');
  if (!li) return;
  const phone = li.dataset.phone;
  const act = e.target.dataset.act || (e.target.classList.contains('name') ? 'open' : '');
  if (act === 'open') return send({ type: 'open', phone });
  const patch = act === 'paid' ? { paymentStatus: 'paid' } : act === 'resume' ? { botPaused: false } : null;
  if (!patch) return;
  e.target.disabled = true;
  try {
    if (mode === 'standalone') await HL.toAgent({ type: 'agent:patch', phone, patch });
    else { const r = await send({ type: 'patch', phone, patch }); if (!r.ok) throw new Error(r.error); }
  } catch (err) { showError(err.message); }
  load();
};

load();
