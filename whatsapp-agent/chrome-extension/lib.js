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
