const $ = (id) => document.getElementById(id);
const note = (text, ok) => { $('msg').hidden = false; $('msg').textContent = text; $('msg').className = `msg ${ok ? 'ok' : 'err'}`; };

HL.config().then(({ server, token }) => { $('server').value = server; $('token').value = token; });

$('form').onsubmit = async (e) => {
  e.preventDefault();
  const server = HL.normalise($('server').value);
  const token = $('token').value.trim();
  let origin;
  try { origin = new URL(server).origin; } catch { return note('That address does not look right. Example: https://hindivine.ngrok-free.app', false); }
  // Chrome only lets the extension talk to addresses you approve.
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false);
  if (!granted) return note('Chrome needs your permission to reach that address. Click Save again and choose Allow.', false);
  $('save').disabled = true;
  await chrome.storage.local.set({ server, token, seen: null });
  try {
    const s = await HL.api('/api/stats');
    note(`Connected to ${s.business}: ${s.total} leads. You'll get alerts from now on.`, true);
    chrome.runtime.sendMessage({ type: 'poll' });
  } catch (err) {
    note(err.message, false);
  } finally {
    $('save').disabled = false;
  }
};
