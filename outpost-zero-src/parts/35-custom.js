/* ---------- your own guns and skins ----------
   A custom gun is built from parts: a frame (the kind of gun, which starts from
   one of the stock guns), a barrel, a stock, a magazine, a fire mode and a
   colour. Each part nudges the frame's numbers, the same way mods do, so a
   custom gun is never stronger than the parts allow. A custom skin is a
   pattern and up to four colours.

   Both are kept in this browser and can be passed to a friend as a share code:
   a short line of text that holds the design. Codes start with OZG (a gun),
   OZS (a skin) or OZC (someone's whole controls setup). */

const GUN_FRAMES = {
  ar: { name: 'Assault rifle', t: 'vk7', modes: ['auto', 'burst', 'semi'] },
  br: { name: 'Battle rifle', t: 'hammer', modes: ['auto', 'semi', 'burst'] },
  smg: { name: 'SMG', t: 'hornet', modes: ['auto', 'burst', 'semi'] },
  dmr: { name: 'Marksman rifle', t: 'ranger', modes: ['semi', 'burst'] },
  sniper: { name: 'Sniper', t: 'kestrel', modes: ['bolt', 'semi'] },
  lmg: { name: 'Machine gun', t: 'tempest', modes: ['auto'] },
  shotgun: { name: 'Shotgun', t: 'breacher', modes: ['pump', 'semi', 'auto'] },
  pistol: { name: 'Pistol', t: 'viper', modes: ['semi', 'burst', 'auto'] },
};
const GUN_MODES = { auto: 'Full auto', burst: '3-round burst', semi: 'Semi-auto', bolt: 'Bolt action', pump: 'Pump action' };
const GUN_BARRELS = { short: 'Short', std: 'Standard', long: 'Long', heavy: 'Heavy' };
const GUN_STOCKS = { none: 'None', std: 'Standard', heavy: 'Heavy' };
const GUN_MAGS = { small: 'Small', std: 'Standard', ext: 'Extended', drum: 'Drum' };
const GUN_COLOURS = [0x2f3337, 0x6a5236, 0x9b8360, 0x4d5a3c, 0x7d858b, 0x8a2a2a, 0x2e4a6b, 0xd8d8d2];
const PART_NOTES = {
  short: 'Quicker to aim and move, less range', std: 'Balanced', long: 'More range and steadier, a bit slower', heavy: 'Hits harder and further, kicks more, slower',
  none: 'Light and quick, but kicks more', heavyStock: 'Much steadier, slower to aim',
  small: 'Fewer rounds, quick reload', ext: 'More rounds, slower reload', drum: 'Lots of rounds, slow to reload and carry',
};
const GUN_IDS_BASE = GUN_IDS.slice();
function partsFor(f) {
  const F = GUN_FRAMES[f], pistol = f === 'pistol';
  return {
    modes: F.modes,
    barrels: pistol ? ['std'] : Object.keys(GUN_BARRELS),
    stocks: pistol ? ['std'] : Object.keys(GUN_STOCKS),
    mags: f === 'sniper' || pistol ? ['small', 'std', 'ext'] : Object.keys(GUN_MAGS),
  };
}
function cleanGunSpec(s) {
  s = s && typeof s === 'object' ? s : {};
  const f = GUN_FRAMES[s.f] ? s.f : 'ar', P = partsFor(f);
  const pick = (v, list, d) => list.includes(v) ? v : (list.includes(d) ? d : list[0]);
  return {
    n: String(s.n || '').replace(/[^\w .\-!']/g, '').trim().slice(0, 16) || 'My ' + GUN_FRAMES[f].name.toLowerCase(),
    f, x: pick(s.x, P.modes, P.modes[0]), b: pick(s.b, P.barrels, 'std'), s: pick(s.s, P.stocks, 'std'), m: pick(s.m, P.mags, 'std'),
    c: clamp(s.c | 0, 0, GUN_COLOURS.length - 1),
  };
}
// the gun a spec makes: a copy of the frame's stock gun with each part applied
function buildCustomGun(spec) {
  const F = GUN_FRAMES[spec.f], T = GUNS[F.t];
  const d = JSON.parse(JSON.stringify(T));
  d.name = spec.n; d.cls = F.name + ' · custom'; d.custom = true; d.spec = spec;
  const mul = (k, v) => { d[k] *= v; };
  // barrel
  if (spec.b === 'short') { mul('range', .8); mul('dmg', .95); mul('mob', 1.04); mul('recoil', 1.08); mul('adsTime', .9); d.shape.barrel = (d.shape.barrel || .3) * .6; }
  if (spec.b === 'long') { mul('range', 1.25); mul('dmg', 1.04); mul('mob', .96); mul('recoil', .9); mul('adsTime', 1.08); d.shape.barrel = (d.shape.barrel || .3) * 1.4; }
  if (spec.b === 'heavy') { mul('range', 1.15); mul('dmg', 1.12); mul('mob', .92); mul('recoil', 1.15); mul('rpm', .9); d.shape.barrel = (d.shape.barrel || .3) * 1.2; }
  // stock
  if (spec.s === 'none') { mul('recoil', 1.2); mul('mob', 1.05); mul('adsTime', .85); d.shape.stock = 'wire'; }
  if (spec.s === 'heavy') { mul('recoil', .82); mul('mob', .95); mul('adsTime', 1.12); d.shape.stock = 'thick'; }
  // magazine
  if (spec.m === 'small') { mul('mag', .67); mul('reload', .85); mul('mob', 1.02); }
  if (spec.m === 'ext') { mul('mag', 1.5); mul('reload', 1.15); mul('mob', .97); }
  if (spec.m === 'drum') { mul('mag', 2.2); mul('reload', 1.5); mul('mob', .92); d.shape.mag = 'drum'; d.tube = false; }
  // fire mode
  const wasAuto = T.auto;
  delete d.burst; delete d.burstGap;
  if (spec.x === 'auto') {
    d.auto = true;
    if (spec.f === 'pistol') { mul('dmg', .55); d.rpm = 1000; d.mp = true; mul('recoil', .5); }
    else if (spec.f === 'shotgun') { mul('dmg', .8); d.rpm = 300; d.tube = false; if (d.shape.mag === 'tube') d.shape.mag = 'box'; }
  } else if (spec.x === 'semi') {
    d.auto = false;
    if (wasAuto) { mul('dmg', 1.15); mul('rpm', .65); }
    if (spec.f === 'shotgun') { d.rpm = 210; mul('dmg', .92); d.tube = false; if (d.shape.mag === 'tube') d.shape.mag = 'box'; }
    if (spec.f === 'sniper') { d.rpm = 160; mul('dmg', .82); }
  } else if (spec.x === 'burst') {
    d.auto = false; d.burst = 3; d.burstGap = 0.22;
    if (spec.f === 'dmr') { d.rpm = 700; mul('dmg', .75); }
    else if (spec.f === 'pistol') { d.rpm = 1000; mul('dmg', .72); }
    else d.rpm = Math.min(1100, d.rpm * 1.35);
  }
  d.mag = Math.max(1, Math.round(d.mag)); d.rpm = Math.round(d.rpm); d.dmg = Math.round(d.dmg * 10) / 10;
  d.reload = Math.round(d.reload * 10) / 10; d.range = Math.round(d.range);
  d.shape.furn = GUN_COLOURS[spec.c];
  return d;
}

/* ---------- skins ---------- */
const SKIN_KINDS = { camo: 'Blotches', multi: 'Multi-terrain', fleck: 'Dots', digital: 'Digital', stripes: 'Stripes', scales: 'Snakeskin', cerakote: 'Solid', worn: 'Worn' };
const hexOk = v => /^#[0-9a-f]{6}$/i.test(v);
function cleanSkinSpec(s) {
  s = s && typeof s === 'object' ? s : {};
  const def = ['#4a5a38', '#2f3a24', '#6b5a3a', '#1f241a'];
  const c = [0, 1, 2, 3].map(i => hexOk(s.c && s.c[i]) ? s.c[i].toLowerCase() : def[i]);
  return { n: String(s.n || '').replace(/[^\w .\-!']/g, '').trim().slice(0, 16) || 'My skin', k: SKIN_KINDS[s.k] ? s.k : 'camo', c, s: (s.s | 0) & 0xffff };
}
function lighter(hex, k) { const c = new THREE.Color(hex); c.lerp(new THREE.Color(0xffffff), k); return '#' + c.getHexString(); }
function skinFromSpec(spec) {
  const [b, a1, a2, a3] = spec.c;
  return { name: spec.n, kind: spec.k, base: b, spots: spec.k === 'stripes' ? [a1] : [a1, a2, a3], specks: [a3, lighter(b, .3)], sw: [b, a1], seed: String(spec.s), custom: true, spec };
}
function setSkin(id, spec) {
  SKINS[id] = skinFromSpec(spec);
  delete skinCanvas[id];
  if (skinCache[id]) { const m = skinCache[id]; if (m.metal.map) m.metal.map.dispose(); m.metal.dispose(); delete skinCache[id]; }
}

/* ---------- what is saved, and putting it in the game ---------- */
let customGuns = [], customSkins = [];
function newCustomId(p) { return p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6); }
function loadCustom() {
  customGuns = (store.get('customGuns', null) || []).filter(g => g && /^cg_\w+$/.test(g.id)).slice(0, 12).map(g => ({ id: g.id, spec: cleanGunSpec(g.spec) }));
  customSkins = (store.get('customSkins', null) || []).filter(s => s && /^cs_\w+$/.test(s.id)).slice(0, 12).map(s => ({ id: s.id, spec: cleanSkinSpec(s.spec) }));
  for (const g of customGuns) GUNS[g.id] = buildCustomGun(g.spec);
  for (const s of customSkins) { setSkin(s.id, s.spec); if (!SKIN_IDS.includes(s.id)) SKIN_IDS.push(s.id); }
}
function saveCustom() { store.set('customGuns', customGuns); store.set('customSkins', customSkins); }
const loadoutGunIds = () => GUN_IDS_BASE.concat(customGuns.map(g => g.id));
function saveCustomGun(id, spec) {
  spec = cleanGunSpec(spec);
  if (!id) { if (customGuns.length >= 12) return null; id = newCustomId('cg_'); customGuns.push({ id, spec }); }
  else { const g = customGuns.find(x => x.id === id); if (!g) return null; g.spec = spec; }
  GUNS[id] = buildCustomGun(spec); saveCustom(); return id;
}
function deleteCustomGun(id) {
  customGuns = customGuns.filter(g => g.id !== id); saveCustom();
  loadout = loadout.map((sl, i) => sl.id === id ? cleanSlot(null, i ? 'longshot' : 'vk7') : sl); saveLoadout();
}
function saveCustomSkin(id, spec) {
  spec = cleanSkinSpec(spec);
  if (!id) { if (customSkins.length >= 12) return null; id = newCustomId('cs_'); customSkins.push({ id, spec }); SKIN_IDS.push(id); }
  else { const s = customSkins.find(x => x.id === id); if (!s) return null; s.spec = spec; }
  setSkin(id, spec); saveCustom(); return id;
}
function deleteCustomSkin(id) {
  customSkins = customSkins.filter(s => s.id !== id); saveCustom();
  const i = SKIN_IDS.indexOf(id); if (i >= 0) SKIN_IDS.splice(i, 1);
  loadout.forEach(sl => { if (sl.skin === id) sl.skin = 'factory'; }); saveLoadout();
}
loadCustom();
// the loadout was read before custom guns existed: read it again now they do
loadout = (() => { const s = store.get('loadout', null) || []; return [cleanSlot(s[0], 'vk7'), cleanSlot(s[1], 'longshot')]; })();

/* ---------- share codes ---------- */
function shareEncode(tag, obj) {
  const b = btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `OZ${tag}1-${b}`;
}
function shareDecode(code) {
  const m = /^OZ([GSC])1-([A-Za-z0-9_-]{4,4000})$/.exec(String(code || '').trim());
  if (!m) return null;
  try {
    let b = m[2].replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    const obj = JSON.parse(decodeURIComponent(escape(atob(b))));
    return obj && typeof obj === 'object' ? { tag: m[1], obj } : null;
  } catch (e) { return null; }
}
const gunCode = id => { const g = customGuns.find(x => x.id === id); return g ? shareEncode('G', g.spec) : ''; };
const skinCode = id => { const s = customSkins.find(x => x.id === id); return s ? shareEncode('S', s.spec) : ''; };
