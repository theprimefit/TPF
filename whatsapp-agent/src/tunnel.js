'use strict';
// Gives a computer without a public address an HTTPS link WhatsApp can reach,
// using Cloudflare's free quick tunnel or ngrok. Both run as separate programs.
const { spawn } = require('node:child_process');

const INSTALL = {
  cloudflare: 'Install cloudflared: Windows "winget install --id Cloudflare.cloudflared", Mac "brew install cloudflared", or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
  ngrok: 'Install ngrok from https://ngrok.com/download and claim your free static domain at https://dashboard.ngrok.com/domains',
};

function startTunnel({ kind, port, ngrokDomain, ngrokAuthtoken, onUrl, log = console }) {
  let cmd;
  let args;
  if (kind === 'cloudflare') {
    cmd = 'cloudflared';
    args = ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`];
  } else if (kind === 'ngrok') {
    if (!ngrokDomain) {
      log.warn('ngrok: set the fixed domain (NGROK_DOMAIN) on the setup page.');
      return null;
    }
    cmd = 'ngrok';
    args = ['http', `--url=${ngrokDomain.replace(/^https?:\/\//, '')}`, String(port), '--log', 'stdout'];
  } else {
    return null;
  }

  const env = { ...process.env };
  if (ngrokAuthtoken) env.NGROK_AUTHTOKEN = ngrokAuthtoken;
  const child = spawn(cmd, args, { env, windowsHide: true });
  let found = false;
  const scan = (buf) => {
    const text = buf.toString();
    const m = kind === 'cloudflare' ? text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/) : text.match(/url=(https:\/\/\S+)/);
    if (m && !found) {
      found = true;
      onUrl(kind === 'cloudflare' ? m[0] : m[1]);
    }
    if (kind === 'ngrok' && /ERR_NGROK|authentication failed/i.test(text)) log.error(`ngrok: ${text.trim()}`);
  };
  child.stdout.on('data', scan);
  child.stderr.on('data', scan);
  child.on('error', (e) => {
    if (e.code === 'ENOENT') log.error(`${cmd} is not installed. ${INSTALL[kind]}`);
    else log.error(`${cmd} failed: ${e.message}`);
  });
  child.on('exit', (code) => found && log.warn(`${cmd} stopped (code ${code}). The public link is down until you restart.`));
  process.on('exit', () => child.kill());
  return child;
}

module.exports = { startTunnel, INSTALL };
