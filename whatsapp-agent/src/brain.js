'use strict';
// Decides what to reply. Uses Claude when ANTHROPIC_API_KEY is set, otherwise a
// rule-based sales flow. Both return the same shape:
// { reply, buttons[], profile{}, intent, action, handoffReason, summary }
const Anthropic = require('@anthropic-ai/sdk');

const PROFILE_FIELDS = ['name', 'goal', 'currentWeight', 'targetWeight', 'height', 'age', 'condition', 'medicines', 'preferredProgram', 'diet', 'startWhen', 'city', 'language'];
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
  const services = biz.services.map((s) => `- ${s.name}: ${s.price}. ${s.details}`).join('\n');
  const included = (biz.included || []).map((i) => `- ${i}`).join('\n');
  const faqs = biz.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n');
  return `You are ${biz.agentName}, the WhatsApp assistant for ${biz.businessName}. Your job is to turn enquiries into booked doctor consultations and enrolled programs, while being genuinely helpful, honest and safe.

About the business: ${biz.pitch}
Phone: ${biz.phone || 'n/a'}
Website / booking: ${biz.bookingLink}
${biz.paymentLink ? `Payment link: ${biz.paymentLink}` : 'There is no payment link; the team shares payment details after the consultation.'}
First step for every lead: ${biz.consultation || 'a consultation'}.
Current offer: ${biz.offer || 'none'}

Programs and prices (the only ones you may quote):
${services}

Every program includes:
${included}

FAQs:
${faqs}

How to talk on WhatsApp:
- Reply in the lead's language and style (${biz.languages.join(', ')}). Mirror Hinglish if they use it.
- Keep each message short: 1-3 sentences, at most one question. Use the lead's name once you know it. One emoji at most. Use a short list only when quoting the programs or what's included.
- Answer their question first, then move one step forward. Learn naturally, one at a time: ${biz.qualifyingQuestions.join('; ')}.
- You may explain all programs, prices and what's included, and say which one the lead is asking about. Do not pick a medicine for them: the doctor confirms the right program after the consultation.
- When they show buying intent (asking how to join, pay or start), make it easy: give the phone number and booking link${biz.paymentLink ? ' or payment link' : ''} and set action accordingly.
- Handle objections with empathy and facts (price: break it down per day (price ÷ 90 days) and remind them it includes the medicine, doctor, dietitian and app, mention the offer; fear of injections: it's once a week with a small pen needle; trust: doctor-supervised with weekly monitoring).
- Offer 2-3 quick-reply buttons when it helps them answer with one tap (for example "Book consultation", "What's included?", "Prices").
${biz.rules.map((r) => `- ${r}`).join('\n')}

Fields:
- profile: carry forward what the CRM already knows and add anything new from the conversation (preferredProgram = Ozempic, Wegovy or Mounjaro if they named one).
- intent: high = wants to buy or book now; medium = interested, asking details or price; low = just browsing or hesitant.
- action: book_call when you share the booking details and they want a consultation; send_payment when you send payment details; handoff when a doctor or human must take over (say so kindly in reply and give handoffReason); mark_lost when they clearly decline or ask not to be contacted; otherwise none.`;
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

// ---- Safety screen (runs on every message, whichever brain is used) ----

const RED_FLAGS = [
  [/\b(pregnan\w*|expecting a baby|breast ?feed\w*|lactat\w*|planning (a )?(baby|pregnancy)|garbhvati)\b/i, 'pregnancy / breastfeeding'],
  [/\b(type ?1|type one|t1d|juvenile) diabet\w*/i, 'type 1 diabetes'],
  [/\bpancreatit\w*/i, 'history of pancreatitis'],
  [/\b(medullary|thyroid cancer|men ?2)\b/i, 'thyroid cancer / MEN2'],
  [/\b(anorexi\w*|bulimi\w*|eating disorder)\b/i, 'eating disorder'],
  [/\b(i'?m|i am|i have been|getting|having|facing|ho (raha|rahi) hai)\b.*\b(side ?effects?|nausea|vomit\w*|ulti|stomach pain)\b/i, 'possible side effect'],
  [/\b(allergic reaction|severe (pain|stomach pain))\b/i, 'possible side effect'],
  [/\b(i am|i'm|age|aged?)\s*:?\s*(1[0-7])\b(?!\s*(kg|kgs|kilo|cm|%|lb))|\b(1[0-7])\s*(yrs?|years?|saal)\b/i, 'under 18'],
];

function redFlag(text) {
  for (const [re, why] of RED_FLAGS) if (re.test(text || '')) return why;
  return '';
}

// ---- Rule-based fallback (no API key, or Claude unavailable) ----

const PROGRAMS = [[/ozempic/i, 'Ozempic'], [/wegovy/i, 'Wegovy'], [/mounjaro|tirzepatide/i, 'Mounjaro']];
const CONDITIONS = [[/\b(diabet\w*|sugar)\b/i, 'Diabetes'], [/\bthyroid\b/i, 'Thyroid'], [/\b(bp|blood pressure|hypertension)\b/i, 'BP'], [/\b(pcos|pcod)\b/i, 'PCOS'], [/\b(no (other )?(disease|condition|problem|issue|medical)\w*|none|koi (bimari )?nahi|healthy)\b/i, 'None reported']];

function extractProfile(all, profile) {
  const kg = all.match(/(\d{2,3})\s*(kg|kgs|kilo)/i);
  if (kg && !profile.currentWeight) profile.currentWeight = `${kg[1]} kg`;
  const cm = all.match(/(1\d{2})\s*cm/i);
  const ft = all.match(/([4-6])\s*(?:ft|feet|foot|')\s*(\d{1,2})?/i);
  if (!profile.height && cm) profile.height = `${cm[1]} cm`;
  else if (!profile.height && ft) profile.height = `${ft[1]} ft${ft[2] ? ` ${ft[2]} in` : ''}`;
  const age = all.match(/\b(\d{2})\s*(yrs?|years?|saal|y\/o)\b|\bage\s*:?\s*(\d{2})\b/i);
  if (age && !profile.age) profile.age = age[1] || age[3];
  for (const [re, name] of PROGRAMS) if (!profile.preferredProgram && re.test(all)) profile.preferredProgram = name;
  for (const [re, name] of CONDITIONS) if (!profile.condition && re.test(all)) { profile.condition = name; break; }
  if (!profile.goal && /\b(weight|lose|loss|fat|kam|motapa|obes\w*)\b/i.test(all)) profile.goal = 'Weight loss';
  return profile;
}

function createRuleBrain({ business }) {
  const first = (name) => (name ? ` ${name.split(' ')[0]}` : '');
  const programs = business.services.map((s) => `• ${s.name}: ${s.price}`).join('\n');
  const included = business.included.map((i) => `✓ ${i}`).join('\n');
  const contact = `Call ${business.phone} or book at ${business.bookingLink}`;

  return async function decide(lead) {
    const inbound = lead.messages.filter((m) => m.dir === 'in');
    const text = inbound.length ? inbound[inbound.length - 1].text : '';
    const all = [lead.sourceDetail, ...inbound.map((m) => m.text)].join(' ');
    const profile = extractProfile(all, { ...lead.profile });
    if (lead.name) profile.name = lead.name;
    const n = first(lead.name);
    const hello = inbound.length === 1 ? `Hi${n}! I'm ${business.agentName} from ${business.businessName} 🌿 ` : '';
    const out = { reply: '', buttons: [], profile, intent: 'low', action: 'none', handoffReason: '', summary: '' };
    const flag = redFlag(text);

    if (flag) {
      out.reply = `Thank you for telling me${n}. For your safety our doctor needs to review this personally before anything else. I've shared your details and the doctor's team will contact you shortly 🙏`;
      out.action = 'handoff';
      out.handoffReason = `Doctor review: ${flag}`;
    } else if (/\b(human|agent|call me|talk to|person|manager|refund|complaint|doctor se baat)\b/i.test(text)) {
      out.reply = `Sure${n}, I've asked our team to contact you personally. They'll message you shortly 🙏`;
      out.action = 'handoff';
      out.handoffReason = 'Lead asked for a person';
    } else if (/\b(not interested|no thanks|don't message|dont message)\b/i.test(text)) {
      out.reply = `No problem${n}, thank you for your time. Message us anytime if you'd like help with weight loss.`;
      out.action = 'mark_lost';
    } else if (/\b(book|join|start|pay|interested|ready|enrol|sign ?up|consult\w*|lena hai)\b/i.test(text)) {
      out.reply = `Great${n}! The first step is ${business.consultation}.\n${contact}\n${business.offer || ''}`.trim();
      out.intent = 'high';
      out.action = 'book_call';
    } else if (/\b(include\w*|kit|what do i get|kya milega|details?)\b/i.test(text)) {
      out.reply = `${hello}Every 3-month program includes:\n${included}\n\nWant to book your doctor consultation?`;
      out.buttons = ['Book consultation', 'Prices'];
      out.intent = 'medium';
    } else if (/\b(price|cost|fee|fees|charges?|kitna|kitne|plans?|programs?|package|ozempic|wegovy|mounjaro|injection)\b/i.test(text)) {
      out.reply = `${hello}Our 3-month weight loss programs:\n${programs}\n\nAll include the weekly injection, doctor and dietitian support, safety monitoring, the app and the kit. Our doctor confirms which one suits you after a health check.\n${business.offer || ''}`.trim();
      out.buttons = ['Book consultation', "What's included?"];
      out.intent = 'medium';
    } else if (!profile.currentWeight || !profile.height) {
      out.reply = `${hello || 'Thanks! '}${hello ? 'We run 3-month doctor-supervised weight loss programs with a weekly injection (Ozempic, Wegovy or Mounjaro). ' : ''}To check if you're eligible, what's your current weight and height?`;
      out.intent = inbound.length > 1 ? 'medium' : 'low';
    } else if (!profile.age || !profile.condition) {
      out.reply = `Got it${n}. What's your age, and do you have diabetes, thyroid, BP or any other condition?`;
      out.intent = 'medium';
    } else {
      out.reply = `Thanks${n}, that helps. Here are our 3-month programs:\n${programs}\n\nThe doctor will review your details and confirm the right program. Shall I book your consultation?`;
      out.buttons = ['Book consultation', "What's included?"];
      out.intent = 'medium';
    }
    out.summary = [profile.name, profile.currentWeight, profile.height, profile.age && `${profile.age} yrs`, profile.condition, profile.preferredProgram].filter(Boolean).join(' · ');
    return out;
  };
}

module.exports = { createClaudeBrain, createRuleBrain, redFlag, systemPrompt, toTurns, OUTPUT_SCHEMA, normalise };
