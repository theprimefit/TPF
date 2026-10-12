'use strict';
// Tiny JSON-file lead store. Writes are atomic (temp file + rename) and
// serialised, so it is safe for a single-process deployment. Swap this module
// for a real database when you outgrow it; the rest of the app only uses the
// functions exported here.
const fs = require('node:fs');
const path = require('node:path');

const STAGES = ['new', 'engaged', 'qualified', 'booked', 'won', 'lost'];

function createStore(file) {
  let data = { leads: {}, processed: [] };
  if (file && fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.leads ||= {};
    data.processed ||= [];
  }
  let writing = Promise.resolve();

  function save() {
    if (!file) return Promise.resolve();
    const snapshot = JSON.stringify(data, null, 2);
    writing = writing.then(async () => {
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmp, snapshot);
      await fs.promises.rename(tmp, file);
    });
    return writing;
  }

  function getLead(phone) {
    return data.leads[phone] || null;
  }

  function upsertLead(phone, init = {}) {
    let lead = data.leads[phone];
    if (!lead) {
      const now = new Date().toISOString();
      lead = data.leads[phone] = {
        phone,
        name: init.name || '',
        stage: 'new',
        score: 0,
        temperature: 'cold',
        source: init.source || 'organic',
        sourceDetail: init.sourceDetail || '',
        profile: {},
        tags: [],
        notes: '',
        botPaused: false,
        optedOut: false,
        handoffReason: '',
        followupsSent: 0,
        lastInboundAt: null,
        lastOutboundAt: null,
        lastFollowupAt: null,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
    }
    if (init.name && !lead.name) lead.name = init.name;
    return lead;
  }

  function updateLead(phone, patch) {
    const lead = data.leads[phone];
    if (!lead) return null;
    if (patch.stage && !STAGES.includes(patch.stage)) throw new Error(`unknown stage ${patch.stage}`);
    Object.assign(lead, patch, { updatedAt: new Date().toISOString() });
    return lead;
  }

  function addMessage(phone, msg) {
    const lead = upsertLead(phone);
    const entry = { at: new Date().toISOString(), ...msg };
    lead.messages.push(entry);
    if (msg.dir === 'in') lead.lastInboundAt = entry.at;
    else lead.lastOutboundAt = entry.at;
    lead.updatedAt = entry.at;
    return entry;
  }

  // WhatsApp retries webhooks, so remember recent message ids to skip repeats.
  function markProcessed(id) {
    if (!id) return true;
    if (data.processed.includes(id)) return false;
    data.processed.push(id);
    if (data.processed.length > 2000) data.processed.splice(0, data.processed.length - 2000);
    return true;
  }

  function listLeads() {
    return Object.values(data.leads).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  function stats() {
    const leads = Object.values(data.leads);
    const byStage = Object.fromEntries(STAGES.map((s) => [s, 0]));
    const byTemp = { hot: 0, warm: 0, cold: 0 };
    const bySource = {};
    for (const l of leads) {
      byStage[l.stage] = (byStage[l.stage] || 0) + 1;
      byTemp[l.temperature] = (byTemp[l.temperature] || 0) + 1;
      bySource[l.source] = (bySource[l.source] || 0) + 1;
    }
    const today = new Date().toISOString().slice(0, 10);
    const converted = byStage.booked + byStage.won;
    return {
      total: leads.length,
      newToday: leads.filter((l) => l.createdAt.startsWith(today)).length,
      needsHuman: leads.filter((l) => l.botPaused && !l.optedOut).length,
      conversionRate: leads.length ? Math.round((converted / leads.length) * 100) : 0,
      byStage,
      byTemp,
      bySource,
    };
  }

  return { getLead, upsertLead, updateLead, addMessage, markProcessed, listLeads, stats, save, STAGES };
}

module.exports = { createStore, STAGES };
