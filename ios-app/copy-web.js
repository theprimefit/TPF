// Copies the web app into www/ for Capacitor.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['css', 'js', 'img', 'vendor']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
console.log('Copied web app to', out);
