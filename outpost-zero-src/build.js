/*
 * Builds ../outpost-zero/index.html from parts/ with the 3D engine, the
 * peer-to-peer library and the Arcade's fonts inlined, so the finished page
 * loads nothing from the network. (Online matches still talk to the PeerJS
 * broker to find each other - that is a connection, not a download.)
 *
 *   node build.js
 *
 * Same shape as the other games' builds: one file out, works off a memory
 * stick. The JS parts are concatenated in name order inside one function, so
 * they share a scope - a part can use anything an earlier part declared.
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const OUT = path.join(DIR, '..', 'outpost-zero', 'index.html');
const FONTS = path.join(DIR, '..', '..', 'hockey-game', 'vendor', 'fonts-inline.css');
const THREE_FILE = path.join(DIR, 'vendor', 'three.r128.min.js');
const PEER_FILE = path.join(DIR, 'vendor', 'peerjs-1.5.4.min.js');

function inlineScript(file){
  const src = fs.readFileSync(file, 'utf8');
  if(src.indexOf('</script') !== -1) throw new Error(path.basename(file) + ' contains a closing script tag');
  return '<script>\n' + src + '\n</script>';
}

const parts = fs.readdirSync(path.join(DIR, 'parts')).sort();
const head = fs.readFileSync(path.join(DIR, 'parts', parts.find(p => p.endsWith('.html'))), 'utf8');
// Controller support for the menus - the Arcade's shared helper, src/padnav.js.
const PADNAV = '/* ---- padnav.js (hub/src) ---- */\n' + fs.readFileSync(path.join(DIR, '..', 'src', 'padnav.js'), 'utf8') + '\n';
const js = PADNAV + parts.filter(p => p.endsWith('.js'))
  .map(p => '/* ---- ' + p + ' ---- */\n' + fs.readFileSync(path.join(DIR, 'parts', p), 'utf8'))
  .join('\n');

// Check the game code parses before shipping it.
try { new Function(js); } catch(e){ throw new Error('game script does not parse: ' + e.message); }

let html = head;
for(const [marker, value] of [
  ['<!--FONTS-->', '<style>\n' + fs.readFileSync(FONTS, 'utf8') + '\n</style>'],
  ['<!--THREE-->', inlineScript(THREE_FILE)],
  ['<!--PEER-->', inlineScript(PEER_FILE)],
  ['<!--GAME-->', '<script>\n(() => {\n' + js + '\n})();\n</script>'],
]){
  if(html.indexOf(marker) === -1) throw new Error('marker missing: ' + marker);
  html = html.replace(marker, () => value);
}

const loads = (html.match(/<link\b[^>]*?href\s*=\s*["']https?:\/\/[^"']+/gi) || [])
  .concat(html.match(/\bsrc\s*=\s*["']https?:\/\/[^"']+/gi) || []);
if(loads.length) throw new Error('page loads from the network: ' + loads.join(', '));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log('outpost-zero/index.html  ' + Math.round(html.length / 1024) + ' KB from ' + parts.length + ' parts. no external loads.');
