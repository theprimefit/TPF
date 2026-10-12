'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const business = require('../config/business.json');
const { createStore } = require('../src/store');
const { parseWebhook, verifySignature } = require('../src/whatsapp');
const { createRuleBrain, createClaudeBrain, toTurns, redFlag } = require('../src/brain');
const { createAgent, inBusinessHours } = require('../src/agent');
const { scoreLead } = require('../src/scoring');
const { createApp } = require('../src/server');

const quiet = { error() {}, log() {} };

function fakeWhatsApp() {
  const sent = [];
  return {
    sent,
    sendText: async (to, text) => sent.push({ to, type: 'text', text }),
    sendButtons: async (to, text, buttons) => sent.push({ to, type: 'buttons', text, buttons }),
    sendTemplate: async (to, name, lang, params) => sent.push({ to, type: 'template', name, params }),
    sendImage: async (to, link, caption) => sent.push({ to, type: 'image', link, text: caption }),
    markRead: async () => {},
  };
}

function setup({ brain, alertNumbers = ['919999999999'], template = { name: 'lead_followup', lang: 'en' }, paymentQrUrl = 'https://example.com/media/upi-qr.jpg' } = {}) {
  const store = createStore(null);
  const wa = fakeWhatsApp();
  const rules = createRuleBrain({ business });
  const agent = createAgent({ store, wa, brain: brain || rules, fallbackBrain: rules, business, alertNumbers, template, paymentQrUrl, log: quiet });
  let n = 0;
  const say = (text, extra = {}) => agent.handleInbound({ id: `m${++n}`, from: '919800000001', name: 'Priya Sharma', type: 'text', text, ...extra });
  return { store, wa, agent, say };
}

const toLead = (wa) => wa.sent.filter((m) => m.to === '919800000001');

test('parses text, button and ad-referral webhooks', () => {
  const payload = {
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: '91980', profile: { name: 'Priya' } }],
      messages: [
        { id: 'a', from: '91980', timestamp: '1700000000', type: 'text', text: { body: ' hi ' }, referral: { source_type: 'ad', headline: 'Lose 5 kg' } },
        { id: 'b', from: '91980', timestamp: '1700000001', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'x', title: 'Weight loss' } } },
        { id: 'c', from: '91980', timestamp: '1700000002', type: 'sticker', sticker: {} },
      ],
    } }] }],
  };
  const msgs = parseWebhook(payload);
  assert.equal(msgs.length, 3);
  assert.deepEqual([msgs[0].text, msgs[0].name, msgs[0].referral], ['hi', 'Priya', { source: 'ad', detail: 'Lose 5 kg' }]);
  assert.equal(msgs[1].text, 'Weight loss');
  assert.equal(msgs[2].text, '[sticker]');
  assert.deepEqual(parseWebhook({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] }), []);
});

test('verifies Meta webhook signatures', () => {
  const body = Buffer.from('{"a":1}');
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
  assert.ok(verifySignature(body, sig, 'secret'));
  assert.ok(!verifySignature(body, sig, 'other'));
  assert.ok(!verifySignature(body, undefined, 'secret'));
});

test('rule-based flow qualifies a lead, quotes the 3 programs and books a consultation', async () => {
  const { store, wa, say } = setup();
  await say('Hi, saw your ad', { referral: { source: 'ad', detail: 'Mounjaro weight loss program' } });
  let lead = store.getLead('919800000001');
  assert.equal(lead.source, 'ad');
  assert.equal(lead.stage, 'new');
  assert.match(toLead(wa)[0].text, /Priya/);
  assert.match(toLead(wa)[0].text, /weight and height/i);

  await say('price kitna hai?');
  const quote = toLead(wa).at(-1).text;
  for (const s of business.services) assert.ok(quote.includes(s.price), `quotes ${s.name}`);
  assert.equal((quote.match(/•/g) || []).length, 3, 'exactly 3 programs');
  assert.match(quote, /doctor confirms/i);

  await say("I'm 92 kg, 5 ft 4");
  assert.match(toLead(wa).at(-1).text, /age/i);
  await say('34 years, I have thyroid');
  lead = store.getLead('919800000001');
  assert.deepEqual(
    [lead.profile.currentWeight, lead.profile.height, lead.profile.age, lead.profile.condition, lead.profile.preferredProgram],
    ['92 kg', '5 ft 4 in', '34', 'Thyroid', 'Mounjaro'],
  );
  assert.equal(lead.stage, 'qualified');

  await say('consultation fees kitna hai?');
  assert.match(toLead(wa).at(-1).text, /₹1,000.*100% adjusted/);

  await say('ok I want to book');
  lead = store.getLead('919800000001');
  assert.equal(lead.paymentStatus, 'requested');
  const [instructions, qr] = toLead(wa).slice(-2);
  assert.ok(instructions.text.includes(business.payment.upiId));
  assert.match(instructions.text, /₹1,000/);
  assert.deepEqual(instructions.buttons, ['Online consultation', 'Clinic visit']);
  assert.equal(qr.type, 'image');
  assert.equal(qr.link, 'https://example.com/media/upi-qr.jpg');
  assert.ok(wa.sent.some((m) => m.to === '919999999999' && /Payment details sent/.test(m.text)));

  await say('Online consultation');
  lead = store.getLead('919800000001');
  assert.equal(lead.profile.consultMode, 'Online');
  assert.equal(lead.paymentStatus, 'requested', 'mode answer does not restart payment');
  assert.match(toLead(wa).at(-1).text, /screenshot/);

  await say('[image]', { type: 'image' });
  lead = store.getLead('919800000001');
  assert.equal(lead.paymentStatus, 'to_verify');
  assert.equal(lead.stage, 'booked');
  assert.match(toLead(wa).at(-1).text, /verify/);
  assert.doesNotMatch(toLead(wa).at(-1).text, /confirmed/i, 'bot never confirms payment itself');
  assert.equal(lead.temperature, 'hot');
  assert.ok(wa.sent.some((m) => m.to === '919999999999' && /Payment to verify/.test(m.text) && /Priya/.test(m.text)));
});

test('medical red flags go to the doctor even when Claude would keep selling', async () => {
  const brain = async () => ({ reply: 'Great, Mounjaro is perfect for you!', buttons: [], profile: {}, intent: 'high', action: 'book_call', handoffReason: '', summary: '' });
  const { store, wa, say } = setup({ brain });
  await say('I am pregnant, can I take Mounjaro?');
  const lead = store.getLead('919800000001');
  assert.ok(lead.botPaused);
  assert.match(lead.handoffReason, /pregnancy/);
  assert.doesNotMatch(toLead(wa)[0].text, /perfect/);
  assert.match(toLead(wa)[0].text, /doctor/);
  assert.ok(wa.sent.some((m) => m.to === '919999999999' && /pregnancy/.test(m.text)));
});

test('red-flag screen', () => {
  for (const t of ['I am pregnant', 'I have type 1 diabetes', 'had pancreatitis', 'I am 16', 'I am getting nausea after the dose'])
    assert.ok(redFlag(t), t);
  for (const t of ['what are the side effects?', 'I am 170 cm', 'I am 15 kg overweight', 'I have type 2 diabetes', 'is ozempic safe?'])
    assert.equal(redFlag(t), '', t);
});

test('ignores duplicate webhook deliveries', async () => {
  const { wa, agent } = setup();
  const msg = { id: 'dup', from: '919800000001', name: '', type: 'text', text: 'hello' };
  await agent.handleInbound(msg);
  await agent.handleInbound(msg);
  assert.equal(toLead(wa).length, 1);
});

test('STOP opts the lead out and silences the bot', async () => {
  const { store, wa, say } = setup();
  await say('hello');
  await say('STOP');
  const lead = store.getLead('919800000001');
  assert.ok(lead.optedOut && lead.botPaused);
  assert.equal(lead.stage, 'lost');
  const count = toLead(wa).length;
  await say('price?');
  assert.equal(toLead(wa).length, count);
});

test('handoff pauses the bot until a human resumes it', async () => {
  const { store, wa, agent, say } = setup();
  await say('I want to talk to a person');
  let lead = store.getLead('919800000001');
  assert.ok(lead.botPaused);
  assert.ok(wa.sent.some((m) => m.to === '919999999999' && /Needs a human/.test(m.text)));
  const count = toLead(wa).length;
  await say('hello?');
  assert.equal(toLead(wa).length, count, 'bot stays quiet');

  await agent.sendManual('919800000001', 'Hi Priya, this is Dr. Mehta');
  lead = store.getLead('919800000001');
  assert.equal(lead.messages.at(-1).by, 'human');
});

test('Claude brain sends a structured request and its decision is applied', async () => {
  let request;
  const client = {
    beta: { messages: { create: async (req) => {
      request = req;
      return {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify({
          reply: 'Lovely Priya! Book your free call here: https://www.hindivine.com/book',
          buttons: ['Book free call'],
          profile: { name: 'Priya', goal: 'PCOS', currentWeight: '74 kg', targetWeight: '', diet: 'Veg', condition: 'PCOS', startWhen: 'this week', city: 'Pune', age: '', language: 'English' },
          intent: 'high', action: 'book_call', handoffReason: '', summary: 'Priya, Pune, PCOS, 74 kg, veg, wants to start this week',
        }) }],
      };
    } } },
  };
  const brain = createClaudeBrain({ business, client });
  const { store, wa, say } = setup({ brain });
  await say('I have PCOS, 74kg, 5ft 3, from Pune. How do I join?');

  assert.equal(request.model, 'claude-opus-5-5');
  assert.equal(request.output_config.format.type, 'json_schema');
  assert.equal(request.output_config.effort, 'low');
  assert.equal(request.fallbacks, 'default');
  assert.equal(request.messages.at(-1).role, 'user');
  assert.match(request.messages.at(-1).content[0].text, /CRM context/);

  const lead = store.getLead('919800000001');
  assert.equal(lead.stage, 'booked');
  assert.equal(lead.profile.city, 'Pune');
  assert.equal(lead.summary, 'Priya, Pune, PCOS, 74 kg, veg, wants to start this week');
  assert.deepEqual(toLead(wa)[0].buttons, ['Book free call']);
});

test('falls back to rules when Claude fails', async () => {
  const brain = async () => { throw new Error('overloaded'); };
  const { wa, say } = setup({ brain });
  await say('price?');
  assert.match(toLead(wa)[0].text, /₹19,999/);
});

test('conversation history becomes alternating turns starting with the lead', () => {
  const turns = toTurns([
    { dir: 'out', by: 'followup', text: 'hi' },
    { dir: 'in', text: 'a' },
    { dir: 'in', text: 'b' },
    { dir: 'out', by: 'human', text: 'c' },
  ]);
  assert.deepEqual(turns, [{ role: 'user', content: 'a\nb' }, { role: 'assistant', content: '[team member] c' }]);
});

test('follow-ups: nudge in the 24h window, template after, stop when the lead replies', async () => {
  const { store, wa, agent, say } = setup();
  await say('hello');
  const t0 = Date.parse('2026-10-13T05:00:00Z'); // Tuesday 10:30 IST
  const lead = store.getLead('919800000001');
  lead.lastInboundAt = new Date(t0).toISOString();
  lead.lastOutboundAt = new Date(t0 + 1000).toISOString();

  assert.equal(await agent.runFollowups(t0 + 3600000), 0, 'too early');
  assert.equal(await agent.runFollowups(t0 + 2.5 * 3600000), 1);
  assert.match(toLead(wa).at(-1).text, /checking/);
  assert.equal(await agent.runFollowups(t0 + 3 * 3600000), 0, 'one per step');

  assert.equal(await agent.runFollowups(t0 + 5.5 * 3600000), 1);
  assert.ok(toLead(wa).at(-1).text.includes(business.bookingLink));
  assert.equal(await agent.runFollowups(t0 + 72 * 3600000 + 60000), 1);
  assert.equal(toLead(wa).at(-1).type, 'template');
  assert.equal(store.getLead('919800000001').followupsSent, 3);

  await say('sorry, was busy');
  assert.equal(store.getLead('919800000001').followupsSent, 0, 'reset on reply');
});

test('no follow-ups outside business hours', () => {
  assert.ok(inBusinessHours(business, new Date('2026-10-13T05:00:00Z')));
  assert.ok(!inBusinessHours(business, new Date('2026-10-13T20:00:00Z'))); // 01:30 IST
  assert.ok(!inBusinessHours(business, new Date('2026-10-11T05:00:00Z'))); // Sunday
});

test('scoring rewards intent and penalises silence', () => {
  const base = { stage: 'engaged', source: 'organic', profile: {}, messages: [{ dir: 'in', text: 'hi' }] };
  const cold = scoreLead(base);
  const hot = scoreLead({ ...base, stage: 'qualified', profile: { goal: 'x', currentWeight: '80', diet: 'veg', startWhen: 'now', intent: 'high' }, messages: [{ dir: 'in', text: 'what is the price, I want to join today' }] });
  assert.equal(cold.temperature, 'cold');
  assert.equal(hot.temperature, 'hot');
  const stale = scoreLead({ ...base, lastInboundAt: new Date(Date.now() - 10 * 86400000).toISOString() });
  assert.ok(stale.score < cold.score || stale.score === 0);
});

test('HTTP: webhook verification, signature check and protected API', async (t) => {
  const store = createStore(null);
  const wa = fakeWhatsApp();
  const rules = createRuleBrain({ business });
  const agent = createAgent({ store, wa, brain: rules, business, log: quiet });
  const env = { WHATSAPP_VERIFY_TOKEN: 'vt', WHATSAPP_APP_SECRET: 'sec', DASHBOARD_TOKEN: 'dash' };
  const server = http.createServer(createApp({ env, business, store, wa, agent }));
  await new Promise((r) => server.listen(0, r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  let res = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=42`);
  assert.equal(await res.text(), '42');
  res = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42`);
  assert.equal(res.status, 403);

  const body = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: '911', profile: { name: 'Amit' } }], messages: [{ id: 'w1', from: '911', timestamp: '1', type: 'text', text: { body: 'price?' } }] } }] }] });
  res = await fetch(`${base}/webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=bad' } });
  assert.equal(res.status, 401);
  const sig = 'sha256=' + crypto.createHmac('sha256', 'sec').update(body).digest('hex');
  res = await fetch(`${base}/webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': sig } });
  assert.equal(res.status, 200);
  for (let i = 0; i < 50 && !store.getLead('911')?.lastOutboundAt; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getLead('911').name, 'Amit');

  res = await fetch(`${base}/api/leads`);
  assert.equal(res.status, 401);
  const auth = { Authorization: 'Bearer dash' };
  const leads = await (await fetch(`${base}/api/leads`, { headers: auth })).json();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].messages, undefined, 'list omits full chat');

  res = await fetch(`${base}/api/leads/911`, { method: 'PATCH', headers: auth, body: JSON.stringify({ stage: 'won', notes: 'paid', score: 999 }) });
  const lead = await res.json();
  assert.equal(lead.stage, 'won');
  assert.equal(lead.notes, 'paid');
  assert.notEqual(lead.score, 999, 'score is not writable');
  res = await fetch(`${base}/api/leads/911`, { method: 'PATCH', headers: auth, body: JSON.stringify({ paymentStatus: 'paid' }) });
  assert.equal((await res.json()).paymentStatus, 'paid');
  res = await fetch(`${base}/api/leads/911`, { method: 'PATCH', headers: auth, body: JSON.stringify({ paymentStatus: 'free' }) });
  assert.equal(res.status, 400);
  res = await fetch(`${base}/media/..%2Fserver.js`);
  assert.equal(res.status, 404);
  res = await fetch(`${base}/api/leads/911`, { method: 'PATCH', headers: auth, body: JSON.stringify({ stage: 'bogus' }) });
  assert.equal(res.status, 400);

  res = await fetch(`${base}/api/leads/911/send`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'Welcome aboard!' }) });
  assert.equal((await res.json()).botPaused, true);
  const csv = await (await fetch(`${base}/api/export.csv`, { headers: auth })).text();
  assert.match(csv, /^phone,name,stage/);
  assert.match(csv, /"Amit"/);
  const stats = await (await fetch(`${base}/api/stats`, { headers: auth })).json();
  assert.equal(stats.byStage.won, 1);
});

test('answers common questions instead of repeating the qualifying question', async () => {
  const cases = [
    ['is it safe?', /doctor-supervised/],
    ['how long is the program', /3 months/],
    ['is online consultation available?', /online consultation/],
    ['hmm too costly', /a day/],
    ['difference between ozempic and wegovy', /semaglutide/],
    ['who is the doctor', /Dr\. Rajat Goel/],
    ['does it hurt', /pen needle/],
    ['delivery kab hogi', /delivered/],
    ['how much weight will I lose', /never promise/],
    ['Mounjaro price', /₹29,999/],
  ];
  for (const [q, expected] of cases) {
    const { wa, say } = setup();
    await say('hi');
    await say(q);
    assert.match(toLead(wa).at(-1).text, expected, q);
  }
});

test('short replies follow the conversation', async () => {
  const { store, wa, say } = setup();
  await say('hi');
  await say('90 kg 5 ft 2');
  await say('34');
  assert.equal(store.getLead('919800000001').profile.age, '34');
  assert.match(toLead(wa).at(-1).text, /condition\?$/);
  await say('no');
  assert.equal(store.getLead('919800000001').profile.condition, 'None reported');
  assert.match(toLead(wa).at(-1).text, /BMI works out to about 36\.3/);
  await say('haan');
  assert.equal(store.getLead('919800000001').paymentStatus, 'requested', '"haan" after the booking offer books');
  const count = toLead(wa).filter((m) => m.type === 'image').length;
  await say('ok');
  assert.match(toLead(wa).at(-1).text, /screenshot/);
  assert.equal(toLead(wa).filter((m) => m.type === 'image').length, count, 'QR is not resent');
});

test('unknown questions are passed to the team without pausing the bot', async () => {
  const { store, wa, say } = setup();
  await say('hi');
  await say('can my husband join the group meeting too?');
  assert.match(toLead(wa).at(-1).text, /team/);
  assert.ok(!store.getLead('919800000001').botPaused);
  assert.ok(wa.sent.some((m) => m.to === '919999999999' && /Question for the team/.test(m.text)));
});

test('uses only the 89208 31975 number', () => {
  assert.equal(business.phone, '+91 89208 31975');
  assert.doesNotMatch(JSON.stringify(business), /8889995465/);
});
