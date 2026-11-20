/*
 * Builds the hub's pages from src/ with the fonts inlined, so they have no
 * external references at all - same rule the games follow.
 *
 *   node build.js
 *
 * The font faces are the ones Top Shelf already embeds; this reuses that file
 * rather than downloading them again.
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

/* src/index.html -> index.html, plus every src/<dir>/index.html -> <dir>/index.html */
function pages(){
  const out = [{ src: path.join('src', 'index.html'), out: 'index.html' }];
  for(const name of fs.readdirSync(path.join(DIR, 'src'), { withFileTypes: true })){
    if(!name.isDirectory()) continue;
    const rel = path.join('src', name.name, 'index.html');
    if(fs.existsSync(path.join(DIR, rel)))
      out.push({ src: rel, out: path.join(name.name, 'index.html') });
  }
  return out;
}

let bad = 0;

for(const page of pages()){
  let html = fs.readFileSync(path.join(DIR, page.src), 'utf8');

  if(html.indexOf('<!--FONTS-->') === -1)
    throw new Error('font marker missing in ' + page.src);
  html = html.replace('<!--FONTS-->', '<style>\n' + fonts + '\n</style>');

  const dest = path.join(DIR, page.out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);

  /* Anything fetched from the network defeats the point, so say so loudly.
     Links to the games and to other sites are hrefs on <a>, not loads, and
     those are fine - this only looks at src/href on loading elements. */
  const left = html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/g) || [];
  const loads = left.filter(function(ref){
    return !/^href=["']https?:\/\/(jtpetrotech\.github\.io|itch\.io)/.test(ref);
  });

  console.log(page.out.replace(/\\/g, '/').padEnd(24) +
              String(Math.round(html.length / 1024)).padStart(4) + ' KB' +
              (loads.length ? '   EXTERNAL: ' + loads.join(', ') : ''));
  if(loads.length) bad++;
}

console.log(bad ? '\n' + bad + ' page(s) reach out to the network - fix before publishing.'
                : '\nno external references. all pages work offline.');
