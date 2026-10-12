'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const business = require('../config/business.json');
const { createStore } = require('../src/store');
const { parseWebhook, verifySignature } = require('../src/whatsapp');
const { createRuleBrain, createClaudeBrain, toTurns } = require('../src/brain');
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
    markRead: async () => {},
  };
}

function setup({ brain, alertNumbers = ['919999999999'], template = { name: 'lead_followup', lang: 'en' } } = {}) {
  const store = createStore(null);
  const wa = fakeWhatsApp();
  const rules = createRuleBrain({ business });
  const agent = createAgent({ store, wa, brain: brain || rules, fallbackBrain: rules, business, alertNumbers, template, log: quiet });
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

test('rule-based flow qualifies a lead, books a call and alerts the team', async () => {
  const { store, wa, say } = setup();
  await say('Hi, saw your ad', { referral: { source: 'ad', detail: 'Lose 5 kg in 30 days' } });
  let lead = store.getLead('919800000001');
  assert.equal(lead.source, 'ad');
  assert.equal(lead.stage, 'new');
  assert.equal(toLead(wa)[0].type, 'buttons');
  assert.match(toLead(wa)[0].text, /Priya/);

  await say('Weight loss');
  assert.match(toLead(wa).at(-1).text, /current weight/i);
  await say('82 kg, want 68');
  assert.match(toLead(wa).at(-1).text, /veg/i);
  await say('veg, starting this week');
  lead = store.getLead('919800000001');
  assert.equal(lead.profile.goal, 'Weight loss');
  assert.equal(lead.profile.currentWeight, '82 kg');
  assert.equal(lead.profile.diet, 'Veg');
  assert.match(toLead(wa).at(-1).text, /3-month/);

  await say('ok I want to book');
  lead = store.getLead('919800000001');
  assert.equal(lead.stage, 'booked');
  assert.ok(toLead(wa).at(-1).text.includes(business.bookingLink));
  assert.equal(lead.temperature, 'hot');
  assert.ok(wa.sent.some((m) => m.to === '919999999999' && /Priya/.test(m.text)), 'team alert sent');
  assert.equal(lead.messages.length, 10);
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
  await say('I have PCOS, 74kg, veg, from Pune. How do I join?');

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
  assert.match(toLead(wa)[0].text, /₹/);
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
