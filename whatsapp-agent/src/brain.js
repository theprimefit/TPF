'use strict';
// Decides what to reply. Uses Claude when ANTHROPIC_API_KEY is set, otherwise a
// rule-based sales flow. Both return the same shape:
// { reply, buttons[], profile{}, intent, action, handoffReason, summary }
const Anthropic = require('@anthropic-ai/sdk');

const PROFILE_FIELDS = ['name', 'goal', 'currentWeight', 'targetWeight', 'diet', 'condition', 'startWhen', 'city', 'age', 'language'];
const ACTIONS = ['none', 'book_call', 'send_payment', 'handoff', 'mark_lost'];

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'WhatsApp message to send. Short, warm, max ~70 words.' },
    buttons: { type: 'array', items: { type: 'string' }, description: '0-3 quick-reply options, each max 20 characters.' },
    profile: {
      type: 'object',
      description: 'Everything known about the lead so far. Empty string when unknown.',
      properties: Object.fromEntries(PROFILE_FIELDS.map((f) => [f, { type: 'string' }])),
      required: PROFILE_FIELDS,
      additionalProperties: false,
    },
    intent: { type: 'string', enum: ['low', 'medium', 'high'] },
    action: { type: 'string', enum: ACTIONS },
    handoffReason: { type: 'string' },
    summary: { type: 'string', description: 'One line for the sales team: who this lead is and what they want.' },
  },
  required: ['reply', 'buttons', 'profile', 'intent', 'action', 'handoffReason', 'summary'],
  additionalProperties: false,
};

function systemPrompt(biz) {
  const services = biz.services.map((s) => `- ${s.name} (${s.price}): ${s.details}`).join('\n');
  const faqs = biz.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n');
  return `You are ${biz.agentName}, the WhatsApp sales assistant for ${biz.businessName}. Your job is to turn enquiries into booked consultations and paid plans, while being genuinely helpful and honest.

About the business: ${biz.pitch}
Website: ${biz.website}
Booking link for the free consultation: ${biz.bookingLink}
${biz.paymentLink ? `Payment link: ${biz.paymentLink}` : 'There is no payment link; the team shares payment details on the call.'}
Current offer: ${biz.offer || 'none'}

Services and prices (the only ones you may quote):
${services}

FAQs:
${faqs}

How to sell on WhatsApp:
- Reply in the lead's language and style (${biz.languages.join(', ')}). Mirror Hinglish if they use it.
- Keep each message short: 1-3 sentences, at most one question. Use the lead's name once you know it. One emoji at most.
- Answer their question first, then move one step forward. Learn naturally, one at a time: ${biz.qualifyingQuestions.join('; ')}.
- When the goal is clear, recommend the single best-fitting plan and why, then invite them to the free consultation with the booking link.
- When they show buying intent (asking how to join, pay or start), make it easy: give the booking link${biz.paymentLink ? ' or payment link' : ''} and set action accordingly.
- Handle objections with empathy and facts (price: break it down per day, mention the offer; time: plans use normal home food; trust: dietitian-made, works on WhatsApp).
- Offer 2-3 quick-reply buttons when it helps them answer with one tap (for example their goal, or "Book free call").
${biz.rules.map((r) => `- ${r}`).join('\n')}

Fields:
- profile: carry forward what the CRM already knows and add anything new from the conversation.
- intent: high = wants to buy or book now; medium = interested, asking details or price; low = just browsing or hesitant.
- action: book_call when you send the booking link and they agreed to a call; send_payment when you send payment details; handoff when a human must take over (say so in reply and give handoffReason); mark_lost when they clearly decline or ask not to be contacted; otherwise none.`;
}

// Turn stored messages into alternating user/assistant turns.
function toTurns(messages) {
  const turns = [];
  for (const m of messages.slice(-30)) {
    const role = m.dir === 'in' ? 'user' : 'assistant';
    const text = m.dir === 'out' && m.by === 'human' ? `[team member] ${m.text}` : m.text;
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += `\n${text}`;
    else turns.push({ role, content: text });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
}

function createClaudeBrain({ business, apiKey, model = 'claude-opus-5-5', effort = 'low', client }) {
  const anthropic = client || new Anthropic({ apiKey });
  const system = systemPrompt(business);

  return async function decide(lead) {
    const turns = toTurns(lead.messages);
    if (!turns.length || turns[turns.length - 1].role !== 'user') return null;
    const context = `[CRM context, not from the lead] name: ${lead.name || 'unknown'}; stage: ${lead.stage}; source: ${lead.source}${lead.sourceDetail ? ` (${lead.sourceDetail})` : ''}; known profile: ${JSON.stringify(lead.profile || {})}; local time: ${new Date().toLocaleString('en-IN', { timeZone: business.timezone })}`;
    const last = turns[turns.length - 1];
    last.content = [
      { type: 'text', text: context },
      { type: 'text', text: last.content },
    ];

    const response = await anthropic.beta.messages.create({
      model,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      output_config: { effort, format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: turns,
    });

    if (response.stop_reason === 'refusal') return null;
    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) return null;
    return normalise(JSON.parse(text));
  };
}

function normalise(d) {
  return {
    reply: String(d.reply || '').trim(),
    buttons: (d.buttons || []).filter(Boolean).slice(0, 3).map((b) => String(b).slice(0, 20)),
    profile: Object.fromEntries(PROFILE_FIELDS.map((f) => [f, String(d.profile?.[f] || '').trim()]).filter(([, v]) => v)),
    intent: ['low', 'medium', 'high'].includes(d.intent) ? d.intent : 'low',
    action: ACTIONS.includes(d.action) ? d.action : 'none',
    handoffReason: d.handoffReason || '',
    summary: d.summary || '',
  };
}

// ---- Rule-based fallback (no API key, or Claude unavailable) ----

const GOALS = [
  [/\b(lose|loss|reduce|kam|fat|slim|weight ?loss|motapa)\b/i, 'Weight loss'],
  [/\b(gain|badhana|thin|underweight|bulk)\b/i, 'Weight gain'],
  [/\bpcos|pcod\b/i, 'PCOS'],
  [/\b(diabet|sugar)\w*/i, 'Diabetes'],
  [/\bthyroid\b/i, 'Thyroid'],
  [/\b(bp|blood pressure|hypertension)\b/i, 'BP'],
  [/\b(pregnan|lactat|feeding)\w*/i, 'Pregnancy / lactation'],
];
const DIETS = [[/\bjain\b/i, 'Jain'], [/\bvegan\b/i, 'Vegan'], [/\b(non[- ]?veg|chicken|fish|mutton)\b/i, 'Non-veg'], [/\b(egg|eggetarian)\b/i, 'Egg'], [/\b(veg|vegetarian|shakahari)\b/i, 'Veg']];

function createRuleBrain({ business }) {
  const first = (name) => (name ? ` ${name.split(' ')[0]}` : '');
  return async function decide(lead) {
    const inbound = lead.messages.filter((m) => m.dir === 'in');
    const text = inbound.length ? inbound[inbound.length - 1].text : '';
    const all = inbound.map((m) => m.text).join(' ');
    const profile = { ...lead.profile };
    if (lead.name) profile.name = lead.name;
    for (const [re, goal] of GOALS) if (!profile.goal && re.test(all)) profile.goal = goal;
    for (const [re, diet] of DIETS) if (!profile.diet && re.test(all)) { profile.diet = diet; break; }
    const kg = all.match(/(\d{2,3})\s*(kg|kgs|kilo)/i);
    if (kg && !profile.currentWeight) profile.currentWeight = `${kg[1]} kg`;

    const out = { reply: '', buttons: [], profile, intent: 'low', action: 'none', handoffReason: '', summary: '' };
    const plans = business.services.map((s) => `• ${s.name}: ${s.price}`).join('\n');
    const best = () =>
      (/pcos|diabet|thyroid|bp/i.test(profile.goal || '') ? business.services.find((s) => /medical/i.test(s.name)) : business.services.find((s) => /3-month/i.test(s.name))) ||
      business.services[0];
    const hello = inbound.length === 1 ? `Hi${first(lead.name)}! I'm ${business.agentName} from ${business.businessName} 🌿 ` : '';

    if (/\b(human|agent|call me|talk to|person|manager|refund|complaint)\b/i.test(text)) {
      out.reply = `Sure${first(lead.name)}, I've asked our team to contact you personally. They'll message you shortly 🙏`;
      out.action = 'handoff';
      out.handoffReason = 'Lead asked for a person';
    } else if (/\b(not interested|no thanks|don't message|dont message)\b/i.test(text)) {
      out.reply = `No problem${first(lead.name)}, thank you for your time. Message us anytime if you'd like help with your diet.`;
      out.action = 'mark_lost';
    } else if (/\b(book|join|start|pay|interested|ready|enrol|sign ?up)\b/i.test(text)) {
      out.reply = `Great decision${first(lead.name)}! Book your free 15-min call with our dietitian here: ${business.bookingLink}\n${business.offer || ''}`.trim();
      out.intent = 'high';
      out.action = 'book_call';
    } else if (/\b(price|cost|fee|fees|charges?|kitna|plans?|package)\b/i.test(text)) {
      if (profile.goal) {
        out.reply = `${hello}Here are our plans:\n${plans}\n\nFor ${profile.goal.toLowerCase()}, our ${best().name} works best. ${business.offer || ''}`.trim();
        out.buttons = ['Book free call', 'Tell me more'];
      } else {
        out.reply = `${hello}Here are our plans:\n${plans}\n\n${business.offer || ''}\nWhat's your main goal, so I can suggest the best one?`.trim();
        out.buttons = ['Weight loss', 'PCOS / Thyroid', 'Book free call'];
      }
      out.intent = 'medium';
    } else if (!profile.goal) {
      out.reply = `Hi${first(lead.name)}! I'm ${business.agentName} from ${business.businessName} 🌿 We make personalised Indian diet plans with dietitians. What's your main goal?`;
      out.buttons = ['Weight loss', 'Weight gain', 'PCOS / Thyroid'];
    } else if (!profile.currentWeight && /weight/i.test(profile.goal)) {
      out.reply = `${hello}Got it, ${profile.goal.toLowerCase()}. What's your current weight and your target weight?`;
      out.intent = 'medium';
    } else if (!profile.diet) {
      out.reply = `${hello || 'Thanks! '}${hello ? `We can help with ${profile.goal.toLowerCase()}. ` : ''}Do you eat veg, non-veg, egg, Jain or vegan food?`;
      out.buttons = ['Veg', 'Non-veg', 'Jain / Vegan'];
      out.intent = 'medium';
    } else {
      out.reply = `${hello || `Perfect${first(lead.name)}. `}For ${profile.goal.toLowerCase()} I'd recommend our ${best().name} (${best().price}). Want to start with a free call with our dietitian? ${business.bookingLink}`;
      out.buttons = ['Book free call', 'Tell me more'];
      out.intent = 'medium';
    }
    out.summary = [profile.name, profile.goal, profile.currentWeight, profile.diet].filter(Boolean).join(' · ');
    return out;
  };
}

module.exports = { createClaudeBrain, createRuleBrain, systemPrompt, toTurns, OUTPUT_SCHEMA, normalise };
