/*
 * Builds the hub's pages from src/ with the fonts inlined, so they have no
 * external references at all - same rule the games follow.
 *
 *   node build.js
 *
 * The font faces are the ones Top Shelf already embeds; this reuses that file
 * rather than downloading them again.
 *
 * Two markers in a src page get filled in:
 *   <!--FONTS-->   the inlined @font-face block
 *   <!--GAMES-->   a card per entry in games.json
 *
 * Every src/<name>/index.html becomes <name>/index.html next to the root page,
 * so GitHub Pages serves it at /<name>/ with no extension in the address. To
 * add a page, drop it in src/ and give it the <!--FONTS--> marker.
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const FONTS = path.join(DIR, '..', 'hockey-game', 'vendor', 'fonts-inline.css');

const fonts = fs.readFileSync(FONTS, 'utf8');
const padnav = fs.readFileSync(path.join(DIR, 'src', 'padnav.js'), 'utf8');

/* ------------------------------------------------------------------ cards -- */

/* Everything from games.json lands in HTML, and some of it is written by
   whoever submitted a game, so none of it goes in raw. */
function esc(s){
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* A URL in an href is the one place escaping is not enough - javascript: and
   data: would both survive it. Only ordinary web links are allowed through. */
function safeUrl(url, where){
  if(!/^https?:\/\//i.test(String(url)))
    throw new Error(where + ': url must start http:// or https:// - got "' + url + '"');
  return esc(url);
}

function colour(c, where, fallback){
  if(c === undefined) return fallback;
  if(!/^#[0-9a-f]{3,8}$/i.test(String(c)))
    throw new Error(where + ': colour must be a hex value like #2f7fe0 - got "' + c + '"');
  return c;
}

/* No art file? Draw the initials. Two letters on the tile coloured by the
   game's accent reads as deliberate, which a missing-image box does not. */
function lettermark(name, accent){
  const initials = String(name).trim().split(/\s+/).slice(0, 2)
    .map(function(w){ return w[0]; }).join('').toUpperCase();
  return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">' +
         '<circle cx="60" cy="60" r="44" fill="none" stroke="' + accent + '" ' +
         'stroke-width="2" opacity=".45"/>' +
         '<text x="60" y="60" text-anchor="middle" dominant-baseline="central" ' +
         'font-family="Bebas Neue, Arial Narrow, sans-serif" font-size="46" ' +
         'letter-spacing="2" fill="' + accent + '">' + esc(initials) + '</text></svg>';
}

function art(game, accent){
  if(!game.art) return lettermark(game.name, accent);
  if(!/^[a-z0-9-]+$/.test(game.art))
    throw new Error(game.name + ': art must be a plain name like "top-shelf"');
  const file = path.join(DIR, 'src', 'art', game.art + '.svg');
  if(!fs.existsSync(file))
    throw new Error(game.name + ': no art file at src/art/' + game.art + '.svg');
  return fs.readFileSync(file, 'utf8').trim();
}

function card(game){
  for(const need of ['name', 'kind', 'url', 'desc']){
    if(!game[need]) throw new Error('a game in games.json has no "' + need + '"');
  }
  const accent = colour(game.accent, game.name, '#2f7fe0');
  const tile = colour(game.tile, game.name, '#0b1119');
  const pills = (game.pills || []).slice(0, 3)
    .map(function(p){ return '        <span class="pill">' + esc(p) + '</span>'; })
    .join('\n');

  return [
    '  <a class="game" href="' + safeUrl(game.url, game.name) + '"' +
      ' style="--accent:' + accent + ';--art:' + tile + '">',
    '    <div class="art" aria-hidden="true">',
    '      ' + art(game, accent),
    '    </div>',
    '    <div class="body">',
    '      <div class="name">' + esc(game.name) + '</div>',
    '      <div class="kind">' + esc(game.kind) + '</div>',
    '      <p class="desc">' + esc(game.desc) + '</p>',
    pills ? '      <div class="meta">\n' + pills + '\n      </div>' : '',
    '      <span class="play">Play <svg viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="M8 5l11 7-11 7z"/></svg></span>',
    '    </div>',
    '  </a>'
  ].filter(Boolean).join('\n');
}

function cards(){
  const data = JSON.parse(fs.readFileSync(path.join(DIR, 'games.json'), 'utf8'));
  if(!Array.isArray(data.games) || !data.games.length)
    throw new Error('games.json has no games');
  return data.games.map(card).join('\n\n');
}

/* ------------------------------------------------------------------ pages -- */

/* src/index.html -> index.html, plus every src/<dir>/index.html -> <dir>/index.html */
function pages(){
  const out = [{ src: path.join('src', 'index.html'), out: 'index.html' }];
  for(const name of fs.readdirSync(path.join(DIR, 'src'), { withFileTypes: true })){
    if(!name.isDirectory() || name.name === 'art') continue;
    const rel = path.join('src', name.name, 'index.html');
    if(fs.existsSync(path.join(DIR, rel)))
      out.push({ src: rel, out: path.join(name.name, 'index.html') });
  }
  return out;
}

const built = cards();

/* The page says how many games there are. Written by hand that goes stale the
   first time one is added, so the build fills it in. */
const games = JSON.parse(fs.readFileSync(path.join(DIR, 'games.json'), 'utf8')).games;
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
               'Eight', 'Nine', 'Ten'];
const countWord = WORDS[games.length] || String(games.length);

let bad = 0;

for(const page of pages()){
  let html = fs.readFileSync(path.join(DIR, page.src), 'utf8');

  if(html.indexOf('<!--FONTS-->') === -1)
    throw new Error('font marker missing in ' + page.src);
  html = html.replace('<!--FONTS-->', '<style>\n' + fonts + '\n</style>');
  html = html.replace('<!--GAMES-->', built);
  html = html.replace(/<!--N-->/g, countWord);
  /* controller support for the menus; the same file every game carries */
  html = html.replace('<!--PADNAV-->', function(){ return '<script>\n' + padnav + '\n</script>'; });

  const dest = path.join(DIR, page.out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);

  /* Anything FETCHED from the network defeats the point, so say so loudly.
     An href on an <a> is somewhere to go, not something to load, so those are
     fine. A stylesheet on <link> is a load and must still be caught, which is
     why this looks for src= anywhere but href= only inside a <link>. */
  const loads = (html.match(/<link\b[^>]*?href\s*=\s*["']https?:\/\/[^"']+/gi) || [])
    .concat(html.match(/\bsrc\s*=\s*["']https?:\/\/[^"']+/gi) || []);

  console.log(page.out.replace(/\\/g, '/').padEnd(24) +
              String(Math.round(html.length / 1024)).padStart(4) + ' KB' +
              (loads.length ? '   EXTERNAL: ' + loads.join(', ') : ''));
  if(loads.length) bad++;
}

console.log('\n' + games.length + ' game' + (games.length === 1 ? '' : 's') + ' on the shelf.');
console.log(bad ? bad + ' page(s) reach out to the network - fix before publishing.'
                : 'no external references. all pages work offline.');
