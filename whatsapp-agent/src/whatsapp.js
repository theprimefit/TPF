'use strict';
// WhatsApp Cloud API (Meta) client: sending, webhook signature checks and
// webhook payload parsing.
const crypto = require('node:crypto');

function createWhatsApp({ token, phoneNumberId, apiVersion = 'v21.0', fetchImpl = globalThis.fetch }) {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  async function call(body) {
    if (!token || !phoneNumberId) {
      console.log('[whatsapp:dry-run]', JSON.stringify(body));
      return { dryRun: true };
    }
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${JSON.stringify(json.error || json)}`);
    return json;
  }

  return {
    sendText: (to, text) => call({ to, type: 'text', text: { body: text, preview_url: true } }),

    // Up to 3 quick-reply buttons (titles max 20 chars).
    sendButtons: (to, text, buttons) =>
      call({
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: {
            buttons: buttons.slice(0, 3).map((title, i) => ({
              type: 'reply',
              reply: { id: `btn_${i}_${title.toLowerCase().replace(/\W+/g, '_')}`.slice(0, 256), title: title.slice(0, 20) },
            })),
          },
        },
      }),

    // Templates are the only messages allowed outside the 24-hour customer-service window.
    sendTemplate: (to, name, lang = 'en', bodyParams = []) =>
      call({
        to,
        type: 'template',
        template: {
          name,
          language: { code: lang },
          components: bodyParams.length
            ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text: String(text) })) }]
            : [],
        },
      }),

    markRead: (messageId) => call({ status: 'read', message_id: messageId }).catch(() => {}),
  };
}

function verifySignature(rawBody, header, appSecret) {
  if (!appSecret) return true; // not configured: accept (development only)
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const given = header.slice(7);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Flattens a webhook payload into simple inbound message objects.
function parseWebhook(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const names = Object.fromEntries((value.contacts || []).map((c) => [c.wa_id, c.profile?.name || '']));
      for (const m of value.messages || []) {
        let text = '';
        if (m.type === 'text') text = m.text?.body || '';
        else if (m.type === 'button') text = m.button?.text || '';
        else if (m.type === 'interactive') text = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
        else if (m.type === 'image' || m.type === 'document' || m.type === 'video') text = m[m.type]?.caption || `[${m.type}]`;
        else text = `[${m.type}]`;
        out.push({
          id: m.id,
          from: m.from,
          name: names[m.from] || '',
          type: m.type,
          text: text.trim(),
          timestamp: Number(m.timestamp) * 1000 || Date.now(),
          // Click-to-WhatsApp ads attach a referral with the ad's headline / id.
          referral: m.referral
            ? { source: m.referral.source_type || 'ad', detail: m.referral.headline || m.referral.source_id || m.referral.source_url || '' }
            : null,
        });
      }
    }
  }
  return out;
}

module.exports = { createWhatsApp, verifySignature, parseWebhook };
