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

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function createApp({ env = process.env, business, store, wa, agent }) {
  const dashboardHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard.html'));

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
        await Promise.all(messages.map((m) => agent.handleInbound(m)));
        return;
      }

      if (url.pathname === '/' || url.pathname === '/dashboard') return send(res, 200, dashboardHtml, 'text/html; charset=utf-8');

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
            return send(res, 200, await agent.sendManual(phone, text.trim(), { pauseBot }));
          }
          if (!parts[3] && req.method === 'PATCH') {
            const body = JSON.parse((await readBody(req)).toString() || '{}');
            const allowed = ['name', 'stage', 'notes', 'tags', 'botPaused'];
            const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
            if (patch.botPaused === false) patch.handoffReason = '';
            store.updateLead(phone, patch);
            agent.rescore(store.getLead(phone));
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

function main() {
  loadEnvFile(path.join(__dirname, '..', '.env'));
  const env = process.env;
  const business = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'business.json'), 'utf8'));
  const store = createStore(path.resolve(__dirname, '..', env.DATA_FILE || './data/leads.json'));
  const wa = createWhatsApp({ token: env.WHATSAPP_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID, apiVersion: env.WHATSAPP_API_VERSION || 'v21.0' });
  const rules = createRuleBrain({ business });
  const brain = env.ANTHROPIC_API_KEY
    ? createClaudeBrain({ business, apiKey: env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || 'claude-opus-5-5', effort: env.CLAUDE_EFFORT || 'low' })
    : rules;
  const agent = createAgent({
    store,
    wa,
    brain,
    fallbackBrain: rules,
    business,
    alertNumbers: (env.ALERT_NUMBERS || '').split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean),
    template: { name: env.FOLLOWUP_TEMPLATE_NAME, lang: env.FOLLOWUP_TEMPLATE_LANG || 'en' },
  });

  if (!env.DASHBOARD_TOKEN) console.warn('DASHBOARD_TOKEN is not set: the dashboard API is locked.');
  if (!env.WHATSAPP_TOKEN) console.warn('WHATSAPP_TOKEN is not set: replies are only logged (dry run).');
  console.log(`AI replies: ${env.ANTHROPIC_API_KEY ? env.CLAUDE_MODEL || 'claude-opus-5-5' : 'rule-based (set ANTHROPIC_API_KEY for Claude)'}`);

  const port = Number(env.PORT) || 3000;
  http.createServer(createApp({ env, business, store, wa, agent })).listen(port, () => console.log(`WhatsApp lead agent on http://localhost:${port}/dashboard`));
  setInterval(() => agent.runFollowups().catch((e) => console.error('follow-ups failed', e)), 5 * 60 * 1000);
}

if (require.main === module) main();

module.exports = { createApp, loadEnvFile };
