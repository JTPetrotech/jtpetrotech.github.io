/* Guns, mods and skins. A gun's numbers come from its base entry, then every
   mod multiplies some of them - the loadout screen and the firing code both
   read the same gunStats() result, so what the bars show is what you get. */

const GUNS = {
  vk7: { name: 'VK-7', cls: 'Assault rifle', snd: 'rifle', dmg: 27, head: 2.0, rpm: 620, auto: true, mag: 30, reload: 2.1, hip: 0.032, ads: 0.0025,
    recoil: 0.0095, range: 220, mob: 1.0, adsTime: 0.17, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo', 'x3'], optic: 'reddot', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .42, H: .09, barrel: .3, guard: [.26, .078], stock: 'full', mag: 'curved', furn: 0x9b8360 } },
  talon: { name: 'Talon', cls: 'Burst rifle', snd: 'rifle', dmg: 31, head: 2.0, rpm: 860, burst: 3, burstGap: 0.24, auto: false, mag: 27, reload: 2.2, hip: 0.034, ads: 0.002,
    recoil: 0.0085, range: 240, mob: 0.98, adsTime: 0.18, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo', 'x3'], optic: 'holo', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .44, H: .095, barrel: .32, guard: [.28, .08], stock: 'full', mag: 'curved', furn: 0x3f4a52 } },
  hammer: { name: 'Hammer', cls: 'Battle rifle', snd: 'br', dmg: 38, head: 2.0, rpm: 480, auto: true, mag: 20, reload: 2.4, hip: 0.04, ads: 0.0022,
    recoil: 0.017, range: 300, mob: 0.93, adsTime: 0.22, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo', 'x3'], optic: 'reddot', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .48, H: .1, barrel: .38, guard: [.3, .085], stock: 'thick', mag: 'box', furn: 0x6a5236 } },
  ranger: { name: 'Ranger DMR', cls: 'Marksman rifle', snd: 'rifle', dmg: 46, head: 2.2, rpm: 330, auto: false, mag: 15, reload: 2.4, hip: 0.05, ads: 0.0008,
    recoil: 0.02, range: 360, mob: 0.95, adsTime: 0.21, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo', 'x3', 'x6'], optic: 'x3', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .46, H: .095, barrel: .42, guard: [.3, .08], stock: 'full', mag: 'box', furn: 0x4d5a3c } },
  kestrel: { name: 'Kestrel', cls: 'Light sniper', snd: 'sniper', dmg: 72, head: 2.4, rpm: 58, auto: false, mag: 6, reload: 2.6, hip: 0.07, ads: 0,
    recoil: 0.036, range: 480, mob: 0.96, adsTime: 0.2, reserveMags: 4,
    optics: ['holo', 'x3', 'x6'], optic: 'x6', muzzles: ['none', 'sup', 'brake'],
    shape: { L: .42, H: .085, barrel: .5, guard: [.28, .08], stock: 'full', mag: 'box', furn: 0x3b4a5c } },
  longshot: { name: 'Longshot .50', cls: 'Heavy sniper', snd: 'sniper', dmg: 88, head: 2.6, rpm: 46, auto: false, mag: 5, reload: 3.0, hip: 0.085, ads: 0,
    recoil: 0.045, range: 600, mob: 0.88, adsTime: 0.28, reserveMags: 3,
    optics: ['x3', 'x6'], optic: 'x6', muzzles: ['none', 'sup', 'brake'],
    shape: { L: .46, H: .09, barrel: .6, guard: [.3, .085], stock: 'thick', mag: 'box', furn: 0x56613f } },
  hornet: { name: 'Hornet', cls: 'SMG', snd: 'smg', dmg: 18, head: 1.6, rpm: 900, auto: true, mag: 36, reload: 1.7, hip: 0.04, ads: 0.011,
    recoil: 0.0065, range: 90, mob: 1.1, adsTime: 0.13, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo'], optic: 'iron', muzzles: ['none', 'sup', 'comp'],
    shape: { L: .3, H: .1, barrel: .12, guard: [.11, .065], stock: 'wire', mag: 'straight', furn: 0x3c4248 } },
  wasp: { name: 'Wasp', cls: 'PDW', snd: 'smg', dmg: 15, head: 1.5, rpm: 1100, auto: true, mag: 50, reload: 2.0, hip: 0.045, ads: 0.013,
    recoil: 0.0055, range: 70, mob: 1.12, adsTime: 0.12, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo'], optic: 'holo', muzzles: ['none', 'sup', 'comp'],
    shape: { L: .34, H: .11, barrel: .08, guard: [.12, .075], stock: 'wire', mag: 'top', furn: 0x6b6f4e } },
  bulwark: { name: 'Bulwark', cls: 'Heavy machine gun', snd: 'lmg', dmg: 26, head: 1.8, rpm: 700, auto: true, mag: 100, reload: 5.0, hip: 0.06, ads: 0.006,
    recoil: 0.009, range: 240, mob: 0.82, adsTime: 0.3, reserveMags: 2,
    optics: ['iron', 'reddot', 'holo', 'x3'], optic: 'reddot', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .5, H: .11, barrel: .36, guard: [.3, .09], stock: 'thick', mag: 'drum', furn: 0x5a5148 } },
  tempest: { name: 'Tempest', cls: 'Light machine gun', snd: 'lmg', dmg: 22, head: 1.7, rpm: 820, auto: true, mag: 75, reload: 4.2, hip: 0.055, ads: 0.0065,
    recoil: 0.0085, range: 210, mob: 0.87, adsTime: 0.26, reserveMags: 2,
    optics: ['iron', 'reddot', 'holo', 'x3'], optic: 'holo', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .48, H: .105, barrel: .32, guard: [.3, .09], stock: 'full', mag: 'can', furn: 0x4a4f45 } },
  breacher: { name: 'Breacher', cls: 'Pump shotgun', snd: 'sg', dmg: 14, pellets: 8, head: 1.3, rpm: 75, auto: false, mag: 7, reload: 3.0, hip: 0.07, ads: 0.05,
    recoil: 0.04, range: 22, mob: 1.0, adsTime: 0.16, reserveMags: 4, tube: true,
    optics: ['iron', 'reddot', 'holo'], optic: 'iron', muzzles: ['none', 'choke', 'sup'],
    shape: { L: .36, H: .09, barrel: .4, guard: [.2, .075], stock: 'full', mag: 'tube', furn: 0x7b5a3a } },
  mamba: { name: 'Mamba', cls: 'Auto shotgun', snd: 'sg', dmg: 11, pellets: 7, head: 1.3, rpm: 260, auto: false, mag: 10, reload: 3.2, hip: 0.075, ads: 0.055,
    recoil: 0.03, range: 18, mob: 0.97, adsTime: 0.18, reserveMags: 4,
    optics: ['iron', 'reddot', 'holo'], optic: 'reddot', muzzles: ['none', 'choke', 'sup'],
    shape: { L: .4, H: .1, barrel: .3, guard: [.22, .08], stock: 'thick', mag: 'drum', furn: 0x2f3a2e } },
  raptor: { name: 'Raptor', cls: 'Bullpup rifle', snd: 'rifle', dmg: 25, head: 2.0, rpm: 720, auto: true, mag: 30, reload: 2.3, hip: 0.03, ads: 0.0028,
    recoil: 0.0085, range: 200, mob: 1.02, adsTime: 0.16, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo', 'x3'], optic: 'holo', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .36, H: .1, barrel: .26, guard: [.18, .08], stock: 'full', mag: 'curved', furn: 0x3d3f36 } },
  saber: { name: 'Saber', cls: 'Heavy SMG', snd: 'smg', dmg: 24, head: 1.6, rpm: 650, auto: true, mag: 30, reload: 1.9, hip: 0.036, ads: 0.01,
    recoil: 0.009, range: 80, mob: 1.06, adsTime: 0.14, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo'], optic: 'reddot', muzzles: ['none', 'sup', 'comp'],
    shape: { L: .32, H: .11, barrel: .14, guard: [.13, .07], stock: 'wire', mag: 'straight', furn: 0x5a3f2a } },
  specter: { name: 'Specter', cls: 'Semi-auto sniper', snd: 'sniper', dmg: 62, head: 2.3, rpm: 160, auto: false, mag: 10, reload: 2.8, hip: 0.07, ads: 0,
    recoil: 0.03, range: 520, mob: 0.92, adsTime: 0.25, reserveMags: 3,
    optics: ['x3', 'x6'], optic: 'x6', muzzles: ['none', 'sup', 'brake'],
    shape: { L: .48, H: .095, barrel: .5, guard: [.3, .085], stock: 'thick', mag: 'box', furn: 0x2e3a2c } },
  warden: { name: 'Warden', cls: 'Lever-action rifle', snd: 'br', dmg: 55, head: 2.1, rpm: 90, auto: false, mag: 8, reload: 3.0, hip: 0.045, ads: 0.0012,
    recoil: 0.028, range: 340, mob: 1.0, adsTime: 0.19, reserveMags: 4, noMag: true,
    optics: ['iron', 'reddot', 'x3'], optic: 'iron', muzzles: ['none', 'sup', 'brake'],
    shape: { L: .4, H: .085, barrel: .48, guard: [.24, .07], stock: 'full', mag: 'tube', furn: 0x8a5a32 } },
  twin: { name: 'Twin', cls: 'Double-barrel shotgun', snd: 'sg', dmg: 17, pellets: 9, head: 1.3, rpm: 300, auto: false, mag: 2, reload: 2.2, hip: 0.075, ads: 0.055,
    recoil: 0.05, range: 20, mob: 1.02, adsTime: 0.15, reserveMags: 10, noMag: true,
    optics: ['iron', 'reddot'], optic: 'iron', muzzles: ['none', 'choke'],
    shape: { L: .3, H: .09, barrel: .45, guard: [.22, .07], stock: 'full', mag: 'none', furn: 0x7a4f2f } },
  ripper: { name: 'Ripper', cls: 'Rotary machine gun', snd: 'lmg', dmg: 18, head: 1.6, rpm: 1250, auto: true, mag: 150, reload: 6.0, hip: 0.07, ads: 0.012,
    recoil: 0.007, range: 160, mob: 0.78, adsTime: 0.34, reserveMags: 2,
    optics: ['iron', 'reddot', 'holo'], optic: 'reddot', muzzles: ['none', 'comp'],
    shape: { L: .5, H: .12, barrel: .4, guard: [.26, .1], stock: 'thick', mag: 'drum', furn: 0x3a3d40 } },
  viper: { name: 'Viper', cls: 'Pistol', snd: 'pistol', dmg: 30, head: 1.8, rpm: 400, auto: false, mag: 12, reload: 1.3, hip: 0.028, ads: 0.008,
    recoil: 0.014, range: 60, mob: 1.15, adsTime: 0.1, reserveMags: 4, pistol: true,
    optics: ['iron', 'reddot'], optic: 'iron', muzzles: ['none', 'sup', 'comp'], noStock: true, noBarrel: true, unders: ['none', 'laser'],
    shape: { furn: 0x2f3337 } },
  stinger: { name: 'Stinger', cls: 'Machine pistol', snd: 'mp', dmg: 14, head: 1.5, rpm: 1000, auto: true, mag: 24, reload: 1.5, hip: 0.036, ads: 0.014,
    recoil: 0.006, range: 45, mob: 1.15, adsTime: 0.1, reserveMags: 4, pistol: true, mp: true,
    optics: ['iron', 'reddot'], optic: 'iron', muzzles: ['none', 'sup', 'comp'], noStock: true, noBarrel: true, unders: ['none', 'laser'],
    shape: { furn: 0x2a2d30 } },
  brute: { name: 'Brute', cls: 'Revolver', snd: 'rev', dmg: 58, head: 1.9, rpm: 140, auto: false, mag: 6, reload: 2.4, hip: 0.03, ads: 0.006,
    recoil: 0.04, range: 70, mob: 1.12, adsTime: 0.12, reserveMags: 5, pistol: true, revolver: true,
    optics: ['iron', 'reddot'], optic: 'iron', muzzles: ['none', 'comp'], noStock: true, noBarrel: true, unders: ['none', 'laser'], noMag: true,
    shape: { furn: 0x6b4a32 } },
};
const GUN_IDS = Object.keys(GUNS);

const OPTICS = {
  iron: { name: 'Iron sights', fov: 60, ads: 1.0, desc: 'No glass, quickest to aim. A little zoom.' },
  reddot: { name: 'Red dot', fov: 52, ads: 1.05, desc: 'Clean dot, slight zoom.' },
  holo: { name: 'Holo sight', fov: 50, ads: 1.08, desc: 'Ring and dot, easy to track movers.' },
  x3: { name: '3x scope', fov: 26, ads: 1.25, overlay: 'x3', desc: 'Mid-range zoom with an amber chevron.' },
  x6: { name: '6x scope', fov: 13, ads: 1.4, overlay: 'x6', sway: true, desc: 'Long-range zoom. Sways; hold Shift to steady.' },
};
// Each mod multiplies stats: rv vertical recoil, rh side recoil, hip hip-fire spread, range, mob move speed,
// adsT aim-in time, magM magazine, rel reload time, pel shotgun pellet spread, adsMove move speed while aiming.
const MODS = {
  muzzle: {
    none: { name: 'None' },
    sup: { name: 'Suppressor', range: 0.85, quiet: true, desc: 'Quiet shots. Bots don\'t hear you and enemies don\'t see you on the minimap.' },
    comp: { name: 'Compensator', rv: 0.75, desc: 'Keeps the muzzle down: less upward kick.' },
    brake: { name: 'Muzzle brake', rv: 0.88, rh: 0.6, adsT: 1.05, desc: 'Much less side-to-side kick.' },
    choke: { name: 'Choke', pel: 0.62, range: 1.25, desc: 'Tighter pellet spread, reaches further.' },
  },
  barrel: {
    std: { name: 'Standard' },
    long: { name: 'Long barrel', range: 1.35, hip: 1.12, adsT: 1.1, mob: 0.97, desc: 'More range, slower to handle.' },
    short: { name: 'Short barrel', range: 0.75, hip: 0.82, adsT: 0.9, mob: 1.03, desc: 'Snappier and better from the hip, less range.' },
  },
  under: {
    none: { name: 'None' },
    vgrip: { name: 'Vertical grip', rv: 0.8, adsT: 1.04, desc: 'Less upward kick.' },
    angled: { name: 'Angled grip', adsT: 0.85, desc: 'Faster to aim.' },
    laser: { name: 'Laser', hip: 0.7, desc: 'Tighter hip-fire.' },
  },
  mag: {
    std: { name: 'Standard' },
    ext: { name: 'Extended mag', magM: 1.5, rel: 1.15, adsT: 1.05, desc: 'Half again as many rounds, slower reload.' },
    fast: { name: 'Fast mag', rel: 0.7, desc: 'Quicker reloads.' },
  },
  stock: {
    std: { name: 'Standard' },
    light: { name: 'Light stock', mob: 1.06, adsMove: 1.25, rv: 1.12, rh: 1.12, desc: 'Move faster, more kick.' },
    heavy: { name: 'Heavy stock', rv: 0.85, rh: 0.85, adsT: 1.1, mob: 0.97, desc: 'Steadier, slower.' },
  },
};
const MOD_CATS = [['optic', 'Optic'], ['muzzle', 'Muzzle'], ['barrel', 'Barrel'], ['under', 'Underbarrel'], ['mag', 'Magazine'], ['stock', 'Stock']];

/* ---------- skins ---------- */
// kind: plain colour, camo (blobs), digital (pixels), stripes, carbon weave, or neon lines
const SKINS = {
  factory: { name: 'Factory', kind: 'factory', sw: ['#2a2e33', '#9b8360'] },
  woodland: { name: 'Woodland', kind: 'camo', base: '#4a5a38', spots: ['#2f3a24', '#6b5a3a', '#1f241a'], sw: ['#4a5a38', '#2f3a24'] },
  desert: { name: 'Desert', kind: 'camo', base: '#c2a77a', spots: ['#9c7f55', '#dccaa3', '#7a6244'], sw: ['#c2a77a', '#9c7f55'] },
  arctic: { name: 'Arctic', kind: 'camo', base: '#dfe5e9', spots: ['#a9b3ba', '#6f7a82'], sw: ['#dfe5e9', '#6f7a82'] },
  ocean: { name: 'Deep sea', kind: 'camo', base: '#2b5f7e', spots: ['#1d3f57', '#4f8db0', '#163042'], sw: ['#2b5f7e', '#4f8db0'] },
  urban: { name: 'Urban digital', kind: 'digital', base: '#7d8388', spots: ['#4b5055', '#a6abaf', '#2d3135'], sw: ['#7d8388', '#2d3135'] },
  tiger: { name: 'Tiger', kind: 'stripes', base: '#d98a2b', spots: ['#1d1a17'], sw: ['#d98a2b', '#1d1a17'] },
  crimson: { name: 'Crimson', kind: 'camo', base: '#8f1f24', spots: ['#6a161a', '#a52a2f'], sw: ['#8f1f24', '#6a161a'] },
  carbon: { name: 'Carbon', kind: 'carbon', sw: ['#1a1c1f', '#2e3236'] },
  gold: { name: 'Gold', kind: 'gold', sw: ['#d4a53a', '#8a6420'] },
  neon: { name: 'Neon', kind: 'neon', sw: ['#15181c', '#3ff0ff'] },
};
const SKIN_IDS = Object.keys(SKINS);
const skinCache = {};
function skinTexture(id) {
  const S = SKINS[id], c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), r = mulberry(hashStr(id));
  const wrap = (fn) => { for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) fn(ox, oy); };
  if (S.kind === 'carbon') {
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { x.fillStyle = (i + j) % 2 ? '#1a1c1f' : '#2c3034'; x.fillRect(i * 8, j * 8, 8, 8); x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(i * 8, j * 8, 8, 2); }
  } else if (S.kind === 'neon') {
    x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#3ff0ff'; x.lineWidth = 2.2;
    for (let i = 0; i < 9; i++) { const y = r() * 128, k = r() * 40; x.beginPath(); x.moveTo(0, y); x.lineTo(40 + k, y); x.lineTo(60 + k, y + 18); x.lineTo(128, y + 18); x.stroke(); }
  } else {
    x.fillStyle = S.base; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < (S.kind === 'digital' ? 140 : S.kind === 'stripes' ? 16 : 26); i++) {
      x.fillStyle = S.spots[(r() * S.spots.length) | 0];
      const px = r() * 128, py = r() * 128;
      if (S.kind === 'digital') { const s = 4 * (1 + ((r() * 3) | 0)); const qx = Math.floor(px / 4) * 4, qy = Math.floor(py / 4) * 4; x.fillRect(qx, qy, s, 4 * (1 + ((r() * 2) | 0))); }
      else if (S.kind === 'stripes') { const w = 3 + r() * 6, t = r() * 0.6 - 0.3; wrap((ox, oy) => { x.save(); x.translate(px + ox, py + oy); x.rotate(t + 0.9); x.beginPath(); x.ellipse(0, 0, 34 + r() * 10, w, 0, 0, 6.29); x.fill(); x.restore(); }); }
      else { const rx = 8 + r() * 16, ry = 5 + r() * 10, a = r() * 3; wrap((ox, oy) => { x.beginPath(); x.ellipse(px + ox, py + oy, rx, ry, a, 0, 6.29); x.fill(); }); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (S.kind === 'digital' || S.kind === 'carbon') t.magFilter = THREE.NearestFilter;
  return t;
}
// { metal, furn, dark } materials for a skin; factory returns null so the gun keeps its own colours
function skinMats(id) {
  if (!SKINS[id] || id === 'factory') return null;
  if (skinCache[id]) return skinCache[id];
  const S = SKINS[id];
  let metal, dark = null;
  if (S.kind === 'gold') {
    metal = new THREE.MeshPhongMaterial({ color: 0xd4a53a, shininess: 90, specular: 0xffe3a0, flatShading: true });
    dark = new THREE.MeshPhongMaterial({ color: 0x8a6420, shininess: 60, specular: 0xc9a050, flatShading: true });
  } else if (S.kind === 'neon') {
    const t = skinTexture(id);
    metal = new THREE.MeshPhongMaterial({ color: 0x15181c, emissive: 0xffffff, emissiveMap: t, shininess: 30, flatShading: true });
  } else metal = new THREE.MeshPhongMaterial({ map: skinTexture(id), shininess: S.kind === 'carbon' ? 40 : 8, specular: 0x222222, flatShading: true });
  return (skinCache[id] = { metal, furn: metal, dark });
}

/* ---------- rarity, for guns found in crates ---------- */
const TIERS = [
  { name: 'Common', css: '#c3ccd1', hex: 0xb9c2c7, mods: 1 },
  { name: 'Rare', css: '#4fa3ff', hex: 0x4fa3ff, mods: 2 },
  { name: 'Epic', css: '#b47dff', hex: 0xb47dff, mods: 4 },
  { name: 'Legendary', css: '#ffb547', hex: 0xffb547, mods: 6 },
];
function rollTier(r) { const v = r(); return v < 0.5 ? 0 : v < 0.8 ? 1 : v < 0.95 ? 2 : 3; }
function randomGun(r, tier) {
  const id = GUN_IDS[(r() * GUN_IDS.length) | 0], att = defaultAtt(id);
  const cats = MOD_CATS.map(([c]) => c).filter(c => modChoices(id, c).length > 1);
  for (let k = 0; k < TIERS[tier].mods && cats.length; k++) {
    const cat = cats.splice((r() * cats.length) | 0, 1)[0], ch = modChoices(id, cat).filter(v => v !== att[cat]);
    if (ch.length) att[cat] = ch[(r() * ch.length) | 0];
  }
  const pools = [['factory'], ['woodland', 'desert', 'arctic', 'urban', 'ocean'], ['tiger', 'crimson', 'carbon', 'urban'], ['gold', 'neon']];
  const pool = pools[tier];
  return { id, att, skin: pool[(r() * pool.length) | 0], tier };
}

function modChoices(id, cat) {
  const g = GUNS[id];
  if (cat === 'optic') return g.optics;
  if (cat === 'muzzle') return g.muzzles;
  if (cat === 'barrel') return g.noBarrel ? ['std'] : ['std', 'long', 'short'];
  if (cat === 'under') return g.unders || ['none', 'vgrip', 'angled', 'laser'];
  if (cat === 'mag') return g.tube || g.noMag ? ['std', 'fast'] : ['std', 'ext', 'fast'];
  if (cat === 'stock') return g.noStock ? ['std'] : ['std', 'light', 'heavy'];
  return [];
}
function defaultAtt(id) { return { optic: GUNS[id].optic, muzzle: 'none', barrel: 'std', under: 'none', mag: 'std', stock: 'std' }; }
function cleanSlot(s, fallback) {
  const id = s && GUNS[s.id] ? s.id : fallback;
  const att = defaultAtt(id);
  if (s && s.att) for (const [cat] of MOD_CATS) if (modChoices(id, cat).includes(s.att[cat])) att[cat] = s.att[cat];
  return { id, att, skin: s && SKINS[s.skin] ? s.skin : 'factory' };
}

function gunStats(id, att) {
  const g = GUNS[id], o = OPTICS[att.optic] || OPTICS.iron;
  const m = { rv: 1, rh: 1, hip: 1, range: 1, mob: 1, adsT: 1, magM: 1, rel: 1, pel: 1, adsMove: 1 };
  let quiet = false;
  for (const cat of ['muzzle', 'barrel', 'under', 'mag', 'stock']) {
    const mod = MODS[cat][att[cat]]; if (!mod) continue;
    for (const k in m) if (mod[k]) m[k] *= mod[k];
    if (mod.quiet) quiet = true;
  }
  let mag = Math.round(g.mag * m.magM);
  if (g.burst) mag = Math.max(g.burst, Math.round(mag / g.burst) * g.burst);
  return {
    id, name: g.name, cls: g.cls, snd: quiet ? 'sup' : g.snd, quiet, pistol: !!g.pistol,
    dmg: g.dmg, pellets: g.pellets || 1, head: g.head, rpm: g.rpm, auto: g.auto, burst: g.burst || 0, burstGap: g.burstGap || 0,
    mag, reserve: mag * g.reserveMags, reload: g.reload * m.rel,
    hip: g.hip * m.hip, ads: g.ads * (g.pellets ? m.pel : 1), pelHip: g.hip * m.pel,
    recoilV: g.recoil * m.rv, recoilH: g.recoil * 0.7 * m.rh,
    range: g.range * m.range, mob: g.mob * m.mob, adsTime: g.adsTime * o.ads * m.adsT, adsMove: m.adsMove,
    fov: o.fov, overlay: o.overlay || null, sway: !!o.sway, optic: att.optic,
  };
}
// 0..1 bars for the loadout screen
function statBars(s) {
  const rpm = s.burst ? Math.round(s.burst / (s.burst * 60 / s.rpm + s.burstGap) * 60) : s.rpm;
  return [
    ['Damage', clamp(s.dmg * s.pellets * (s.pellets > 1 ? 0.75 : 1) / 100, 0, 1), Math.round(s.dmg) + (s.pellets > 1 ? '×' + s.pellets : '')],
    ['Fire rate', clamp(rpm / 1100, 0, 1), rpm + (s.burst ? ' (burst)' : '')],
    ['Range', clamp(s.range / 600, 0, 1), Math.round(s.range) + 'm'],
    ['Accuracy', clamp(1 - s.hip / 0.1, 0, 1), ''],
    ['Control', clamp(1 - s.recoilV / 0.05, 0, 1), ''],
    ['Mobility', clamp((s.mob - 0.75) / 0.45, 0, 1), ''],
    ['Aim speed', clamp(1 - (s.adsTime - 0.08) / 0.4, 0, 1), Math.round(s.adsTime * 1000) + 'ms'],
    ['Magazine', clamp(s.mag / 100, 0, 1), s.mag + ''],
  ];
}

/* ---------- gun models, built from boxes and cylinders ---------- */
// UVs scaled to real size, so a camo pattern keeps the same scale on every part
const UVK = 7;
function uvBox(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const ox = Math.random(), oy = Math.random();
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, ox + uv.getX(i) * dims[f][0] * UVK, oy + uv.getY(i) * dims[f][1] * UVK); }
  return geo;
}
function uvCyl(r, l, s = 8) {
  const c = new THREE.CylinderGeometry(r, r, l, s), uv = c.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6.28 * r * UVK, uv.getY(i) * l * UVK);
  c.rotateX(Math.PI / 2); return c;
}
// gun materials: smooth shaded with a bit of sheen, so metal reads as metal
const gunMats = {};
const gm = (c, shin = 34, spec = 0x3c3c3c) => gunMats[c + ':' + shin] || (gunMats[c + ':' + shin] = new THREE.MeshPhongMaterial({ color: c, shininess: shin, specular: spec }));
function addLimb(parent, a, b, r1, r2, m) {
  const d = new THREE.Vector3().subVectors(b, a), me = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, d.length(), 10), m);
  me.position.copy(a).add(b).multiplyScalar(.5); me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); parent.add(me); return me;
}
// worldModel: a full-size copy for the ground (crates, dropped guns) instead of the in-hand view
function makeGunModel(id, att, skin, worldModel) {
  const def = GUNS[id], sh = def.shape, g = new THREE.Group(), sk = skinMats(skin);
  const metal = sk ? sk.metal : gm(0x2c2f33, 40, 0x555555), dark = sk && sk.dark ? sk.dark : gm(0x1c1e21, 26), glove = gm(0x2f2b26, 6, 0x111111), furn = sk ? sk.furn : gm(sh.furn, 14, 0x222222);
  const steel = gm(0x16181a, 70, 0x777777), rubber = gm(0x141414, 4, 0x0a0a0a), sleeve = gm(0x4b5139, 3, 0x0a0a0a), detail = !worldModel;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const add = (geo, m, x, y, z, rx = 0, parent = g) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.x = rx; parent.add(me); return me; };
  const Bx = uvBox, Cy = uvCyl;
  let top, front, muzzleZ, ironFrontZ, ironRearZ, opticZ, magMesh = null;
  if (def.pistol) {
    const long = def.revolver ? .06 : 0;
    const slide = add(Bx(.04, .045, .21 + long), metal, 0, 0, -.02 - long / 2);
    if (!def.revolver) { for (let i = 0; i < 5; i++) for (const s of [-1, 1]) add(Bx(.002, .034, .004), dark, s * .0205, .002, .075 + i * .009 + long / 2, 0, slide); add(Bx(.042, .012, .045), dark, 0, .006, -.025 + long / 2, 0, slide); }
    else { add(Bx(.012, .02, .02), steel, 0, .028, .07, -.5); }
    add(Bx(.006, .006, .05), dark, 0, -.068, -.025); add(Bx(.006, .028, .006), dark, 0, -.054, -.05); add(Bx(.005, .02, .006), steel, 0, -.052, -.012, .3);
    add(Bx(.036, .03, .16), dark, 0, -.035, -.03);
    add(Bx(.034, .11, .05), furn, 0, -.09, .045, -.22);
    add(Cy(.009, .03), dark, 0, .004, -.135 - long);
    if (def.revolver) add(Cy(.026, .05, 8), metal, 0, -.008, .0);
    if (def.mp) { magMesh = add(Bx(.03, .1, .035), dark, 0, -.16, .055, -.22); add(Bx(.012, .012, .16), dark, 0, -.03, .14); add(Bx(.012, .06, .012), dark, 0, -.06, .22); }
    if (!worldModel) {
      add(Bx(.062, .07, .085), glove, 0, -.1, .05); add(Bx(.06, .045, .06), glove, -.012, -.08, .0);
      addLimb(g, V(.005, -.14, .085), V(.06, -.3, .38), .036, .046, sleeve); addLimb(g, V(-.02, -.13, .07), V(-.13, -.3, .36), .034, .045, sleeve);
      addLimb(g, V(.006, -.125, .075), V(.012, -.14, .1), .038, .04, glove);
    }
    g.userData.slide = def.revolver ? null : slide;
    top = .0225; muzzleZ = -.15 - long; ironFrontZ = -.115 - long; ironRearZ = .07; opticZ = -.01; front = -.12;
  } else {
    const L = sh.L, H = sh.H, [gl, gh] = sh.guard;
    let bl = sh.barrel + (att.barrel === 'long' ? .12 : att.barrel === 'short' ? -.07 : 0);
    bl = Math.max(.05, bl);
    front = -L / 2; top = H / 2;
    add(Bx(.07, H, L), metal, 0, 0, 0);
    add(Bx(.066, gh, gl), furn, 0, -.004, front - gl / 2);
    add(Cy(.014, bl), dark, 0, .006, front - bl / 2 - gl * 0.4);
    muzzleZ = front - gl * 0.4 - bl;
    add(Bx(.03, .012, L + gl * .6), dark, 0, top + .006, -gl * .3);
    add(Bx(.072, .02, .05), dark, 0, .01, L * .1); // ejection port
    add(Bx(.074, .004, .055), steel, .0, .022, L * .1);
    add(Bx(.05, .012, .022), dark, 0, H / 2 + .004, L / 2 - .015); // charging handle
    add(Bx(.062, .034, .08), metal, 0, -H / 2 - .012, front + .12); // magwell
    add(Bx(.006, .006, .075), dark, 0, -H / 2 - .032, L / 2 - .14); add(Bx(.006, .03, .006), dark, 0, -H / 2 - .018, L / 2 - .175);
    add(Bx(.005, .022, .006), steel, 0, -H / 2 - .016, L / 2 - .14, .25); // trigger
    add(Bx(.004, .01, .02), steel, .037, -.01, L / 2 - .12); // selector
    if (detail) { const rl = L + gl * .6, n = Math.floor(rl / .022); for (let i = 0; i < n; i++) add(Bx(.033, .0035, .006), dark, 0, top + .0135, -gl * .3 - rl / 2 + (i + .5) * rl / n); }
    if (detail) for (let i = 0; i < 3; i++) for (const s of [-1, 1]) add(Bx(.002, gh * .35, .03), dark, s * .0335, -.004, front - gl * (i + 1) / 4);
    add(Cy(.02, .03, 10), dark, 0, .006, front - gl * .4 - Math.min(.06, bl * .3)); // gas block
    top += .012;
    add(Bx(.045, .11, .05), furn, 0, -H / 2 - .045, L / 2 - .08, -.3);
    const magScale = att.mag === 'ext' ? 1.45 : 1;
    if (sh.mag === 'curved') magMesh = add(Bx(.05, .17 * magScale, .08), dark, 0, -H / 2 - .07 * magScale, front + .12, .25);
    else if (sh.mag === 'straight') magMesh = add(Bx(.045, .2 * magScale, .06), dark, 0, -H / 2 - .09 * magScale, front + .1);
    else if (sh.mag === 'box') magMesh = add(Bx(.05, .09 * magScale, .08), dark, 0, -H / 2 - .04 * magScale, front + .14);
    else if (sh.mag === 'drum') { magMesh = add(new THREE.CylinderGeometry(.075 * Math.sqrt(magScale), .075 * Math.sqrt(magScale), .07, 12), dark, 0, -H / 2 - .07, front + .14); magMesh.rotation.z = Math.PI / 2; }
    else if (sh.mag === 'top') magMesh = add(Bx(.05, .03, .22 * magScale), dark, 0, top + .012, -.02);
    else if (sh.mag === 'tube') magMesh = add(Cy(.016, .3), dark, 0, -.045, front - .12);
    else if (sh.mag === 'can') { magMesh = add(Bx(.1, .11 * magScale, .13), furn, .03, -H / 2 - .05 * magScale, front + .13); add(Bx(.03, .03, .03), dark, -.03, 0, 0, 0, magMesh); }
    if (att.mag === 'fast' && magMesh) { const band = add(Bx(.056, .02, .09), pm(0xff9a3c), 0, 0, 0, 0, magMesh); band.scale.set(1, 1, sh.mag === 'tube' ? 2 : 1); }
    const stk = att.stock === 'light' ? 'wire' : att.stock === 'heavy' ? 'thick' : sh.stock;
    if (stk === 'full') { add(Bx(.06, .11, .24), furn, 0, -.02, L / 2 + .12); add(Bx(.062, .115, .02), rubber, 0, -.02, L / 2 + .25); add(Cy(.016, .1, 10), dark, 0, .005, L / 2 + .04); }
    else if (stk === 'thick') { add(Bx(.068, .13, .3), furn, 0, -.025, L / 2 + .15); add(Bx(.05, .04, .14), furn, 0, .045, L / 2 + .13); add(Bx(.07, .135, .022), rubber, 0, -.025, L / 2 + .31); }
    else { add(Bx(.016, .016, .22), dark, 0, 0, L / 2 + .11); add(Bx(.016, .08, .016), dark, 0, -.03, L / 2 + .22); }
    const uz = front - gl / 2, uy = -gh / 2 - .004;
    if (att.under === 'vgrip') add(Bx(.03, .09, .035), dark, 0, uy - .045, uz);
    else if (att.under === 'angled') add(Bx(.03, .05, .09), dark, 0, uy - .025, uz + .02, -.5);
    else if (att.under === 'laser') { add(Bx(.025, .025, .08), dark, .042, -.01, uz); add(new THREE.SphereGeometry(.004, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3030 }), .042, -.01, uz - .042); }
    if (sh.mag === 'tube') add(Bx(.075, .06, .12), furn, 0, -.05, front - .1);
    if (!worldModel) {
      const gy = -H / 2 - .055, gz = L / 2 - .07;
      add(Bx(.07, .065, .095), glove, 0, gy, gz); add(Bx(.02, .02, .06), glove, -.035, gy + .03, gz - .05); // grip hand, trigger finger
      addLimb(g, V(.01, gy - .03, gz + .04), V(.1, -.28, L / 2 + .3), .038, .047, sleeve);
      addLimb(g, V(.01, gy - .025, gz + .03), V(.025, gy - .04, gz + .08), .04, .042, glove);
      const ly = att.under === 'vgrip' ? uy - .06 : -gh / 2 - .03;
      if (att.under !== 'vgrip') { add(Bx(.08, .055, .1), glove, 0, ly, uz); add(Bx(.016, .03, .09), glove, .04, ly + .03, uz); }
      else add(Bx(.06, .06, .07), glove, 0, ly, uz);
      addLimb(g, V(-.02, ly - .02, uz + .04), V(-.16, -.27, uz + .36), .036, .046, sleeve);
      addLimb(g, V(-.02, ly - .02, uz + .04), V(-.035, ly - .035, uz + .085), .04, .042, glove);
    }
    ironFrontZ = front - gl + .025; ironRearZ = L / 2 - .04; opticZ = -L * 0.12;
  }
  if (def.pistol && att.under === 'laser') { add(Bx(.025, .02, .06), dark, 0, -.06, -.08); add(new THREE.SphereGeometry(.004, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3030 }), 0, -.06, -.111); }
  let mz = muzzleZ;
  if (att.muzzle === 'sup') { add(Cy(def.pistol ? .016 : .022, .17, 10), dark, 0, def.pistol ? .004 : .006, mz - .085); mz -= .17; }
  else if (att.muzzle === 'comp') { add(Bx(.035, .035, .06), metal, 0, .006, mz - .03); mz -= .06; }
  else if (att.muzzle === 'brake') { add(Bx(.05, .03, .07), metal, 0, .006, mz - .035); mz -= .07; }
  else if (att.muzzle === 'choke') { add(Cy(.02, .05), metal, 0, .006, mz - .025); mz -= .05; }
  else if (!def.pistol && !def.tube) { add(Cy(.017, .045, 10), dark, 0, .006, mz - .022); if (detail) for (let i = 0; i < 4; i++) { const sl = add(Bx(.036, .003, .03), steel, 0, .006, mz - .025); sl.rotation.z = i * Math.PI / 4; } mz -= .045; }
  let sightY;
  const glassMat = () => new THREE.MeshBasicMaterial({ color: 0x9fd0e0, transparent: true, opacity: .14, depthWrite: false });
  const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const om = pm(0x24282c);
  if (att.optic === 'iron') {
    sightY = top + .028;
    add(Bx(.006, .028, .006), om, 0, top + .014, ironFrontZ);
    add(Bx(.006, .024, .012), om, -.016, top + .012, ironFrontZ);
    add(Bx(.006, .024, .012), om, .016, top + .012, ironFrontZ);
    add(Bx(.008, .03, .012), om, -.011, top + .015, ironRearZ);
    add(Bx(.008, .03, .012), om, .011, top + .015, ironRearZ);
  } else if (att.optic === 'reddot') {
    sightY = top + .03;
    add(Bx(.05, .016, .07), om, 0, top + .008, opticZ);
    add(Bx(.007, .048, .012), om, -.023, sightY, opticZ - .02);
    add(Bx(.007, .048, .012), om, .023, sightY, opticZ - .02);
    add(Bx(.053, .008, .012), om, 0, sightY + .026, opticZ - .02);
    add(new THREE.PlaneGeometry(.04, .042), glassMat(), 0, sightY, opticZ - .022);
    add(new THREE.SphereGeometry(.0018, 8, 6), red, 0, sightY, opticZ - .018);
  } else if (att.optic === 'holo') {
    sightY = top + .032;
    add(Bx(.056, .016, .08), om, 0, top + .008, opticZ);
    add(Bx(.007, .05, .05), om, -.027, sightY, opticZ);
    add(Bx(.007, .05, .05), om, .027, sightY, opticZ);
    add(Bx(.06, .01, .05), om, 0, sightY + .028, opticZ);
    add(new THREE.PlaneGeometry(.046, .044), glassMat(), 0, sightY, opticZ - .02);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.0065, .0007, 4, 24), red); ring.position.set(0, sightY, opticZ - .016); g.add(ring);
    add(new THREE.SphereGeometry(.0011, 6, 4), red, 0, sightY, opticZ - .016);
  } else {
    const big = att.optic === 'x6', r = big ? .024 : .019, len = big ? .3 : .15;
    sightY = top + (big ? .04 : .032);
    add(Cy(r, len, 10), om, 0, sightY, opticZ);
    add(Cy(r * 1.32, .07, 10), om, 0, sightY, opticZ - len / 2 - .02);
    add(Cy(r * 1.22, .05, 10), om, 0, sightY, opticZ + len / 2 + .015);
    add(Bx(.02, sightY - top, .025), om, 0, (sightY + top) / 2, opticZ - len * .3);
    add(Bx(.02, sightY - top, .025), om, 0, (sightY + top) / 2, opticZ + len * .3);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 1.1, 14), new THREE.MeshPhongMaterial({ color: 0x1d3a52, shininess: 120, specular: 0x88aacc }));
    lens.position.set(0, sightY, opticZ + len / 2 + .041); g.add(lens);
  }
  if (worldModel) {
    g.scale.setScalar(1.9);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    return { group: g };
  }
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const flash = new THREE.Group();
  const fs_ = att.muzzle === 'sup' ? .05 : .11;
  for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(fs_, fs_), flashMat); p.rotation.y = i * Math.PI / 2; flash.add(p); }
  flash.add(new THREE.Mesh(new THREE.CircleGeometry(fs_ * .45, 6), flashMat));
  flash.position.set(0, .008, mz - .04); flash.visible = false; g.add(flash);
  const hip = def.pistol ? new THREE.Vector3(.15, -.15, -.36) : new THREE.Vector3(.2, -.2, -.52);
  const adsZ = def.pistol ? -.32 : att.optic === 'iron' ? -.26 : (att.optic === 'x3' || att.optic === 'x6') ? -.22 : -.27;
  g.visible = false; wScene.add(g);
  return { group: g, flash, slide: g.userData.slide || null, muzzle: new THREE.Vector3(0, .008, mz), hip, adsPos: new THREE.Vector3(0, -sightY, adsZ), mag: magMesh, magY: magMesh ? magMesh.position.y : 0,
    eject: new THREE.Vector3(.04, .02, def.pistol ? -.02 : .02) };
}
const sharedMats = () => { const s = new Set([...Object.values(matCache), ...Object.values(gunMats)]); for (const k in skinCache) { s.add(skinCache[k].metal); if (skinCache[k].dark) s.add(skinCache[k].dark); } return s; };
function disposeGunModel(m) {
  if (!m) return;
  m.group.parent && m.group.parent.remove(m.group);
  const keep = sharedMats();
  m.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !keep.has(o.material)) o.material.dispose(); });
}

/* ---------- the player's loadout ---------- */
let loadout = (() => {
  const s = store.get('loadout', null) || [];
  return [cleanSlot(s[0], 'vk7'), cleanSlot(s[1], 'longshot')];
})();
function saveLoadout() { store.set('loadout', loadout); }
