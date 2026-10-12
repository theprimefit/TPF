'use strict';
// Decides what to reply. Uses Claude when ANTHROPIC_API_KEY is set, otherwise a
// rule-based sales flow. Both return the same shape:
// { reply, buttons[], profile{}, intent, action, handoffReason, summary }
const Anthropic = require('@anthropic-ai/sdk');

const PROFILE_FIELDS = ['name', 'goal', 'currentWeight', 'targetWeight', 'height', 'age', 'gender', 'condition', 'medicines', 'preferredProgram', 'consultMode', 'diet', 'startWhen', 'city', 'language'];
const ACTIONS = ['none', 'book_call', 'send_payment', 'handoff', 'ask_team', 'mark_lost'];

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
  const services = biz.services.map((s) => `- ${s.name}: ${s.price}${s.mrp ? ` (MRP ${s.mrp}, save ${s.save})` : ''}. ${s.details}`).join('\n');
  const included = (biz.included || []).map((i) => `- ${i}`).join('\n');
  const faqs = biz.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n');
  return `You are ${biz.agentName}, the WhatsApp assistant for ${biz.businessName}. Your job is to turn enquiries into booked doctor consultations and enrolled programs, while being genuinely helpful, honest and safe.

About the business: ${biz.pitch}
Phone: ${biz.phone || 'n/a'}
Website / booking: ${biz.bookingLink}
${biz.email ? `Email: ${biz.email}\n` : ''}${biz.doctor ? `Doctor: ${biz.doctor.name}, ${biz.doctor.credentials}. Expertise: ${biz.doctor.expertise.join(', ')}. Trusted by ${biz.doctor.trust}.\n` : ''}First step for every lead: ${biz.consultation || 'a consultation'}.
${biz.payment ? `How to pay the consultation fee: ${biz.payment.instructions} (The QR code image is sent automatically when you set action send_payment.)` : 'The team shares payment details after the consultation.'}
${biz.clinic || ''}
${biz.steps ? `How the program works: ${biz.steps.map((x, i) => `${i + 1}. ${x}`).join(' → ')}` : ''}
${biz.whoCanBenefit ? `Who can benefit: ${biz.whoCanBenefit.join('; ')}.` : ''}
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
- When they show buying intent (asking how to join, book, pay or start), make it easy: explain the consultation fee and that it is fully adjusted against the program, ask online or clinic visit, give the UPI payment details and ask for the screenshot, and set action send_payment.
- Handle objections with empathy and facts (price: break it down per day (price ÷ 90 days) and remind them it includes the medicine, doctor, dietitian and app, mention the offer; fear of injections: it's once a week with a small pen needle; trust: doctor-supervised with weekly monitoring).
- Offer 2-3 quick-reply buttons when it helps them answer with one tap (for example "Book consultation", "What's included?", "Prices").
${biz.rules.map((r) => `- ${r}`).join('\n')}

Fields:
- profile: carry forward what the CRM already knows and add anything new from the conversation (preferredProgram = Ozempic, Wegovy or Mounjaro if they named one).
- intent: high = wants to buy or book now; medium = interested, asking details or price; low = just browsing or hesitant.
- action: send_payment when you give the consultation fee payment details; book_call when you share booking details without payment details; handoff when a doctor or human must take over (say so kindly in reply and give handoffReason); ask_team when you can't answer from the information above and the team should reply (the bot keeps chatting); mark_lost when they clearly decline or ask not to be contacted; otherwise none.`;
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

// Patterns for what the lead is asking. Checked against the latest message only.
const ASK = {
  greet: /^\s*(hi+|hello+|hey+|hii+|namaste|namaskar|good (morning|afternoon|evening)|hlo|helo)\b[\s!.,]*$/i,
  thanks: /^\s*(ok(ay)?,? )?(thanks?|thank you|thx|ty|dhanyavad|shukriya)( you)?[\s!.]*$/i,
  yes: /^\s*(yes+|yeah|yep|ya|haan?|ha+n?|ji|ji haan|sure|ok(ay)?|okk+|done|please|go ahead|theek hai|thik hai|chalo|great|nice|cool|👍)\b[\s!.]*$/i,
  no: /^\s*(no+|nope|nahi|nahin|na|not now|later|baad mein)\b[\s!.]*$/i,
  lost: /\b(not interested|no thanks|don'?t (message|contact)|band karo|mat bhejo)\b/i,
  human: /\b(human|real person|talk to (a |the )?(person|someone|doctor|team)|call me|manager|complaint|refund\w*|doctor se baat)\b/i,
  book: /\b(book\w*|enrol+\w*|sign ?up|register|appointment|interested|program lena hai|join (now|the program|karna hai)|start (the )?(program|treatment)|i want (it|this|to start)|pay(ment)? (details|kaise|karna hai))\b|\b(i want to|i'd like to|i would like to|how (do|can) i|let me|ready to|want to) (join|start|pay|buy|book)\b/i,
  fee: /\b(consult\w* (fees?|charges?|cost|kitna)|fees? (for|of) (the )?consult\w*)\b/i,
  costly: /\b(costly|expensive|too much|mehenga|mahanga|budget|discount|kam karo|afford)\b/i,
  emi: /\b(emi|instal+ments?|monthly pay\w*|part payment|kist)\b/i,
  price: /\b(price|prices|pricing|cost|rate|fees?|charges?|kitna|kitne|kitni|amount|package|plans?|programs?)\b/i,
  included: /\b(includ\w*|kit|what (do|will) i get|kya milega|kya kya|details|benefits?)\b/i,
  compare: /\b(differen\w*|compare|better|best|which (one|is|should)|kaunsa|konsa|vs\.?|versus)\b/i,
  safe: /\b(safe|safety|risk\w*|side ?effects?|nuksan|harm\w*|danger\w*)\b/i,
  duration: /\b(how long|duration|kitne (din|mahine)|months?|weeks?|kab tak)\b/i,
  where: /\b(where|address|location|clinic|city|kahan|kaha|online|video call|visit)\b/i,
  delivery: /\b(deliver\w*|ship\w*|courier|kit kab|kab milega|kab aayega)\b/i,
  results: /\b(how much (weight|kg)|kitna (weight|wajan|vajan) (kam|loss)|results?|guarantee\w*|kitne kg)\b/i,
  needle: /\b(needle|pain\w*|hurt\w*|dard|scared|darr?|injection lag\w*|inject myself)\b/i,
  prescription: /\b(prescri\w*|parchi)\b/i,
  doctor: /\b(doctor|dr\.?|who (is|are) (the )?(doctor|you)|qualified|rajat)\b/i,
};

// hasQr: whether a UPI QR image is sent with the payment details.
function createRuleBrain({ business, hasQr = true }) {
  const first = (name) => (name ? ` ${name.split(' ')[0]}` : '');
  const doc = business.doctor ? business.doctor.name : 'our doctor';
  const fee = business.consultationFee;
  const priceLine = (s) => `• ${s.short || s.name}: ${s.price}${s.mrp ? ` (MRP ${s.mrp})` : ''}`;
  const programs = business.services.map(priceLine).join('\n');
  const feeLine = fee ? `Consultation fee ${fee}, 100% adjusted in the program fee.` : '';
  const pay = business.payment;

  return async function decide(lead) {
    const inbound = lead.messages.filter((m) => m.dir === 'in');
    const text = inbound.length ? inbound[inbound.length - 1].text : '';
    const lastBot = [...lead.messages].reverse().find((m) => m.dir === 'out')?.text || '';
    const all = [lead.sourceDetail, ...inbound.map((m) => m.text)].join(' ');
    const profile = extractProfile(all, { ...lead.profile });
    if (lead.name) profile.name = lead.name;

    // Short answers to the question we just asked.
    if (/your age/i.test(lastBot)) {
      const num = text.match(/^\s*(\d{2})\b/);
      if (num && !profile.age) profile.age = num[1];
    }
    if (/other condition\?/i.test(lastBot) && !profile.condition && /^\s*(no|nope|nahi|nahin|none|nothing|na)\b|\b(no|nahi|none|nothing)\s*[.!]?\s*$/i.test(text)) profile.condition = 'None reported';
    const askedMode = /online consultation or a clinic visit\?/i.test(lastBot) || lead.paymentStatus === 'requested';
    if (askedMode && /^\s*(online|video( call)?)( consultation)?\s*[.!]?\s*$/i.test(text)) profile.consultMode = 'Online';
    if (askedMode && /^\s*(clinic( visit)?|visit|offline|in person|clinic pe aaunga|clinic aaungi?)\s*[.!]?\s*$/i.test(text)) profile.consultMode = 'Clinic visit';

    const n = first(lead.name);
    const isFirst = inbound.length === 1;
    const hello = isFirst ? `Hi${n}! I'm ${business.agentName} from ${business.businessName} 🌿 ` : '';
    const out = { reply: '', buttons: [], profile, intent: inbound.length > 2 ? 'medium' : 'low', action: 'none', handoffReason: '', summary: '' };
    const offeredBooking = /\b(book|payment details)\b[^?]*\?\s*$/i.test(lastBot);
    const paymentAsked = lead.paymentStatus === 'requested';

    // What's still missing to check eligibility, phrased as the next question.
    const nextQuestion = () => {
      if (!profile.currentWeight && !profile.height) return "To check if you're eligible, what's your current weight and height?";
      if (!profile.currentWeight) return "What's your current weight?";
      if (!profile.height) return "And your height?";
      if (!profile.age && !profile.condition) return "What's your age, and do you have diabetes, thyroid, BP or any other condition?";
      if (!profile.age) return "What's your age?";
      if (!profile.condition) return 'Do you have diabetes, thyroid, BP or any other condition?';
      return paymentAsked ? '' : 'Shall I book your consultation with the doctor?';
    };
    const withNext = (answer, buttons) => {
      const q = nextQuestion();
      out.reply = q ? `${answer}\n\n${q}` : answer;
      out.buttons = buttons || (/book your consultation/.test(q) ? ['Book consultation', 'Prices'] : []);
    };
    const book = () => {
      out.intent = 'high';
      if (paymentAsked) {
        out.reply = pay
          ? `Sure${n}! Please pay ${fee} to UPI ID ${pay.upiId} ${hasQr ? '(or scan the QR above) ' : ''}and send the payment screenshot here. Our team will then confirm your slot.`
          : `Sure${n}! Our team will share the payment details shortly.`;
        return;
      }
      if (pay) {
        out.reply = `Great${n}! Here's how to book your consultation with ${doc}'s team:\n• Fee: ${fee} (100% adjusted when you join the program)\n• Pay by UPI: ${pay.upiId}${hasQr ? ' (QR code below)' : ''}\n• Then send the payment screenshot here\n\nWould you like an online consultation or a clinic visit?`;
        out.buttons = ['Online consultation', 'Clinic visit'];
        out.action = 'send_payment';
      } else {
        out.reply = `Great${n}! Call or WhatsApp ${business.phone} to book your consultation with ${doc}'s team.`;
        out.action = 'book_call';
      }
    };

    // The lead just gave eligibility details: thank them and move on (BMI once we have everything).
    const gotNew = ['currentWeight', 'height', 'age', 'condition'].some((k) => profile[k] && !lead.profile?.[k]);
    const progress = () => {
      const q = nextQuestion();
      if (q && !/book your consultation/.test(q)) {
        out.reply = `Thanks${n}. ${q}`;
      } else {
        const bmi = bmiOf(profile);
        out.reply = `Thanks${n}, that helps.${bmi ? ` Your BMI works out to about ${bmi}.` : ''} ${doc} will review your details and confirm the right program at your consultation.${paymentAsked ? '' : ' Shall I book it for you?'}`;
        if (!paymentAsked) out.buttons = ['Book consultation', 'Prices'];
      }
      out.intent = 'medium';
    };

    const flag = redFlag(text);
    if (flag) {
      out.reply = `Thank you for telling me${n}. For your safety, ${doc} needs to review this personally before anything else. I've shared your details and the doctor's team will contact you shortly 🙏`;
      out.action = 'handoff';
      out.handoffReason = `Doctor review: ${flag}`;
    } else if (ASK.human.test(text)) {
      out.reply = `Sure${n}, I've asked our team to contact you personally. They'll message you shortly 🙏`;
      out.action = 'handoff';
      out.handoffReason = /refund/i.test(text) ? 'Asked about refunds' : 'Lead asked for a person';
    } else if (ASK.lost.test(text)) {
      out.reply = `No problem${n}, thank you for your time. Message us anytime if you'd like help with weight loss 🙏`;
      out.action = 'mark_lost';
    } else if (paymentAsked && profile.consultMode && profile.consultMode !== lead.profile?.consultMode) {
      out.reply = `Noted${n ? `,${n}` : ''}: ${profile.consultMode.toLowerCase()}. Once you've paid, send the payment screenshot here and our team will confirm your slot.${profile.consultMode === 'Clinic visit' && business.clinic ? ` ${business.clinic}` : ''}`;
      out.intent = 'high';
    } else if (ASK.fee.test(text)) {
      out.reply = `${hello}The consultation fee is ${fee}, and it's 100% adjusted in the program fee if you join. Shall I share the payment details to book it?`;
      out.buttons = ['Book consultation', 'Prices'];
      out.intent = 'medium';
    } else if (ASK.book.test(text) || (offeredBooking && ASK.yes.test(text))) {
      book();
    } else if (/online consultation or a clinic visit\?/i.test(lastBot) && ASK.yes.test(text)) {
      out.reply = 'Which would you prefer, an online consultation or a clinic visit?';
      out.buttons = ['Online consultation', 'Clinic visit'];
      out.intent = 'high';
    } else if (offeredBooking && ASK.no.test(text)) {
      out.reply = `No problem${n}. Is there anything I can answer for you first?`;
      out.buttons = ['Prices', "What's included?", 'Is it safe?'];
    } else if (ASK.emi.test(text)) {
      out.reply = `Let me check the payment options for you${n}. Our team will message you about this shortly 🙏`;
      out.action = 'handoff';
      out.handoffReason = 'Asked about EMI / instalments';
    } else if (ASK.costly.test(text)) {
      const cheapest = business.services[0];
      const perDay = Math.round(Number(cheapest.price.replace(/\D/g, '')) / 90);
      withNext(`I understand${n}. The ${cheapest.short} program works out to about ₹${perDay} a day, and that includes the medicine, weekly doctor meetings, dietitian support, the app and the kit. ${business.offer || ''}${fee ? ` The ${fee} consultation fee is also adjusted in the program fee.` : ''}`.replace(/\s+$/, ''));
      out.intent = 'medium';
    } else if (ASK.compare.test(text) && /ozempic|wegovy|mounjaro|injection|program|medicine|dawai/i.test(text)) {
      const meds = business.services.map((s) => `${s.short} (${s.medicine})`).join(', ');
      withNext(`${hello}All three are once-weekly injections: ${meds}. Which one suits you depends on your weight, health and reports, so ${doc} decides that at your consultation.`);
    } else if (ASK.included.test(text)) {
      out.reply = `${hello}Every 3-month program includes:\n${business.included.map((i) => `✓ ${i}`).join('\n')}\n\nShall I book your consultation?`;
      out.buttons = ['Book consultation', 'Prices'];
      out.intent = 'medium';
    } else if (ASK.safe.test(text)) {
      withNext(`${hello}It's a doctor-supervised program. ${doc}'s team starts you on a low dose, increases it step by step and checks on you every week. Some people get nausea or an upset stomach in the first weeks; the doctor adjusts the dose if needed. Whether it's right for you is decided after your health check.`);
    } else if (ASK.needle.test(text)) {
      withNext(`${hello}It's one small injection a week with a fine pen needle, and you get an instruction guide plus WhatsApp support. Most people find it very easy after the first one.`);
    } else if (ASK.results.test(text)) {
      withNext(`${hello}Results vary from person to person, so we never promise a fixed number. The doctor sets realistic goals with you and tracks your weight and inches every week.`);
    } else if (ASK.delivery.test(text)) {
      withNext(`${hello}After the doctor confirms your program, the kit is delivered to you anywhere in India. Our team shares the delivery date when you enroll.`);
    } else if (ASK.prescription.test(text)) {
      withNext(`${hello}Yes, these are prescription medicines. ${doc} reviews your health first and only then confirms the program.`);
    } else if (ASK.where.test(text) && !/\d/.test(text)) {
      withNext(`${hello}You can choose an online consultation (from anywhere in India) or a clinic visit. ${business.clinic || ''}`.trim());
    } else if (ASK.duration.test(text) && !/\b(price|cost|fees?|kitna|rate|charges?)\b/i.test(text)) {
      withNext(`${hello}The program runs for 3 months, with a weekly injection and weekly follow-ups.`);
    } else if (ASK.doctor.test(text) && !/\d/.test(text)) {
      const d = business.doctor;
      withNext(d ? `${hello}The program is led by ${d.name}, ${d.credentials}, trusted by ${d.trust}.` : `${hello}The program is run by our doctors.`);
    } else if (ASK.price.test(text) || PROGRAMS.some(([re]) => re.test(text))) {
      const asked = business.services.filter((s) => new RegExp(s.short, 'i').test(text));
      if (asked.length === 1) {
        const s = asked[0];
        out.reply = `${hello}The 3-month ${s.short} program is ${s.price} (MRP ${s.mrp}, you save ${s.save}). It includes the weekly injection, doctor and dietitian support, safety monitoring, the app and the kit. ${feeLine}`.trim();
      } else {
        out.reply = `${hello}Our 3-month programs:\n${programs}\n\nEach includes the weekly injection, doctor and dietitian support, the app and the kit. The doctor confirms the right one at your consultation. ${feeLine}`.trim();
      }
      out.buttons = ['Book consultation', "What's included?"];
      out.intent = 'medium';
    } else if (gotNew && !ASK.price.test(text) && !ASK.book.test(text)) {
      progress();
    } else if ((ASK.yes.test(text) || ASK.no.test(text)) && !isFirst) {
      const q = nextQuestion();
      out.reply = paymentAsked
        ? `Okay${n}. Once you've paid ${fee} to ${pay ? pay.upiId : 'us'}, send the payment screenshot here and our team will confirm your slot.`
        : `Okay${n}. ${q || 'How can I help you?'}`;
      if (/book your consultation/.test(q) && !paymentAsked) out.buttons = ['Book consultation', 'Prices'];
    } else if (ASK.thanks.test(text)) {
      const q = nextQuestion();
      out.reply = `You're welcome${n} 😊${q ? ` ${q}` : ''}`;
      if (/book your consultation/.test(q)) out.buttons = ['Book consultation', 'Prices'];
    } else if (ASK.greet.test(text) || isFirst) {
      out.reply = isFirst
        ? `${hello}We run 3-month doctor-supervised weight loss programs with a weekly injection (Ozempic, Wegovy or Mounjaro), led by ${doc}. ${nextQuestion()}`
        : `Hi again${n}! ${nextQuestion() || 'How can I help you?'}`;
      if (isFirst) out.buttons = [];
    } else {
      const q = nextQuestion();
      if (gotNew) {
        progress();
      } else {
        out.reply = `Let me get our team to answer that properly${n}. They'll reply here shortly.${q ? `\n\nMeanwhile, ${q.charAt(0).toLowerCase()}${q.slice(1)}` : ''}`;
        out.action = 'ask_team';
      }
    }
    out.summary = [profile.name, profile.currentWeight, profile.height, profile.age && `${profile.age} yrs`, profile.condition, profile.preferredProgram, profile.consultMode].filter(Boolean).join(' · ');
    return out;
  };
}

function bmiOf(p) {
  const kg = parseFloat(p.currentWeight);
  let m = 0;
  const cm = String(p.height || '').match(/(\d{3})\s*cm/);
  const ft = String(p.height || '').match(/(\d)\s*ft(?:\s*(\d{1,2})\s*in)?/);
  if (cm) m = Number(cm[1]) / 100;
  else if (ft) m = (Number(ft[1]) * 12 + Number(ft[2] || 0)) * 0.0254;
  if (!kg || !m) return '';
  return (kg / (m * m)).toFixed(1);
}

module.exports = { createClaudeBrain, createRuleBrain, redFlag, systemPrompt, toTurns, OUTPUT_SCHEMA, normalise };
