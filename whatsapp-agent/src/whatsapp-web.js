'use strict';
// WhatsApp through "Linked devices": you scan a QR code (or enter a pairing
// code) with your phone, like WhatsApp Web, and the agent replies from your own
// number. No Meta setup is needed. This uses the unofficial Baileys library, so
// WhatsApp may restrict or ban numbers it sees as automated; the agent only
// replies to people who message first and paces its messages like a person.
const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');

const SKIP_JID = /(@g\.us|@broadcast|@newsletter)$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pulls what the agent needs out of a raw WhatsApp message. Pure, so it can be tested.
function parseWebMessage(m, getContentType) {
  const jid = m.key?.remoteJid || '';
  if (!m.message || !jid || SKIP_JID.test(jid) || jid === 'status@broadcast') return null;
  const phoneJid = [jid, m.key.remoteJidAlt, m.key.senderPn].find((j) => j && j.endsWith('@s.whatsapp.net'));
  const id = (phoneJid || jid).split('@')[0].split(':')[0];
  let msg = m.message;
  for (const wrap of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'documentWithCaptionMessage']) {
    if (msg[wrap]?.message) msg = msg[wrap].message;
  }
  const kind = getContentType(msg) || '';
  const text =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.buttonsResponseMessage?.selectedDisplayText ||
    msg.templateButtonReplyMessage?.selectedDisplayText ||
    msg.listResponseMessage?.title ||
    '';
  const type = { imageMessage: 'image', documentMessage: 'document', audioMessage: 'audio', videoMessage: 'video', stickerMessage: 'sticker' }[kind] || 'text';
  const ad = msg.extendedTextMessage?.contextInfo?.externalAdReply;
  return {
    id: m.key.id,
    jid,
    from: id,
    fromMe: Boolean(m.key.fromMe),
    name: m.pushName || '',
    type,
    text: (text || (type === 'text' ? '' : `[${type}]`)).trim(),
    timestamp: Number(m.messageTimestamp) * 1000 || Date.now(),
    referral: ad ? { source: 'ad', detail: ad.title || ad.body || ad.sourceUrl || '' } : null,
  };
}

function createWhatsAppWeb({ sessionDir, onMessage, onHumanReply = () => {}, log = console }) {
  let B = null;
  let sock = null;
  let stopped = false;
  let retries = 0;
  const status = { state: 'starting', qr: '', pairingCode: '', me: '', error: '' };
  const jids = new Map(); // phone or id → chat to reply to
  const keys = new Map(); // message id → key, to mark it read
  const buttons = new Map(); // chat → the options we last offered as "1, 2, 3"
  const sentIds = new Set(); // our own messages, so the team's replies from the phone can be told apart

  async function start() {
    stopped = false;
    B = B || (await import('@whiskeysockets/baileys'));
    const pino = (await import('pino')).default;
    fs.mkdirSync(sessionDir, { recursive: true });
    const { state, saveCreds } = await B.useMultiFileAuthState(sessionDir);
    let version;
    try {
      ({ version } = await B.fetchLatestBaileysVersion());
    } catch {
      /* fall back to the library's built-in version */
    }
    sock = B.default({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: B.Browsers.macOS('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      ...(version ? { version } : {}),
    });
    const me = sock;

    me.ev.on('creds.update', saveCreds);
    me.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (me !== sock) return;
      if (qr) {
        status.state = 'qr';
        status.qr = await QRCode.toDataURL(qr, { margin: 1, width: 300 });
        status.error = '';
      }
      if (connection === 'open') {
        retries = 0;
        Object.assign(status, { state: 'connected', qr: '', pairingCode: '', error: '', me: (me.user?.id || '').split(':')[0].split('@')[0] });
        log.log(`WhatsApp linked: +${status.me}`);
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (stopped) return;
        if (code === B.DisconnectReason.loggedOut) {
          log.warn('WhatsApp was unlinked from the phone. Scan the QR code again on the setup page.');
          fs.rmSync(sessionDir, { recursive: true, force: true });
          Object.assign(status, { state: 'starting', qr: '', pairingCode: '', me: '', error: 'Unlinked from the phone. Link again below.' });
          return start().catch((e) => fail(e));
        }
        status.state = 'reconnecting';
        const wait = Math.min(60000, 2000 * 2 ** retries++);
        setTimeout(() => !stopped && me === sock && start().catch((e) => fail(e)), wait);
      }
    });

    me.ev.on('messages.upsert', ({ messages }) => {
      for (const raw of messages) {
        const m = parseWebMessage(raw, B.getContentType);
        if (!m) continue;
        jids.set(m.from, m.jid);
        if (m.fromMe) {
          // Typed by the team on the phone: record it and let the person handle the chat.
          if (!sentIds.has(m.id) && m.text && Date.now() - m.timestamp < 120000) onHumanReply(m.from, m.text);
          continue;
        }
        keys.set(m.id, raw.key);
        if (keys.size > 500) keys.delete(keys.keys().next().value);
        const offered = buttons.get(m.jid);
        const pick = m.text.match(/^\s*([1-3])\s*[.)]?\s*$/);
        if (offered && pick && offered[pick[1] - 1]) m.text = offered[pick[1] - 1];
        buttons.delete(m.jid);
        onMessage(m);
      }
    });
  }

  function fail(e) {
    status.state = 'error';
    status.error = e.message;
    log.error('WhatsApp link failed:', e.message);
  }

  function chatOf(to) {
    if (!sock || status.state !== 'connected') throw new Error('WhatsApp is not linked. Open the setup page and scan the QR code.');
    return jids.get(String(to)) || `${String(to).replace(/\D/g, '')}@s.whatsapp.net`;
  }

  // Shows "typing…" for a moment, scaled to the message length, so replies feel human.
  async function deliver(jid, content, typingChars = 0) {
    try {
      await sock.sendPresenceUpdate('composing', jid);
      await sleep(Math.min(4000, 700 + typingChars * 20));
      await sock.sendPresenceUpdate('paused', jid);
    } catch {
      /* presence is cosmetic */
    }
    const res = await sock.sendMessage(jid, content);
    if (res?.key?.id) {
      sentIds.add(res.key.id);
      if (sentIds.size > 1000) sentIds.delete(sentIds.values().next().value);
    }
    return res;
  }

  return {
    mode: 'web',
    start: () => start().catch((e) => fail(e)),
    status: () => ({ ...status }),

    sendText: (to, text) => {
      const jid = chatOf(to);
      return deliver(jid, { text }, text.length);
    },

    // Linked devices can't send real buttons, so options become a numbered list.
    sendButtons: (to, text, options) => {
      const jid = chatOf(to);
      buttons.set(jid, options);
      const list = options.map((o, i) => `*${i + 1}.* ${o}`).join('\n');
      return deliver(jid, { text: `${text}\n\n${list}\n_Reply with a number_` }, text.length);
    },

    // Local files (file://…) are read from disk, so no public address is needed.
    sendImage: (to, link, caption = '') => {
      const jid = chatOf(to);
      const image = link.startsWith('file://') ? fs.readFileSync(link.slice(7)) : { url: link };
      return deliver(jid, { image, caption });
    },

    sendTemplate: () => Promise.reject(new Error('Templates are only for the Cloud API')),

    markRead: (id) => {
      const key = keys.get(id);
      return key && sock ? sock.readMessages([key]).catch(() => {}) : Promise.resolve();
    },

    // "Link with phone number instead": WhatsApp shows a box for this 8-character code.
    pairingCode: async (phone) => {
      if (!sock) throw new Error('Still starting, try again in a few seconds.');
      if (status.state === 'connected') throw new Error('Already linked.');
      if (status.state !== 'qr') throw new Error('WhatsApp is not reachable yet. Wait until the QR code appears above, then try again.');
      let code;
      try {
        code = await sock.requestPairingCode(String(phone).replace(/\D/g, ''));
      } catch (e) {
        throw new Error(`WhatsApp did not give a code (${e.message}). Wait a few seconds and try again.`);
      }
      status.pairingCode = code.match(/.{1,4}/g).join('-');
      return status.pairingCode;
    },

    logout: async () => {
      stopped = true; // the close event below must not restart on its own
      try {
        if (sock) await sock.logout();
      } catch {
        /* already gone */
      }
      fs.rmSync(sessionDir, { recursive: true, force: true });
      Object.assign(status, { state: 'starting', qr: '', pairingCode: '', me: '', error: '' });
      sock = null;
      return start().catch((e) => fail(e)); // start() clears "stopped"
    },

    stop: () => {
      stopped = true;
      try {
        sock?.end(undefined);
      } catch {
        /* ignore */
      }
      sock = null;
    },
  };
}

module.exports = { createWhatsAppWeb, parseWebMessage };
