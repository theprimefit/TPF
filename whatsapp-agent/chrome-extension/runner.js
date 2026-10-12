// Runs the lead agent inside WhatsApp Web, with no server: it watches for new
// messages, replies with the agent's own logic, sends follow-ups and saves leads
// in chrome.storage. It works by operating the WhatsApp Web page like a person,
// so it depends on WhatsApp Web's layout and stops cleanly if that changes.
(() => {
  if (window.__hlRunner || !self.HLAgent) return;
  window.__hlRunner = true;
  const { business, createStore, createRuleBrain, createAgent } = self.HLAgent;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const looksLikePhone = (s) => /^\+?[\d\s()-]{8,}$/.test(String(s || '').trim());

  let settings = { mode: 'standalone', enabled: true, replySaved: false };
  let store = null;
  let agent = null;
  let lastUserInput = 0;
  let health = { ready: false, problem: '', lastReplyAt: null };
  const botSent = new Set(); // ids of messages the agent sent, to tell them from the team's

  // ---------- WhatsApp Web page helpers (several selectors each, layouts change) ----------
  const q = (sels, root = document) => { for (const s of sels) { const el = root.querySelector(s); if (el) return el; } return null; };
  const chatList = () => q(['#pane-side', '[aria-label="Chat list"]', '#side']);
  const composer = () => q(['footer div[contenteditable="true"][role="textbox"]', 'footer div[contenteditable="true"]', '#main div[contenteditable="true"][data-tab="10"]']);
  const sendButton = () => {
    const icon = q(['footer [data-icon="send"]', 'footer [data-icon="wds-ic-send-filled"]', 'footer button[aria-label="Send"]', 'footer [aria-label="Send"]']);
    return icon ? icon.closest('button') || icon : null;
  };
  const headerTitle = () => {
    const h = q(['#main header']);
    if (!h) return '';
    const el = h.querySelector('span[dir="auto"][title]') || h.querySelector('span[title]') || h.querySelector('span[dir="auto"]');
    return ((el && (el.getAttribute('title') || el.textContent)) || '').trim();
  };

  // Messages in the open chat. data-id looks like "false_919812345678@c.us_3EB0…" (false = incoming).
  function messages() {
    const main = q(['#main']);
    if (!main) return [];
    return [...main.querySelectorAll('[data-id]')]
      .filter((el) => /^(true|false)_/.test(el.getAttribute('data-id')))
      .map((el) => {
        const id = el.getAttribute('data-id');
        const [dir, jid] = id.split('_');
        const textEl = el.querySelector('.selectable-text') || el.querySelector('[data-pre-plain-text] span');
        const text = textEl ? textEl.innerText.trim() : '';
        const hasImage = Boolean(el.querySelector('img[src^="blob:"]'));
        return { id, incoming: dir === 'false', jid: jid || '', text: text || (hasImage ? '[image]' : ''), type: hasImage && !text ? 'image' : 'text' };
      })
      .filter((m) => m.text);
  }

  function currentChat() {
    const title = headerTitle();
    if (!title) return null;
    const msgs = messages();
    const jid = (msgs.find((m) => m.incoming) || msgs[0] || {}).jid || '';
    if (/@g\.us$|@broadcast$|@newsletter$/.test(jid)) return { group: true, title };
    const phone = /@c\.us$/.test(jid) ? digits(jid.split('@')[0]) : looksLikePhone(title) ? digits(title) : '';
    const saved = !looksLikePhone(title);
    return { key: phone || title, title, saved, group: false, msgs };
  }

  function unreadRows() {
    const list = chatList();
    if (!list) return [];
    return [...list.querySelectorAll('[role="listitem"], [role="row"]')].filter((row) => {
      const badge = row.querySelector('[aria-label*="unread" i], [aria-label*="अपठित"]');
      return Boolean(badge);
    });
  }

  function rowTitle(row) {
    const t = row.querySelector('span[title]');
    return t ? t.getAttribute('title') : '';
  }

  function press(el) {
    for (const type of ['mousedown', 'mouseup', 'click']) el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }

  async function openRow(row) {
    const want = rowTitle(row);
    press(row.querySelector('span[title]') || row);
    for (let i = 0; i < 20; i++) {
      await sleep(200);
      if (headerTitle() === want && composer()) return true;
    }
    return false;
  }

  // Opens a chat by phone number or name: from the chat list, or through WhatsApp's search box.
  async function openChat(key) {
    const cur = currentChat();
    if (cur && cur.key === key) return true;
    const list = chatList();
    const match = (title) => (digits(key).length >= 8 ? digits(title).endsWith(digits(key).slice(-10)) : title === key);
    const row = list && [...list.querySelectorAll('[role="listitem"], [role="row"]')].find((r) => match(rowTitle(r)));
    if (row) return openRow(row);
    const search = q(['#side div[contenteditable="true"]', 'div[contenteditable="true"][data-tab="3"]']);
    if (!search) return false;
    search.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, digits(key).length >= 8 ? digits(key).slice(-10) : key);
    await sleep(1500);
    const hit = [...document.querySelectorAll('#pane-side [role="listitem"], #pane-side [role="row"]')].find((r) => match(rowTitle(r)));
    const ok = hit ? await openRow(hit) : false;
    search.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    return ok;
  }

  // Types into the message box and presses Send, then remembers the new message ids as the bot's.
  async function typeAndSend(text) {
    const box = composer();
    if (!box) throw new Error("Can't find WhatsApp's message box");
    const before = new Set(messages().filter((m) => !m.incoming).map((m) => m.id));
    box.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
    await sleep(Math.min(3500, 600 + text.length * 15)); // "typing…" for a moment, like a person
    const btn = sendButton();
    if (btn) press(btn);
    else box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    await sleep(900);
    for (const m of messages()) if (!m.incoming && !before.has(m.id)) { botSent.add(m.id); store.markProcessed(m.id); }
    health.lastReplyAt = new Date().toISOString();
  }

  const listed = (options) => options.map((o, i) => `*${i + 1}.* ${o}`).join('\n');
  const lastOffered = new Map();

  // The interface the agent expects from WhatsApp.
  const wa = {
    async sendText(to, text) {
      if (to === '__notify__') {
        const [title, ...rest] = text.split('\n');
        chrome.runtime.sendMessage({ type: 'notify', title: title.replace(/^🔥\s*/, ''), message: rest.join('\n') });
        return;
      }
      if (!(await openChat(to))) throw new Error(`Could not open the chat with ${to}`);
      await typeAndSend(text);
    },
    async sendButtons(to, text, options) {
      lastOffered.set(to, options);
      await wa.sendText(to, `${text}\n\n${listed(options)}\n_Reply with a number_`);
    },
    async sendImage() {}, // the UPI ID is already in the payment message
    async sendTemplate() {},
    async markRead() {}, // opening the chat marks it read
  };

  // ---------- Reading new messages ----------
  async function handleOpenChat() {
    const chat = currentChat();
    if (!chat || chat.group) return;
    if (chat.saved && !settings.replySaved) return; // saved contacts are usually friends and family
    const known = store.getLead(chat.key);
    if (!known) {
      // First time we see this chat: only the messages after our last reply are waiting for an answer.
      let lastOut = -1;
      chat.msgs.forEach((m, i) => { if (!m.incoming) lastOut = i; });
      chat.msgs.forEach((m, i) => { if (i <= lastOut || chat.msgs.length - i > 3) store.markProcessed(m.id); });
    }
    const waiting = [];
    for (const m of chat.msgs) {
      if (store.isProcessed(m.id)) continue;
      if (!m.incoming) {
        // Sent by a person (on the phone or in this tab), not by the bot.
        store.markProcessed(m.id);
        if (!botSent.has(m.id) && store.getLead(chat.key)) agent.recordHumanReply(chat.key, m.text);
        waiting.length = 0;
        continue;
      }
      waiting.push(m);
    }
    if (!waiting.length) return;
    // Several messages in a row get one reply, like a person would give.
    for (const m of waiting.slice(0, -1)) store.markProcessed(m.id);
    const last = waiting[waiting.length - 1];
    let text = waiting.map((m) => m.text).join('\n');
    const offered = lastOffered.get(chat.key);
    const pick = last.text.match(/^\s*([1-3])\s*[.)]?\s*$/);
    if (offered && pick && offered[pick[1] - 1]) text = offered[pick[1] - 1];
    lastOffered.delete(chat.key);
    await agent.handleInbound({ id: last.id, from: chat.key, name: chat.saved ? chat.title : '', type: waiting.some((m) => m.type === 'image') ? 'image' : 'text', text });
  }

  let busy = Promise.resolve();
  const exclusive = (fn) => (busy = busy.then(fn, fn).catch((e) => { health.problem = e.message; }));
  const userActive = () => Date.now() - lastUserInput < 60000;

  async function tick() {
    health.ready = Boolean(chatList());
    if (!health.ready) { health.problem = 'WhatsApp Web is not open or not logged in yet.'; return; }
    if (settings.mode !== 'standalone' || !settings.enabled) return;
    health.problem = '';
    await handleOpenChat();
    if (userActive()) return; // never switch chats while someone is using this tab
    for (const row of unreadRows().slice(0, 3)) {
      const title = rowTitle(row);
      if (!title || (!looksLikePhone(title) && !settings.replySaved)) continue;
      if (await openRow(row)) await handleOpenChat();
    }
  }

  // ---------- Requests from the popup, leads page and lead card ----------
  async function patchLead(phone, patch) {
    const allowed = ['stage', 'notes', 'botPaused', 'paymentStatus', 'name'];
    const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
    if (clean.botPaused === false) clean.handoffReason = '';
    store.updateLead(phone, clean);
    agent.rescore(store.getLead(phone));
    await store.save();
    return store.getLead(phone);
  }

  window.__hlAgent = {
    lookup(title) {
      const d = digits(title);
      const leads = store.listLeads();
      return leads.find((l) => (d.length >= 8 ? l.phone.endsWith(d.slice(-10)) : l.phone === title || l.name === title)) || null;
    },
    patch: patchLead,
    business: () => ({ ...business, upiId: business.payment ? business.payment.upiId : '' }),
  };

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    (async () => {
      if (msg.type === 'agent:health') return { ...health, enabled: settings.enabled, mode: settings.mode };
      if (msg.type === 'agent:patch') return patchLead(msg.phone, msg.patch);
      if (msg.type === 'agent:send') return exclusive(async () => {
        if (!(await openChat(msg.phone))) throw new Error('Could not open that chat in WhatsApp Web.');
        await typeAndSend(msg.text);
        store.addMessage(msg.phone, { dir: 'out', by: 'human', text: msg.text });
        store.updateLead(msg.phone, { botPaused: true, handoffReason: store.getLead(msg.phone)?.handoffReason || 'Team took over' });
        await store.save();
        return store.getLead(msg.phone);
      });
      if (msg.type === 'agent:open') return exclusive(() => openChat(msg.phone));
      return null;
    })().then((data) => reply({ ok: true, data }), (e) => reply({ ok: false, error: e.message }));
    return true;
  });

  // ---------- Start ----------
  for (const type of ['keydown', 'mousedown', 'touchstart']) {
    window.addEventListener(type, (e) => { if (e.isTrusted) lastUserInput = Date.now(); }, true);
  }

  (async () => {
    const saved = await chrome.storage.local.get(['agentData', 'mode', 'enabled', 'replySaved']);
    settings = { mode: saved.mode || 'standalone', enabled: saved.enabled !== false, replySaved: Boolean(saved.replySaved) };
    store = createStore(null);
    store.importData(saved.agentData);
    store.save = () => chrome.storage.local.set({ agentData: store.exportData(), agentUpdated: Date.now() });
    const rules = createRuleBrain({ business, hasQr: false }); // the UPI ID is sent as text
    agent = createAgent({ store, wa, brain: rules, fallbackBrain: rules, business, alertNumbers: ['__notify__'], freeFormFollowups: true, log: { error: (...a) => console.warn('[Hindivine Leads]', ...a), log() {}, warn() {} } });
    chrome.storage.onChanged.addListener((c) => {
      if (c.mode) settings.mode = c.mode.newValue || 'standalone';
      if (c.enabled) settings.enabled = c.enabled.newValue !== false;
      if (c.replySaved) settings.replySaved = Boolean(c.replySaved.newValue);
    });
    // Let WhatsApp Web finish loading, then keep watching.
    setInterval(() => exclusive(tick), 4000);
    setInterval(() => exclusive(() => (settings.mode === 'standalone' && settings.enabled && chatList() && !userActive() ? agent.runFollowups() : 0)), 5 * 60 * 1000);
  })();
})();
