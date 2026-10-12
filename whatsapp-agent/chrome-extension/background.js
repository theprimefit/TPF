// Polls the agent every minute: desktop alerts for new and urgent leads, and a
// badge with how many need someone right now. Also answers the WhatsApp Web card.
importScripts('lib.js');

const POLL_MINUTES = 1;
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('poll', { periodInMinutes: POLL_MINUTES });
  chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('poll', { periodInMinutes: POLL_MINUTES }));
chrome.alarms.onAlarm.addListener((a) => a.name === 'poll' && poll());

async function poll() {
  const { server } = await HL.config();
  if (!server) return;
  let leads;
  try {
    leads = await HL.api('/api/leads');
  } catch (e) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#9aa2c0' });
    chrome.action.setTitle({ title: `Hindivine Leads: ${e.message}` });
    return;
  }
  const urgent = leads.filter((l) => l.paymentStatus === 'to_verify' || (l.botPaused && !l.optedOut)).length;
  chrome.action.setBadgeText({ text: urgent ? String(urgent) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#d23a2a' });
  chrome.action.setTitle({ title: urgent ? `Hindivine Leads: ${urgent} need attention` : 'Hindivine Leads' });

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
  for (const [phone, title, message] of alerts.slice(0, 4)) {
    chrome.notifications.create(`lead:${phone}:${Date.now()}`, { type: 'basic', iconUrl: 'icons/icon-128.png', title, message: String(message).slice(0, 180), priority: 2 });
  }
  if (alerts.length > 4) {
    chrome.notifications.create(`more:${Date.now()}`, { type: 'basic', iconUrl: 'icons/icon-128.png', title: `${alerts.length - 4} more lead updates`, message: 'Open the dashboard to see them.' });
  }
}

chrome.notifications.onClicked.addListener(async (id) => {
  const { server } = await HL.config();
  const phone = id.startsWith('lead:') ? id.split(':')[1] : '';
  chrome.tabs.create({ url: `${server}/dashboard${phone ? `#lead=${phone}` : ''}` });
  chrome.notifications.clear(id);
});

// Requests from the popup and the WhatsApp Web card (content scripts can't call the agent directly).
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    if (msg.type === 'poll') return poll();
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
    if (msg.type === 'open') {
      const { server } = await HL.config();
      return chrome.tabs.create({ url: `${server}/dashboard${msg.phone ? `#lead=${msg.phone}` : ''}` });
    }
    return null;
  })()
    .then((data) => reply({ ok: true, data }))
    .catch((e) => reply({ ok: false, error: e.message }));
  return true; // keeps the channel open for the async reply
});
