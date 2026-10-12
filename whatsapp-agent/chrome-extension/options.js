const $ = (id) => document.getElementById(id);
const note = (text, ok) => { $('msg').hidden = false; $('msg').textContent = text; $('msg').className = `msg ${ok ? 'ok' : 'err'}`; };
const chosen = () => document.querySelector('input[name="mode"]:checked').value;
const show = () => { $('serverBox').hidden = chosen() !== 'server'; $('standaloneBox').hidden = chosen() !== 'standalone'; };

(async () => {
  const s = await chrome.storage.local.get(['mode', 'server', 'token', 'replySaved']);
  document.querySelector(`input[name="mode"][value="${s.mode || 'standalone'}"]`).checked = true;
  $('server').value = s.server || '';
  $('token').value = s.token || '';
  $('replySaved').checked = Boolean(s.replySaved);
  show();
})();
document.querySelectorAll('input[name="mode"]').forEach((r) => (r.onchange = show));

$('form').onsubmit = async (e) => {
  e.preventDefault();
  if (chosen() === 'standalone') {
    await chrome.storage.local.set({ mode: 'standalone', replySaved: $('replySaved').checked });
    return note('Saved. The agent runs in your WhatsApp Web tab.', true);
  }
  const server = HL.normalise($('server').value);
  const token = $('token').value.trim();
  let origin;
  try { origin = new URL(server).origin; } catch { return note('Enter the agent address, e.g. http://localhost:3000', false); }
  if (!token) return note('Enter the dashboard password.', false);
  // Chrome only lets the extension talk to addresses you approve.
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false);
  if (!granted) return note('Chrome needs your permission to reach that address. Click Save again and choose Allow.', false);
  $('save').disabled = true;
  await chrome.storage.local.set({ mode: 'server', server, token, seen: null });
  try {
    const s = await HL.api('/api/stats');
    note(`Connected to ${s.business}: ${s.total} leads.`, true);
    chrome.runtime.sendMessage({ type: 'poll' });
  } catch (err) {
    note(err.message, false);
  } finally {
    $('save').disabled = false;
  }
};
