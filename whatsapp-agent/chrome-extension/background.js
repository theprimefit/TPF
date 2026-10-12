// Background worker: desktop alerts, the toolbar count, and opening leads.
// Standalone mode: the agent runs in the WhatsApp Web tab and sends alerts here.
// Server mode: polls the agent server every minute.
importScripts('lib.js');

const POLL_MINUTES = 1;
chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.alarms.create('poll', { periodInMinutes: POLL_MINUTES });
  if (reason === 'install') chrome.tabs.create({ url: 'welcome.html' });
});
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('poll', { periodInMinutes: POLL_MINUTES }));
chrome.alarms.onAlarm.addListener((a) => a.name === 'poll' && poll());
chrome.storage.onChanged.addListener((c) => { if (c.agentUpdated || c.mode) badge(); });

function setBadge(count, note) {
  chrome.action.setBadgeText({ text: note ? '!' : count ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: note ? '#9aa2c0' : '#d23a2a' });
  chrome.action.setTitle({ title: note ? `Hindivine Leads: ${note}` : count ? `Hindivine Leads: ${count} need attention` : 'Hindivine Leads' });
}

async function badge() {
  if ((await HL.mode()) !== 'standalone') return;
  const s = HL.localStats(await HL.localLeads());
  setBadge(s.toVerify + s.needsHuman);
}

function notify(phone, title, message) {
  chrome.notifications.create(`lead:${phone || ''}:${Date.now()}`, { type: 'basic', iconUrl: 'icons/icon-128.png', title, message: String(message || '').slice(0, 180), priority: 2 });
}

async function poll() {
  if ((await HL.mode()) === 'standalone') return badge();
  const { server } = await HL.config();
  if (!server) return;
  let leads;
  try {
    leads = await HL.api('/api/leads');
  } catch (e) {
    return setBadge(0, e.message);
  }
  setBadge(leads.filter((l) => l.paymentStatus === 'to_verify' || (l.botPaused && !l.optedOut)).length);

  const { seen } = await chrome.storage.local.get('seen');
  const next = {};
  const alerts = [];
  for (const l of leads) {
    next[l.phone] = { p: l.paymentStatus || '', b: Boolean(l.botPaused && !l.optedOut), t: l.temperature };
    if (!seen) continue; // first run: remember everything, alert on nothing
    const before = seen[l.phone];
    const who = l.name || `+${l.phone}`;
    if (!before) alerts.push([l.phone, `New lead: ${who}`, l.lastMessage ? l.lastMessage.text : 'Started a WhatsApp chat']);
    else if (l.paymentStatus === 'to_verify' && before.p !== 'to_verify') alerts.push([l.phone, `Payment to verify: ${who}`, 'Sent a payment screenshot for the ₹1,000 consultation fee.']);
    else if (next[l.phone].b && !before.b) alerts.push([l.phone, `Needs a person: ${who}`, l.handoffReason || 'The bot paused this chat.']);
    else if (l.temperature === 'hot' && before.t !== 'hot') alerts.push([l.phone, `Hot lead: ${who}`, l.summary || `Score ${l.score}`]);
  }
  await chrome.storage.local.set({ seen: next });
  for (const [phone, title, message] of alerts.slice(0, 4)) notify(phone, title, message);
  if (alerts.length > 4) notify('', `${alerts.length - 4} more lead updates`, 'Open the dashboard to see them.');
}

async function openLead(phone) {
  if ((await HL.mode()) === 'standalone') return chrome.tabs.create({ url: `leads.html${phone ? `#${phone}` : ''}` });
  const { server } = await HL.config();
  return chrome.tabs.create({ url: `${server}/dashboard${phone ? `#lead=${phone}` : ''}` });
}

chrome.notifications.onClicked.addListener((id) => {
  openLead(id.startsWith('lead:') ? id.split(':')[1] : '');
  chrome.notifications.clear(id);
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    if (msg.type === 'poll') return poll();
    if (msg.type === 'open') return openLead(msg.phone);
    if (msg.type === 'notify') {
      // From the agent in WhatsApp Web. The phone number is in the title, e.g. "Hot lead: Neha (+9198…)".
      const phone = (String(msg.title).match(/\+(\d{8,15})/) || [])[1] || '';
      const title = msg.title.replace(/\s*\(\+\d+\)/, '').replace(/: (\d{10,15})$/, ': +$1');
      notify(phone, title, msg.message);
      return badge();
    }
    // Server mode requests from the lead card.
    if (msg.type === 'lookup') {
      const digits = String(msg.title || '').replace(/\D/g, '');
      const byPhone = digits.length >= 10;
      const leads = await HL.api(`/api/leads?q=${encodeURIComponent(byPhone ? digits.slice(-10) : msg.title)}`);
      const exact = leads.find((l) => (byPhone ? l.phone.endsWith(digits.slice(-10)) : (l.name || '').toLowerCase() === String(msg.title).toLowerCase()));
      const lead = exact || (leads.length === 1 ? leads[0] : null);
      return lead ? HL.api(`/api/leads/${lead.phone}`) : null;
    }
    if (msg.type === 'patch') {
      const lead = await HL.api(`/api/leads/${msg.phone}`, { method: 'PATCH', body: JSON.stringify(msg.patch) });
      poll();
      return lead;
    }
    if (msg.type === 'business') return HL.api('/api/business');
    return null;
  })()
    .then((data) => reply({ ok: true, data }))
    .catch((e) => reply({ ok: false, error: e.message }));
  return true;
});
