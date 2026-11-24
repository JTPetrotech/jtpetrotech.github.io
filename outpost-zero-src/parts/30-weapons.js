/* Guns and mods. A gun's numbers come from its base entry, then every mod
   multiplies some of them - the loadout screen and the firing code both read
   the same gunStats() result, so what the bars show is what you get. */

const GUNS = {
  vk7: { name: 'VK-7', cls: 'Assault rifle', snd: 'rifle', dmg: 27, head: 2.0, rpm: 620, auto: true, mag: 30, reload: 2.1, hip: 0.032, ads: 0.0025,
    recoil: 0.0095, range: 220, mob: 1.0, adsTime: 0.17, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo', 'x3'], optic: 'reddot', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .42, H: .09, barrel: .3, guard: [.26, .078], stock: 'full', mag: 'curved', furn: 0x9b8360 } },
  ranger: { name: 'Ranger DMR', cls: 'Marksman rifle', snd: 'rifle', dmg: 46, head: 2.2, rpm: 330, auto: false, mag: 15, reload: 2.4, hip: 0.05, ads: 0.0008,
    recoil: 0.02, range: 360, mob: 0.95, adsTime: 0.21, reserveMags: 3,
    optics: ['iron', 'reddot', 'holo', 'x3', 'x6'], optic: 'x3', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .46, H: .095, barrel: .42, guard: [.3, .08], stock: 'full', mag: 'box', furn: 0x4d5a3c } },
  longshot: { name: 'Longshot .50', cls: 'Sniper rifle', snd: 'sniper', dmg: 88, head: 2.6, rpm: 46, auto: false, mag: 5, reload: 3.0, hip: 0.085, ads: 0,
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
  bulwark: { name: 'Bulwark', cls: 'Light machine gun', snd: 'lmg', dmg: 26, head: 1.8, rpm: 700, auto: true, mag: 100, reload: 5.0, hip: 0.06, ads: 0.006,
    recoil: 0.009, range: 240, mob: 0.82, adsTime: 0.3, reserveMags: 2,
    optics: ['iron', 'reddot', 'holo', 'x3'], optic: 'reddot', muzzles: ['none', 'sup', 'comp', 'brake'],
    shape: { L: .5, H: .11, barrel: .36, guard: [.3, .09], stock: 'thick', mag: 'drum', furn: 0x5a5148 } },
  breacher: { name: 'Breacher', cls: 'Pump shotgun', snd: 'sg', dmg: 14, pellets: 8, head: 1.3, rpm: 75, auto: false, mag: 7, reload: 3.0, hip: 0.07, ads: 0.05,
    recoil: 0.04, range: 22, mob: 1.0, adsTime: 0.16, reserveMags: 4,
    optics: ['iron', 'reddot', 'holo'], optic: 'iron', muzzles: ['none', 'choke', 'sup'],
    shape: { L: .36, H: .09, barrel: .4, guard: [.2, .075], stock: 'full', mag: 'tube', furn: 0x7b5a3a } },
  viper: { name: 'Viper', cls: 'Pistol', snd: 'pistol', dmg: 30, head: 1.8, rpm: 400, auto: false, mag: 12, reload: 1.3, hip: 0.028, ads: 0.008,
    recoil: 0.014, range: 60, mob: 1.15, adsTime: 0.1, reserveMags: 4, pistol: true,
    optics: ['iron', 'reddot'], optic: 'iron', muzzles: ['none', 'sup', 'comp'], noStock: true, noBarrel: true, unders: ['none', 'laser'],
    shape: { furn: 0x2f3337 } },
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

function modChoices(id, cat) {
  const g = GUNS[id];
  if (cat === 'optic') return g.optics;
  if (cat === 'muzzle') return g.muzzles;
  if (cat === 'barrel') return g.noBarrel ? ['std'] : ['std', 'long', 'short'];
  if (cat === 'under') return g.unders || ['none', 'vgrip', 'angled', 'laser'];
  if (cat === 'mag') return id === 'breacher' ? ['std', 'fast'] : ['std', 'ext', 'fast'];
  if (cat === 'stock') return g.noStock ? ['std'] : ['std', 'light', 'heavy'];
  return [];
}
function defaultAtt(id) { return { optic: GUNS[id].optic, muzzle: 'none', barrel: 'std', under: 'none', mag: 'std', stock: 'std' }; }
function cleanSlot(s, fallback) {
  const id = s && GUNS[s.id] ? s.id : fallback;
  const att = defaultAtt(id);
  if (s && s.att) for (const [cat] of MOD_CATS) if (modChoices(id, cat).includes(s.att[cat])) att[cat] = s.att[cat];
  return { id, att };
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
  const mag = Math.round(g.mag * m.magM);
  return {
    id, name: g.name, cls: g.cls, snd: quiet ? 'sup' : g.snd, quiet, pistol: !!g.pistol,
    dmg: g.dmg, pellets: g.pellets || 1, head: g.head, rpm: g.rpm, auto: g.auto,
    mag, reserve: mag * g.reserveMags, reload: g.reload * m.rel,
    hip: g.hip * m.hip, ads: g.ads * (g.pellets ? m.pel : 1), pelHip: g.hip * m.pel,
    recoilV: g.recoil * m.rv, recoilH: g.recoil * 0.7 * m.rh,
    range: g.range * m.range, mob: g.mob * m.mob, adsTime: g.adsTime * o.ads * m.adsT, adsMove: m.adsMove,
    fov: o.fov, overlay: o.overlay || null, sway: !!o.sway, optic: att.optic,
  };
}
// 0..1 bars for the loadout screen
function statBars(s) {
  return [
    ['Damage', clamp(s.dmg * s.pellets * (s.pellets > 1 ? 0.75 : 1) / 100, 0, 1), Math.round(s.dmg) + (s.pellets > 1 ? '×' + s.pellets : '')],
    ['Fire rate', clamp(s.rpm / 1100, 0, 1), s.rpm + ''],
    ['Range', clamp(s.range / 600, 0, 1), Math.round(s.range) + 'm'],
    ['Accuracy', clamp(1 - s.hip / 0.1, 0, 1), ''],
    ['Control', clamp(1 - s.recoilV / 0.05, 0, 1), ''],
    ['Mobility', clamp((s.mob - 0.75) / 0.45, 0, 1), ''],
    ['Aim speed', clamp(1 - (s.adsTime - 0.08) / 0.4, 0, 1), Math.round(s.adsTime * 1000) + 'ms'],
    ['Magazine', clamp(s.mag / 100, 0, 1), s.mag + ''],
  ];
}

/* ---------- viewmodels, built from boxes and cylinders ---------- */
function makeGunModel(id, att) {
  const def = GUNS[id], sh = def.shape, g = new THREE.Group();
  const metal = pm(0x2a2e33), dark = pm(0x1d2024), glove = pm(0x262b2f), furn = pm(sh.furn);
  const add = (geo, m, x, y, z, rx = 0, parent = g) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.x = rx; parent.add(me); return me; };
  const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const Cy = (r, l, s = 8) => { const c = new THREE.CylinderGeometry(r, r, l, s); c.rotateX(Math.PI / 2); return c; };
  let top, front, muzzleZ, ironFrontZ, ironRearZ, opticZ;
  if (def.pistol) {
    add(Bx(.04, .045, .21), metal, 0, 0, -.02);
    add(Bx(.036, .03, .16), dark, 0, -.035, -.03);
    add(Bx(.034, .11, .05), furn, 0, -.09, .045, -.22);
    add(Cy(.009, .03), dark, 0, .004, -.135);
    add(Bx(.07, .07, .09), glove, 0, -.1, .05);
    add(Bx(.065, .05, .07), glove, 0, -.075, .0);
    top = .0225; muzzleZ = -.15; ironFrontZ = -.115; ironRearZ = .07; opticZ = -.01; front = -.12;
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
    top += .012;
    add(Bx(.045, .11, .05), furn, 0, -H / 2 - .045, L / 2 - .08, -.3);
    // magazine
    const magScale = att.mag === 'ext' ? 1.45 : 1;
    let magMesh;
    if (sh.mag === 'curved') magMesh = add(Bx(.05, .17 * magScale, .08), dark, 0, -H / 2 - .07 * magScale, front + .12, .25);
    else if (sh.mag === 'straight') magMesh = add(Bx(.045, .2 * magScale, .06), dark, 0, -H / 2 - .09 * magScale, front + .1);
    else if (sh.mag === 'box') magMesh = add(Bx(.05, .09 * magScale, .08), dark, 0, -H / 2 - .04 * magScale, front + .14);
    else if (sh.mag === 'drum') { magMesh = add(new THREE.CylinderGeometry(.075 * Math.sqrt(magScale), .075 * Math.sqrt(magScale), .07, 10), dark, 0, -H / 2 - .07, front + .14); magMesh.rotation.z = Math.PI / 2; }
    else if (sh.mag === 'top') magMesh = add(Bx(.05, .03, .22 * magScale), dark, 0, top + .012, -.02);
    else if (sh.mag === 'tube') magMesh = add(Cy(.016, .3), dark, 0, -.045, front - .12);
    if (att.mag === 'fast' && magMesh) { const band = add(Bx(.056, .02, .09), pm(0xff9a3c), 0, 0, 0, 0, magMesh); band.scale.set(1, 1, sh.mag === 'tube' ? 2 : 1); }
    // stock
    const stk = att.stock === 'light' ? 'wire' : att.stock === 'heavy' ? 'thick' : sh.stock;
    if (stk === 'full') add(Bx(.06, .11, .24), furn, 0, -.02, L / 2 + .12);
    else if (stk === 'thick') { add(Bx(.068, .13, .3), furn, 0, -.025, L / 2 + .15); add(Bx(.05, .04, .14), furn, 0, .045, L / 2 + .13); }
    else { add(Bx(.016, .016, .22), dark, 0, 0, L / 2 + .11); add(Bx(.016, .08, .016), dark, 0, -.03, L / 2 + .22); }
    // underbarrel
    const uz = front - gl / 2, uy = -gh / 2 - .004;
    if (att.under === 'vgrip') add(Bx(.03, .09, .035), dark, 0, uy - .045, uz);
    else if (att.under === 'angled') add(Bx(.03, .05, .09), dark, 0, uy - .025, uz + .02, -.5);
    else if (att.under === 'laser') { add(Bx(.025, .025, .08), dark, .042, -.01, uz); add(new THREE.SphereGeometry(.004, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3030 }), .042, -.01, uz - .042); }
    if (sh.mag === 'tube') add(Bx(.075, .06, .12), furn, 0, -.05, front - .1); // pump
    add(Bx(.075, .065, .1), glove, 0, -H / 2 - .055, L / 2 - .07);
    if (att.under !== 'vgrip') add(Bx(.085, .06, .11), glove, 0, -gh / 2 - .03, uz);
    else add(Bx(.06, .06, .07), glove, 0, uy - .06, uz);
    ironFrontZ = front - gl + .025; ironRearZ = L / 2 - .04; opticZ = -L * 0.12;
  }
  if (def.pistol && att.under === 'laser') { add(Bx(.025, .02, .06), dark, 0, -.06, -.08); add(new THREE.SphereGeometry(.004, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3030 }), 0, -.06, -.111); }
  // muzzle device
  let mz = muzzleZ;
  if (att.muzzle === 'sup') { add(Cy(def.pistol ? .016 : .022, .17, 10), dark, 0, def.pistol ? .004 : .006, mz - .085); mz -= .17; }
  else if (att.muzzle === 'comp') { add(Bx(.035, .035, .06), metal, 0, .006, mz - .03); mz -= .06; }
  else if (att.muzzle === 'brake') { add(Bx(.05, .03, .07), metal, 0, .006, mz - .035); mz -= .07; }
  else if (att.muzzle === 'choke') { add(Cy(.02, .05), metal, 0, .006, mz - .025); mz -= .05; }
  // optic
  let sightY;
  const glassMat = () => new THREE.MeshBasicMaterial({ color: 0x9fd0e0, transparent: true, opacity: .14, depthWrite: false });
  const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  if (att.optic === 'iron') {
    sightY = top + .028;
    add(Bx(.006, .028, .006), metal, 0, top + .014, ironFrontZ);
    add(Bx(.006, .024, .012), metal, -.016, top + .012, ironFrontZ);
    add(Bx(.006, .024, .012), metal, .016, top + .012, ironFrontZ);
    add(Bx(.008, .03, .012), metal, -.011, top + .015, ironRearZ);
    add(Bx(.008, .03, .012), metal, .011, top + .015, ironRearZ);
  } else if (att.optic === 'reddot') {
    sightY = top + .03;
    add(Bx(.05, .016, .07), metal, 0, top + .008, opticZ);
    add(Bx(.007, .048, .012), metal, -.023, sightY, opticZ - .02);
    add(Bx(.007, .048, .012), metal, .023, sightY, opticZ - .02);
    add(Bx(.053, .008, .012), metal, 0, sightY + .026, opticZ - .02);
    const gl_ = add(new THREE.PlaneGeometry(.04, .042), glassMat(), 0, sightY, opticZ - .022);
    add(new THREE.SphereGeometry(.0018, 8, 6), red, 0, sightY, opticZ - .018);
  } else if (att.optic === 'holo') {
    sightY = top + .032;
    add(Bx(.056, .016, .08), metal, 0, top + .008, opticZ);
    add(Bx(.007, .05, .05), metal, -.027, sightY, opticZ);
    add(Bx(.007, .05, .05), metal, .027, sightY, opticZ);
    add(Bx(.06, .01, .05), metal, 0, sightY + .028, opticZ);
    add(new THREE.PlaneGeometry(.046, .044), glassMat(), 0, sightY, opticZ - .02);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.0065, .0007, 4, 24), red); ring.position.set(0, sightY, opticZ - .016); g.add(ring);
    add(new THREE.SphereGeometry(.0011, 6, 4), red, 0, sightY, opticZ - .016);
  } else {
    const big = att.optic === 'x6', r = big ? .024 : .019, len = big ? .3 : .15;
    sightY = top + (big ? .04 : .032);
    add(Cy(r, len, 10), dark, 0, sightY, opticZ);
    add(Cy(r * 1.32, .07, 10), dark, 0, sightY, opticZ - len / 2 - .02);
    add(Cy(r * 1.22, .05, 10), dark, 0, sightY, opticZ + len / 2 + .015);
    add(Bx(.02, sightY - top, .025), metal, 0, (sightY + top) / 2, opticZ - len * .3);
    add(Bx(.02, sightY - top, .025), metal, 0, (sightY + top) / 2, opticZ + len * .3);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 1.1, 14), new THREE.MeshBasicMaterial({ color: 0x1d3a52 }));
    lens.position.set(0, sightY, opticZ + len / 2 + .041); g.add(lens);
  }
  // muzzle flash
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const flash = new THREE.Group();
  const fs_ = att.muzzle === 'sup' ? .05 : .11;
  for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(fs_, fs_), flashMat); p.rotation.y = i * Math.PI / 2; flash.add(p); }
  flash.add(new THREE.Mesh(new THREE.CircleGeometry(fs_ * .45, 6), flashMat));
  flash.position.set(0, .008, mz - .04); flash.visible = false; g.add(flash);
  const hip = def.pistol ? new THREE.Vector3(.15, -.15, -.36) : new THREE.Vector3(.2, -.2, -.52);
  const adsZ = def.pistol ? -.32 : att.optic === 'iron' ? -.26 : (att.optic === 'x3' || att.optic === 'x6') ? -.22 : -.27;
  g.visible = false; wScene.add(g);
  return { group: g, flash, muzzle: new THREE.Vector3(0, .008, mz), hip, adsPos: new THREE.Vector3(0, -sightY, adsZ) };
}
function disposeGunModel(m) {
  if (!m) return;
  wScene.remove(m.group);
  m.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !Object.values(matCache).includes(o.material)) o.material.dispose(); });
}

/* ---------- the player's loadout ---------- */
let loadout = (() => {
  const s = store.get('loadout', null) || [];
  return [cleanSlot(s[0], 'vk7'), cleanSlot(s[1], 'longshot')];
})();
function saveLoadout() { store.set('loadout', loadout); }
