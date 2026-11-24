/* Collision, effects, the robot body (used for bots and for online players),
   bots, crates, dropped guns and small loot. */

/* ---------- collision ---------- */
function resolve(pos, r, feetY, h) {
  for (const b of world.boxes) {
    if (feetY >= b.maxY - 0.02 || feetY + h <= b.minY) continue;
    if (pos.x < b.minX - r || pos.x > b.maxX + r || pos.z < b.minZ - r || pos.z > b.maxZ + r) continue;
    const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = cx + dx / d * r; pos.z = cz + dz / d * r; }
    else {
      const l = pos.x - b.minX, rr = b.maxX - pos.x, t = pos.z - b.minZ, bb = b.maxZ - pos.z, m = Math.min(l, rr, t, bb);
      if (m === l) pos.x = b.minX - r; else if (m === rr) pos.x = b.maxX + r; else if (m === t) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
    }
  }
  for (const c of world.circles) {
    if (c.off || feetY >= c.top - 0.02) continue;
    const dx = pos.x - c.x, dz = pos.z - c.z, d2 = dx * dx + dz * dz, rr = c.r + r;
    if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = c.x + dx / d * rr; pos.z = c.z + dz / d * rr; }
  }
  const lim = world.half - 1.2;
  pos.x = clamp(pos.x, -lim, lim); pos.z = clamp(pos.z, -lim, lim);
}
function groundAt(x, z, feetY) {
  let g = heightAt(x, z);
  for (const b of world.boxes) if (b.maxY <= feetY + 0.6 && b.maxY > g && x > b.minX - 0.15 && x < b.maxX + 0.15 && z > b.minZ - 0.15 && z < b.maxZ + 0.15) g = b.maxY;
  for (const c of world.circles) if (c.rock && c.top <= feetY + 0.6 && c.top > g && (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r * 0.7) ** 2) g = c.top;
  return g;
}
const inWater = (x, z, feet) => world.water != null && feet < world.water - 0.05;
const _ray = new THREE.Ray(), _hitV = new THREE.Vector3();
function hasLOS(a, b) {
  const len = a.distanceTo(b);
  _ray.origin.copy(a); _ray.direction.copy(b).sub(a).normalize();
  for (const bx of world.boxes) { if (_ray.intersectBox(bx.box3, _hitV) && a.distanceTo(_hitV) < len - 0.3) return false; }
  // round things: tanks, rocks and tree trunks (flat segment against circle)
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-6, lo = Math.min(a.y, b.y);
  for (const c of world.circles) {
    if (c.top < lo) continue;
    const t = ((c.x - a.x) * dx + (c.z - a.z) * dz) / L2;
    if (t < 0.03 || t > 0.97) continue;
    const px = a.x + dx * t - c.x, pz = a.z + dz * t - c.z;
    if (px * px + pz * pz < c.r * c.r) return false;
  }
  return true;
}
function randomClear(cx, cz, rad, r = 1) {
  for (let i = 0; i < 300; i++) {
    const a = R(0, 6.28), d = Math.sqrt(Math.random()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (isClear(x, z, r)) return [x, z];
  }
  return [cx, cz];
}

/* ---------- effects ---------- */
const fx = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd58a, transparent: true, opacity: .9 });
const tracerMatOther = new THREE.LineBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: .75 });
function tracer(a, b, other) {
  const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const l = new THREE.Line(geo, (other ? tracerMatOther : tracerMat).clone()); scene.add(l);
  fx.push({ o: l, life: .07, max: .07, kind: 'line', sc: scene });
}
const puffGeo = new THREE.IcosahedronGeometry(1, 0);
function puff(p, color = 0xd9d3c4, size = .35, life = .35, rise = 0) {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false }));
  m.position.copy(p); m.scale.setScalar(size * 0.3); scene.add(m);
  fx.push({ o: m, life, max: life, kind: 'puff', size, rise, sc: scene });
}
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
function sparks(p, n = 4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(shardGeo, sparkMat); m.scale.setScalar(.035); m.position.copy(p); scene.add(m);
    fx.push({ o: m, life: R(.12, .3), max: .3, kind: 'spark', v: new THREE.Vector3(R(-5, 5), R(1, 6), R(-5, 5)), sc: scene });
  }
}
// bullet marks: small dark squares stuck to whatever was hit, a limited number at a time
const holeGeo = new THREE.PlaneGeometry(.13, .13), holeMat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: .75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const holes = [];
function bulletHole(p, n) {
  const m = new THREE.Mesh(holeGeo, holeMat);
  m.position.copy(p).addScaledVector(n, .012); m.lookAt(_v.copy(m.position).add(n)); m.rotation.z = Math.random() * 3;
  scene.add(m); holes.push(m);
  if (holes.length > 70) scene.remove(holes.shift());
}
function clearHoles() { holes.forEach(h => scene.remove(h)); holes.length = 0; }
const shellGeo = new THREE.CylinderGeometry(.006, .006, .03, 6), shellMat = new THREE.MeshPhongMaterial({ color: 0xc9a23a, shininess: 80, specular: 0xffe7a0 });
function shell(p) { // in the in-hand scene, flies off to the right
  const m = new THREE.Mesh(shellGeo, shellMat); m.position.copy(p); m.rotation.z = Math.PI / 2; wScene.add(m);
  fx.push({ o: m, life: .5, max: .5, kind: 'shell', v: new THREE.Vector3(R(.9, 1.4), R(.9, 1.5), R(-.2, .3)), spin: R(10, 25), sc: wScene });
}
const shardGeo = new THREE.BoxGeometry(1, 1, 1);
// a knockout: a burst of dust and grit where they stood
function knockout(p) {
  for (let i = 0; i < 3; i++) puff(new THREE.Vector3(p.x + R(-.4, .4), p.y + R(.3, 1.3), p.z + R(-.4, .4)), [0xa49a88, 0x8a8376, 0xc2b8a3][i], R(.9, 1.4), R(.7, 1.1), .5);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(shardGeo, pm(i % 2 ? 0x6e675a : 0x8b8270)); const s = R(.03, .07); m.scale.setScalar(s);
    m.position.set(p.x + R(-.2, .2), p.y + R(.6, 1.4), p.z + R(-.2, .2)); scene.add(m);
    fx.push({ o: m, life: 1, max: 1, kind: 'shard', v: new THREE.Vector3(R(-2, 2), R(1, 3.5), R(-2, 2)), spin: new THREE.Vector3(R(-9, 9), R(-9, 9), R(-9, 9)), s, sc: scene });
  }
}
function scrapBurst(p, accent = 0xffb547, body = 0x6b7680) {
  const cols = [body, 0x2e3439, accent, 0x9aa4ad];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(shardGeo, pm(cols[i % 4]));
    const s = R(.08, .26); m.scale.set(s, s, s); m.position.set(p.x + R(-.3, .3), p.y + R(.4, 1.8), p.z + R(-.3, .3)); m.castShadow = true;
    scene.add(m);
    fx.push({ o: m, life: 1.8, max: 1.8, kind: 'shard', v: new THREE.Vector3(R(-4, 4), R(3, 8), R(-4, 4)), spin: new THREE.Vector3(R(-9, 9), R(-9, 9), R(-9, 9)), s, sc: scene });
  }
  const ring = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: .85, depthWrite: false }));
  ring.position.set(p.x, p.y + 1.1, p.z); scene.add(ring);
  fx.push({ o: ring, life: .4, max: .4, kind: 'puff', size: 1.8, rise: 0, sc: scene });
  puff(new THREE.Vector3(p.x, p.y + 1, p.z), 0x5c6064, 1.4, 1.6, 1.2);
}
function updateFx(dt) {
  updateFallen(dt);
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt; const k = 1 - f.life / f.max;
    if (f.kind === 'line') f.o.material.opacity = .9 * (1 - k);
    else if (f.kind === 'puff') { f.o.scale.setScalar(f.size * (0.3 + k)); f.o.material.opacity = .8 * (1 - k); if (f.rise) f.o.position.y += f.rise * dt; }
    else if (f.kind === 'spark') { f.v.y -= 20 * dt; f.o.position.addScaledVector(f.v, dt); }
    else if (f.kind === 'shell') { f.v.y -= 6 * dt; f.o.position.addScaledVector(f.v, dt); f.o.rotation.x += f.spin * dt; }
    else if (f.kind === 'shard') {
      f.v.y -= 18 * dt; f.o.position.addScaledVector(f.v, dt);
      const g = heightAt(f.o.position.x, f.o.position.z);
      if (f.o.position.y < g + f.s / 2) { f.o.position.y = g + f.s / 2; f.v.y *= -0.3; f.v.x *= .6; f.v.z *= .6; f.spin.multiplyScalar(.6); }
      f.o.rotation.x += f.spin.x * dt; f.o.rotation.y += f.spin.y * dt; f.o.rotation.z += f.spin.z * dt;
      if (f.life < .4) f.o.scale.setScalar(f.s * f.life / .4);
    }
    if (f.life <= 0) { f.sc.remove(f.o); if (f.kind === 'line') f.o.geometry.dispose(); if (f.kind === 'line' || f.kind === 'puff') f.o.material.dispose(); fx.splice(i, 1); }
  }
}
function clearFx() { fx.forEach(f => f.sc.remove(f.o)); fx.length = 0; clearHoles(); clearFallen(); }

/* ---------- teams ---------- */
const TEAM = [
  { name: 'Orange', css: '#ff9a3c', hex: 0xff9a3c }, { name: 'Blue', css: '#4fa3ff', hex: 0x4fa3ff },
  { name: 'Green', css: '#6fd58a', hex: 0x6fd58a }, { name: 'Purple', css: '#b47dff', hex: 0xb47dff },
  { name: 'Red', css: '#ff5c5c', hex: 0xff5c5c }, { name: 'Yellow', css: '#ffd447', hex: 0xffd447 },
  { name: 'Cyan', css: '#3fd8e0', hex: 0x3fd8e0 }, { name: 'Pink', css: '#ff7ac8', hex: 0xff7ac8 },
];
const teamCss = t => (TEAM[t % TEAM.length] || TEAM[0]).css;
const teamHex = t => (TEAM[t % TEAM.length] || TEAM[0]).hex;

/* ---------- the soldier body ----------
   Each body part is a handful of shapes merged into one mesh with the colours
   baked into its vertices, and shared by every soldier dressed the same, so a
   swarm of 120 costs 7 draw calls a head rather than 30. */
const UNIFORMS = [0x5d6347, 0x8c7d5c, 0x5a6058, 0x4b5563, 0x6b5f4a, 0x3f4a3c];
const SKINS_TONE = [0xe8bf9c, 0xd09a74, 0xa8714c, 0x7a4e30, 0x5a3a24];
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _bp = new THREE.Vector3(), _by = new THREE.Vector3(0, 1, 0);
function mergeColored(list) {
  let n = 0; const gs = [];
  for (const it of list) { const g = it.geo.index ? it.geo.toNonIndexed() : it.geo.clone(); g.applyMatrix4(it.m); gs.push([g, new THREE.Color(it.col)]); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const [g, c] of gs) {
    const p = g.attributes.position, q = g.attributes.normal;
    for (let i = 0; i < p.count; i++, o++) {
      pos[o * 3] = p.getX(i); pos[o * 3 + 1] = p.getY(i); pos[o * 3 + 2] = p.getZ(i);
      nor[o * 3] = q.getX(i); nor[o * 3 + 1] = q.getY(i); nor[o * 3 + 2] = q.getZ(i);
      col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}
// a small kit for describing a body part: boxes, spheres, and limbs strung between two points
function kit() {
  const L = [];
  const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(_bp.set(x, y, z), _bq.setFromEuler(new THREE.Euler(rx, ry, rz)), _bs.set(sx, sy, sz));
  return {
    L,
    box(w, h, d, col, x, y, z, rx = 0, ry = 0, rz = 0) { L.push({ geo: new THREE.BoxGeometry(w, h, d), col, m: at(x, y, z, rx, ry, rz) }); },
    ball(r, col, x, y, z, sx = 1, sy = 1, sz = 1, seg = 10) { L.push({ geo: new THREE.SphereGeometry(r, seg, Math.max(6, seg - 3)), col, m: at(x, y, z, 0, 0, 0, sx, sy, sz) }); },
    cap(r, col, x, y, z, sx = 1, sy = 1, sz = 1) { L.push({ geo: new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), col, m: at(x, y, z, 0, 0, 0, sx, sy, sz) }); },
    cyl(r1, r2, h, col, x, y, z, rx = 0, ry = 0, rz = 0, seg = 8) { L.push({ geo: new THREE.CylinderGeometry(r1, r2, h, seg), col, m: at(x, y, z, rx, ry, rz) }); },
    limb(a, b, r1, r2, col, seg = 8) {
      const d = new THREE.Vector3().subVectors(b, a), len = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(_by, d.clone().normalize());
      L.push({ geo: new THREE.CylinderGeometry(r2, r1, len, seg), col, m: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), q, _bs.set(1, 1, 1)) });
    },
    done() { return mergeColored(L); },
  };
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mixHex = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
// What the soldier is carrying, in their hands. len/bar: body and barrel length; mag: style; optic: top
const BODY_GUN = {
  rifle: { len: .42, bar: .22, h: .07, mag: 'curved', optic: 'dot' },
  smg: { len: .3, bar: .1, h: .075, mag: 'straight', optic: 'dot' },
  dmr: { len: .48, bar: .34, h: .07, mag: 'box', optic: 'scope' },
  shotgun: { len: .4, bar: .3, h: .07, mag: 'tube', optic: 'none' },
  lmg: { len: .5, bar: .28, h: .09, mag: 'drum', optic: 'dot' },
};
const bodyCache = {};
function soldierGeo(uni, skin, team, lens, gunKind) {
  const key = [uni, skin, team, lens, gunKind].join('|');
  if (bodyCache[key]) return bodyCache[key];
  const vest = mixHex(uni, 0x2f3128, .45), gear = mixHex(uni, 0x1e201c, .62), dark = 0x22241f, metal = 0x2a2c2e, boot = 0x2b2620;
  const helmet = mixHex(uni, 0x4a4a3c, .3), glove = 0x2d2b27, skinD = mixHex(skin, 0x3a2418, .25);
  // torso: hips, shirt, plate carrier with pouches, pack, belt, neck
  const t = kit();
  t.box(.36, .2, .23, uni, 0, .99, 0);
  t.box(.4, .055, .26, dark, 0, 1.085, 0);
  t.box(.06, .06, .05, gear, .14, 1.085, .13);
  t.cyl(.2, .18, .5, uni, 0, 1.34, 0, 0, 0, 0, 10);
  t.box(.44, .38, .3, vest, 0, 1.37, .005);
  for (const x of [-.12, 0, .12]) { t.box(.1, .13, .06, gear, x, 1.26, .175); t.box(.1, .02, .065, dark, x, 1.33, .176); }
  t.box(.12, .08, .04, gear, -.13, 1.45, .17);
  t.box(.07, .04, .045, team, .13, 1.47, .168); // team patch
  t.box(.36, .42, .17, gear, 0, 1.37, -.23);
  t.box(.3, .1, .14, mixHex(gear, 0, .2), 0, 1.22, -.25);
  for (const x of [-.13, .13]) t.box(.05, .4, .03, dark, x, 1.38, -.16);
  t.box(.34, .06, .04, vest, 0, 1.56, .14);
  t.ball(.1, uni, .24, 1.53, 0, 1, .9, 1);
  t.ball(.1, uni, -.24, 1.53, 0, 1, .9, 1);
  t.cyl(.055, .06, .11, skin, 0, 1.62, .01);
  t.cyl(.07, .075, .06, uni, 0, 1.585, 0, 0, 0, 0, 10); // collar
  // head: face, nose, ears, eyes, helmet with a band in the team colour and goggles
  const h = kit();
  h.ball(.11, skin, 0, 0, 0, .88, 1.08, .98, 14);
  h.box(.035, .05, .04, skinD, 0, -.015, .1);
  h.box(.07, .02, .02, skinD, 0, -.06, .095); // mouth line
  for (const s of [-1, 1]) { h.box(.025, .045, .03, skinD, s * .098, -.005, 0); h.box(.026, .014, .01, 0x1a1a1a, s * .04, .022, .1); h.box(.035, .008, .01, mixHex(skin, 0x201510, .6), s * .04, .042, .1); }
  h.cap(.138, helmet, 0, .035, -.005, 1, .95, 1.05);
  h.cyl(.142, .145, .022, helmet, 0, .035, -.005, 0, 0, 0, 14);
  h.cyl(.14, .14, .03, team, 0, .06, -.005, 0, 0, 0, 14);
  h.box(.17, .05, .04, dark, 0, .1, .11, -.35);
  h.box(.065, .03, .012, lens, -.04, .1, .132, -.35); h.box(.065, .03, .012, lens, .04, .1, .132, -.35);
  h.box(.06, .05, .04, gear, 0, .12, -.13);
  for (const s of [-1, 1]) h.box(.02, .07, .07, dark, s * .135, -.03, 0); // ear protection
  // arms and the gun, posed holding it at the shoulder
  const a = kit(), G_ = BODY_GUN[gunKind] || BODY_GUN.rifle;
  const gx = .1, gy = 1.42, gz0 = .02, gz1 = gz0 + G_.len, H = G_.h;
  a.box(.05, .1, .2, gear, gx, gy - .02, gz0 - .05);                 // stock
  a.box(.04, .03, .06, dark, gx, gy - .04, gz0 - .16);               // butt pad
  a.box(.055, H, G_.len * .55, metal, gx, gy, gz0 + G_.len * .3);    // receiver
  a.box(.06, H * .9, G_.len * .42, gear, gx, gy - .004, gz0 + G_.len * .78); // handguard
  a.cyl(.012, .012, G_.bar, 0x1d1e1f, gx, gy + .005, gz1 + G_.bar / 2, Math.PI / 2);
  a.box(.03, .075, .04, dark, gx, gy - .07, gz0 + .1, -.3);          // grip
  if (G_.mag === 'curved') a.box(.04, .15, .065, dark, gx, gy - .1, gz0 + G_.len * .46, .25);
  else if (G_.mag === 'straight') a.box(.035, .17, .045, dark, gx, gy - .11, gz0 + G_.len * .42);
  else if (G_.mag === 'box') a.box(.04, .1, .07, dark, gx, gy - .075, gz0 + G_.len * .45);
  else if (G_.mag === 'drum') { a.cyl(.07, .07, .06, dark, gx, gy - .09, gz0 + G_.len * .42, 0, 0, Math.PI / 2, 12); }
  else if (G_.mag === 'tube') a.cyl(.016, .016, G_.bar + .1, dark, gx, gy - .035, gz1 + G_.bar / 2 - .08, Math.PI / 2);
  if (G_.optic === 'dot') a.box(.035, .045, .07, dark, gx, gy + H / 2 + .022, gz0 + G_.len * .35);
  else if (G_.optic === 'scope') { a.cyl(.022, .022, .22, dark, gx, gy + H / 2 + .035, gz0 + G_.len * .35, Math.PI / 2, 0, 0, 10); a.cyl(.03, .024, .05, dark, gx, gy + H / 2 + .035, gz0 + G_.len * .35 + .12, Math.PI / 2, 0, 0, 10); }
  // the right hand on the grip, the left on the handguard
  const rS = V3(.24, 1.5, -.01), rE = V3(.27, 1.27, .03), rH = V3(gx + .015, gy - .06, gz0 + .1);
  const lS = V3(-.24, 1.5, -.01), lE = V3(-.2, 1.3, .25), lH = V3(gx - .03, gy - .045, gz0 + G_.len * .78);
  for (const [S, E, Hd] of [[rS, rE, rH], [lS, lE, lH]]) {
    a.limb(S, E, .068, .058, uni);
    a.limb(S.clone().lerp(E, .3), S.clone().lerp(E, .5), .072, .07, team); // armband
    a.ball(.058, uni, E.x, E.y, E.z);
    a.limb(E, Hd.clone().lerp(E, .15), .056, .045, uni);
    a.ball(.046, glove, Hd.x, Hd.y, Hd.z, 1, .9, 1.25);
  }
  // legs, hinged at the hip and the knee
  const th = kit();
  th.limb(V3(0, 0, 0), V3(0, -.45, .01), .085, .068, uni);
  th.box(.05, .1, .1, gear, .085, -.24, 0); // thigh pocket
  const sh = kit();
  sh.limb(V3(0, 0, 0), V3(0, -.36, -.01), .066, .055, uni);
  sh.box(.11, .1, .05, dark, 0, -.05, .06); // knee pad
  sh.box(.12, .13, .14, boot, 0, -.4, .005);
  sh.box(.12, .07, .26, boot, 0, -.445, .05);
  sh.box(.125, .025, .27, 0x161412, 0, -.475, .05);
  return (bodyCache[key] = { torso: t.done(), head: h.done(), arms: a.done(), thigh: th.done(), shin: sh.done(), mz: gz1 + G_.bar + .01, my: gy + .005, mx: gx });
}
// tag: what a bullet hitting this part reports. Parts go into world.shootables.
// bodyCol: the uniform. visorCol: the goggle lenses (red-orange for enemies). bandCol: helmet band, armbands, patch.
function buildRobot(bodyCol, visorCol, tag, bandCol, opt = {}) {
  const uni = UNIFORMS.includes(bodyCol) ? bodyCol : UNIFORMS[(opt.look || 0) % UNIFORMS.length];
  const skin = SKINS_TONE[(opt.skin != null ? opt.skin : (Math.random() * SKINS_TONE.length) | 0) % SKINS_TONE.length];
  const geo = soldierGeo(uni, skin, bandCol != null ? bandCol : 0x888888, visorCol, opt.gun || 'rifle');
  const g = new THREE.Group();
  const mb = new THREE.MeshLambertMaterial({ vertexColors: true });
  const parts = [];
  const part = (geometry, p, parent, x = 0, y = 0, z = 0) => {
    const me = new THREE.Mesh(geometry, mb); me.position.set(x, y, z); me.castShadow = true;
    me.userData = Object.assign({ part: p }, tag); parts.push(me); parent.add(me); return me;
  };
  const upper = new THREE.Group(); g.add(upper);
  part(geo.torso, 'body', upper);
  part(geo.arms, 'body', upper);
  const head = part(geo.head, 'head', upper, 0, 1.72, 0);
  const legs = [], knees = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * .1, .95, 0); g.add(hip);
    part(geo.thigh, 'body', hip);
    const knee = new THREE.Group(); knee.position.set(0, -.45, .01); hip.add(knee);
    part(geo.shin, 'body', knee);
    legs.push(hip); knees.push(knee);
  }
  scene.add(g);
  return { group: g, upper, parts, legs, knees, head, mb, md: mb, mv: mb, walk: 0, muzzle: new THREE.Vector3(geo.mx, geo.my, geo.mz) };
}
function disposeRobot(rb) {
  scene.remove(rb.group);
  const set = new Set(rb.parts);
  world.shootables = world.shootables.filter(o => !set.has(o));
  rb.mb.dispose();
}
function animateRobot(rb, moved, dt) {
  rb.walk += moved * 2.6;
  const a = Math.min(1, moved / Math.max(dt * 2, 1e-4) * 0.6 + 0.05), sw = Math.sin(rb.walk) * a;
  rb.legs[0].rotation.x = sw * .55; rb.legs[1].rotation.x = -sw * .55;
  rb.knees[0].rotation.x = (Math.max(0, Math.sin(rb.walk + 1.4)) * 1.0 + .05) * a;
  rb.knees[1].rotation.x = (Math.max(0, Math.sin(rb.walk + 1.4 + Math.PI)) * 1.0 + .05) * a;
  rb.upper.rotation.y = sw * .06; rb.upper.rotation.x = .05 * a;
  return Math.abs(Math.sin(rb.walk)) * .04 * a - .02 * a;
}
// Knocked out: tip over, lie there a moment, then sink away. Nothing gory.
const fallen = [];
function fallDown(rb) {
  const set = new Set(rb.parts);
  world.shootables = world.shootables.filter(o => !set.has(o));
  rb.group.rotation.order = 'YXZ';
  fallen.push({ rb, t: 0, dir: Math.random() < .5 ? 1 : -1, side: R(-.4, .4), y0: rb.group.position.y, dust: false });
  while (fallen.length > 30) { const f = fallen.shift(); disposeRobot(f.rb); }
}
function updateFallen(dt) {
  for (let i = fallen.length - 1; i >= 0; i--) {
    const f = fallen[i], g = f.rb.group; f.t += dt;
    const k = Math.min(1, f.t / .55), e = k * k;
    g.rotation.x = f.dir * e * 1.5; g.rotation.z = f.side * e;
    f.rb.knees[0].rotation.x = f.rb.knees[1].rotation.x = (f.dir < 0 ? .9 : .3) * Math.min(1, f.t / .3);
    g.position.y = f.y0 + (f.t > 3.5 ? -(f.t - 3.5) * .5 : 0) + e * .12;
    if (!f.dust && k >= 1) { f.dust = true; if (g.visible) puff(new THREE.Vector3(g.position.x + Math.sin(g.rotation.y) * f.dir * 1.2, g.position.y + .2, g.position.z + Math.cos(g.rotation.y) * f.dir * 1.2), 0x9a9080, 1.2, 1.2, .3); }
    if (f.t > 5) { disposeRobot(f.rb); fallen.splice(i, 1); }
  }
}
function clearFallen() { fallen.forEach(f => disposeRobot(f.rb)); fallen.length = 0; }
function makeNameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '600 34px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.6)'; x.strokeText(text, 128, 34);
  x.fillStyle = color; x.fillText(text, 128, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(2.2, .55, 1); sp.position.y = 2.65; sp.renderOrder = 5;
  return sp;
}
function disposeTag(t) { if (t) { t.material.map.dispose(); t.material.dispose(); } }

/* ---------- bots ---------- */
// The player shows up to the bots as this; P is the real state.
const PL = { isPlayer: true, name: 'You', team: 0 };
const DIFF = { easy: { name: 'Recruit', acc: 0.62, react: 1.3 }, normal: { name: 'Regular', acc: 0.85, react: 1 }, hard: { name: 'Veteran', acc: 1.12, react: 0.72 } };
// What a bot is carrying. dmg is per hit on a player; bot-on-bot hits do a bit more so their fights end.
const BOT_GUNS = {
  rifle: { snd: 'rifle', dmg: [7, 10], burst: [3, 6], gap: .11, cool: [0.9, 2.0], range: 125, best: [14, 40] },
  smg: { snd: 'smg', dmg: [5, 7], burst: [5, 9], gap: .07, cool: [0.8, 1.6], range: 70, best: [5, 18] },
  dmr: { snd: 'br', dmg: [15, 21], burst: [1, 2], gap: .42, cool: [1.2, 2.2], range: 175, best: [30, 80] },
  shotgun: { snd: 'sg', dmg: [20, 32], burst: [1, 1], gap: .6, cool: [0.9, 1.4], range: 26, best: [3, 9] },
  lmg: { snd: 'lmg', dmg: [6, 9], burst: [7, 12], gap: .09, cool: [1.4, 2.4], range: 135, best: [15, 45] },
};
const BOT_GUN_IDS = Object.keys(BOT_GUNS);
const GUN_TO_BOT = { vk7: 'rifle', talon: 'rifle', hammer: 'dmr', ranger: 'dmr', kestrel: 'dmr', longshot: 'dmr', hornet: 'smg', wasp: 'smg', stinger: 'smg',
  bulwark: 'lmg', tempest: 'lmg', raptor: 'rifle', saber: 'smg', specter: 'dmr', warden: 'dmr', twin: 'shotgun', ripper: 'lmg', breacher: 'shotgun', mamba: 'shotgun', viper: 'smg', brute: 'dmr' };
const CALLSIGNS = ['Bravo', 'Kilo', 'Ghost', 'Echo', 'Atlas', 'Rook', 'Viking', 'Nomad', 'Sierra', 'Tango', 'Hawk', 'Jinx'];
let bots = [];
let botSerial = 1;
const tPos = t => t.isPlayer ? P.pos : t.pos;
const tFeet = t => t.isPlayer ? P.feet : t.feet;
const tAlive = t => t.isPlayer ? P.alive && G.playing : !t.dead;
const tHead = t => t.isPlayer ? P.feet + P.eye - 0.2 : t.feet + 1.8;
class Bot {
  constructor(x, z, team, opt = {}) {
    this.team = team; this.ally = !!opt.ally; this.kind = 'bot';
    this.name = opt.name || ('UNIT-' + String(botSerial++).padStart(2, '0'));
    this.gun = BOT_GUNS[opt.gun] ? opt.gun : BOT_GUN_IDS[(Math.random() * BOT_GUN_IDS.length) | 0];
    this.k = 0; this.d = 0;
    this.pos = new THREE.Vector3(); this.goal = new THREE.Vector3(); this.lastKnown = new THREE.Vector3();
    this.spawn(x, z, opt.drop);
  }
  spawn(x, z, drop) {
    this.pos.set(x, 0, z);
    const g = groundAt(x, z, 999);
    this.feet = drop ? g + drop : g; this.dropping = !!drop; this.vy = 0;
    this.yaw = R(0, 6.28); this.hp = 100; this.armor = 0; this.dead = false;
    this.newGoal(); this.goalTimer = R(4, 9);
    this.scanT = R(0, .3); this.canSee = false; this.target = null; this.seenFor = 0; this.alert = 0;
    this.cool = R(.5, 1.5); this.burst = 0; this.strafe = Math.random() < .5 ? 1 : -1; this.strafeT = R(.6, 1.6); this.reaction = R(.4, .85);
    this.push = 0; this.retreat = 0; this.jumpT = R(2, 5);
    this.lastFired = -99; this.flash = 0; this.stuck = 0; this.crateT = R(0, 2);
    const visor = this.ally ? 0x8fd0ff : 0xff6a3c;
    this.look = this.look != null ? this.look : (Math.random() * 1e6) | 0;
    this.rb = buildRobot(-1, visor, { bot: this }, teamHex(this.team), { look: this.look, skin: (this.look >> 3) % 5, gun: this.gun });
    world.shootables.push(...this.rb.parts);
    if (this.ally) { this.tag = makeNameTag(this.name, teamCss(this.team)); this.rb.group.add(this.tag); }
    this.rb.group.position.set(this.pos.x, this.feet, this.pos.z);
  }
  newGoal() {
    const M = G.rules || {};
    if (M.kind === 'br') {
      if (Math.random() < 0.4) { const c = nearestCrate(this.pos, 60, true); if (c) { this.goal.set(c.x, 0, c.z); return; } }
      const a = R(0, 6.28), r = Math.sqrt(Math.random()) * Math.max(8, Z.r * 0.75);
      this.goal.set(Z.cx + Math.cos(a) * r, 0, Z.cz + Math.sin(a) * r); return;
    }
    const H = world.half * 0.85;
    if (M.kind === 'tdm' && Math.random() < 0.6) {
      const pts = world.spawns[1 - (this.team % 2)], p = pts[(Math.random() * pts.length) | 0];
      this.goal.set(p[0] * R(0.2, 0.9), 0, p[1] * R(0.2, 1)); return;
    }
    this.goal.set(R(-H, H), 0, R(-H, H));
  }
  hear(from) { if (this.dead) return; this.alert = Math.max(this.alert, 4); this.lastKnown.copy(from); }
  muzzle() { return _v.copy(this.rb.muzzle).applyMatrix4(this.rb.group.matrixWorld).clone(); }
  scan() {
    const range = BOT_GUNS[this.gun].range * 1.15 + 20;
    let best = [];
    const consider = (t) => {
      if (!tAlive(t) || t.team === this.team) return;
      const p = tPos(t), d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (d > (t.isPlayer && P.crouch ? range * 0.75 : range)) return;
      best.push([d, t]);
    };
    consider(PL);
    for (const b of bots) if (b !== this) consider(b);
    best.sort((a, b) => a[0] - b[0]);
    this.canSee = false;
    for (let i = 0; i < Math.min(3, best.length); i++) {
      const [d, t] = best[i], p = tPos(t);
      const fdot = (Math.sin(this.yaw) * (p.x - this.pos.x) + Math.cos(this.yaw) * (p.z - this.pos.z)) / (d || 1);
      if (!(fdot > 0.05 || d < 14 || this.alert > 0 || t === this.target)) continue;
      if (hasLOS(_a.set(this.pos.x, this.feet + 1.85, this.pos.z), _b.set(p.x, tHead(t), p.z))) {
        if (this.target !== t) this.seenFor = Math.min(this.seenFor, this.reaction * 0.5);
        this.target = t; this.canSee = true; return;
      }
    }
  }
  update(dt) {
    const cd = Math.hypot(this.pos.x - camera.position.x, this.pos.z - camera.position.z);
    this.far = cd > 110;
    this.rb.group.visible = cd < scene.fog.far * 0.95;
    if (this.far && !this.dropping) { this.lodAcc = (this.lodAcc || 0) + dt; if (this.lodAcc < 0.075) return; dt = this.lodAcc; this.lodAcc = 0; }
    const diff = DIFF[G.diff] || DIFF.normal, gun = BOT_GUNS[this.gun];
    // parachute in
    if (this.dropping) {
      const mx = this.goal.x - this.pos.x, mz = this.goal.z - this.pos.z, ml = Math.hypot(mx, mz) || 1;
      this.pos.x += mx / ml * 5 * dt; this.pos.z += mz / ml * 5 * dt; resolve(this.pos, .5, this.feet, 2.1);
      this.feet -= 9 * dt;
      const g = groundAt(this.pos.x, this.pos.z, this.feet);
      if (this.feet <= g) { this.feet = g; this.dropping = false; }
      this.rb.group.position.set(this.pos.x, this.feet, this.pos.z); this.rb.group.rotation.y = this.yaw;
      return;
    }
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = R(.18, .32); this.scan(); }
    const t = this.target && tAlive(this.target) ? this.target : null;
    if (!t) { this.target = null; this.canSee = false; }
    let dx = 0, dz = 0, dist = 999;
    if (t) { const p = tPos(t); dx = p.x - this.pos.x; dz = p.z - this.pos.z; dist = Math.hypot(dx, dz) || 0.001; }
    if (this.canSee && t) { this.seenFor += dt; this.alert = 7; this.lastKnown.copy(tPos(t)); } else { this.seenFor = 0; this.alert -= dt; }
    let mx = 0, mz = 0, speed = 4.2, faceYaw = null;
    const br = G.rules && G.rules.kind === 'br';
    const zd = br ? Math.hypot(this.pos.x - Z.cx, this.pos.z - Z.cz) : 0;
    const lead = this.ally && P.alive ? P.pos : null;
    if (br && zd > Z.r - 4) { mx = Z.cx - this.pos.x; mz = Z.cz - this.pos.z; speed = 6.4; if (this.canSee) faceYaw = Math.atan2(dx, dz); }
    else if (this.canSee && t) {
      faceYaw = Math.atan2(dx, dz);
      const fx_ = dx / dist, fz_ = dz / dist;
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = R(.5, 1.6); if (Math.random() < 0.18) this.push = R(1, 2); }
      this.push -= dt; this.retreat -= dt;
      if (this.hp < 35 && this.retreat < -3 && Math.random() < dt) this.retreat = 1.6;
      let fwd = dist > gun.best[1] ? 1 : dist < gun.best[0] ? -1 : 0;
      if (this.push > 0) fwd = 1; if (this.retreat > 0) fwd = -1.3;
      mx = fx_ * fwd + -fz_ * this.strafe; mz = fz_ * fwd + fx_ * this.strafe;
      speed = this.retreat > 0 ? 6 : this.push > 0 ? 5.6 : 4.2;
      this.jumpT -= dt; if (this.jumpT <= 0) { this.jumpT = R(2.5, 6); if (this.vy === 0 && Math.random() < 0.5) this.vy = 6; }
    } else if (this.alert > 0) {
      mx = this.lastKnown.x - this.pos.x; mz = this.lastKnown.z - this.pos.z; speed = 6;
      if (Math.hypot(mx, mz) < 2.5) this.alert = 0;
    } else if (lead && Math.hypot(lead.x - this.pos.x, lead.z - this.pos.z) > 15) {
      mx = lead.x - this.pos.x; mz = lead.z - this.pos.z; speed = Math.hypot(mx, mz) > 30 ? 8.5 : 6.2;
    } else {
      if (lead && Math.hypot(this.goal.x - lead.x, this.goal.z - lead.z) > 14) { const a = R(0, 6.28); this.goal.set(lead.x + Math.cos(a) * R(4, 11), 0, lead.z + Math.sin(a) * R(4, 11)); }
      mx = this.goal.x - this.pos.x; mz = this.goal.z - this.pos.z; this.goalTimer -= dt;
      const gd = Math.hypot(mx, mz);
      speed = gd > 28 ? 6.4 : 4.4;
      if (gd < 2 || this.goalTimer < 0) { this.newGoal(); this.goalTimer = R(4, 10); }
    }
    if (inWater(this.pos.x, this.pos.z, this.feet)) speed *= 0.65;
    const ml = Math.hypot(mx, mz), ox = this.pos.x, oz = this.pos.z;
    if (ml > 0.01) { this.pos.x += mx / ml * speed * dt; this.pos.z += mz / ml * speed * dt; if (faceYaw === null) faceYaw = Math.atan2(mx, mz); }
    resolve(this.pos, .5, this.feet, 2.1);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    if (ml > 0.01 && moved < speed * dt * 0.25) {
      this.stuck += dt;
      if (this.stuck > 0.35 && this.vy === 0) this.vy = 6.2;
      if (this.stuck > 0.9) { this.newGoal(); this.strafe *= -1; this.stuck = 0; }
    } else this.stuck = 0;
    // gravity, so bots can jump and drop off roofs
    const g = groundAt(this.pos.x, this.pos.z, this.feet);
    this.vy -= 18 * dt; this.feet += this.vy * dt;
    if (this.feet <= g) { this.feet = g; this.vy = 0; }
    else if (this.vy <= 0 && this.feet - g < 0.45) { this.feet = g; this.vy = 0; }
    if (faceYaw !== null) { let d = faceYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * (this.canSee ? 9 : 5)); }
    const bob = this.far ? 0 : animateRobot(this.rb, moved, dt);
    this.rb.group.position.set(this.pos.x, this.feet + bob, this.pos.z);
    this.rb.group.rotation.y = this.yaw;
    if (this.flash > 0) { this.flash -= dt; const e = Math.max(0, this.flash / .12); this.rb.mb.emissive.setRGB(e, e, e); this.rb.md.emissive.setRGB(e * .8, e * .8, e * .8); }
    if (br && zd > Z.r) this.damage(zoneDps() * dt, false, 'zone');
    // open crates it walks past
    if (br) { this.crateT -= dt; if (this.crateT <= 0) { this.crateT = 0.6; const c = nearestCrate(this.pos, 2.6, true); if (c && !this.dead) botOpenCrate(this, c); } }
    // shooting
    this.cool -= dt;
    if (this.canSee && t && this.seenFor > this.reaction * diff.react && this.cool <= 0 && dist < gun.range) {
      if (this.burst <= 0) this.burst = gun.burst[0] + ((Math.random() * (gun.burst[1] - gun.burst[0] + 1)) | 0);
      this.fire(t, dist, diff);
      this.burst--; this.cool = this.burst > 0 ? gun.gap : R(gun.cool[0], gun.cool[1]);
    }
  }
  fire(t, dist, diff) {
    const gun = BOT_GUNS[this.gun];
    this.lastFired = G.time;
    const m = this.muzzle(), p = tPos(t);
    const target = new THREE.Vector3(p.x, tHead(t) - 0.4, p.z);
    let chance = clamp(0.62 - dist / 160, 0.07, 0.62) * diff.acc;
    if (gun.snd === 'sg') chance = dist < gun.best[1] ? 0.8 : 0.35;
    const dmg = R(gun.dmg[0], gun.dmg[1]) * (gun.snd === 'sg' ? clamp(1.4 - dist / 20, 0.3, 1) : 1);
    if (t.isPlayer) {
      const speedH = Math.hypot(P.vel.x, P.vel.z);
      if (P.sprint) chance *= .55; else if (speedH > 1) chance *= .8;
      if (P.crouch) chance *= .8;
      if (!P.onGround) chance *= .7;
      if (Math.random() < chance) hurt(dmg, this.pos, this);
      else { target.x += R(-1.6, 1.6); target.y += R(-1, 1.2); target.z += R(-1.6, 1.6); if (dist > 6) sndWhiz(); }
    } else {
      if (Math.random() < chance * 0.9) t.damage(dmg * 1.7, Math.random() < 0.12, this);
      else { target.x += R(-1.6, 1.6); target.y += R(-1, 1.2); target.z += R(-1.6, 1.6); }
    }
    const heard = m.distanceTo(camera.position);
    if (heard < 220) tracer(m, target, true);
    if (heard < 180 || t.isPlayer) sndShot(gun.snd, heard);
  }
  damage(n, head, src) {
    if (this.dead) return false;
    if (this.armor > 0 && src !== 'zone') { const ab = Math.min(this.armor, n * 0.6); this.armor -= ab; n -= ab; }
    this.hp -= n;
    if (src && src !== 'zone') {
      this.flash = .12; this.alert = 7;
      this.lastKnown.copy(tPos(src));
      if (!this.canSee || !this.target) { this.target = src; this.seenFor = Math.max(this.seenFor, this.reaction * .6); }
    }
    if (this.hp <= 0) { this.die(head, src); return true; }
    return false;
  }
  die(head, src) {
    this.dead = true; this.d++;
    knockout(this.pos.clone().setY(this.feet));
    if (this.tag) this.rb.group.remove(this.tag);
    disposeTag(this.tag); this.tag = null;
    fallDown(this.rb);
    onBotKilled(this, src, head);
  }
  remove() { if (!this.dead) { disposeTag(this.tag); disposeRobot(this.rb); } this.dead = true; }
}

/* ---------- crates ---------- */
let crates = [], groundGuns = [];
const crateGeo = { body: new THREE.BoxGeometry(1.15, .62, .78), lid: new THREE.BoxGeometry(1.2, .12, .82), band: new THREE.BoxGeometry(1.17, .1, .8), beam: new THREE.CylinderGeometry(.18, .18, 40, 8, 1, true) };
function clearCrates() {
  for (const c of crates) { scene.remove(c.g); if (c.beam) scene.remove(c.beam); }
  const meshes = new Set(crates.flatMap(c => c.meshes));
  world.shootables = world.shootables.filter(o => !meshes.has(o));
  world.boxes = world.boxes.filter(b => !b.crate);
  crates = [];
  for (const gg of groundGuns) disposeGunModel(gg.m);
  groundGuns = [];
}
function spawnCrates(seed) {
  clearCrates();
  const r = mulberry(seed >>> 0);
  world.cratePts.forEach(([x, z], i) => {
    const tier = rollTier(r), loot = randomGun(r, tier), y = groundAt(x, z, 999), yaw = r() * 3;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
    const body = new THREE.Mesh(crateGeo.body, pm(0x4f5a3a)); body.position.y = .31;
    const band = new THREE.Mesh(crateGeo.band, new THREE.MeshBasicMaterial({ color: TIERS[tier].hex })); band.position.y = .42;
    const hinge = new THREE.Group(); hinge.position.set(0, .62, -.41);
    const lid = new THREE.Mesh(crateGeo.lid, pm(0x5d6a44)); lid.position.set(0, .06, .41); hinge.add(lid);
    g.add(body, band, hinge);
    [body, lid].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    scene.add(g);
    let beam = null;
    if (tier >= 2) {
      beam = new THREE.Mesh(crateGeo.beam, new THREE.MeshBasicMaterial({ color: TIERS[tier].hex, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beam.position.set(x, y + 20, z); scene.add(beam);
    }
    const b = { minX: x - .6, maxX: x + .6, minZ: z - .6, maxZ: z + .6, minY: y - .1, maxY: y + .68, crate: true };
    b.box3 = new THREE.Box3(new THREE.Vector3(b.minX, b.minY, b.minZ), new THREE.Vector3(b.maxX, b.maxY, b.maxZ));
    world.boxes.push(b);
    const meshes = [body, lid];
    world.shootables.push(...meshes);
    crates.push({ i, x, z, y, tier, loot, armor: tier >= 1 ? 50 : 25, open: false, openT: 0, g, hinge, band, beam, meshes });
  });
}
function nearestCrate(pos, maxD, closedOnly) {
  let best = null, bd = maxD;
  for (const c of crates) { if (closedOnly && c.open) continue; const d = Math.hypot(c.x - pos.x, c.z - pos.z); if (d < bd) { bd = d; best = c; } }
  return best;
}
// who: 'me' (this player gets the loot), a Bot, or 'other' (someone else online)
function openCrate(c, who) {
  if (c.open) return;
  c.open = true;
  if (c.beam) { scene.remove(c.beam); c.beam = null; }
  c.band.material.color.setHex(0x3a3f44);
  if (Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 40) sndCrate();
  if (who === 'me') {
    guns.forEach(g => g.reserveLeft = Math.min(g.s.reserve * 2, g.reserveLeft + g.s.mag * 2));
    const br = G.rules && G.rules.kind === 'br', np = Math.max(0, Math.min(MAX_PLATES - P.plates, c.tier >= 1 ? 3 : 2));
    if (br) P.plates += np;
    const T = TIERS[c.tier];
    toast(`+ AMMO${br && np > 0 ? ` · + ${np} PLATE${np > 1 ? 'S' : ''}` : ''} · ${T.name.toUpperCase()} ${GUNS[c.loot.id].name.toUpperCase()} INSIDE`);
    dropGun(c.loot, c.x + Math.sin(c.g.rotation.y) * .1, c.y + .9, c.z, true);
  } else if (who && who.kind === 'bot') {
    who.armor = Math.min(100, who.armor + c.armor);
    if (c.tier >= 1) who.gun = GUN_TO_BOT[c.loot.id] || who.gun;
  }
}
function botOpenCrate(b, c) { if (G.mode === 'bots') openCrate(c, b); }
function dropGun(item, x, y, z, fromCrate) {
  const m = makeGunModel(item.id, item.att, item.skin, true);
  m.group.position.set(x, y, z);
  groundGuns.push({ ...item, x, y, z, m, t: R(0, 6), crate: !!fromCrate });
}
function updateCrates(dt) {
  for (const c of crates) if (c.open && c.openT < 1) { c.openT = Math.min(1, c.openT + dt * 3); c.hinge.rotation.x = -1.9 * c.openT * (2 - c.openT); }
  for (const gg of groundGuns) { gg.t += dt; gg.m.group.position.y = gg.y + Math.sin(gg.t * 2) * .06; gg.m.group.rotation.y += dt * 0.9; }
}

/* ---------- small loot dropped by bots ---------- */
let loot = [];
const lootGeo = { ammo: new THREE.BoxGeometry(.55, .32, .38), lid: new THREE.BoxGeometry(.57, .06, .4), plate: new THREE.BoxGeometry(.45, .58, .08), inner: new THREE.BoxGeometry(.3, .4, .1) };
function spawnLoot(type, x, z) {
  const g = new THREE.Group();
  if (type === 'ammo') { const a = new THREE.Mesh(lootGeo.ammo, pm(0x55603d)); const l = new THREE.Mesh(lootGeo.lid, pm(0xffb547)); l.position.y = .12; g.add(a, l); }
  else { g.add(new THREE.Mesh(lootGeo.plate, pm(0x5d8fc2)), new THREE.Mesh(lootGeo.inner, pm(0x9ccbf5))); }
  g.children.forEach(c => c.castShadow = true);
  const y = groundAt(x, z, 999);
  g.position.set(x, y + .5, z); scene.add(g);
  loot.push({ type, g, x, z, y, t: R(0, 6) });
}
function clearLoot() { loot.forEach(l => scene.remove(l.g)); loot = []; }
function updateLoot(dt) {
  for (let i = loot.length - 1; i >= 0; i--) {
    const L = loot[i]; L.t += dt;
    L.g.position.y = L.y + .55 + Math.sin(L.t * 2.2) * .1; L.g.rotation.y += dt * 1.4;
    if (P.alive && Math.hypot(P.pos.x - L.x, P.pos.z - L.z) < 1.5 && Math.abs(P.feet - L.y) < 2) {
      if (L.type === 'ammo') { guns.forEach(g => g.reserveLeft = Math.min(g.s.reserve * 2, g.reserveLeft + g.s.mag)); toast('+ AMMO'); }
      else { if (P.plates >= MAX_PLATES) continue; P.plates++; toast('+ ARMOR PLATE'); }
      beep(660, .08, .1, 'sine'); beep(990, .1, .08, 'sine', .07);
      scene.remove(L.g); loot.splice(i, 1);
    }
  }
}
