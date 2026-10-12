'use strict';
// Lead scoring (0–100) and automatic pipeline stage changes.

const BUY_SIGNALS = /\b(join|start|enrol+|enroll|book|buy|pay|payment|sign ?up|register|interested|ready|lets do|let's do|kab start|shuru|lena hai|chahiye)\b/i;
const PRICE_SIGNALS = /\b(price|pricing|cost|fee|fees|charges?|kitna|kitne|rate|plans?|package|₹|rs\.?|rupees?)\b/i;
const URGENCY = /\b(today|now|asap|urgent|immediately|tomorrow|this week|aaj|abhi|kal)\b/i;
const NEGATIVE = /\b(not interested|no thanks|expensive|too costly|mehenga|later|baad mein|just checking|stop)\b/i;

const PROFILE_POINTS = { goal: 10, currentWeight: 4, targetWeight: 4, diet: 4, condition: 4, startWhen: 6, city: 2, age: 2 };
const INTENT_POINTS = { high: 25, medium: 10, low: 0 };
const STAGE_POINTS = { new: 0, engaged: 5, qualified: 15, booked: 30, won: 40, lost: -40 };

function temperatureOf(score) {
  if (score >= 60) return 'hot';
  if (score >= 30) return 'warm';
  return 'cold';
}

function scoreLead(lead, now = Date.now()) {
  let score = 0;
  const reasons = [];
  const add = (pts, why) => {
    if (!pts) return;
    score += pts;
    reasons.push(`${pts > 0 ? '+' : ''}${pts} ${why}`);
  };

  for (const [field, pts] of Object.entries(PROFILE_POINTS)) {
    if (lead.profile?.[field]) add(pts, `knows ${field}`);
  }

  const inbound = lead.messages.filter((m) => m.dir === 'in');
  add(Math.min(inbound.length * 3, 15), 'engagement');

  const text = inbound.map((m) => m.text).join('\n');
  if (BUY_SIGNALS.test(text)) add(15, 'buying words');
  if (PRICE_SIGNALS.test(text)) add(10, 'asked about price');
  if (URGENCY.test(text)) add(10, 'urgency');
  const lastText = inbound.length ? inbound[inbound.length - 1].text : '';
  if (NEGATIVE.test(lastText)) add(-15, 'hesitation');

  add(INTENT_POINTS[lead.profile?.intent] || 0, `AI intent ${lead.profile?.intent}`);
  add(STAGE_POINTS[lead.stage] || 0, `stage ${lead.stage}`);
  if (lead.source && lead.source !== 'organic') add(5, 'came from an ad');

  if (lead.lastInboundAt) {
    const days = (now - Date.parse(lead.lastInboundAt)) / 86400000;
    if (days > 7) add(-20, 'silent 7+ days');
    else if (days > 3) add(-10, 'silent 3+ days');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, temperature: temperatureOf(score), reasons };
}

// Moves a lead forward (never backward) based on what we know about it.
function nextStage(lead) {
  if (['booked', 'won', 'lost'].includes(lead.stage)) return lead.stage;
  const p = lead.profile || {};
  const qualified = p.goal && (p.currentWeight || p.condition || p.diet) && (p.startWhen || p.intent === 'high');
  if (qualified) return 'qualified';
  const inbound = lead.messages.filter((m) => m.dir === 'in').length;
  if (lead.stage === 'new' && inbound >= 2) return 'engaged';
  return lead.stage;
}

module.exports = { scoreLead, nextStage, temperatureOf };
