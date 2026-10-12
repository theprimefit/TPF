'use strict';
// The lead agent: handles every inbound WhatsApp message end to end
// (capture → understand → reply → score → alert) and runs follow-ups.
const { scoreLead, nextStage } = require('./scoring');
const { redFlag } = require('./brain');

const OPT_OUT = /^\s*(stop|unsubscribe|band karo|cancel)\s*$/i;
const OPT_IN = /^\s*(start|subscribe)\s*$/i;
const PAID = /\b(paid|payment (done|sent|made|kar di|ho gaya|complete\w*)|done payment|transferred|sent (the )?(money|amount)|screenshot)\b/i;
const DAY = 86400000;
const HOUR = 3600000;

// Follow-up cadence after the lead goes quiet (measured from their last message).
const FOLLOWUPS = [
  { after: 2 * HOUR, text: (l) => `Hi${first(l)}, just checking, did you get a chance to look at this? Happy to answer any question 🙂` },
  { after: 5 * HOUR, text: (l, biz) => `${biz.offer ? `${biz.offer} ` : ''}Want me to book your doctor consultation${first(l)}? Call ${biz.phone} or book at ${biz.bookingLink}` },
  { after: 3 * DAY, template: true },
  { after: 7 * DAY, template: true },
];

function first(lead) {
  const n = lead.name || lead.profile?.name;
  return n ? ` ${n.split(' ')[0]}` : '';
}

function inBusinessHours(biz, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: biz.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const hm = `${parts.hour}:${parts.minute}`;
  const h = biz.businessHours;
  return h.days.includes(day) && hm >= h.start && hm < h.end;
}

function createAgent({ store, wa, brain, fallbackBrain, business, alertNumbers = [], template = {}, paymentQrUrl = '', log = console }) {
  const queues = new Map(); // phone → promise chain, so one lead is handled in order

  function enqueue(phone, fn) {
    const prev = queues.get(phone) || Promise.resolve();
    const next = prev.then(fn, fn).finally(() => {
      if (queues.get(phone) === next) queues.delete(phone);
    });
    queues.set(phone, next);
    return next;
  }

  async function send(lead, text, buttons = [], by = 'bot', at = new Date().toISOString()) {
    if (buttons.length) await wa.sendButtons(lead.phone, text, buttons);
    else await wa.sendText(lead.phone, text);
    store.addMessage(lead.phone, { dir: 'out', by, text, buttons, at });
  }

  function rescore(lead) {
    const before = lead.temperature;
    const stage = nextStage(lead);
    const { score, temperature, reasons } = scoreLead({ ...lead, stage });
    // Direct assign: rescoring alone shouldn't bump updatedAt (the dashboard sorts by it).
    Object.assign(store.getLead(lead.phone), { stage, score, temperature, scoreReasons: reasons });
    return before !== 'hot' && temperature === 'hot';
  }

  async function alertTeam(lead, why) {
    if (!alertNumbers.length) return;
    const p = lead.profile || {};
    const text = `🔥 ${why}: ${lead.name || p.name || lead.phone} (+${lead.phone})\nScore ${lead.score} · ${lead.stage}\n${lead.summary || [p.goal, p.currentWeight, p.diet, p.startWhen].filter(Boolean).join(' · ')}`;
    for (const n of alertNumbers) await wa.sendText(n, text).catch((e) => log.error('alert failed', e.message));
  }

  async function decide(lead, text) {
    // Medical red flags always go to the doctor with a fixed safe reply, whatever the AI would say.
    if (fallbackBrain && redFlag(text)) return fallbackBrain(lead);
    try {
      const d = await brain(lead);
      if (d && d.reply) return d;
    } catch (e) {
      log.error('brain failed, using rules:', e.message);
    }
    return fallbackBrain ? fallbackBrain(lead) : null;
  }

  async function process(msg) {
    let lead = store.upsertLead(msg.from, {
      name: msg.name,
      source: msg.referral ? msg.referral.source : undefined,
      sourceDetail: msg.referral ? msg.referral.detail : undefined,
    });
    store.addMessage(msg.from, { dir: 'in', text: msg.text, id: msg.id, type: msg.type });
    store.updateLead(msg.from, { followupsSent: 0 });
    wa.markRead(msg.id);

    if (OPT_OUT.test(msg.text)) {
      store.updateLead(msg.from, { optedOut: true, botPaused: true, stage: 'lost' });
      await send(lead, `You won't receive more messages from ${business.businessName}. Reply START anytime to talk again.`);
      return store.save();
    }
    if (OPT_IN.test(msg.text) && lead.optedOut) {
      store.updateLead(msg.from, { optedOut: false, botPaused: false, stage: 'engaged' });
    }

    // Payment proof: never confirm it ourselves, hand it to the team to verify.
    if (lead.paymentStatus === 'requested' && (['image', 'document'].includes(msg.type) || PAID.test(msg.text))) {
      store.updateLead(msg.from, { paymentStatus: 'to_verify', stage: 'booked' });
      if (!lead.botPaused) {
        await send(lead, `Thank you${first(lead)}! 🙏 Our team will verify your payment and confirm your consultation slot shortly.`);
      }
      rescore(lead);
      await alertTeam(store.getLead(msg.from), 'Payment to verify');
      return store.save();
    }

    if (lead.botPaused || lead.optedOut) {
      // A human owns this chat; just keep the CRM up to date.
      if (rescore(lead)) await alertTeam(lead, 'Hot lead (team chat)');
      return store.save();
    }

    const decision = await decide(lead, msg.text);
    lead = store.getLead(msg.from);

    // If the lead sent more messages while we were thinking, let the next run answer them together.
    const lastIn = [...lead.messages].reverse().find((m) => m.dir === 'in');
    if (lastIn && lastIn.id !== msg.id) return store.save();

    if (decision) {
      const patch = { profile: { ...lead.profile, ...decision.profile } };
      if (decision.profile.name && !lead.name) patch.name = decision.profile.name;
      if (decision.summary) patch.summary = decision.summary;
      if (decision.action === 'book_call') patch.stage = 'booked';
      if (decision.action === 'send_payment' && !['to_verify', 'paid'].includes(lead.paymentStatus)) patch.paymentStatus = 'requested';
      if (decision.action === 'mark_lost') patch.stage = 'lost';
      if (decision.action === 'handoff') Object.assign(patch, { botPaused: true, handoffReason: decision.handoffReason || 'Requested by AI' });
      patch.profile.intent = decision.intent;
      store.updateLead(msg.from, patch);
      await send(lead, decision.reply, decision.buttons);
      if (decision.action === 'send_payment' && paymentQrUrl && business.payment) {
        await wa.sendImage(lead.phone, paymentQrUrl, `Scan & pay ${business.consultationFee || ''} · UPI ID ${business.payment.upiId}`.replace('  ', ' '));
        store.addMessage(lead.phone, { dir: 'out', by: 'bot', text: `[UPI QR code: ${business.payment.upiId}]` });
      }
    }

    const becameHot = rescore(lead);
    if (decision?.action === 'handoff') await alertTeam(store.getLead(msg.from), `Needs a human (${store.getLead(msg.from).handoffReason})`);
    else if (decision?.action === 'book_call') await alertTeam(lead, 'Consultation link sent');
    else if (decision?.action === 'send_payment') await alertTeam(lead, 'Payment details sent');
    else if (becameHot) await alertTeam(lead, 'Hot lead');
    return store.save();
  }

  function handleInbound(msg) {
    if (!store.markProcessed(msg.id)) return Promise.resolve();
    return enqueue(msg.from, () => process(msg)).catch((e) => log.error('inbound failed', e));
  }

  // Team replies from the dashboard. The bot pauses so it never talks over a person.
  async function sendManual(phone, text, { pauseBot = true } = {}) {
    const lead = store.getLead(phone);
    if (!lead) throw new Error('lead not found');
    await send(lead, text, [], 'human');
    if (pauseBot) store.updateLead(phone, { botPaused: true, handoffReason: lead.handoffReason || 'Team took over' });
    await store.save();
    return store.getLead(phone);
  }

  async function runFollowups(now = Date.now()) {
    if (!inBusinessHours(business, new Date(now))) return 0;
    let sent = 0;
    for (const lead of store.listLeads()) {
      if (lead.optedOut || lead.botPaused || !['new', 'engaged', 'qualified'].includes(lead.stage)) continue;
      if (!lead.lastInboundAt || !lead.lastOutboundAt || lead.lastOutboundAt < lead.lastInboundAt) continue;
      const step = FOLLOWUPS[lead.followupsSent || 0];
      if (!step) continue;
      const quiet = now - Date.parse(lead.lastInboundAt);
      if (quiet < step.after) continue;
      try {
        if (step.template || quiet >= 23 * HOUR) {
          // Outside WhatsApp's 24-hour window only approved templates are allowed.
          if (!template.name) {
            store.updateLead(lead.phone, { followupsSent: (lead.followupsSent || 0) + 1 });
            continue;
          }
          await wa.sendTemplate(lead.phone, template.name, template.lang, [lead.name ? lead.name.split(' ')[0] : 'there']);
          store.addMessage(lead.phone, { dir: 'out', by: 'followup', text: `[template ${template.name}]`, at: new Date(now).toISOString() });
        } else {
          await send(lead, step.text(lead, business), [], 'followup', new Date(now).toISOString());
        }
        store.updateLead(lead.phone, { followupsSent: (lead.followupsSent || 0) + 1, lastFollowupAt: new Date(now).toISOString() });
        sent++;
      } catch (e) {
        log.error(`follow-up to ${lead.phone} failed:`, e.message);
      }
    }
    for (const lead of store.listLeads()) rescore(lead);
    await store.save();
    return sent;
  }

  return { handleInbound, sendManual, runFollowups, rescore };
}

module.exports = { createAgent, inBusinessHours, FOLLOWUPS };
