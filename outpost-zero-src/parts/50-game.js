/* The player, shooting, solo rounds, and the online team match. */

const G = { mode: null, playing: false, paused: false, over: false, time: 0, round: store.get('round', 1), acc: 1,
  stats: { kills: 0, heads: 0, shots: 0, hits: 0, deaths: 0 }, map: store.get('map', 'valley') };
if (!MAPS[G.map]) G.map = 'valley';
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), vy: 0, feet: 0, yaw: 0, pitch: 0, onGround: false, crouch: false, eye: 1.65,
  hp: 100, armor: 0, lastHurt: -99, alive: true, sprint: false, breath: 1 };
let guns = [];
let cur = 0, adsT = 0, swapT = 1, kick = 0, bob = 0, nextShot = 0, reloading = false, reloadEnd = 0, flashT = 0, trigger = false, locked = false;
let sens = store.get('sens', 1), pendingLoadout = false;
const mouse = { l: false, r: false };
const keys = {};
const TEAM = [{ name: 'Orange', css: 'o', hex: 0xff9a3c, visor: 0xff9a3c }, { name: 'Blue', css: 'b', hex: 0x4fa3ff, visor: 0x4fa3ff }];

function equip() {
  guns.forEach(g => disposeGunModel(g.m));
  guns = loadout.map(sl => { const s = gunStats(sl.id, sl.att); return { s, att: sl.att, m: makeGunModel(sl.id, sl.att), magLeft: s.mag, reserveLeft: s.reserve }; });
  cur = 0; swapT = 0; reloading = false; adsT = 0; pendingLoadout = false;
}

/* ---------- zone (solo) ---------- */
const Z = { cx: 0, cz: 0, r: 180, phase: 0, t: 0, startR: 180, state: 'wait', phases: [] };
const BASE_PHASES = [{ wait: 40, to: 0.65, shrink: 30 }, { wait: 30, to: 0.4, shrink: 25 }, { wait: 25, to: 0.22, shrink: 22 }, { wait: 20, to: 0.09, shrink: 20 }, { wait: 15, to: 0.015, shrink: 25 }];
const zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 140, 72, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x8d7dff, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false }));
zoneMesh.visible = false; scene.add(zoneMesh);
const zoneDps = () => 3 + Z.phase * 3;

/* ---------- HUD helpers ---------- */
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).innerHTML = v; } }
function feed(html) { const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d); setTimeout(() => d.remove(), 4500); while ($('feed').children.length > 6) $('feed').lastChild.remove(); }
let toastTimer = 0, hitTimer = 0, vignT = 0;
function toast(t) { $('toast').textContent = t; toastTimer = 1.4; }
function hitMarker(kill) { $('hit').classList.toggle('kill', !!kill); hitTimer = kill ? .35 : .18; }
function dmgArc(from) {
  const dx = from.x - P.pos.x, dz = from.z - P.pos.z;
  const lx = dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw), lf = -(dx * Math.sin(P.yaw) + dz * Math.cos(P.yaw));
  const d = document.createElement('div'); d.className = 'arc'; d.style.transform = `rotate(${Math.atan2(lx, lf) * 180 / Math.PI}deg)`;
  $('dmg').appendChild(d); setTimeout(() => d.remove(), 1100);
}
function hurt(n, from) { // solo damage
  if (!P.alive) return;
  P.lastHurt = G.time;
  if (P.armor > 0) { const ab = Math.min(P.armor, n * 0.7); P.armor -= ab; n -= ab; }
  P.hp -= n;
  if (from) { vignT = .35; dmgArc(from); }
  if (P.hp <= 0) { P.hp = 0; soloDie(); }
}

/* ---------- weapons in hand ---------- */
function startReload() {
  const g = guns[cur];
  if (!g || reloading || g.magLeft >= g.s.mag || g.reserveLeft <= 0 || !P.alive) return;
  reloading = true; reloadEnd = G.time + g.s.reload;
  beep(300, .04, .08); beep(220, .05, .08, 'square', g.s.reload * .6);
}
function swapTo(i) {
  if (i === cur || !P.alive || !guns[i]) return;
  guns[cur].m.group.visible = false;
  cur = i; reloading = false; swapT = 0; nextShot = Math.max(nextShot, G.time + .35);
  beep(500, .03, .05);
}
const raycaster = new THREE.Raycaster();
const _dir = new THREE.Vector3(), _dir0 = new THREE.Vector3(), _cam = new THREE.Vector3();
function falloff(s, d) {
  if (s.pellets > 1) return d <= s.range ? 1 : d >= s.range * 2.2 ? .15 : lerp(1, .15, (d - s.range) / (s.range * 1.2));
  return d > s.range ? .6 : 1;
}
function fire() {
  const g = guns[cur], s = g.s;
  if (reloading || swapT < 1) return;
  if (g.magLeft <= 0) { beep(1200, .02, .06); nextShot = G.time + .25; startReload(); return; }
  g.magLeft--; G.stats.shots++;
  nextShot = G.time + 60 / s.rpm;
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
      const head = ud.part === 'head';
      const acc = hitsBy.get(target) || { dmg: 0, head: false };
      acc.dmg += s.dmg * (head ? s.head : 1) * falloff(s, h.distance); acc.head = acc.head || head;
      hitsBy.set(target, acc);
      puff(h.point.clone(), 0xffc766, .2);
    } else puff(h.point.clone().addScaledVector(_dir, -.1));
  }
  if (hitsBy.size) {
    G.stats.hits++;
    let killed = false, head = false;
    for (const [t, a] of hitsBy) {
      head = head || a.head;
      if (t instanceof Bot) killed = t.damage(a.dmg, a.head) || killed;
      else mpSend({ t: 'hit', v: t, d: Math.round(a.dmg), h: a.head ? 1 : 0 });
    }
    hitMarker(killed);
    beep(head ? 2200 : 1700, .04, .12, 'square');
  }
  if (!scoped) tracer(muzzleW, end0, false);
  sndShot(s.snd);
  if (G.mode === 'solo' && !s.quiet) for (const b of bots) if (!b.dead && b.pos.distanceTo(P.pos) < 70) b.hear(P.pos);
  if (G.mode === 'tdm') {
    const r2 = v => Math.round(v * 100) / 100;
    mpSend({ t: 'shot', a: [r2(muzzleW.x), r2(muzzleW.y), r2(muzzleW.z)], b: [r2(end0.x), r2(end0.y), r2(end0.z)], s: s.snd, q: s.quiet ? 1 : 0 });
  }
  const k = (1 - adsT * .35) * (P.crouch ? .8 : 1);
  P.pitch = clamp(P.pitch + s.recoilV * k, -1.5, 1.5); P.yaw += (Math.random() - .5) * 2 * s.recoilH * k;
  kick = 1; flashT = .05;
  if (g.magLeft === 0 && g.reserveLeft > 0) setTimeout(() => { if (G.playing && guns[cur] === g) startReload(); }, 250);
}

/* ---------- player movement, aiming, viewmodel ---------- */
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();
function updatePlayer(dt, input) {
  const g = guns[cur], s = g.s;
  fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  wish.set(0, 0, 0);
  if (P.alive && input) {
    if (keys.KeyW) wish.add(fwd); if (keys.KeyS) wish.sub(fwd); if (keys.KeyD) wish.add(right); if (keys.KeyA) wish.sub(right);
  }
  if (wish.lengthSq() > 0) wish.normalize();
  const aiming = input && mouse.r && !reloading && P.alive && swapT >= 1;
  P.sprint = input && P.alive && keys.ShiftLeft && keys.KeyW && !aiming && P.onGround && !P.crouch;
  let speed = (P.sprint ? 9.2 : P.crouch ? 3.2 : 6) * s.mob;
  if (adsT > .5) speed = Math.min(speed, 3.6 * s.adsMove * s.mob);
  const accel = P.onGround ? 12 : 2.5;
  P.vel.x = lerp(P.vel.x, wish.x * speed, 1 - Math.exp(-accel * dt));
  P.vel.z = lerp(P.vel.z, wish.z * speed, 1 - Math.exp(-accel * dt));
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  resolve(P.pos, .4, P.feet, P.crouch ? 1.2 : 1.75);
  if (input && P.alive && keys.Space && P.onGround) { P.vy = 6.3; P.onGround = false; }
  P.vy -= 18 * dt; P.feet += P.vy * dt;
  const gr = groundAt(P.pos.x, P.pos.z, P.feet);
  if (P.feet <= gr) { P.feet = gr; P.vy = 0; P.onGround = true; }
  else if (P.onGround && P.vy <= 0 && P.feet - gr < 0.45) { P.feet = gr; P.vy = 0; }
  else P.onGround = false;
  P.eye = lerp(P.eye, P.alive ? (P.crouch ? 1.05 : 1.65) : 0.45, 1 - Math.exp(-12 * dt));
  // weapon state
  if (reloading && G.time >= reloadEnd) { const take = Math.min(s.mag - g.magLeft, g.reserveLeft); g.magLeft += take; g.reserveLeft -= take; reloading = false; beep(700, .04, .08); }
  swapT = Math.min(1, swapT + dt / .35);
  adsT = clamp(adsT + (aiming ? dt : -dt) / s.adsTime, 0, 1);
  if (input && P.alive && (s.auto ? mouse.l : trigger) && G.time >= nextShot && !P.sprint) fire();
  trigger = false;
  // scope sway
  const scoped = s.overlay && adsT > .9;
  let swayX = 0, swayY = 0;
  if (scoped && s.sway) {
    const steady = keys.ShiftLeft && P.breath > 0;
    P.breath = clamp(P.breath + (steady ? -dt / 4 : dt / 6), 0, 1);
    const amp = (steady ? .12 : 1) * (P.breath <= 0 ? 1.6 : 1) * 0.006;
    swayX = (Math.sin(G.time * 1.1) + Math.sin(G.time * 2.7) * .5) * amp; swayY = (Math.cos(G.time * 1.6) * .8 + Math.sin(G.time * .7) * .4) * amp;
  } else P.breath = clamp(P.breath + dt / 6, 0, 1);
  // camera
  const ease = adsT * adsT * (3 - 2 * adsT);
  camera.fov = lerp(75, s.fov, ease) + (P.sprint ? 4 : 0);
  camera.updateProjectionMatrix();
  camera.position.set(P.pos.x, P.feet + P.eye, P.pos.z);
  camera.rotation.set(P.pitch + swayY, P.yaw + swayX, P.alive ? 0 : 0.4);
  // viewmodel
  const spdH = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround) bob += spdH * dt * (P.sprint ? 1.25 : 1.6);
  kick = Math.max(0, kick - dt * 9);
  guns.forEach((x, i) => x.m.group.visible = i === cur && P.alive && !scoped);
  const gp = g.m.group.position;
  gp.lerpVectors(g.m.hip, g.m.adsPos, ease);
  const bobAmp = (1 - ease * .9) * Math.min(1, spdH / 6);
  gp.x += Math.sin(bob) * .012 * bobAmp; gp.y += Math.abs(Math.cos(bob)) * .012 * bobAmp;
  const heavy = s.recoilV > .03;
  gp.z += kick * (heavy ? .09 : .035) * (1 - ease * .5);
  let rx = kick * (heavy ? .18 : .06) * (1 - ease * .6), rz = 0, ry = 0;
  if (reloading) { const k = 1 - (reloadEnd - G.time) / s.reload, d = Math.sin(Math.PI * clamp(k, 0, 1)); gp.y -= d * .12; rx -= d * .5; rz = d * .5; }
  if (swapT < 1) { gp.y -= (1 - swapT) * .3; rx -= (1 - swapT) * .6; }
  if (P.sprint) { gp.x -= .04; gp.y -= .03; ry = .55; rz = .25; }
  g.m.group.rotation.set(rx, ry, rz);
  flashT -= dt; g.m.flash.visible = flashT > 0; if (g.m.flash.visible) g.m.flash.rotation.z = Math.random() * 3;
  return { scoped, spdH };
}

/* ---------- solo ---------- */
function clearSolo() {
  bots.forEach(b => { if (!b.dead) disposeRobot(b.rb); }); bots = [];
  clearLoot(); clearFx();
}
function startSolo() {
  G.mode = 'solo';
  clearSolo();
  if (world.id !== G.map) loadMap(G.map);
  G.over = false; G.time = 0; G.acc = 0.72 + G.round * 0.07;
  G.stats = { kills: 0, heads: 0, shots: 0, hits: 0, deaths: 0 };
  const H = world.half, k = H / 200;
  Z.cx = R(-0.17, 0.17) * H; Z.cz = R(-0.17, 0.17) * H; Z.r = Z.startR = H * 0.93; Z.phase = 0; Z.t = 0; Z.state = 'wait';
  Z.phases = BASE_PHASES.map(p => ({ wait: p.wait * (0.55 + 0.45 * k), to: p.to * H, shrink: p.shrink * (0.6 + 0.4 * k) }));
  zoneMesh.visible = true;
  const [px, pz] = randomClear(Z.cx, Z.cz, H * 0.6, 1.2);
  P.pos.set(px, 0, pz); P.feet = groundAt(px, pz, 999); P.vel.set(0, 0, 0); P.vy = 0;
  P.yaw = Math.atan2(-(Z.cx - px), -(Z.cz - pz)); P.pitch = 0;
  P.hp = 100; P.armor = 0; P.alive = true; P.crouch = false; P.breath = 1;
  equip();
  const n = Math.max(3, Math.min(32, Math.round((6 + G.round * 3) * clamp(H / 170, 0.3, 1))));
  botSerial = 1;
  for (let i = 0; i < n; i++) {
    let x, z, tries = 0;
    do { [x, z] = randomClear(Z.cx, Z.cz, H * 0.75, 1); tries++; } while (Math.hypot(x - px, z - pz) < Math.min(45, H * 0.6) && tries < 40);
    bots.push(new Bot(x, z));
  }
  const nl = Math.round(26 * clamp(k, 0.3, 1));
  for (let i = 0; i < nl; i++) { const [x, z] = randomClear(Z.cx, Z.cz, H * 0.85, .8); spawnLoot(i % 3 === 0 ? 'armor' : 'ammo', x, z); }
  const lx = px - Math.sin(P.yaw) * 3, lz = pz - Math.cos(P.yaw) * 3;
  if (isClear(lx, lz, .5)) spawnLoot('armor', lx, lz);
  setTopChips();
  $('feed').innerHTML = '';
  feed(`Round ${G.round} · ${MAPS[world.id].name} · ${n} bots`);
}
function aliveCount() { return bots.filter(b => !b.dead).length; }
function checkWin() { if (G.mode === 'solo' && G.playing && !G.over && P.alive && aliveCount() === 0) endSolo(true); }
function soloDie() { P.alive = false; G.stats.deaths++; feed('You were knocked out'); setTimeout(() => endSolo(false), 1200); }
function updateZone(dt) {
  const ph = Z.phases[Math.min(Z.phase, Z.phases.length - 1)];
  Z.t += dt;
  if (Z.phase < Z.phases.length) {
    if (Z.state === 'wait' && Z.t >= ph.wait) { Z.state = 'shrink'; Z.t = 0; Z.startR = Z.r; }
    else if (Z.state === 'shrink') { const k = Math.min(1, Z.t / ph.shrink); Z.r = lerp(Z.startR, ph.to, k); if (k >= 1) { Z.phase++; Z.state = 'wait'; Z.t = 0; } }
  }
  zoneMesh.position.set(Z.cx, 55, Z.cz); zoneMesh.scale.set(Z.r, 1, Z.r);
  const out = Math.hypot(P.pos.x - Z.cx, P.pos.z - Z.cz) > Z.r;
  $('zonetint').style.opacity = out && P.alive ? 1 : 0;
  if (out && P.alive) { hurt(zoneDps() * dt, null); if (Math.random() < dt * 2) toast('OUTSIDE THE ZONE'); }
}
function endSolo(won) {
  if (G.over) return; G.over = true;
  G.playing = false; mouse.l = mouse.r = false;
  if (document.exitPointerLock && locked) document.exitPointerLock();
  const s = G.stats;
  $('endeye').textContent = `Round ${G.round} · ${MAPS[world.id].name}`;
  $('endtitle').textContent = won ? 'Sector cleared' : 'Knocked out';
  $('sk0').textContent = 'KILLS'; $('sh0').textContent = 'HEADSHOTS';
  $('sk').textContent = s.kills; $('sh').textContent = s.heads;
  $('sa').textContent = s.shots ? Math.round(s.hits / s.shots * 100) + '%' : '—';
  $('st').textContent = fmt(G.time);
  if (won) { G.round++; store.set('round', G.round); $('again').textContent = `Start round ${G.round}`; }
  else $('again').textContent = 'Try again';
  $('again').hidden = false; $('endTeams').hidden = true; $('endStatus').textContent = '';
  $('hud').hidden = true; $('end').hidden = false;
}

/* ---------- online team match ---------- */
// What every player knows (the host too)
const MP = { me: null, team: 0, players: new Map(), avatars: new Map(), score: [0, 0], limit: 25, map: 'docks', state: 'idle',
  endAt: 0, sendT: 0, respawnAt: 0, lobby: null, myName: '' };
// What only the host knows
const HS = { players: new Map(), order: 0, map: 'docks', limit: 25, state: 'lobby', score: [0, 0], endAt: 0, snapT: 0, endTimer: null };
const MATCH_MINUTES = 10;

function mpSend(msg) { if (Net.isHost) hostHandle('H', msg); else Net.sendHost(msg); }
function hostBroadcast(msg, except) { Net.sendAll(msg, except); if (except !== 'H') clientHandle(msg); }
function teamCounts() { const c = [0, 0]; for (const p of HS.players.values()) c[p.team]++; return c; }
function rosterList() { return [...HS.players.values()].sort((a, b) => a.order - b.order).map(p => ({ id: p.id, name: p.name, team: p.team, k: p.k, d: p.d })); }
function lobbyMsg() { return { t: 'lobby', code: Net.code, map: HS.map, limit: HS.limit, state: HS.state, players: rosterList() }; }
function broadcastLobby() { hostBroadcast(lobbyMsg()); }
function cleanName(n) { n = String(n || '').replace(/[^\w .\-]/g, '').trim().slice(0, 14); return n || 'Player'; }
function hostAddPlayer(id, name) {
  const c = teamCounts();
  const p = { id, name: cleanName(name), team: c[0] <= c[1] ? 0 : 1, k: 0, d: 0, hp: 100, alive: false, st: [0, 0, 0, 0, 0, 0], lastHit: 0, spawnT: 0, order: ++HS.order };
  HS.players.set(id, p);
  return p;
}
function hostEvenTeams(shuffle) {
  const list = [...HS.players.values()].sort((a, b) => a.order - b.order);
  if (shuffle) for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
  list.forEach((p, i) => p.team = i % 2);
}
// After someone leaves mid-match: if one side is up by two, move the newest player across
function hostRebalance() {
  const c = teamCounts();
  if (Math.abs(c[0] - c[1]) < 2) return;
  const big = c[0] > c[1] ? 0 : 1;
  const mover = [...HS.players.values()].filter(p => p.team === big).sort((a, b) => b.order - a.order)[0];
  if (!mover) return;
  mover.team = 1 - big;
  hostBroadcast({ t: 'note', m: `${mover.name} moved to ${TEAM[mover.team].name} to even the teams` });
  if (HS.state === 'match' && mover.alive) { mover.alive = false; hostBroadcast({ t: 'roster', players: rosterList() }); hostRespawn(mover, 1.5); return; }
}
function hostSpawnPoint(team) {
  const enemies = [...HS.players.values()].filter(p => p.team !== team && p.alive);
  let best = null, bestD = -1;
  for (const [x, z] of world.spawns[team]) {
    let d = 1e9; for (const e of enemies) d = Math.min(d, Math.hypot(e.st[0] - x, e.st[2] - z));
    d += Math.random() * 6;
    if (d > bestD) { bestD = d; best = [x, z]; }
  }
  return best || [0, 0];
}
function hostRespawn(p, delay) {
  setTimeout(() => {
    if (HS.state !== 'match' || !HS.players.has(p.id)) return;
    const [x, z] = hostSpawnPoint(p.team);
    p.hp = 100; p.alive = true; p.spawnT = performance.now(); p.st[0] = x; p.st[2] = z;
    hostBroadcast({ t: 'spawn', id: p.id, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
  }, delay * 1000);
}
function hostStartMatch() {
  if (HS.players.size < 2 || HS.state === 'match') return;
  clearTimeout(HS.endTimer);
  loadMap(HS.map);
  HS.state = 'match'; HS.score = [0, 0]; HS.endAt = performance.now() + MATCH_MINUTES * 60000;
  const spawns = {}, used = [0, 0];
  for (const p of HS.players.values()) {
    p.k = 0; p.d = 0; p.hp = 100; p.alive = true; p.spawnT = performance.now();
    const pts = world.spawns[p.team], pt = pts[(used[p.team]++) % pts.length];
    p.st[0] = pt[0]; p.st[2] = pt[1]; spawns[p.id] = pt;
  }
  hostBroadcast({ t: 'start', map: HS.map, limit: HS.limit, endIn: MATCH_MINUTES * 60000, score: HS.score, players: rosterList(), spawns });
}
function hostEndMatch() {
  if (HS.state !== 'match') return;
  HS.state = 'ended';
  const win = HS.score[0] === HS.score[1] ? -1 : HS.score[0] > HS.score[1] ? 0 : 1;
  hostBroadcast({ t: 'end', score: HS.score, win, players: rosterList() });
  HS.endTimer = setTimeout(() => { HS.state = 'lobby'; for (const p of HS.players.values()) p.alive = false; broadcastLobby(); }, 9000);
}
function hostHandle(id, m) {
  const p = HS.players.get(id);
  if (m.t === 'hello') {
    if (p) return;
    if (HS.players.size >= 8) { Net.sendTo(id, { t: 'full' }); setTimeout(() => Net.kick(id), 300); return; }
    const np = hostAddPlayer(id, m.name);
    Net.sendTo(id, { t: 'welcome', id });
    if (HS.state === 'match') {
      const left = Math.max(0, HS.endAt - performance.now());
      np.alive = false;
      Net.sendTo(id, { t: 'start', map: HS.map, limit: HS.limit, endIn: left, score: HS.score, players: rosterList(), spawns: {} });
      hostBroadcast({ t: 'roster', players: rosterList() }, id);
      hostBroadcast({ t: 'note', m: `${np.name} joined ${TEAM[np.team].name}` });
      hostRespawn(np, 1);
    } else broadcastLobby();
    return;
  }
  if (!p) return;
  if (m.t === 'st' && Array.isArray(m.p)) { for (let i = 0; i < 6; i++) p.st[i] = +m.p[i] || 0; }
  else if (m.t === 'shot' && HS.state === 'match' && p.alive) { hostBroadcast({ t: 'shot', id, a: m.a, b: m.b, s: m.s, q: m.q }, id); }
  else if (m.t === 'hit' && HS.state === 'match') {
    const v = HS.players.get(m.v), d = clamp(+m.d || 0, 0, 400);
    if (!v || !p.alive || !v.alive || v.team === p.team || d <= 0) return;
    if (performance.now() - v.spawnT < 1500) return; // spawn protection
    v.hp -= d; v.lastHit = performance.now();
    if (v.hp > 0) { hostBroadcast({ t: 'hp', id: v.id, hp: Math.round(v.hp), by: id }); return; }
    v.hp = 0; v.alive = false; v.d++; p.k++; HS.score[p.team]++;
    hostBroadcast({ t: 'kill', k: id, v: v.id, h: m.h ? 1 : 0, score: HS.score, kk: p.k, vd: v.d });
    if (HS.score[p.team] >= HS.limit) hostEndMatch(); else hostRespawn(v, 3.5);
  }
}
function hostLeave(id) {
  const p = HS.players.get(id); if (!p) return;
  HS.players.delete(id);
  hostBroadcast({ t: 'note', m: `${p.name} left` });
  hostRebalance();
  if (HS.state === 'lobby') hostEvenTeams(false);
  if (HS.state === 'match') hostBroadcast({ t: 'roster', players: rosterList() }); else broadcastLobby();
}
function hostTick(dt) {
  if (HS.state !== 'match') return;
  const now = performance.now();
  const me = HS.players.get('H');
  if (me) { me.st = [P.pos.x, P.feet, P.pos.z, P.yaw, P.pitch, P.crouch ? 1 : 0]; }
  for (const p of HS.players.values()) if (p.alive && p.hp < 100 && now - p.lastHit > 5000) p.hp = Math.min(100, p.hp + 22 * dt);
  HS.snapT -= dt;
  if (HS.snapT <= 0) {
    HS.snapT = 1 / 15;
    const r2 = v => Math.round(v * 100) / 100;
    const s = {};
    for (const p of HS.players.values()) s[p.id] = [r2(p.st[0]), r2(p.st[1]), r2(p.st[2]), r2(p.st[3]), r2(p.st[4]), p.st[5] ? 1 : 0, p.alive ? 1 : 0, Math.round(p.hp)];
    hostBroadcast({ t: 's', p: s });
  }
  if (now > HS.endAt) hostEndMatch();
}

/* --- every player, host included, reacts to these --- */
function nameOf(id) { const p = MP.players.get(id); return p ? escHtml(p.name) : 'someone'; }
function teamOf(id) { const p = MP.players.get(id); return p ? p.team : 0; }
function tagName(id) { return `<span class="${TEAM[teamOf(id)].css}">${nameOf(id)}</span>`; }
function clientHandle(m) {
  switch (m.t) {
    case 'welcome': MP.me = m.id; break;
    case 'full': uiJoinStatus('That match is full (8 players).', true); Net.close(); break;
    case 'lobby':
      MP.lobby = m; MP.map = m.map; MP.limit = m.limit;
      setRoster(m.players);
      if (m.state === 'lobby' && G.mode === 'tdm') leaveMatchToLobby();
      if (m.state === 'lobby' || !G.playing) uiShowLobby();
      break;
    case 'start': enterMatch(m); break;
    case 'roster': setRoster(m.players); syncAvatars(); break;
    case 'note': feed(escHtml(m.m)); break;
    case 's': if (G.mode === 'tdm') applySnap(m.p); break;
    case 'shot': {
      if (G.mode !== 'tdm' || m.id === MP.me) break;
      const a = new THREE.Vector3(...m.a), b = new THREE.Vector3(...m.b);
      tracer(a, b, true);
      sndShot(m.s, a.distanceTo(P.pos));
      const av = MP.avatars.get(m.id); if (av) { av.lastShot = G.time; av.quiet = !!m.q; }
      break;
    }
    case 'hp':
      if (m.id === MP.me) {
        if (m.hp < P.hp) { vignT = .35; const av = MP.avatars.get(m.by); if (av) dmgArc(av.pos); }
        P.hp = m.hp;
      }
      break;
    case 'kill': {
      MP.score = m.score;
      const kp = MP.players.get(m.k), vp = MP.players.get(m.v);
      if (kp) kp.k = m.kk; if (vp) vp.d = m.vd;
      feed(`${tagName(m.k)} → ${tagName(m.v)}${m.h ? ' · headshot' : ''}`);
      if (m.v === MP.me) { P.alive = false; P.hp = 0; G.stats.deaths++; MP.respawnAt = G.time + 3.5; $('respawnwho').textContent = 'KNOCKED OUT BY ' + (kp ? kp.name.toUpperCase() : 'SOMEONE'); }
      else { const av = MP.avatars.get(m.v); if (av) { av.alive = false; av.rb.group.visible = false; scrapBurst(av.pos.clone().setY(av.feet), TEAM[av.team].hex); } }
      if (m.k === MP.me) {
        G.stats.kills++; if (m.h) G.stats.heads++;
        hitMarker(true); beep(880, .12, .14, 'triangle'); beep(1320, .1, .1, 'triangle', .06);
        guns.forEach(g => g.reserveLeft = Math.min(g.s.reserve * 2, g.reserveLeft + g.s.mag));
      }
      break;
    }
    case 'spawn':
      if (m.id === MP.me) mpRespawn(m.x, m.z);
      else { const av = MP.avatars.get(m.id); if (av) { av.pos.set(m.x, groundAt(m.x, m.z, 999), m.z); av.target.copy(av.pos); av.feet = av.pos.y; av.alive = true; av.rb.group.visible = true; } }
      break;
    case 'end': showMatchEnd(m); break;
  }
}
function setRoster(list) {
  MP.players = new Map(list.map(p => [p.id, p]));
  const me = MP.players.get(MP.me);
  if (me) MP.team = me.team;
}
function makeNameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '600 34px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.6)'; x.strokeText(text, 128, 34);
  x.fillStyle = color; x.fillText(text, 128, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(2.2, .55, 1); sp.position.y = 2.65;
  return sp;
}
function disposeAvatar(av) {
  disposeRobot(av.rb);
  if (av.tag) { av.tag.material.map.dispose(); av.tag.material.dispose(); }
}
function syncAvatars() {
  for (const [id, av] of MP.avatars) {
    const p = MP.players.get(id);
    if (!p || p.team !== av.team || av.myTeam !== MP.team) { disposeAvatar(av); MP.avatars.delete(id); }
  }
  for (const p of MP.players.values()) {
    if (p.id === MP.me || MP.avatars.has(p.id)) continue;
    const t = TEAM[p.team];
    const rb = buildRobot(0x6d757c, t.visor, { remote: p.id }, t.hex);
    world.shootables.push(...rb.parts);
    const av = { id: p.id, team: p.team, myTeam: MP.team, rb, pos: new THREE.Vector3(), target: new THREE.Vector3(), feet: 0, yaw: 0, tyaw: 0,
      alive: false, lastShot: -99, quiet: false, tag: null };
    if (p.team === MP.team) { av.tag = makeNameTag(p.name, p.team ? '#8cc4ff' : '#ffc08a'); rb.group.add(av.tag); }
    rb.group.visible = false;
    MP.avatars.set(p.id, av);
  }
}
function applySnap(s) {
  for (const id in s) {
    const st = s[id];
    if (id === MP.me) { if (P.alive && st[6]) P.hp = st[7]; continue; }
    const av = MP.avatars.get(id); if (!av) continue;
    const wasAlive = av.alive;
    av.target.set(st[0], st[1], st[2]); av.tyaw = st[3]; av.crouch = st[5];
    if (st[6] && !wasAlive) { av.pos.copy(av.target); av.feet = st[1]; }
    av.alive = !!st[6]; av.rb.group.visible = av.alive;
  }
}
function updateAvatars(dt) {
  const k = 1 - Math.exp(-14 * dt);
  for (const av of MP.avatars.values()) {
    if (!av.alive) continue;
    const ox = av.pos.x, oz = av.pos.z;
    av.pos.x = lerp(av.pos.x, av.target.x, k); av.pos.z = lerp(av.pos.z, av.target.z, k); av.feet = lerp(av.feet, av.target.y, k);
    // camera yaw looks down -z; the robot faces +z, so turn it half a circle
    let d = (av.tyaw + Math.PI) - av.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); av.yaw += d * k;
    const bobY = animateRobot(av.rb, Math.hypot(av.pos.x - ox, av.pos.z - oz), dt);
    av.rb.group.position.set(av.pos.x, av.feet + bobY - (av.crouch ? .35 : 0), av.pos.z);
    av.rb.group.rotation.y = av.yaw;
  }
}
function setTopChips() {
  const t = $('topc');
  if (G.mode === 'tdm') {
    t.innerHTML = `<div class="chip t0${MP.team === 0 ? ' mine' : ''}"><div class="k">ORANGE</div><div class="v" id="sc0">0</div></div>
      <div class="chip"><div class="k" id="tdmk">FIRST TO ${MP.limit}</div><div class="v" id="tdmt">10:00</div></div>
      <div class="chip t1${MP.team === 1 ? ' mine' : ''}"><div class="k">BLUE</div><div class="v" id="sc1">0</div></div>
      <div class="chip"><div class="k">YOU K/D</div><div class="v" id="kd">0/0</div></div>`;
  } else {
    t.innerHTML = `<div class="chip zone" id="zonechip"><div class="k" id="zonek">ZONE MOVES</div><div class="v" id="zonev">0:30</div></div>
      <div class="chip"><div class="k">BOTS LEFT</div><div class="v" id="alive">0</div></div>
      <div class="chip"><div class="k">KILLS</div><div class="v" id="kills">0</div></div>
      <div class="chip"><div class="k">ROUND</div><div class="v" id="roundv">${G.round}</div></div>`;
  }
  for (const k in hudCache) if (/^(sc0|sc1|tdmk|tdmt|kd|zonek|zonev|alive|kills|roundv)$/.test(k)) delete hudCache[k];
  $('armorrow').hidden = G.mode === 'tdm';
}
function clearAvatars() { for (const av of MP.avatars.values()) disposeAvatar(av); MP.avatars.clear(); }
function enterMatch(m) {
  G.mode = 'tdm'; G.over = false; G.time = 0; G.stats = { kills: 0, heads: 0, shots: 0, hits: 0, deaths: 0 };
  clearSolo(); clearAvatars(); zoneMesh.visible = false; $('zonetint').style.opacity = 0;
  MP.state = 'match'; MP.map = m.map; MP.limit = m.limit; MP.score = m.score; MP.endAt = G.time + m.endIn / 1000;
  if (world.id !== m.map) loadMap(m.map);
  setRoster(m.players); syncAvatars();
  equip();
  const sp = m.spawns[MP.me];
  if (sp) mpRespawn(sp[0], sp[1]);
  else { P.alive = false; MP.respawnAt = G.time + 1; $('respawnwho').textContent = 'JOINING ' + TEAM[MP.team].name.toUpperCase(); P.pos.set(0, 0, 0); P.feet = groundAt(0, 0, 999) + 20; }
  setTopChips();
  $('feed').innerHTML = '';
  feed(`Team deathmatch · ${MAPS[m.map].name} · you're on <span class="${TEAM[MP.team].css}">${TEAM[MP.team].name}</span>`);
  uiEnterGame(true);
}
function mpRespawn(x, z) {
  if (pendingLoadout) equip(); else guns.forEach(g => { g.magLeft = g.s.mag; g.reserveLeft = g.s.reserve; });
  P.pos.set(x, 0, z); P.feet = groundAt(x, z, 999); P.vel.set(0, 0, 0); P.vy = 0;
  P.yaw = Math.atan2(x, z); // face the middle of the map
  P.pitch = 0; P.hp = 100; P.alive = true; P.crouch = false; adsT = 0; reloading = false;
}
function leaveMatchToLobby() {
  G.playing = false; G.mode = null; MP.state = 'lobby';
  clearAvatars(); clearFx();
  if (document.exitPointerLock && locked) document.exitPointerLock();
  $('hud').hidden = true; $('pause').hidden = true; $('end').hidden = true;
}
function showMatchEnd(m) {
  setRoster(m.players);
  G.over = true; mouse.l = mouse.r = false;
  if (document.exitPointerLock && locked) document.exitPointerLock();
  const mine = MP.team;
  $('endeye').textContent = `Team deathmatch · ${MAPS[MP.map].name}`;
  $('endtitle').textContent = m.win === -1 ? `Draw ${m.score[0]}–${m.score[1]}` : (m.win === mine ? 'Your team won ' : 'Your team lost ') + `${m.score[mine]}–${m.score[1 - mine]}`;
  const s = G.stats;
  $('sk0').textContent = 'KILLS'; $('sh0').textContent = 'DEATHS';
  $('sk').textContent = s.kills; $('sh').textContent = s.deaths;
  $('sa').textContent = s.shots ? Math.round(s.hits / s.shots * 100) + '%' : '—';
  $('st').textContent = fmt(G.time);
  $('endTeams').innerHTML = teamsHtml(m.players, true, m.score); $('endTeams').hidden = false;
  $('again').hidden = true;
  $('endStatus').textContent = 'Back to the lobby in a few seconds.';
  $('hud').hidden = true; $('pause').hidden = true; $('end').hidden = false;
  G.paused = true;
}
function teamsHtml(list, withKd, score) {
  const cols = [0, 1].map(t => {
    const ps = list.filter(p => p.team === t);
    if (withKd) ps.sort((a, b) => b.k - a.k || a.d - b.d);
    const items = ps.map(p => `<li class="${p.id === MP.me ? 'me' : ''}"><span>${escHtml(p.name)}${p.id === 'H' ? ' · host' : ''}</span>${withKd ? `<span class="kd">${p.k} / ${p.d}</span>` : ''}</li>`).join('')
      || '<li class="empty">Nobody yet</li>';
    return `<div class="team t${t}"><h3><span>${TEAM[t].name}</span><span>${score ? score[t] : ps.length + (ps.length === 1 ? ' player' : ' players')}</span></h3><ol>${items}</ol></div>`;
  });
  return cols.join('');
}
function updateTdm(dt) {
  if (Net.isHost) hostTick(dt);
  updateAvatars(dt);
  MP.sendT -= dt;
  if (MP.sendT <= 0 && !Net.isHost) {
    MP.sendT = 1 / 15;
    const r2 = v => Math.round(v * 100) / 100;
    Net.sendHost({ t: 'st', p: [r2(P.pos.x), r2(P.feet), r2(P.pos.z), r2(P.yaw), r2(P.pitch), P.crouch ? 1 : 0] });
  }
  const rs = $('respawn');
  if (!P.alive && !G.over) { rs.hidden = false; setText('respawnn', String(Math.max(0, Math.ceil(MP.respawnAt - G.time)))); }
  else rs.hidden = true;
}

/* ---------- per-frame ---------- */
function update(dt) {
  G.time += dt;
  const input = !G.paused && !G.over;
  const { scoped, spdH } = updatePlayer(dt, input);
  if (G.mode === 'solo') {
    for (const b of bots) if (!b.dead) b.update(dt);
    updateZone(dt);
    updateLoot(dt);
    if (P.alive && G.time - P.lastHurt > 4.5 && P.hp < 100) P.hp = Math.min(100, P.hp + 22 * dt);
  } else if (G.mode === 'tdm') updateTdm(dt);
  updateHUD(dt, scoped, spdH);
}
const mm = $('minimap'), mctx = mm.getContext('2d');
function updateHUD(dt, scoped, spdH) {
  const g = guns[cur], s = g.s;
  setText('hpv', String(Math.ceil(P.hp))); setText('arv', String(Math.ceil(P.armor)));
  $('hpbar').firstChild.style.width = P.hp + '%'; $('arbar').firstChild.style.width = P.armor + '%';
  setText('ammon', `${g.magLeft} <small>/ ${g.reserveLeft}</small>`);
  setText('wname', `${s.name}`);
  setText('watt', escHtml(modSummary(loadout[cur])));
  setText('slot0', '1 ' + escHtml(guns[0].s.name.toUpperCase())); setText('slot1', '2 ' + escHtml(guns[1].s.name.toUpperCase()));
  $('slot0').classList.toggle('on', cur === 0); $('slot1').classList.toggle('on', cur === 1);
  if (G.mode === 'solo') {
    setText('alive', String(aliveCount())); setText('kills', String(G.stats.kills));
    const ph = Z.phases[Z.phase];
    if (!ph) { setText('zonek', 'FINAL ZONE'); setText('zonev', '—'); }
    else if (Z.state === 'wait') { setText('zonek', 'ZONE MOVES'); setText('zonev', fmt(ph.wait - Z.t)); }
    else { setText('zonek', 'ZONE CLOSING'); setText('zonev', fmt(ph.shrink - Z.t)); }
    const zc = $('zonechip'); if (zc) zc.classList.toggle('closing', Z.state === 'shrink');
  } else {
    setText('sc0', String(MP.score[0])); setText('sc1', String(MP.score[1]));
    setText('tdmt', fmt(MP.endAt - G.time)); setText('kd', `${G.stats.kills}/${G.stats.deaths}`);
    const showBoard = keys.Tab && !G.over;
    $('board').hidden = !showBoard;
    if (showBoard) setText('board', `<div class="teams">${teamsHtml([...MP.players.values()], true, MP.score)}</div>`);
  }
  let prompt = '';
  if (!P.alive) prompt = '';
  else if (reloading) prompt = 'RELOADING';
  else if (g.magLeft === 0 && g.reserveLeft === 0) prompt = 'NO AMMO · SWITCH GUNS';
  else if (g.magLeft <= Math.ceil(s.mag * .2)) prompt = 'PRESS R TO RELOAD';
  setText('prompt', prompt);
  toastTimer -= dt; $('toast').style.opacity = toastTimer > 0 ? 1 : 0;
  hitTimer -= dt; $('hit').style.opacity = hitTimer > 0 ? 1 : 0;
  vignT -= dt; $('vign').style.opacity = Math.max(0, vignT * 2.5) + (P.alive && P.hp < 35 ? (35 - P.hp) / 50 : 0);
  const moveMul = (1 + spdH / 6 * .9) * (P.onGround ? 1 : 2.2) * (P.crouch ? .75 : 1);
  const spread = s.pellets > 1 ? lerp(s.pelHip, s.ads, adsT) : lerp(s.hip, s.ads, adsT) * moveMul;
  const gap = 4 + spread * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
  const ch = $('cross').children;
  ch[0].style.top = (-gap - 9) + 'px'; ch[1].style.top = gap + 'px'; ch[2].style.left = (-gap - 9) + 'px'; ch[3].style.left = gap + 'px';
  $('cross').style.opacity = adsT > .4 || P.sprint || !P.alive ? 0 : 1;
  $('scope').hidden = !scoped; $('scope').className = 'hud' + (s.overlay === 'x3' ? ' x3' : '');
  $('breath').hidden = !(scoped && s.sway);
  if (scoped && s.sway) $('breathfill').style.width = (P.breath * 100) + '%';
  drawMinimap();
}
function modSummary(sl) {
  const out = [OPTICS[sl.att.optic].name];
  for (const cat of ['muzzle', 'barrel', 'under', 'mag', 'stock']) { const v = sl.att[cat]; if (v !== 'none' && v !== 'std') out.push(MODS[cat][v].name); }
  return out.join(' · ');
}
function drawMinimap() {
  const W2 = mm.width, c = W2 / 2, range = Math.min(110, world.half * 1.1), sc = W2 / 2 / range;
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, W2, W2);
  mctx.save(); mctx.beginPath(); mctx.rect(0, 0, W2, W2); mctx.clip();
  mctx.translate(c, c); mctx.scale(sc, sc); mctx.rotate(P.yaw); mctx.translate(-P.pos.x, -P.pos.z);
  mctx.fillStyle = 'rgba(205,214,200,.55)';
  for (const b of world.boxes) { if (Math.abs(b.minX - P.pos.x) > range * 1.5 || Math.abs(b.minZ - P.pos.z) > range * 1.5) continue; mctx.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ); }
  const dot = (x, z, col, r = 3.2) => { mctx.fillStyle = col; mctx.beginPath(); mctx.arc(x, z, r / sc, 0, Math.PI * 2); mctx.fill(); };
  if (G.mode === 'solo') {
    mctx.lineWidth = 2.2 / sc; mctx.strokeStyle = '#8d7dff';
    mctx.beginPath(); mctx.arc(Z.cx, Z.cz, Z.r, 0, Math.PI * 2); mctx.stroke();
    const ph = Z.phases[Z.phase];
    if (ph && Z.state === 'wait') { mctx.setLineDash([6 / sc, 5 / sc]); mctx.strokeStyle = 'rgba(255,255,255,.8)'; mctx.beginPath(); mctx.arc(Z.cx, Z.cz, ph.to, 0, Math.PI * 2); mctx.stroke(); mctx.setLineDash([]); }
    for (const b of bots) if (!b.dead && G.time - b.lastFired < 2.5) dot(b.pos.x, b.pos.z, '#ffb547');
  } else {
    for (const av of MP.avatars.values()) {
      if (!av.alive) continue;
      if (av.team === MP.team) dot(av.pos.x, av.pos.z, av.team ? '#4fa3ff' : '#ff9a3c');
      else if (G.time - av.lastShot < 2 && !av.quiet) dot(av.pos.x, av.pos.z, '#ff5c4d', 3.6);
    }
  }
  mctx.restore();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.fillStyle = '#ffffff'; mctx.beginPath(); mctx.moveTo(c, c - 9); mctx.lineTo(c + 6, c + 6); mctx.lineTo(c, c + 2); mctx.lineTo(c - 6, c + 6); mctx.closePath(); mctx.fill();
}

/* ---------- input ---------- */
function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && G.playing && !G.paused && !G.over) uiPause();
});
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  keys[e.code] = true;
  if (!G.playing) return;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (G.paused) return;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'Digit1') swapTo(0); if (e.code === 'Digit2') swapTo(1);
  if (e.code === 'KeyC') P.crouch = !P.crouch;
  if (e.code === 'Escape' && !locked) uiPause();
});
addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousedown', e => {
  if (!G.playing || G.paused) return;
  if (!locked) lock();
  if (e.button === 0) { mouse.l = true; trigger = true; }
  if (e.button === 2) mouse.r = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
addEventListener('contextmenu', e => { if (G.playing) e.preventDefault(); });
addEventListener('mousemove', e => {
  if (!G.playing || G.paused || !P.alive) return;
  const s = 0.0022 * sens * (camera.fov / 75);
  P.yaw -= (e.movementX || 0) * s; P.pitch = clamp(P.pitch - (e.movementY || 0) * s, -1.5, 1.5);
});
addEventListener('wheel', e => { if (G.playing && !G.paused) swapTo(1 - cur); }, { passive: true });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });

/* ---------- loop ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  wCam.aspect = w / h; wCam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
let last = performance.now(), menuT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const live = G.playing && (G.mode === 'tdm' || !G.paused);
  if (live) update(dt);
  else if (!G.playing) {
    menuT += dt * 0.04;
    const r = Math.min(95, world.half * 0.9);
    camera.fov = 60; camera.updateProjectionMatrix();
    camera.position.set(Math.cos(menuT) * r, Math.max(18, r * 0.36), Math.sin(menuT) * r);
    camera.lookAt(0, 4, 0);
    if (Net.isHost && HS.state === 'match') hostTick(dt);
  }
  if (live || !G.playing) updateFx(dt);
  const fp = camera.position;
  sun.position.set(fp.x + 60, fp.y + 110, fp.z + 35); sun.target.position.set(fp.x, 0, fp.z);
  renderer.clear();
  renderer.render(scene, camera);
  if (G.playing) { renderer.clearDepth(); renderer.render(wScene, wCam); }
}
