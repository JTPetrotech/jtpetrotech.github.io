/* Effects, collision, the robot body (used for bots and for online players),
   solo bots and loot. */

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
    if (feetY >= c.top - 0.02) continue;
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
const _ray = new THREE.Ray(), _hitV = new THREE.Vector3();
function hasLOS(a, b) {
  const len = a.distanceTo(b);
  _ray.origin.copy(a); _ray.direction.copy(b).sub(a).normalize();
  for (const bx of world.boxes) { if (_ray.intersectBox(bx.box3, _hitV) && a.distanceTo(_hitV) < len - 0.3) return false; }
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
const tracerMatOther = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 });
function tracer(a, b, other) {
  const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const l = new THREE.Line(geo, (other ? tracerMatOther : tracerMat).clone()); scene.add(l);
  fx.push({ o: l, life: .07, max: .07, kind: 'line' });
}
const puffGeo = new THREE.IcosahedronGeometry(1, 0);
function puff(p, color = 0xd9d3c4, size = .35) {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false }));
  m.position.copy(p); m.scale.setScalar(size * 0.3); scene.add(m);
  fx.push({ o: m, life: .35, max: .35, kind: 'puff', size });
}
const shardGeo = new THREE.BoxGeometry(1, 1, 1);
function scrapBurst(p, accent = 0xffb547, body = 0x6b7680) {
  const cols = [body, 0x2e3439, accent, 0x9aa4ad];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(shardGeo, pm(cols[i % 4]));
    const s = R(.08, .26); m.scale.set(s, s, s); m.position.set(p.x + R(-.3, .3), p.y + R(.4, 1.8), p.z + R(-.3, .3)); m.castShadow = true;
    scene.add(m);
    fx.push({ o: m, life: 1.8, max: 1.8, kind: 'shard', v: new THREE.Vector3(R(-4, 4), R(3, 8), R(-4, 4)), spin: new THREE.Vector3(R(-9, 9), R(-9, 9), R(-9, 9)), s });
  }
  const ring = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: .85, depthWrite: false }));
  ring.position.set(p.x, p.y + 1.1, p.z); scene.add(ring);
  fx.push({ o: ring, life: .4, max: .4, kind: 'puff', size: 1.8 });
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt; const k = 1 - f.life / f.max;
    if (f.kind === 'line') f.o.material.opacity = .9 * (1 - k);
    else if (f.kind === 'puff') { f.o.scale.setScalar(f.size * (0.3 + k)); f.o.material.opacity = .8 * (1 - k); }
    else if (f.kind === 'shard') {
      f.v.y -= 18 * dt; f.o.position.addScaledVector(f.v, dt);
      const g = heightAt(f.o.position.x, f.o.position.z);
      if (f.o.position.y < g + f.s / 2) { f.o.position.y = g + f.s / 2; f.v.y *= -0.3; f.v.x *= .6; f.v.z *= .6; f.spin.multiplyScalar(.6); }
      f.o.rotation.x += f.spin.x * dt; f.o.rotation.y += f.spin.y * dt; f.o.rotation.z += f.spin.z * dt;
      if (f.life < .4) f.o.scale.setScalar(f.s * f.life / .4);
    }
    if (f.life <= 0) { scene.remove(f.o); if (f.kind === 'line') f.o.geometry.dispose(); if (f.kind !== 'shard') f.o.material.dispose(); fx.splice(i, 1); }
  }
}
function clearFx() { fx.forEach(f => scene.remove(f.o)); fx.length = 0; }

/* ---------- the robot body ---------- */
const robotGeo = { torso: new THREE.BoxGeometry(.8, .9, .5), pelvis: new THREE.BoxGeometry(.6, .25, .4), leg: new THREE.BoxGeometry(.24, .62, .27),
  head: new THREE.BoxGeometry(.46, .38, .42), visor: new THREE.BoxGeometry(.36, .09, .04), arm: new THREE.BoxGeometry(.18, .62, .2),
  gun: new THREE.BoxGeometry(.09, .12, .6), ant: new THREE.BoxGeometry(.03, .25, .03), pack: new THREE.BoxGeometry(.55, .55, .22), band: new THREE.BoxGeometry(.82, .12, .52) };
// tag: what a bullet hitting this part reports. Parts go into world.shootables.
function buildRobot(bodyCol, visorCol, tag, bandCol) {
  const g = new THREE.Group();
  const mb = new THREE.MeshPhongMaterial({ color: bodyCol, flatShading: true, shininess: 12 });
  const md = new THREE.MeshPhongMaterial({ color: 0x2e3439, flatShading: true });
  const mv = new THREE.MeshBasicMaterial({ color: visorCol });
  const parts = [];
  const part = (geo, m, x, y, z, p, parent = g) => {
    const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true;
    if (p) { me.userData = Object.assign({ part: p }, tag); parts.push(me); }
    parent.add(me); return me;
  };
  part(robotGeo.torso, mb, 0, 1.2, 0, 'body');
  part(robotGeo.pack, md, 0, 1.25, -.34, 'body');
  part(robotGeo.pelvis, md, 0, .72, 0, 'body');
  if (bandCol != null) part(robotGeo.band, new THREE.MeshBasicMaterial({ color: bandCol }), 0, 1.42, 0, 'body');
  const head = part(robotGeo.head, mb, 0, 1.86, 0, 'head');
  part(robotGeo.visor, mv, 0, 1.88, .215, 'head');
  part(robotGeo.ant, md, .14, 2.15, -.08, null);
  const legs = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * .17, .66, 0); g.add(pivot);
    const leg = part(robotGeo.leg, md, 0, -.31, 0, 'body', pivot);
    legs.push(pivot);
  }
  part(robotGeo.arm, mb, -.5, 1.2, .1, 'body');
  part(robotGeo.arm, mb, .5, 1.2, .1, 'body').rotation.x = -1.1;
  part(robotGeo.gun, md, .42, 1.25, .45, 'body');
  scene.add(g);
  return { group: g, parts, legs, head, mb, md, mv, walk: 0 };
}
function disposeRobot(rb) {
  scene.remove(rb.group);
  const set = new Set(rb.parts);
  world.shootables = world.shootables.filter(o => !set.has(o));
  rb.mb.dispose(); rb.md.dispose(); rb.mv.dispose();
}
function animateRobot(rb, moved, dt) {
  rb.walk += moved * 3.2;
  const sw = Math.sin(rb.walk) * Math.min(1, moved / Math.max(dt * 2, 1e-4) * 0.6 + 0.1);
  rb.legs[0].rotation.x = sw * .6; rb.legs[1].rotation.x = -sw * .6;
  return Math.abs(Math.sin(rb.walk)) * .04;
}

/* ---------- solo bots ---------- */
let bots = [];
let botSerial = 1;
class Bot {
  constructor(x, z) {
    this.name = 'UNIT-' + String(botSerial++).padStart(2, '0');
    this.pos = new THREE.Vector3(x, heightAt(x, z), z);
    this.feet = this.pos.y; this.yaw = R(0, 6.28); this.hp = 100; this.dead = false;
    this.goal = new THREE.Vector3(); this.newGoal(); this.goalTimer = R(4, 9);
    this.losTimer = R(0, .3); this.canSee = false; this.seenFor = 0; this.alert = 0; this.lastKnown = new THREE.Vector3();
    this.cool = R(.5, 1.5); this.burst = 0; this.strafe = Math.random() < .5 ? 1 : -1; this.strafeT = R(1, 3); this.reaction = R(.45, .9);
    this.lastFired = -99; this.flash = 0; this.stuck = 0;
    this.rb = buildRobot([0x6b7680, 0x7a7466, 0x667a70][botSerial % 3], 0xffb547, { bot: this });
    world.shootables.push(...this.rb.parts);
    this.rb.group.position.copy(this.pos);
  }
  newGoal() {
    const a = R(0, 6.28), r = Math.sqrt(Math.random()) * Math.max(8, Z.r * 0.8);
    this.goal.set(Z.cx + Math.cos(a) * r, 0, Z.cz + Math.sin(a) * r);
  }
  hear(from) { if (this.dead) return; this.alert = Math.max(this.alert, 4); this.lastKnown.copy(from); }
  muzzle() { return _v.set(.42, 1.25, .78).applyMatrix4(this.rb.group.matrixWorld).clone(); }
  update(dt) {
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, dist = Math.hypot(dx, dz) || 0.001;
    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = R(.18, .32);
      const fdot = (Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz) / dist;
      const range = P.crouch ? 85 : 115;
      this.canSee = P.alive && dist < range && (fdot > 0.15 || dist < 12 || this.alert > 0) &&
        hasLOS(_a.set(this.pos.x, this.feet + 1.85, this.pos.z), _b.set(P.pos.x, P.feet + P.eye - 0.2, P.pos.z));
    }
    if (this.canSee) { this.seenFor += dt; this.alert = 7; this.lastKnown.copy(P.pos); } else { this.seenFor = 0; this.alert -= dt; }
    let mx = 0, mz = 0, speed = 3.1, faceYaw = null;
    const zd = Math.hypot(this.pos.x - Z.cx, this.pos.z - Z.cz);
    if (zd > Z.r - 3) { mx = Z.cx - this.pos.x; mz = Z.cz - this.pos.z; speed = 4.6; }
    else if (this.canSee) {
      faceYaw = Math.atan2(dx, dz);
      const fx_ = dx / dist, fz_ = dz / dist;
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = R(1, 2.8); }
      const fwd = dist > 38 ? 1 : dist < 13 ? -1 : 0;
      mx = fx_ * fwd + -fz_ * this.strafe * .8; mz = fz_ * fwd + fx_ * this.strafe * .8; speed = 2.7;
    } else if (this.alert > 0) { mx = this.lastKnown.x - this.pos.x; mz = this.lastKnown.z - this.pos.z; speed = 4; if (Math.hypot(mx, mz) < 2) this.alert = 0; }
    else {
      mx = this.goal.x - this.pos.x; mz = this.goal.z - this.pos.z; this.goalTimer -= dt;
      if (Math.hypot(mx, mz) < 2 || this.goalTimer < 0) { this.newGoal(); this.goalTimer = R(5, 12); }
    }
    const ml = Math.hypot(mx, mz), ox = this.pos.x, oz = this.pos.z;
    if (ml > 0.01) { this.pos.x += mx / ml * speed * dt; this.pos.z += mz / ml * speed * dt; if (faceYaw === null) faceYaw = Math.atan2(mx, mz); }
    resolve(this.pos, .5, this.feet, 2.1);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    if (ml > 0.01 && moved < speed * dt * 0.25) { this.stuck += dt; if (this.stuck > 0.7) { this.newGoal(); this.strafe *= -1; this.stuck = 0; } } else this.stuck = 0;
    const g = groundAt(this.pos.x, this.pos.z, this.feet);
    this.feet = g < this.feet ? Math.max(g, this.feet - 9 * dt) : g;
    if (faceYaw !== null) { let d = faceYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * (this.canSee ? 8 : 4)); }
    const bob = animateRobot(this.rb, moved, dt);
    this.rb.group.position.set(this.pos.x, this.feet + bob, this.pos.z);
    this.rb.group.rotation.y = this.yaw;
    if (this.flash > 0) { this.flash -= dt; const e = Math.max(0, this.flash / .12); this.rb.mb.emissive.setRGB(e, e, e); this.rb.md.emissive.setRGB(e * .8, e * .8, e * .8); }
    if (zd > Z.r) this.damage(zoneDps() * dt, false, true);
    this.cool -= dt;
    if (this.canSee && this.seenFor > this.reaction && this.cool <= 0 && P.alive) {
      if (this.burst <= 0) this.burst = 3 + (Math.random() * 3 | 0);
      this.fire(dist);
      this.burst--; this.cool = this.burst > 0 ? .12 : R(1.1, 2.4);
    }
  }
  fire(dist) {
    this.lastFired = G.time;
    const speedH = Math.hypot(P.vel.x, P.vel.z);
    let p = clamp(0.62 - dist / 150, 0.06, 0.62) * G.acc;
    if (P.sprint) p *= .55; else if (speedH > 1) p *= .8;
    if (P.crouch) p *= .8;
    if (!P.onGround) p *= .7;
    const m = this.muzzle();
    const target = new THREE.Vector3(P.pos.x, P.feet + P.eye - 0.35, P.pos.z);
    if (Math.random() < p) hurt(R(6, 9) + G.round * .4, this.pos);
    else { target.x += R(-1.6, 1.6); target.y += R(-1, 1.2); target.z += R(-1.6, 1.6); }
    tracer(m, target, true);
    sndShot('bot', dist);
  }
  damage(n, head, zone) {
    if (this.dead) return false;
    this.hp -= n; if (!zone) { this.flash = .12; this.alert = 7; this.lastKnown.copy(P.pos); this.seenFor = Math.max(this.seenFor, this.reaction * .6); }
    if (this.hp <= 0) { this.die(head, zone); return true; }
    return false;
  }
  die(head, zone) {
    this.dead = true;
    scrapBurst(this.pos.clone().setY(this.feet));
    disposeRobot(this.rb);
    if (!zone) {
      G.stats.kills++; if (head) G.stats.heads++;
      feed(`You → ${escHtml(this.name)}${head ? ' · headshot' : ''}`);
      beep(880, .12, .14, 'triangle'); beep(1320, .1, .1, 'triangle', .06);
    } else feed(`${escHtml(this.name)} lost to the zone`);
    const r = Math.random(); if (r < .6) spawnLoot('ammo', this.pos.x, this.pos.z); else if (r < .85) spawnLoot('armor', this.pos.x, this.pos.z);
    setTimeout(checkWin, 600);
  }
}

/* ---------- loot (solo) ---------- */
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
      else { if (P.armor >= 100) continue; P.armor = Math.min(100, P.armor + 50); toast('+ ARMOR PLATE'); }
      beep(660, .08, .1, 'sine'); beep(990, .1, .08, 'sine', .07);
      scene.remove(L.g); loot.splice(i, 1);
    }
  }
}
