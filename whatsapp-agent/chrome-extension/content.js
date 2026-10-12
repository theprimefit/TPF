// Lead card on web.whatsapp.com: shows the agent's details for the open chat and
// offers quick replies. Replies are only typed into the message box; a person
// always presses Send. WhatsApp Web changes often, so everything is best-effort.
(() => {
  if (window.__hindivineLeads) return;
  window.__hindivineLeads = true;

  const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (res) => r(res || { ok: false, error: 'Extension reloaded. Refresh WhatsApp Web.' })));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const host = document.createElement('div');
  host.id = 'hindivine-leads-card';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host { all: initial; }
    .wrap { position: fixed; right: 16px; top: 72px; z-index: 2147483000; width: 290px; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      --bg:#fff; --text:#141b38; --muted:#5f6886; --line:#dfe3ee; --accent:#2557d6; --chip:#eef2ff; --warn:#8a4f00; --warn-soft:#fff2d9; --ok:#0f8a5f; --ok-soft:#dff4ea; }
    @media (prefers-color-scheme: dark) { .wrap { --bg:#1f2c34; --text:#e9edef; --muted:#9fb0bb; --line:#2f3f49; --accent:#7f9dff; --chip:#273845; --warn:#f2c26b; --warn-soft:#3a2d12; --ok:#4fd1a0; --ok-soft:#133a2d; } }
    .card { background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 30px -12px rgba(0,0,0,.35); overflow: hidden; }
    .head { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border-bottom: 1px solid var(--line); cursor: pointer; }
    .head b { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pill { border-radius: 99px; padding: 1px 8px; font-size: 11px; font-weight: 700; color: #fff; }
    .hot { background: #d23a2a; } .warm { background: #c97a00; } .cold { background: #4a6fa5; }
    .body { padding: 10px 11px; display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto; }
    .muted { color: var(--muted); font-size: 12px; }
    .flag { border-radius: 8px; padding: 6px 8px; font-size: 12px; background: var(--warn-soft); color: var(--warn); }
    .flag.ok { background: var(--ok-soft); color: var(--ok); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; }
    dt { color: var(--muted); } dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; }
    button { font: inherit; font-size: 12px; font-weight: 600; color: var(--text); background: transparent; border: 1px solid var(--line); border-radius: 8px; padding: 4px 9px; cursor: pointer; }
    button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    button.chip { background: var(--chip); border-color: transparent; }
    h3 { margin: 2px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .min .body { display: none; }
    .toast { font-size: 12px; color: var(--ok); }
  </style><div class="wrap" hidden><div class="card"><div class="head" title="Show or hide"><b>Hindivine Leads</b><span id="pill"></span><span class="muted" id="tog">▾</span></div><div class="body" id="body"></div></div></div>`;
  const wrap = root.querySelector('.wrap');
  const body = root.getElementById('body');
  document.documentElement.appendChild(host);

  let minimised = false;
  root.querySelector('.head').onclick = () => { minimised = !minimised; wrap.classList.toggle('min', minimised); root.getElementById('tog').textContent = minimised ? '▸' : '▾'; };

  let business = null;
  let current = '';
  let lead = null;

  function chatTitle() {
    const header = document.querySelector('#main header');
    if (!header) return '';
    const el = header.querySelector('span[title]') || header.querySelector('span[dir="auto"]');
    return ((el && (el.getAttribute('title') || el.textContent)) || '').trim();
  }

  // Types text into WhatsApp's message box without sending it.
  function insert(text) {
    const box = document.querySelector('footer div[contenteditable="true"]') || document.querySelector('#main div[contenteditable="true"][role="textbox"]');
    if (box) {
      box.focus();
      const ok = document.execCommand('insertText', false, text);
      if (ok) return toast('Added to the message box. Check it, then press Send.');
    }
    navigator.clipboard.writeText(text).then(() => toast('Copied. Paste it into the chat with Ctrl+V.'), () => toast('Could not insert the text.'));
  }

  function toast(text) {
    const t = root.getElementById('toast');
    if (t) { t.textContent = text; setTimeout(() => { if (t.textContent === text) t.textContent = ''; }, 4000); }
  }

  function replies() {
    if (!business) return [];
    const b = business;
    const first = lead && lead.name ? ` ${lead.name.split(' ')[0]}` : '';
    const prices = b.services.map((s) => `• ${s.short || s.name}: ${s.price}${s.mrp ? ` (MRP ${s.mrp})` : ''}`).join('\n');
    return [
      ['Prices', `Hi${first}! Our 3-month programs:\n${prices}\nEach includes the weekly injection, doctor and dietitian support, the app and the kit.`],
      ['Payment details', `To book your consultation${first}: the fee is ${b.consultationFee} (100% adjusted in the program fee). Pay by UPI to ${b.upiId} and send the payment screenshot here.`],
      ["What's included", `Every program includes:\n${b.included.map((i) => `✓ ${i}`).join('\n')}`],
      ['Online / clinic', `You can choose an online consultation or a clinic visit. ${b.clinic || ''}`.trim()],
      ['Payment received', `Thank you${first}! We've received your payment. Our team will confirm your consultation slot shortly 🙏`],
      ['Will call you', `Our team will call you shortly from ${b.phone}.`],
    ];
  }

  function render(message) {
    wrap.hidden = false;
    const pill = root.getElementById('pill');
    if (!lead) {
      pill.innerHTML = '';
      body.innerHTML = `<p class="muted">${esc(message || 'This chat is not a lead in the agent yet.')}</p>${business ? `<h3>Quick replies</h3><div class="row" id="qr"></div><span class="toast" id="toast"></span>` : ''}`;
    } else {
      const p = lead.profile || {};
      const rows = [['Stage', lead.stage], ['Weight', p.currentWeight], ['Height', p.height], ['Age', p.age], ['Condition', p.condition], ['Program', p.preferredProgram], ['Consultation', p.consultMode]].filter(([, v]) => v);
      pill.innerHTML = `<span class="pill ${esc(lead.temperature)}">${esc(lead.score)}</span>`;
      const flags = [];
      if (lead.paymentStatus === 'to_verify') flags.push(['', '⚠ Payment screenshot to verify']);
      else if (lead.paymentStatus === 'paid') flags.push(['ok', '✓ Consultation fee paid']);
      else if (lead.paymentStatus === 'requested') flags.push(['', 'Fee requested, not paid yet']);
      flags.push(lead.botPaused && !lead.optedOut ? ['', `Bot paused${lead.handoffReason ? `: ${lead.handoffReason}` : ''}`] : ['ok', 'Bot is replying to this chat']);
      body.innerHTML = `
        <div><b style="font-size:14px">${esc(lead.name || '+' + lead.phone)}</b><div class="muted">+${esc(lead.phone)}${lead.source === 'ad' ? ` · ad: ${esc(lead.sourceDetail)}` : ''}</div></div>
        ${flags.map(([c, t]) => `<div class="flag ${c}">${esc(t)}</div>`).join('')}
        ${lead.summary ? `<p class="muted">${esc(lead.summary)}</p>` : ''}
        ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
        <div class="row">
          ${lead.paymentStatus === 'to_verify' ? '<button class="primary" data-act="paid">Mark paid</button>' : ''}
          <button data-act="bot">${lead.botPaused ? 'Resume bot' : 'Pause bot'}</button>
          <button data-act="open">Dashboard</button>
        </div>
        <h3>Quick replies</h3><div class="row" id="qr"></div><span class="toast" id="toast"></span>`;
    }
    const qr = root.getElementById('qr');
    if (qr) {
      for (const [label, text] of replies()) {
        const b = document.createElement('button');
        b.className = 'chip';
        b.textContent = label;
        b.onclick = () => insert(text);
        qr.appendChild(b);
      }
    }
    body.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => act(b.dataset.act, b)));
  }

  async function act(what, btn) {
    if (!lead) return;
    if (what === 'open') return send({ type: 'open', phone: lead.phone });
    btn.disabled = true;
    const patch = what === 'paid' ? { paymentStatus: 'paid' } : { botPaused: !lead.botPaused };
    const r = await send({ type: 'patch', phone: lead.phone, patch });
    if (r.ok) lead = r.data;
    render(r.ok ? '' : r.error);
  }

  async function refresh(force) {
    const title = chatTitle();
    if (!title) { wrap.hidden = true; current = ''; return; }
    if (title === current && !force) return;
    current = title;
    if (!business) {
      const b = await send({ type: 'business' });
      if (b.ok) business = b.data;
    }
    const r = await send({ type: 'lookup', title });
    if (title !== current) return; // the user moved on to another chat
    lead = r.ok ? r.data : null;
    render(r.ok ? '' : r.error);
  }

  let timer = null;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => refresh(false), 400); }).observe(document.body, { childList: true, subtree: true });
  setInterval(() => refresh(true), 30000); // keep score and status fresh
  refresh(false); // a chat may already be open
})();
