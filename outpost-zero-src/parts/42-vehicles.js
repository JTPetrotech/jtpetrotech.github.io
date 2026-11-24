/* Vehicles: a jeep and a quad bike, parked around the map. E gets in and out.
   W/S drive, A/D steer, the mouse looks around. Driving into an enemy at speed
   knocks them out. Online, whoever is driving sends the vehicle's position with
   their own; the host decides who gets a seat. */

const VEH = {
  jeep: { name: 'Jeep', max: 24, rev: 8, accel: 10, turn: 1.45, r: 1.7, seat: 0.8, wheel: .46, cols: [0x5b6a3f, 0x6e6450, 0x4a5560, 0x8a8a80] },
  quad: { name: 'Quad bike', max: 30, rev: 7, accel: 15, turn: 2.1, r: 1.15, seat: 0.75, wheel: .36, cols: [0xb5452f, 0x2f6fa8, 0xd19a2e, 0x3f8a5a] },
};
let vehicles = [];
function buildVehicle(type, col) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const m = pm(col), d = pm(0x24282c), seat = pm(0x2c2620);
  const glass = new THREE.MeshPhongMaterial({ color: 0x2a3a46, shininess: 90, specular: 0x88aacc, transparent: true, opacity: .55 });
  const add = (geo, mat, x, y, z, parent = body) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  const B = (w, h, dd) => new THREE.BoxGeometry(w, h, dd);
  const T = VEH[type], wheels = [];
  const wg = new THREE.CylinderGeometry(T.wheel, T.wheel, type === 'jeep' ? .34 : .3, 14); wg.rotateZ(Math.PI / 2);
  if (type === 'jeep') {
    add(B(2.0, .6, 4.0), m, 0, .9, 0);
    add(B(1.96, .35, 1.4), m, 0, 1.35, 1.25);
    add(B(1.9, .55, .08), glass, 0, 1.78, .52);
    add(B(1.96, .07, .1), d, 0, 2.07, .52);
    for (const s of [-1, 1]) { add(B(.08, .6, .08), d, s * .94, 1.78, .52); add(B(.09, .9, .09), d, s * .9, 1.65, -1.25); }
    add(B(1.9, .09, .09), d, 0, 2.08, -1.25);
    add(B(.7, .45, .7), seat, -.45, 1.35, -.2); add(B(.7, .45, .7), seat, .45, 1.35, -.2);
    add(B(.7, .55, .12), seat, -.45, 1.62, -.55); add(B(.7, .55, .12), seat, .45, 1.62, -.55);
    add(B(.5, .08, .08), d, -.45, 1.6, .2);
    add(B(2.1, .22, .25), d, 0, .7, 2.05); add(B(2.1, .22, .2), d, 0, .7, -2.03);
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .26, 14), d); spare.rotation.x = Math.PI / 2; spare.position.set(0, 1.25, -2.15); spare.castShadow = true; body.add(spare);
    add(B(.3, .12, .05), pm(0xffe9b0), -.7, 1.05, 2.02); add(B(.3, .12, .05), pm(0xffe9b0), .7, 1.05, 2.02);
    for (const [x, z] of [[-1.02, 1.35], [1.02, 1.35], [-1.02, -1.35], [1.02, -1.35]]) wheels.push(add(wg, d, x, T.wheel, z, g));
  } else {
    add(B(1.0, .42, 1.9), m, 0, .72, 0);
    add(B(.62, .2, .8), seat, 0, 1.02, -.25);
    add(B(1.25, .1, .7), m, 0, .98, .72); add(B(1.25, .1, .6), m, 0, .98, -.78);
    add(B(.08, .5, .08), d, 0, 1.15, .62); add(B(.9, .07, .07), d, 0, 1.4, .62);
    add(B(.26, .12, .05), pm(0xffe9b0), 0, .9, .97);
    for (const [x, z] of [[-.62, .72], [.62, .72], [-.62, -.72], [.62, -.72]]) wheels.push(add(wg, d, x, T.wheel, z, g));
  }
  scene.add(g);
  return { group: g, body, wheels };
}
function clearVehicles() {
  if (P.veh) { P.veh.driver = null; P.veh = null; }
  for (const v of vehicles) scene.remove(v.group);
  world.circles = world.circles.filter(c => !c.veh);
  vehicles = [];
  stopEngine();
}
function spawnVehicles(seed) {
  clearVehicles();
  const r = mulberry((seed ^ 0x5eed) >>> 0);
  world.vehPts.forEach(([x, z, yaw], i) => {
    const type = r() < 0.4 ? 'quad' : 'jeep', T = VEH[type], col = T.cols[(r() * T.cols.length) | 0];
    const mdl = buildVehicle(type, col);
    const v = { i, type, T, pos: new THREE.Vector3(x, 0, z), feet: groundAt(x, z, 999), yaw, speed: 0, driver: null, spin: 0, hitCD: new Map(), ...mdl };
    v.circle = { x, z, r: T.r, top: v.feet + 1.9, veh: true };
    world.circles.push(v.circle);
    placeVehicle(v);
    vehicles.push(v);
  });
}
function placeVehicle(v) {
  v.circle.x = v.pos.x; v.circle.z = v.pos.z; v.circle.top = v.feet + 1.9;
  v.group.position.set(v.pos.x, v.feet, v.pos.z); v.group.rotation.y = v.yaw;
  // lean with the ground under the wheels
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), L = v.T.r;
  const hf = heightAt(v.pos.x + fx * L, v.pos.z + fz * L), hb = heightAt(v.pos.x - fx * L, v.pos.z - fz * L);
  const hl = heightAt(v.pos.x + fz, v.pos.z - fx), hr = heightAt(v.pos.x - fz, v.pos.z + fx);
  v.group.rotation.x = clamp(-Math.atan2(hf - hb, 2 * L), -.4, .4);
  v.group.rotation.z = clamp(Math.atan2(hl - hr, 2), -.3, .3);
}
// one step of driving, for the vehicle you are in
function driveVehicle(v, dt, thr, steer) {
  const T = v.T, wet = inWater(v.pos.x, v.pos.z, v.feet);
  const max = (thr >= 0 ? T.max : T.rev) * (wet ? 0.45 : 1);
  const target = thr * max;
  const braking = thr !== 0 && Math.sign(target) !== Math.sign(v.speed) && Math.abs(v.speed) > 0.5;
  const a = thr === 0 ? 5 : braking ? T.accel * 2.2 : T.accel;
  v.speed += clamp(target - v.speed, -a * dt, a * dt);
  v.yaw += steer * T.turn * dt * clamp(v.speed / 7, -1, 1);
  const want = Math.abs(v.speed) * dt;
  const ox = v.pos.x, oz = v.pos.z;
  v.pos.x += Math.sin(v.yaw) * v.speed * dt; v.pos.z += Math.cos(v.yaw) * v.speed * dt;
  v.circle.off = true; resolve(v.pos, T.r, v.feet + 0.45, 1.6); v.circle.off = false;
  const moved = Math.hypot(v.pos.x - ox, v.pos.z - oz);
  if (want > 0.05 && moved < want * 0.5) { if (Math.abs(v.speed) > 9) { sndCrate(); P.lastHurt = G.time; } v.speed *= 0.35; }
  const g = groundAt(v.pos.x, v.pos.z, v.feet + 0.3);
  v.feet = g > v.feet ? g : Math.max(g, v.feet - 12 * dt);
  v.spin += v.speed * dt / T.wheel;
  for (const w of v.wheels) w.rotation.x = v.spin;
  placeVehicle(v);
  // running into someone on the other side knocks them out (they are robots: scrap, no blood)
  if (Math.abs(v.speed) > 7) {
    const reach = T.r + 0.7;
    if (G.mode === 'bots') {
      for (const b of bots) if (!b.dead && b.team !== PL.team && Math.hypot(b.pos.x - v.pos.x, b.pos.z - v.pos.z) < reach && Math.abs(b.feet - v.feet) < 2) {
        if (b.damage(300, false, PL)) hitMarker(true);
      }
    } else if (G.mode === 'net') {
      for (const av of MP.avatars.values()) {
        if (!av.alive || av.team === MP.team || av.veh >= 0) continue;
        if (Math.hypot(av.pos.x - v.pos.x, av.pos.z - v.pos.z) > reach) continue;
        if ((v.hitCD.get(av.id) || 0) > G.time) continue;
        v.hitCD.set(av.id, G.time + 1); mpSend({ t: 'hit', v: av.id, d: 300, h: 0 }); hitMarker(true);
      }
    }
  }
  engineSound(Math.abs(v.speed) / T.max);
}
function nearestVehicle(maxD) {
  let best = null, bd = maxD;
  for (const v of vehicles) { if (v.driver) continue; const d = Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z); if (d < bd && Math.abs(v.feet - P.feet) < 2.5) { bd = d; best = v; } }
  return best;
}
function enterVehicle(v) {
  v.driver = 'me'; P.veh = v; P.crouch = false; adsT = 0; reloading = false; burstLeft = 0;
  P.yaw = v.yaw + Math.PI; P.pitch = -0.1;
  sndClick(500); startEngine();
}
// tell: also let the other players know (online). Called on death too.
function leaveVehicle(quiet) {
  const v = P.veh; if (!v) return;
  P.veh = null; v.driver = null;
  const side = [[Math.cos(v.yaw), -Math.sin(v.yaw)], [-Math.cos(v.yaw), Math.sin(v.yaw)], [-Math.sin(v.yaw), -Math.cos(v.yaw)]];
  let px = v.pos.x, pz = v.pos.z;
  for (const [sx, sz] of side) { const x = v.pos.x + sx * (v.T.r + 1), z = v.pos.z + sz * (v.T.r + 1); if (isClear(x, z, .5)) { px = x; pz = z; break; } }
  if (!quiet || P.alive) { P.pos.x = px; P.pos.z = pz; P.feet = groundAt(px, pz, v.feet + 1); P.vy = 0; }
  v.speed = 0; stopEngine();
  if (G.mode === 'net') mpSend({ t: 'veh', v: v.i, on: 0, x: Math.round(v.pos.x * 100) / 100, z: Math.round(v.pos.z * 100) / 100, y: Math.round(v.yaw * 100) / 100 });
}
// while driving: steer the vehicle and put the camera behind it
function updateDriving(dt, input) {
  const v = P.veh;
  const thr = input && P.alive ? (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) : 0;
  const steer = input && P.alive ? (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0) : 0;
  driveVehicle(v, dt, thr, steer);
  P.pos.x = v.pos.x; P.pos.z = v.pos.z; P.feet = v.feet + v.T.seat; P.vy = 0; P.onGround = true; P.sprint = false;
  P.vel.set(Math.sin(v.yaw) * v.speed, 0, Math.cos(v.yaw) * v.speed);
  // the view drifts back behind the vehicle while it is moving
  if (Math.abs(v.speed) > 3) { let d = (v.yaw + Math.PI) - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); P.yaw += d * Math.min(1, dt * 1.6); }
  const cf = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  const back = 7.5 * Math.cos(P.pitch * 0.8), up = 3 - Math.sin(P.pitch) * 5;
  camera.fov = 72 + Math.min(10, Math.abs(v.speed) * 0.35); camera.updateProjectionMatrix();
  camera.position.set(v.pos.x - cf.x * back, Math.max(heightAt(v.pos.x - cf.x * back, v.pos.z - cf.z * back) + 0.8, v.feet + up), v.pos.z - cf.z * back);
  camera.rotation.set(P.pitch - 0.18, P.yaw, 0);
  guns.forEach(x => x.m.group.visible = false);
  for (const g of guns) if (g.m.flash) g.m.flash.visible = false;
  return { scoped: false, spdH: Math.abs(v.speed) };
}

/* engine: one oscillator pitched by speed, only for the vehicle you drive */
let engine = null;
function startEngine() {
  if (!AC || engine) return;
  const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
  o.type = 'sawtooth'; o.frequency.value = 40; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0.05;
  o.connect(f).connect(g).connect(master); o.start();
  engine = { o, g, f };
}
function engineSound(k) { if (engine) { engine.o.frequency.value = 38 + k * 70; engine.f.frequency.value = 300 + k * 500; engine.g.gain.value = 0.04 + k * 0.05; } }
function stopEngine() { if (engine) { try { engine.o.stop(); } catch (e) {} engine = null; } }

/* online: where other people's vehicles are */
function vehicleFromNet(i, x, z, yaw, driver) {
  const v = vehicles[i]; if (!v) return;
  if (v.driver === 'me' && driver !== 'me') return;
  v.driver = driver;
  if (x != null) { v.pos.x = x; v.pos.z = z; v.feet = groundAt(x, z, 999); v.yaw = yaw; v.speed = 0; placeVehicle(v); }
}
