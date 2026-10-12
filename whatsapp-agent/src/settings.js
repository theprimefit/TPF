'use strict';
// Settings editable from the /setup page. They are stored as KEY=value lines in
// the settings file (.env by default) and applied to process.env immediately.
const fs = require('node:fs');
const path = require('node:path');

const FIELDS = [
  { key: 'DASHBOARD_TOKEN', label: 'Dashboard password', secret: true, group: 'Dashboard', help: 'Your team uses this to open the dashboard and this setup page.' },
  { key: 'WHATSAPP_TOKEN', label: 'WhatsApp access token', secret: true, group: 'WhatsApp', help: 'Meta Business Settings → System users → Generate token (whatsapp_business_messaging).' },
  { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone number ID', group: 'WhatsApp', help: 'developers.facebook.com → your app → WhatsApp → API Setup.' },
  { key: 'WHATSAPP_APP_SECRET', label: 'App secret', secret: true, group: 'WhatsApp', help: 'App settings → Basic → App secret. Proves messages really come from Meta.' },
  { key: 'WHATSAPP_VERIFY_TOKEN', label: 'Webhook verify token', group: 'WhatsApp', help: 'Any password. Paste the same value in Meta when you add the webhook.' },
  { key: 'FOLLOWUP_TEMPLATE_NAME', label: 'Follow-up template name', group: 'WhatsApp', help: 'Approved template for follow-ups after 24 hours, e.g. lead_followup. Leave blank to skip.' },
  { key: 'ALERT_NUMBERS', label: 'Team alert numbers', group: 'Team', help: 'WhatsApp numbers with country code, separated by commas, e.g. 919876543210.' },
  { key: 'ANTHROPIC_API_KEY', label: 'Claude API key (optional)', secret: true, group: 'AI replies', help: 'From console.anthropic.com. Without it the built-in replies are used.' },
  { key: 'TUNNEL', label: 'Public link from this computer', group: 'Public link', options: ['', 'cloudflare', 'ngrok'], help: 'Only when running on your own computer. Cloudflare needs no account but the link changes on every restart; ngrok gives one fixed free link.' },
  { key: 'NGROK_DOMAIN', label: 'ngrok fixed domain', group: 'Public link', help: 'Your free static domain from dashboard.ngrok.com, e.g. hindivine.ngrok-free.app.' },
  { key: 'NGROK_AUTHTOKEN', label: 'ngrok authtoken', secret: true, group: 'Public link', help: 'dashboard.ngrok.com → Your Authtoken.' },
  { key: 'PUBLIC_URL', label: 'Public address (hosted servers)', group: 'Public link', help: 'Only on a hosted server, e.g. https://hindivine-agent.onrender.com. Leave blank when using a tunnel.' },
];
const KEYS = new Set(FIELDS.map((f) => f.key));

function settingsFile(env, root) {
  return path.resolve(root, env.SETTINGS_FILE || '.env');
}

function readFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// Updates (or appends) only the given keys, keeping every other line as it was.
function writeFile(file, values) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : [];
  const left = { ...values };
  const out = lines.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && m[1] in left) {
      const v = left[m[1]];
      delete left[m[1]];
      return `${m[1]}=${v}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(left)) out.push(`${k}=${v}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
}

const mask = (v) => (v ? `••••${String(v).slice(-4)}` : '');

function publicView(env) {
  return FIELDS.map((f) => ({ ...f, value: f.secret ? '' : env[f.key] || '', isSet: Boolean(env[f.key]), masked: f.secret ? mask(env[f.key]) : undefined }));
}

// Cleans submitted values: unknown keys dropped, blank secrets mean "keep", no newlines.
function clean(body, env) {
  const out = {};
  for (const [k, raw] of Object.entries(body || {})) {
    if (!KEYS.has(k)) continue;
    const field = FIELDS.find((f) => f.key === k);
    const v = String(raw ?? '').replace(/[\r\n]/g, '').trim();
    if (field.secret && !v) continue;
    if (field.options && !field.options.includes(v)) throw new Error(`${field.label}: choose one of the options`);
    if (k === 'ALERT_NUMBERS') out[k] = v.split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean).join(',');
    else if (k === 'PUBLIC_URL') out[k] = v.replace(/\/+$/, '');
    else out[k] = v;
  }
  const token = out.DASHBOARD_TOKEN ?? env.DASHBOARD_TOKEN;
  if (!token || token.length < 6) throw new Error('Choose a dashboard password of at least 6 characters.');
  return out;
}

module.exports = { FIELDS, settingsFile, readFile, writeFile, publicView, clean, mask };
