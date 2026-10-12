// All leads saved by the in-browser agent, with chats and controls.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STAGES = ['new', 'engaged', 'qualified', 'booked', 'won', 'lost'];
const LABELS = { currentWeight: 'Weight', height: 'Height', age: 'Age', condition: 'Condition', preferredProgram: 'Interested in', consultMode: 'Consultation', city: 'City', intent: 'Buying intent' };
let leads = [];
let selected = location.hash.slice(1) || '';

function err(text) { $('err').hidden = !text; $('err').textContent = text || ''; }

async function load() {
  if ((await HL.mode()) !== 'standalone') {
    const { server } = await HL.config();
    location.replace(`${server}/dashboard`);
    return;
  }
  leads = await HL.localLeads();
  const s = HL.localStats(leads);
  $('tiles').innerHTML = [['Total leads', s.total], ['New today', s.newToday], ['Hot', s.hot], ['Booked', s.booked], ['Verify payment', s.toVerify], ['Need a person', s.needsHuman], ['Conversion', `${s.conversion}%`]]
    .map(([k, v]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('');
  renderList();
  if (selected) renderDetail();
}

function renderList() {
  const q = $('q').value.toLowerCase();
  const f = $('filter').value;
  const shown = leads.filter((l) => (!q || `${l.name} ${l.phone} ${l.summary || ''}`.toLowerCase().includes(q))
    && (!f || (f === 'attention' ? HL.needsAttention(l) : f === 'hot' ? l.temperature === 'hot' : l.stage === f)));
  $('list').innerHTML = shown.length ? shown.map((l) => {
    const last = l.messages[l.messages.length - 1];
    return `<div class="lead ${l.phone === selected ? 'sel' : ''}" data-phone="${esc(l.phone)}">
      <b>${esc(l.name || '+' + l.phone)}${l.paymentStatus === 'to_verify' ? '<span class="tag">verify payment</span>' : ''}${l.botPaused && !l.optedOut ? '<span class="tag">person</span>' : ''}</b>
      <span class="pill ${esc(l.temperature)}">${esc(l.score)}</span>
      <span class="meta">${esc(l.stage)} · ${last ? esc(last.text) : ''}</span></div>`;
  }).join('') : '<div class="empty">No leads yet. They appear when new numbers message your WhatsApp.</div>';
}

function renderDetail() {
  const l = leads.find((x) => x.phone === selected);
  if (!l) { $('detail').innerHTML = '<div class="empty">Select a lead to see the chat.</div>'; return; }
  const p = Object.entries(l.profile || {}).filter(([k, v]) => v && LABELS[k]);
  const draft = $('reply') ? $('reply').value : '';
  $('detail').innerHTML = `<div class="detail">
    <div class="chat">
      <div style="padding:12px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <b style="flex:1">${esc(l.name || '+' + l.phone)} <span class="pill ${esc(l.temperature)}">${esc(l.temperature)} · ${esc(l.score)}</span></b>
        <button id="openWa">Open in WhatsApp Web</button>
        <button id="bot">${l.botPaused ? 'Resume bot' : 'Pause bot'}</button>
      </div>
      <div class="msgs" id="msgs">${l.messages.map((m) => `<div class="m ${m.dir}">${esc(m.text)}<small>${m.dir === 'out' ? esc(m.by) + ' · ' : ''}${new Date(m.at).toLocaleString()}</small></div>`).join('')}</div>
      <div class="composer"><textarea id="reply" placeholder="Type a reply. It is sent through WhatsApp Web and pauses the bot.">${esc(draft)}</textarea><button class="primary" id="send">Send</button></div>
    </div>
    <aside class="side">
      <label>Stage <select id="stage">${STAGES.map((s) => `<option ${s === l.stage ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>Consultation fee <select id="payment">${[['', 'not requested'], ['requested', 'requested'], ['to_verify', 'verify screenshot'], ['paid', 'paid']].map(([v, t]) => `<option value="${v}" ${v === (l.paymentStatus || '') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${l.summary ? `<p class="muted">${esc(l.summary)}</p>` : ''}
      <dl><dt>Phone</dt><dd>+${esc(l.phone)}</dd>${p.map(([k, v]) => `<dt>${LABELS[k]}</dt><dd>${esc(v)}</dd>`).join('')}<dt>Follow-ups</dt><dd>${l.followupsSent || 0} sent</dd></dl>
      ${l.handoffReason ? `<p class="msg err">${esc(l.handoffReason)}</p>` : ''}
    </aside></div>`;
  $('msgs').scrollTop = $('msgs').scrollHeight;
  const patch = async (body) => { try { await HL.toAgent({ type: 'agent:patch', phone: l.phone, patch: body }); err(''); } catch (e) { err(e.message); } load(); };
  $('bot').onclick = () => patch({ botPaused: !l.botPaused });
  $('stage').onchange = (e) => patch({ stage: e.target.value });
  $('payment').onchange = (e) => patch({ paymentStatus: e.target.value });
  $('openWa').onclick = async () => { try { const tab = await HL.whatsappTab(); await HL.toAgent({ type: 'agent:open', phone: l.phone }); chrome.tabs.update(tab.id, { active: true }); chrome.windows.update(tab.windowId, { focused: true }); } catch (e) { err(e.message); } };
  $('send').onclick = async () => {
    const text = $('reply').value.trim();
    if (!text) return;
    $('send').disabled = true;
    try { await HL.toAgent({ type: 'agent:send', phone: l.phone, text }); $('reply').value = ''; err(''); } catch (e) { err(e.message); }
    $('send').disabled = false;
    load();
  };
}

$('list').onclick = (e) => { const row = e.target.closest('.lead'); if (!row) return; selected = row.dataset.phone; history.replaceState(null, '', `#${selected}`); renderList(); renderDetail(); };
$('q').oninput = renderList;
$('filter').onchange = renderList;
$('settings').onclick = () => chrome.runtime.openOptionsPage();
$('csv').onclick = () => {
  const cols = ['phone', 'name', 'stage', 'temperature', 'score', 'paymentStatus', 'currentWeight', 'height', 'age', 'condition', 'preferredProgram', 'consultMode', 'summary', 'createdAt'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = leads.map((l) => cols.map((c) => cell(l[c] ?? (l.profile || {})[c])).join(','));
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' })), download: 'hindivine-leads.csv' });
  a.click();
};
chrome.storage.onChanged.addListener((c) => { if (c.agentUpdated && document.activeElement?.id !== 'reply') load(); });
load();
