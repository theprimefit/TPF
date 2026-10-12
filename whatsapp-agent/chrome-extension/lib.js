// Shared by the background worker, popup and options page.
/* exported HL */
const HL = {
  async config() {
    const { server = '', token = '' } = await chrome.storage.local.get(['server', 'token']);
    return { server, token };
  },

  // Calls the agent's API with the dashboard password.
  async api(path, opts = {}) {
    const { server, token } = await HL.config();
    if (!server) throw new Error('Open the extension options and enter your agent address.');
    let res;
    try {
      res = await fetch(server + path, {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
      });
    } catch (e) {
      throw new Error(`Can't reach ${server}. Is the agent running?`);
    }
    if (res.status === 401) throw new Error('Wrong dashboard password. Update it in the extension options.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `The agent answered ${res.status}`);
    return body;
  },

  async mode() {
    const { mode } = await chrome.storage.local.get('mode');
    return mode || 'standalone';
  },

  // Standalone mode keeps leads in chrome.storage, written by the agent in WhatsApp Web.
  async localLeads() {
    const { agentData } = await chrome.storage.local.get('agentData');
    const leads = Object.values((agentData && agentData.leads) || {});
    return leads.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },

  localStats(leads) {
    const today = new Date().toISOString().slice(0, 10);
    const by = (f) => leads.filter(f).length;
    const converted = by((l) => l.stage === 'booked' || l.stage === 'won');
    return {
      total: leads.length,
      newToday: by((l) => (l.createdAt || '').startsWith(today)),
      hot: by((l) => l.temperature === 'hot'),
      booked: by((l) => l.stage === 'booked'),
      toVerify: by((l) => l.paymentStatus === 'to_verify'),
      needsHuman: by((l) => l.botPaused && !l.optedOut),
      conversion: leads.length ? Math.round((converted / leads.length) * 100) : 0,
    };
  },

  async whatsappTab() {
    const [tab] = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    return tab || null;
  },

  // Asks the agent running inside the WhatsApp Web tab to do something.
  async toAgent(msg) {
    const tab = await HL.whatsappTab();
    if (!tab) throw new Error('Open WhatsApp Web (web.whatsapp.com) in Chrome first. The agent runs there.');
    const res = await chrome.tabs.sendMessage(tab.id, msg).catch(() => null);
    if (!res) throw new Error('The agent is not running in the WhatsApp Web tab yet. Reload that tab.');
    if (!res.ok) throw new Error(res.error);
    return res.data;
  },

  normalise(address) {
    let a = String(address || '').trim().replace(/\/+$/, '').replace(/\/(dashboard|setup)$/, '');
    if (a && !/^https?:\/\//.test(a)) a = `https://${a}`;
    return a;
  },

  needsAttention(l) {
    if (l.paymentStatus === 'to_verify') return 'Verify payment';
    if (l.botPaused && !l.optedOut) return l.handoffReason || 'Needs a person';
    if (l.temperature === 'hot' && !['won', 'lost'].includes(l.stage)) return 'Hot lead';
    return '';
  },
};
