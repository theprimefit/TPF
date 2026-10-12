const fs = require('fs');
// Bundles the real agent modules into demo/template.html so the demo runs them in the browser.
// Usage: node demo/build.js  →  demo/hindivine-lead-agent.html
const path = require('path');
const root = path.join(__dirname, '..');
const mods = { './store': 'src/store.js', './scoring': 'src/scoring.js', './brain': 'src/brain.js', './agent': 'src/agent.js' };
let out = `const __defs = {};\nconst __cache = {};\nfunction require(name) {\n  if (__cache[name]) return __cache[name].exports;\n  if (name === 'node:fs') return { existsSync: () => false };\n  if (name === 'node:path') return { dirname: (p) => p };\n  if (name === '@anthropic-ai/sdk') return function Anthropic() {};\n  const module = (__cache[name] = { exports: {} });\n  __defs[name](module, module.exports, require);\n  return module.exports;\n}\n`;
out += `__defs['./business.json'] = (module) => { module.exports = ${fs.readFileSync(root + '/config/business.json', 'utf8').trim()}; };\n`;
for (const [k, f] of Object.entries(mods)) out += `__defs['${k}'] = function (module, exports, require) {\n${fs.readFileSync(root + '/' + f, 'utf8')}\n};\n`;
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'hindivine-lead-agent.html'), tpl.replace('/*__MODULES__*/', () => out));
