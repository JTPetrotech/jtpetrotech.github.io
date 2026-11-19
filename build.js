/*
 * Builds hub/index.html from src/index.html with the fonts inlined, so the
 * page has no external references at all - same rule the games follow.
 *
 *   node build.js
 *
 * The font faces are the ones Top Shelf already embeds; this reuses that file
 * rather than downloading them again.
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SRC = path.join(DIR, 'src', 'index.html');
const FONTS = path.join(DIR, '..', 'hockey-game', 'vendor', 'fonts-inline.css');
const OUT = path.join(DIR, 'index.html');

const fonts = fs.readFileSync(FONTS, 'utf8');
let html = fs.readFileSync(SRC, 'utf8');

if(html.indexOf('<!--FONTS-->') === -1) throw new Error('font marker missing in src/index.html');
html = html.replace('<!--FONTS-->', '<style>\n' + fonts + '\n</style>');

fs.writeFileSync(OUT, html);

const left = html.match(/(?:src|href)\s*=\s*["']https?:\/\/(?!jtpetrotech\.github\.io)[^"']+/g);
console.log('wrote index.html  ' + Math.round(html.length / 1024) + ' KB');
console.log('external references (other than the game links): ' + (left ? left.join(', ') : 'none'));
