/* The player: moving, aiming, shooting, reloading, picking things up. */

const G = { mode: null, rules: { kind: 'br', squad: 1, limit: 30 }, diff: store.get('diff', 'normal'), playing: false, paused: false, over: false, time: 0,
  stats: { kills: 0, heads: 0, shots: 0, hits: 0, deaths: 0 }, map: store.get('map', 'valley'), spec: null, timers: [] };
if (!MAPS[G.map]) G.map = 'valley';
if (!DIFF[G.diff]) G.diff = 'normal';
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), vy: 0, feet: 0, yaw: 0, pitch: 0, onGround: false, crouch: false, eye: 1.65,
  hp: 100, armor: 0, lastHurt: -99, alive: true, sprint: false, breath: 1, drop: false, veh: null };
let guns = [];
let cur = 0, adsT = 0, swapT = 1, kick = 0, bob = 0, nextShot = 0, reloading = false, reloadEnd = 0, flashT = 0, triggerT = -9, locked = false;
let burstLeft = 0, recoilAcc = 0, lastShotT = -9, sprintOut = 0, stepAcc = 0, landDip = 0, lookDX = 0, lookDY = 0, swayX = 0, swayY = 0, airVy = 0;
let sens = store.get('sens', 1), pendingLoadout = false;
const mouse = { l: false, r: false };
const keys = {};
function afterTimer(sec, fn) { G.timers.push({ at: G.time + sec, fn }); }
function runTimers() { for (let i = G.timers.length - 1; i >= 0; i--) if (G.time >= G.timers[i].at) { const t = G.timers.splice(i, 1)[0]; t.fn(); } }

function makeHeld(sl) { const s = gunStats(sl.id, sl.att); return { id: sl.id, skin: sl.skin || 'factory', s, att: sl.att, m: makeGunModel(sl.id, sl.att, sl.skin), magLeft: s.mag, reserveLeft: s.reserve }; }
function equip() {
  guns.forEach(g => disposeGunModel(g.m));
  guns = loadout.map(makeHeld);
  cur = 0; swapT = 0; reloading = false; adsT = 0; pendingLoadout = false; burstLeft = 0;
}

/* ---------- the closing zone (battle royale) ---------- */
const Z = { cx: 0, cz: 0, r: 180, phase: 0, t: 0, startR: 180, state: 'wait', phases: [] };
const BASE_PHASES = [{ wait: 45, to: 0.62, shrink: 30 }, { wait: 35, to: 0.38, shrink: 25 }, { wait: 28, to: 0.2, shrink: 22 }, { wait: 22, to: 0.08, shrink: 20 }, { wait: 16, to: 0.015, shrink: 25 }];
const zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 140, 72, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x8d7dff, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false }));
zoneMesh.visible = false; scene.add(zoneMesh);
const zoneDps = () => 3 + Z.phase * 3;
function zoneSetup(cx, cz) {
  const H = world.half, k = H / 200;
  Z.cx = cx; Z.cz = cz; Z.r = Z.startR = H * 0.95; Z.phase = 0; Z.t = 0; Z.state = 'wait';
  Z.phases = BASE_PHASES.map(p => ({ wait: p.wait * (0.55 + 0.45 * k), to: p.to * H, shrink: p.shrink * (0.6 + 0.4 * k) }));
  zoneMesh.visible = true;
}
function zoneTick(dt) {
  const ph = Z.phases[Math.min(Z.phase, Z.phases.length - 1)];
  Z.t += dt;
  if (Z.phase < Z.phases.length) {
    if (Z.state === 'wait' && Z.t >= ph.wait) { Z.state = 'shrink'; Z.t = 0; Z.startR = Z.r; toast('THE ZONE IS CLOSING'); }
    else if (Z.state === 'shrink') { const k = Math.min(1, Z.t / ph.shrink); Z.r = lerp(Z.startR, ph.to, k); if (k >= 1) { Z.phase++; Z.state = 'wait'; Z.t = 0; } }
  }
}
function zoneDraw() {
  zoneMesh.position.set(Z.cx, 55, Z.cz); zoneMesh.scale.set(Math.max(0.5, Z.r), 1, Math.max(0.5, Z.r));
  const out = Math.hypot(P.pos.x - Z.cx, P.pos.z - Z.cz) > Z.r;
  $('zonetint').style.opacity = out && P.alive && zoneMesh.visible ? 1 : 0;
  return out;
}

/* ---------- getting hurt (vs bots; online the host decides) ---------- */
let vignT = 0;
function hurt(n, from, src) {
  if (!P.alive || G.mode !== 'bots') return;
  P.lastHurt = G.time;
  if (P.armor > 0 && src !== 'zone') { const ab = Math.min(P.armor, n * 0.7); P.armor -= ab; n -= ab; }
  P.hp -= n;
  if (from) { vignT = .35; dmgArc(from); }
  if (P.hp <= 0) { P.hp = 0; P.alive = false; onPlayerKilled(src); }
}

/* ---------- weapons in hand ---------- */
function startReload() {
  const g = guns[cur];
  if (!g || !P.alive) return;
  if (reloading) return;
  if (g.magLeft >= g.s.mag) { toast('MAGAZINE FULL'); return; }
  if (g.reserveLeft <= 0) { toast('NO SPARE AMMO · OPEN A CRATE OR SWITCH GUNS'); return; }
  reloading = true; reloadEnd = G.time + g.s.reload; burstLeft = 0;
  sndClick(700); sndClick(500, g.s.reload * 0.55); sndClick(1100, g.s.reload * 0.92);
}
function swapTo(i) {
  if (i === cur || !P.alive || !guns[i]) return;
  guns[cur].m.group.visible = false;
  cur = i; reloading = false; swapT = 0; burstLeft = 0; nextShot = Math.max(nextShot, G.time + .35);
  sndClick(600);
}
const raycaster = new THREE.Raycaster();
const _dir = new THREE.Vector3(), _dir0 = new THREE.Vector3(), _cam = new THREE.Vector3(), _n = new THREE.Vector3();
function falloff(s, d) {
  if (s.pellets > 1) return d <= s.range ? 1 : d >= s.range * 2.2 ? .15 : lerp(1, .15, (d - s.range) / (s.range * 1.2));
  return d > s.range ? .6 : 1;
}
function fire() {
  const g = guns[cur], s = g.s;
  if (swapT < 1) return;
  if (reloading) { if (g.magLeft > 0) reloading = false; else return; }
  if (g.magLeft <= 0) { sndClick(1400); nextShot = G.time + .25; burstLeft = 0; startReload(); return; }
  g.magLeft--; G.stats.shots++;
  nextShot = G.time + 60 / s.rpm; lastShotT = G.time;
  const speedH = Math.hypot(P.vel.x, P.vel.z), scoped = s.overlay && adsT > .9;
  const moveMul = (1 + speedH / 6 * 0.9) * (P.onGround ? 1 : 2.2) * (P.crouch ? .75 : 1);
  let spread = s.pellets > 1 ? lerp(s.pelHip, s.ads, adsT) : lerp(s.hip, s.ads, adsT) * moveMul;
  if (s.sway && scoped && s.pellets === 1) spread = speedH > 1 ? 0.01 : 0;
  camera.getWorldDirection(_dir0); camera.getWorldPosition(_cam);
  const muzzleW = g.m.muzzle.clone(); g.m.group.localToWorld(muzzleW); muzzleW.applyMatrix4(camera.matrixWorld);
  const hitsBy = new Map();
  let end0 = null;
  for (let i = 0; i < s.pellets; i++) {
    _dir.copy(_dir0);
    _dir.x += (Math.random() - .5) * 2 * spread; _dir.y += (Math.random() - .5) * 2 * spread; _dir.z += (Math.random() - .5) * 2 * spread; _dir.normalize();
    raycaster.set(_cam, _dir); raycaster.far = 700;
    const h = raycaster.intersectObjects(world.shootables, false)[0];
    const end = h ? h.point.clone() : _cam.clone().addScaledVector(_dir, 400);
    if (i === 0) end0 = end;
    if (s.pellets > 1 && i > 0 && i < 4 && !scoped) tracer(muzzleW, end, false);
    if (!h) continue;
    const ud = h.object.userData || {};
    const target = ud.bot || ud.remote;
    if (target) {
      if (ud.remote) { const av = MP.avatars.get(ud.remote); if (!av || !av.alive || av.team === MP.team) { puff(h.point.clone(), 0xd9d3c4, .2); continue; } }
      else if (ud.bot.team === PL.team || ud.bot.dead) { puff(h.point.clone(), 0xd9d3c4, .2); continue; }
      const head = ud.part === 'head';
      const acc = hitsBy.get(target) || { dmg: 0, head: false };
      acc.dmg += s.dmg * (head ? s.head : 1) * falloff(s, h.distance); acc.head = acc.head || head;
      hitsBy.set(target, acc);
      sparks(h.point, 3); puff(h.point.clone(), 0xffc766, .2);
    } else {
      const p = h.point.clone().addScaledVector(_dir, -.06);
      puff(p, h.object === world.objs[0] ? 0xa89a7c : 0xcfc8b8, .28, .5, .4);
      if (h.face) { _n.copy(h.face.normal).transformDirection(h.object.matrixWorld); if (h.object.isInstancedMesh || h.object === world.objs[0]) bulletHole(h.point, _n); }
      if (Math.random() < .35) sparks(h.point, 2);
    }
  }
  if (hitsBy.size) {
    G.stats.hits++;
    let killed = false, head = false;
    for (const [t, a] of hitsBy) {
      head = head || a.head;
      if (t instanceof Bot) killed = t.damage(a.dmg, a.head, PL) || killed;
      else mpSend({ t: 'hit', v: t, d: Math.round(a.dmg), h: a.head ? 1 : 0 });
    }
    hitMarker(killed);
    beep(head ? 2200 : 1700, .04, .12, 'square');
  }
  if (!scoped) tracer(muzzleW, end0, false);
  sndShot(s.snd);
  if (!GUNS[g.id].revolver && !(s.pellets > 1 && GUNS[g.id].tube)) { const e = g.m.eject.clone(); g.m.group.localToWorld(e); shell(e); }
  if (Math.random() < .3) puff(muzzleW.clone(), 0xbfbab0, .12, .7, .5);
  if (G.mode === 'bots' && !s.quiet) for (const b of bots) if (!b.dead && b.team !== PL.team && b.pos.distanceTo(P.pos) < 75) b.hear(P.pos);
  if (G.mode === 'net') {
    const r2 = v => Math.round(v * 100) / 100;
    mpSend({ t: 'shot', a: [r2(muzzleW.x), r2(muzzleW.y), r2(muzzleW.z)], b: [r2(end0.x), r2(end0.y), r2(end0.z)], s: s.snd, q: s.quiet ? 1 : 0 });
  }
  const k = (1 - adsT * .35) * (P.crouch ? .8 : 1);
  const kv = s.recoilV * k * R(0.85, 1.15);
  P.pitch = clamp(P.pitch + kv, -1.5, 1.5); recoilAcc += kv;
  P.yaw += (Math.random() - .5) * 2 * s.recoilH * k;
  kick = 1; flashT = .05;
  if (g.magLeft === 0 && g.reserveLeft > 0) afterTimer(.25, () => { if (G.playing && guns[cur] === g) startReload(); });
}

/* ---------- picking things up ---------- */
function nearestBench(maxD) {
  for (const [x, z] of world.benchPts) if (Math.hypot(x - P.pos.x, z - P.pos.z) < maxD) return [x, z];
  return null;
}
function findInteract() {
  if (!P.alive || P.drop) return null;
  if (P.veh) return { kind: 'exit', v: P.veh };
  let best = null, bd = 2.4;
  for (const gg of groundGuns) { const d = Math.hypot(gg.x - P.pos.x, gg.z - P.pos.z); if (d < bd && Math.abs(gg.y - P.feet) < 2.6) { bd = d; best = { kind: 'gun', gg }; } }
  if (best) return best;
  const v = nearestVehicle(3.4);
  if (v) return { kind: 'veh', v };
  if (nearestBench(2.6)) return { kind: 'bench' };
  const c = nearestCrate(P.pos, 2.5, true);
  if (c && Math.abs(c.y - P.feet) < 2) return { kind: 'crate', c };
  return null;
}
function interact() {
  const it = findInteract(); if (!it) return;
  if (it.kind === 'exit') { leaveVehicle(); return; }
  if (it.kind === 'veh') { if (G.mode === 'net') mpSend({ t: 'veh', v: it.v.i, on: 1 }); else enterVehicle(it.v); return; }
  if (it.kind === 'bench') { openBench(); return; }
  if (it.kind === 'crate') {
    if (G.mode === 'net') mpSend({ t: 'open', c: it.c.i }); else openCrate(it.c, 'me');
    return;
  }
  const gg = it.gg, old = guns[cur];
  groundGuns.splice(groundGuns.indexOf(gg), 1); disposeGunModel(gg.m);
  const held = makeHeld({ id: gg.id, att: gg.att, skin: gg.skin });
  if (gg.ammo) { held.magLeft = gg.ammo[0]; held.reserveLeft = gg.ammo[1]; }
  disposeGunModel(old.m); guns[cur] = held;
  reloading = false; swapT = 0; burstLeft = 0;
  const f = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  const dx = P.pos.x + f.x * 0.9, dz = P.pos.z + f.z * 0.9;
  groundGuns.push(Object.assign({ id: old.id, att: old.att, skin: old.skin, tier: 0, ammo: [old.magLeft, old.reserveLeft], x: dx, y: P.feet + 0.5, z: dz, t: 0 }, { m: makeGunModel(old.id, old.att, old.skin, true) }));
  groundGuns[groundGuns.length - 1].m.group.position.set(dx, P.feet + 0.5, dz);
  toast(`PICKED UP ${GUNS[gg.id].name.toUpperCase()}`);
  sndClick(800); sndClick(1200, .12);
}

/* ---------- moving, aiming, the gun in your hands ---------- */
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();
function updatePlayer(dt, input) {
  if (P.veh) return updateDriving(dt, input);
  const g = guns[cur], s = g.s;
  fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  wish.set(0, 0, 0);
  if (P.alive && input) {
    if (keys.KeyW) wish.add(fwd); if (keys.KeyS) wish.sub(fwd); if (keys.KeyD) wish.add(right); if (keys.KeyA) wish.sub(right);
  }
  if (wish.lengthSq() > 0) wish.normalize();
  const wantShoot = input && P.alive && (mouse.l || G.time - triggerT < 0.25);
  const aiming = input && mouse.r && !reloading && P.alive && swapT >= 1;
  // sprint ends the moment you shoot or aim, so the trigger always works
  const sprintKey = input && P.alive && keys.ShiftLeft && keys.KeyW && P.onGround && !P.crouch && !P.drop;
  P.sprint = sprintKey && !aiming && !wantShoot && !(adsT > .3);
  if (P.sprint) sprintOut = 0.12; else sprintOut = Math.max(0, sprintOut - dt);
  const wet = inWater(P.pos.x, P.pos.z, P.feet);
  let speed = (P.sprint ? 9.2 : P.crouch ? 3.2 : 6) * s.mob * (wet ? 0.6 : 1);
  if (adsT > .5) speed = Math.min(speed, 3.6 * s.adsMove * s.mob);
  if (P.drop) speed = 10;
  const accel = P.onGround ? 12 : P.drop ? 3 : 2.5;
  P.vel.x = lerp(P.vel.x, wish.x * speed, 1 - Math.exp(-accel * dt));
  P.vel.z = lerp(P.vel.z, wish.z * speed, 1 - Math.exp(-accel * dt));
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  resolve(P.pos, .4, P.feet, P.crouch ? 1.2 : 1.75);
  if (input && P.alive && keys.Space && P.onGround && !wet) { P.vy = 6.3; P.onGround = false; }
  P.vy -= 18 * dt;
  if (P.drop) P.vy = Math.max(P.vy, -9);
  P.feet += P.vy * dt;
  const gr = groundAt(P.pos.x, P.pos.z, P.feet);
  const wasAir = !P.onGround;
  if (P.feet <= gr) { if (wasAir && P.vy < -7 && !P.drop) landDip = Math.min(.25, -P.vy * .02); if (wasAir) sndStep(wet); P.feet = gr; P.vy = 0; P.onGround = true; if (P.drop) { P.drop = false; toast('LANDED'); } }
  else if (P.onGround && P.vy <= 0 && P.feet - gr < 0.45) { P.feet = gr; P.vy = 0; }
  else P.onGround = false;
  P.eye = lerp(P.eye, P.alive ? (P.crouch ? 1.05 : 1.65) : 0.45, 1 - Math.exp(-12 * dt));
  // footsteps
  const spdH = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround && spdH > 1.5 && P.alive) { stepAcc += spdH * dt; if (stepAcc > (P.sprint ? 2.6 : 2.1)) { stepAcc = 0; sndStep(wet); } }
  // weapon state
  if (reloading && G.time >= reloadEnd) { const take = Math.min(s.mag - g.magLeft, g.reserveLeft); g.magLeft += take; g.reserveLeft -= take; reloading = false; }
  swapT = Math.min(1, swapT + dt / .35);
  adsT = clamp(adsT + (aiming ? dt : -dt) / s.adsTime, 0, 1);
  if (input && P.alive && G.time >= nextShot && sprintOut <= 0) {
    if (burstLeft > 0) { fire(); burstLeft--; if (burstLeft === 0) nextShot = G.time + s.burstGap; }
    else if (s.auto ? mouse.l : G.time - triggerT < 0.25) {
      triggerT = -9;
      if (s.burst) { burstLeft = s.burst - 1; fire(); if (guns[cur].magLeft <= 0) burstLeft = 0; }
      else fire();
    }
  }
  // recoil climbs while you shoot and mostly settles back when you stop
  if (G.time - lastShotT > 0.09 && recoilAcc > 0) { const r = recoilAcc * Math.min(1, dt * 8); P.pitch -= r * 0.7; recoilAcc -= r; }
  // scope sway
  const scoped = s.overlay && adsT > .9;
  let sx = 0, sy = 0;
  if (scoped && s.sway) {
    const steady = keys.ShiftLeft && P.breath > 0;
    P.breath = clamp(P.breath + (steady ? -dt / 4 : dt / 6), 0, 1);
    const amp = (steady ? .12 : 1) * (P.breath <= 0 ? 1.6 : 1) * 0.006;
    sx = (Math.sin(G.time * 1.1) + Math.sin(G.time * 2.7) * .5) * amp; sy = (Math.cos(G.time * 1.6) * .8 + Math.sin(G.time * .7) * .4) * amp;
  } else P.breath = clamp(P.breath + dt / 6, 0, 1);
  // camera
  const ease = adsT * adsT * (3 - 2 * adsT);
  camera.fov = lerp(75, s.fov, ease) + (P.sprint ? 5 : 0);
  camera.updateProjectionMatrix();
  landDip = Math.max(0, landDip - dt * 0.9);
  const headBob = P.onGround ? Math.sin(bob * 2) * 0.03 * Math.min(1, spdH / 6) * (1 - ease) : 0;
  camera.position.set(P.pos.x, P.feet + P.eye + headBob - landDip, P.pos.z);
  const roll = -(P.vel.x * right.x + P.vel.z * right.z) * 0.004 * (1 - ease);
  camera.rotation.set(P.pitch + sy, P.yaw + sx, P.alive ? roll : 0.4);
  // viewmodel
  if (P.onGround) bob += spdH * dt * (P.sprint ? 1.25 : 1.6);
  kick = Math.max(0, kick - dt * 9);
  swayX = lerp(swayX, clamp(-lookDX * 0.0009, -.04, .04), 1 - Math.exp(-10 * dt)); swayY = lerp(swayY, clamp(lookDY * 0.0009, -.04, .04), 1 - Math.exp(-10 * dt));
  lookDX = 0; lookDY = 0;
  guns.forEach((x, i) => x.m.group.visible = i === cur && P.alive && !scoped);
  const gp = g.m.group.position;
  gp.lerpVectors(g.m.hip, g.m.adsPos, ease);
  const bobAmp = (1 - ease * .9) * Math.min(1, spdH / 6);
  gp.x += Math.sin(bob) * .012 * bobAmp + swayX * (1 - ease * .8); gp.y += Math.abs(Math.cos(bob)) * .012 * bobAmp + swayY * (1 - ease * .8);
  gp.y += Math.sin(G.time * 1.6) * .002 * (1 - ease) - landDip * .3;
  const heavy = s.recoilV > .03;
  gp.z += kick * (heavy ? .09 : .035) * (1 - ease * .5);
  let rx = kick * (heavy ? .18 : .06) * (1 - ease * .6), rz = swayX * 2, ry = swayX * 1.5;
  if (g.m.mag) g.m.mag.position.y = g.m.magY;
  if (reloading) {
    const k = 1 - (reloadEnd - G.time) / s.reload, d = Math.sin(Math.PI * clamp(k, 0, 1));
    gp.y -= d * .1; rx -= d * .45; rz += d * .5;
    if (g.m.mag) g.m.mag.position.y = g.m.magY - Math.max(0, Math.sin(Math.PI * clamp((k - .15) / .6, 0, 1))) * .22;
  }
  if (swapT < 1) { gp.y -= (1 - swapT) * .3; rx -= (1 - swapT) * .6; }
  if (P.sprint) { gp.x -= .04; gp.y -= .03; ry = .55; rz = .25; }
  g.m.group.rotation.set(rx, ry, rz);
  flashT -= dt; g.m.flash.visible = flashT > 0; if (g.m.flash.visible) g.m.flash.rotation.z = Math.random() * 3;
  return { scoped, spdH };
}
// When you are out, watch a teammate: their eyes, their way of looking
function spectateCam(t) {
  if (!t) return false;
  const p = t.pos, feet = t.feet, yaw = t.kind === 'bot' ? t.yaw + Math.PI : t.yaw - Math.PI;
  camera.fov = 75; camera.updateProjectionMatrix();
  camera.position.set(p.x - Math.sin(yaw) * -3.2, feet + 2.6, p.z - Math.cos(yaw) * -3.2);
  camera.rotation.set(-0.25, yaw, 0);
  guns.forEach(x => x.m.group.visible = false);
  return true;
}
