const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));

$('open').onclick = () => send({ type: 'open' });

async function load() {
  const { server } = await HL.config();
  if (!server) {
    $('err').hidden = false;
    $('err').innerHTML = 'Not connected yet. <a href="#" id="opt">Open options</a> to enter your agent address.';
    $('opt').onclick = () => chrome.runtime.openOptionsPage();
    return;
  }
  try {
    const [s, leads] = await Promise.all([HL.api('/api/stats'), HL.api('/api/leads')]);
    $('err').hidden = true;
    $('wa').hidden = !s.whatsapp || s.whatsapp.state === 'connected';
    $('wa').textContent = 'WhatsApp is not linked, so the agent cannot reply. Open Setup on the agent to scan the QR code.';
    $('tiles').innerHTML = [
      ['New today', s.newToday], ['Hot', s.byTemp.hot || 0], ['Booked', s.byStage.booked],
      ['Verify payment', s.paymentsToVerify || 0, true], ['Need a person', s.needsHuman, true], ['Conversion', `${s.conversionRate}%`],
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
          <button data-act="open">Open chat</button>
        </span>
      </li>`).join('') : '<li><span class="muted">Nothing needs you right now.</span></li>';
    $('foot').textContent = `${s.total} leads · ${server.replace(/^https?:\/\//, '')}`;
  } catch (e) {
    $('err').hidden = false;
    $('err').textContent = e.message;
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
  const r = await send({ type: 'patch', phone, patch });
  if (!r.ok) { $('err').hidden = false; $('err').textContent = r.error; }
  load();
};

load();
