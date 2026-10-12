'use strict';
// HTTP entry point: WhatsApp webhook, dashboard and CRM API.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStore } = require('./store');
const { createWhatsApp, verifySignature, parseWebhook } = require('./whatsapp');
const { createClaudeBrain, createRuleBrain } = require('./brain');
const { createAgent } = require('./agent');
const settings = require('./settings');
const { startTunnel } = require('./tunnel');

const ROOT = path.join(__dirname, '..');
const STATIC = {
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'],
  '/sw.js': ['sw.js', 'text/javascript'],
  '/icon-192.png': ['icon-192.png', 'image/png'],
  '/icon-512.png': ['icon-512.png', 'image/png'],
};

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// deps.agent and deps.wa are read on every request, so saving settings can swap them live.
function createApp(deps) {
  const { env = process.env, business, store } = deps;
  const state = deps.state || {};
  const page = (name) => fs.readFileSync(path.join(ROOT, 'public', name));
  const mediaDirs = () => [path.join(path.dirname(path.resolve(ROOT, env.DATA_FILE || './data/leads.json')), 'media'), path.join(ROOT, 'public', 'media')];

  const send = (res, status, body, type = 'application/json') => {
    res.writeHead(status, { 'Content-Type': type });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };
  const readBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > 5e6) reject(new Error('body too large'));
        else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  const authorised = (req) => {
    const token = env.DASHBOARD_TOKEN;
    if (!token) return false;
    const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return given.length === token.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token));
  };
  // The setup page works with the dashboard password, or before one exists with the one-time setup code.
  const setupAuthorised = (req) => {
    if (env.DASHBOARD_TOKEN) return authorised(req);
    const code = String(req.headers['x-setup-code'] || '');
    return Boolean(state.setupCode) && code.length === state.setupCode.length && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(state.setupCode));
  };
  const publicUrl = () => hostedUrl(env) || state.tunnelUrl || '';
  const json = async (req) => JSON.parse((await readBody(req)).toString() || '{}');
  const setupStatus = () => {
    const qr = findQr(mediaDirs());
    return {
      fields: settings.publicView(env),
      firstRun: !env.DASHBOARD_TOKEN,
      publicUrl: publicUrl(),
      webhookUrl: publicUrl() ? `${publicUrl()}/webhook` : '',
      verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
      tunnel: { kind: env.TUNNEL || '', url: state.tunnelUrl || '', error: state.tunnelError || '' },
      qr: qr ? `/media/${path.basename(qr)}` : '',
      upiId: business.payment?.upiId || '',
      ready: {
        whatsapp: Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_APP_SECRET && env.WHATSAPP_VERIFY_TOKEN),
        publicUrl: Boolean(publicUrl()),
        qr: Boolean(qr),
        claude: Boolean(env.ANTHROPIC_API_KEY),
        alerts: Boolean(env.ALERT_NUMBERS),
        template: Boolean(env.FOLLOWUP_TEMPLATE_NAME),
      },
    };
  };
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    try {
      if (url.pathname === '/health') return send(res, 200, { ok: true });

      // Meta webhook verification handshake.
      if (url.pathname === '/webhook' && req.method === 'GET') {
        const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env.WHATSAPP_VERIFY_TOKEN;
        return ok ? send(res, 200, url.searchParams.get('hub.challenge') || '', 'text/plain') : send(res, 403, 'forbidden', 'text/plain');
      }

      if (url.pathname === '/webhook' && req.method === 'POST') {
        const raw = await readBody(req);
        if (!verifySignature(raw, req.headers['x-hub-signature-256'], env.WHATSAPP_APP_SECRET)) return send(res, 401, { error: 'bad signature' });
        send(res, 200, { ok: true }); // acknowledge fast; Meta retries slow webhooks
        const messages = parseWebhook(JSON.parse(raw.toString('utf8') || '{}'));
        await Promise.all(messages.map((m) => deps.agent.handleInbound(m)));
        return;
      }

      // Public media (the UPI QR image WhatsApp downloads when we send it).
      if (parts[0] === 'media' && parts.length === 2 && /^[\w.-]+\.(jpe?g|png|webp)$/i.test(parts[1])) {
        const file = mediaDirs().map((d) => path.join(d, parts[1])).find((f) => fs.existsSync(f));
        if (!file) return send(res, 404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': `image/${parts[1].split('.').pop().replace('jpg', 'jpeg')}`, 'Cache-Control': 'public, max-age=3600' });
        return res.end(fs.readFileSync(file));
      }

      if (url.pathname === '/' || url.pathname === '/dashboard') return send(res, 200, page('dashboard.html'), 'text/html; charset=utf-8');
      if (url.pathname === '/setup') return send(res, 200, page('setup.html'), 'text/html; charset=utf-8');
      if (STATIC[url.pathname]) return send(res, 200, page(STATIC[url.pathname][0]), STATIC[url.pathname][1]);

      if (parts[0] === 'api' && parts[1] === 'setup') {
        if (!setupAuthorised(req)) return send(res, 401, { error: env.DASHBOARD_TOKEN ? 'Enter the dashboard password.' : 'Enter the setup code shown in the server window.' });
        if (!parts[2] && req.method === 'GET') return send(res, 200, setupStatus());
        if (!parts[2] && req.method === 'POST') {
          let values;
          try {
            values = settings.clean(await json(req), env);
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
          settings.writeFile(settings.settingsFile(env, ROOT), values);
          const tunnelChanged = ['TUNNEL', 'NGROK_DOMAIN', 'NGROK_AUTHTOKEN'].some((k) => k in values && values[k] !== (env[k] || ''));
          Object.assign(env, values);
          if (deps.reload) deps.reload({ tunnelChanged });
          return send(res, 200, setupStatus());
        }
        if (parts[2] === 'qr' && req.method === 'POST') {
          const img = await readBody(req);
          const ext = img[0] === 0xff && img[1] === 0xd8 ? 'jpg' : img.slice(1, 4).toString() === 'PNG' ? 'png' : '';
          if (!ext) return send(res, 400, { error: 'Upload a JPG or PNG image of the QR code.' });
          const dir = mediaDirs()[0];
          fs.mkdirSync(dir, { recursive: true });
          for (const old of ['upi-qr.jpg', 'upi-qr.png']) fs.rmSync(path.join(dir, old), { force: true });
          fs.writeFileSync(path.join(dir, `upi-qr.${ext}`), img);
          if (deps.reload) deps.reload({});
          return send(res, 200, setupStatus());
        }
        if (parts[2] === 'check' && req.method === 'GET') return send(res, 200, await checkWhatsApp(env));
        if (parts[2] === 'test' && req.method === 'POST') {
          const to = String((await json(req)).to || '').replace(/\D/g, '');
          if (to.length < 10) return send(res, 400, { error: 'Enter a WhatsApp number with country code, e.g. 919876543210.' });
          try {
            const r = await deps.wa.sendText(to, `✅ Test from ${business.businessName}: your WhatsApp lead agent is connected.`);
            return send(res, 200, { ok: true, dryRun: Boolean(r && r.dryRun) });
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
        }
        return send(res, 404, { error: 'not found' });
      }

      if (parts[0] === 'api') {
        if (!authorised(req)) return send(res, 401, { error: 'unauthorised' });

        if (url.pathname === '/api/stats') return send(res, 200, { ...store.stats(), business: business.businessName });

        if (url.pathname === '/api/leads' && req.method === 'GET') {
          const q = (url.searchParams.get('q') || '').toLowerCase();
          const stage = url.searchParams.get('stage');
          const temp = url.searchParams.get('temperature');
          const leads = store
            .listLeads()
            .filter((l) => (!stage || l.stage === stage) && (!temp || l.temperature === temp))
            .filter((l) => !q || `${l.name} ${l.phone} ${l.summary || ''} ${l.profile?.goal || ''}`.toLowerCase().includes(q))
            .map(({ messages, ...l }) => ({ ...l, lastMessage: messages[messages.length - 1] || null, messageCount: messages.length }));
          return send(res, 200, leads);
        }

        if (url.pathname === '/api/export.csv') {
          const cols = ['phone', 'name', 'stage', 'temperature', 'score', 'source', 'goal', 'currentWeight', 'targetWeight', 'diet', 'condition', 'startWhen', 'city', 'summary', 'notes', 'createdAt', 'lastInboundAt'];
          const rows = store.listLeads().map((l) => cols.map((c) => csvCell(l[c] ?? l.profile?.[c])).join(','));
          res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="leads.csv"' });
          return res.end([cols.join(','), ...rows].join('\n'));
        }

        if (parts[1] === 'leads' && parts[2]) {
          const phone = decodeURIComponent(parts[2]);
          const lead = store.getLead(phone);
          if (!lead) return send(res, 404, { error: 'lead not found' });

          if (parts[3] === 'send' && req.method === 'POST') {
            const { text, pauseBot = true } = JSON.parse((await readBody(req)).toString() || '{}');
            if (!text || !text.trim()) return send(res, 400, { error: 'text required' });
            return send(res, 200, await deps.agent.sendManual(phone, text.trim(), { pauseBot }));
          }
          if (!parts[3] && req.method === 'PATCH') {
            const body = JSON.parse((await readBody(req)).toString() || '{}');
            const allowed = ['name', 'stage', 'notes', 'tags', 'botPaused', 'paymentStatus'];
            const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
            if (patch.botPaused === false) patch.handoffReason = '';
            if ('paymentStatus' in patch && !['', 'requested', 'to_verify', 'paid'].includes(patch.paymentStatus)) return send(res, 400, { error: 'bad paymentStatus' });
            store.updateLead(phone, patch);
            deps.agent.rescore(store.getLead(phone));
            await store.save();
            return send(res, 200, store.getLead(phone));
          }
          if (!parts[3] && req.method === 'GET') return send(res, 200, lead);
        }
      }
      send(res, 404, { error: 'not found' });
    } catch (e) {
      console.error(e);
      if (!res.headersSent) send(res, e.message.startsWith('unknown stage') ? 400 : 500, { error: e.message });
    }
  };
}

// The server's own public address: set by hand, or provided by Render / Railway.
function hostedUrl(env) {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/+$/, '');
  if (env.RENDER_EXTERNAL_URL) return env.RENDER_EXTERNAL_URL.replace(/\/+$/, '');
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  return '';
}

function findQr(dirs) {
  for (const d of dirs) for (const f of ['upi-qr.jpg', 'upi-qr.jpeg', 'upi-qr.png']) if (fs.existsSync(path.join(d, f))) return path.join(d, f);
  return '';
}

// Public URL of the UPI QR image: PAYMENT_QR_URL, or the public address + /media/<file> when the image exists.
function paymentQrUrl(env, base, dirs) {
  if (env.PAYMENT_QR_URL) return env.PAYMENT_QR_URL;
  const qr = findQr(dirs);
  if (!qr || !base) return '';
  return `${base.replace(/\/$/, '')}/media/${path.basename(qr)}`;
}

// Asks Meta whether the token and phone number ID work.
async function checkWhatsApp(env) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return { ok: false, message: 'Add the access token and phone number ID first.' };
  try {
    const res = await fetch(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION || 'v21.0'}/${env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating`, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: body.error?.message || `Meta answered ${res.status}` };
    return { ok: true, message: `Connected: ${body.verified_name || 'business'} (${body.display_phone_number || env.WHATSAPP_PHONE_NUMBER_ID})` };
  } catch (e) {
    return { ok: false, message: `Could not reach Meta: ${e.message}` };
  }
}

function openBrowser(url) {
  const { exec } = require('node:child_process');
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function main() {
  const env = process.env;
  loadEnvFile(path.join(ROOT, '.env'));
  if (env.SETTINGS_FILE) loadEnvFile(path.resolve(ROOT, env.SETTINGS_FILE));
  const business = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'business.json'), 'utf8'));
  const store = createStore(path.resolve(ROOT, env.DATA_FILE || './data/leads.json'));
  const port = Number(env.PORT) || 3000;
  const state = {};
  const deps = { env, business, store, state };
  const mediaDirs = [path.join(path.dirname(path.resolve(ROOT, env.DATA_FILE || './data/leads.json')), 'media'), path.join(ROOT, 'public', 'media')];

  // (Re)creates the WhatsApp client and the agent from the current settings.
  function build() {
    deps.wa = createWhatsApp({ token: env.WHATSAPP_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID, apiVersion: env.WHATSAPP_API_VERSION || 'v21.0' });
    const rules = createRuleBrain({ business });
    const brain = env.ANTHROPIC_API_KEY
      ? createClaudeBrain({ business, apiKey: env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || 'claude-opus-5-5', effort: env.CLAUDE_EFFORT || 'low' })
      : rules;
    deps.agent = createAgent({
      store,
      wa: deps.wa,
      brain,
      fallbackBrain: rules,
      business,
      alertNumbers: (env.ALERT_NUMBERS || '').split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean),
      template: { name: env.FOLLOWUP_TEMPLATE_NAME, lang: env.FOLLOWUP_TEMPLATE_LANG || 'en' },
      paymentQrUrl: paymentQrUrl(env, hostedUrl(env) || state.tunnelUrl, mediaDirs),
    });
  }

  let tunnel = null;
  function tunnelUp() {
    if (tunnel) tunnel.kill();
    tunnel = null;
    state.tunnelUrl = '';
    state.tunnelError = '';
    if (!env.TUNNEL) return;
    console.log(`Starting the ${env.TUNNEL} public link…`);
    tunnel = startTunnel({
      kind: env.TUNNEL,
      port,
      ngrokDomain: env.NGROK_DOMAIN,
      ngrokAuthtoken: env.NGROK_AUTHTOKEN,
      onUrl: (u) => {
        state.tunnelUrl = u;
        build();
        console.log(`\n  Public link: ${u}\n  WhatsApp webhook URL: ${u}/webhook\n`);
      },
      log: { warn: console.warn, error: (m) => { state.tunnelError = m; console.error(m); } },
    });
  }

  deps.reload = ({ tunnelChanged }) => {
    build();
    if (tunnelChanged) tunnelUp();
  };
  build();
  tunnelUp();

  if (!env.DASHBOARD_TOKEN) state.setupCode = String(crypto.randomInt(100000, 1000000));
  console.log(`AI replies: ${env.ANTHROPIC_API_KEY ? env.CLAUDE_MODEL || 'claude-opus-5-5' : 'built-in (add a Claude key on the setup page for AI replies)'}`);
  if (!env.WHATSAPP_TOKEN) console.log('WhatsApp is not connected yet: replies are only shown in this window.');

  http.createServer(createApp(deps)).listen(port, () => {
    const local = `http://localhost:${port}`;
    console.log(`\n  Hindivine WhatsApp lead agent is running.\n  Dashboard: ${local}/dashboard\n  Setup:     ${local}/setup`);
    const lan = Object.values(require('node:os').networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${port}`);
    if (lan.length) console.log(`  On the office Wi-Fi (phone app): ${lan.join('  ')}`);
    if (state.setupCode) console.log(`  First-time setup code: ${state.setupCode}`);
    console.log('  Keep this window open. Close it to stop the agent.\n');
    if (env.OPEN_BROWSER === '1') openBrowser(`${local}/setup${state.setupCode ? `#${state.setupCode}` : ''}`);
  });
  setInterval(() => deps.agent.runFollowups().catch((e) => console.error('follow-ups failed', e)), 5 * 60 * 1000);
}

if (require.main === module) main();

module.exports = { createApp, loadEnvFile };
