/* Online: the host's browser runs the match (health, kills, the zone, who
   opened which crate) and everyone else sends what they see. Three modes:
   team deathmatch (two even teams), free-for-all, and battle royale in squads
   of 1-4, with the squads split evenly. Up to 8 people. */

// What every player knows (the host too)
const MP = { me: null, team: 0, players: new Map(), avatars: new Map(), score: [], rules: { kind: 'tdm', squad: 2, limit: 25 }, map: 'docks', state: 'idle',
  endAt: 0, sendT: 0, pingT: 0, respawnAt: 0, lobby: null, myName: '', killer: '', out: false };
// What only the host knows
const HS = { players: new Map(), order: 0, map: 'docks', rules: { kind: 'tdm', squad: 2, limit: 25 }, state: 'lobby', score: [], endAt: 0, snapT: 0, endTimer: null, seed: 0, opened: new Set(), vehOwner: new Map() };
const MATCH_MINUTES = 10, MAX_PLAYERS = 16;

function mpSend(msg) { if (Net.isHost) hostHandle('H', msg); else Net.sendHost(msg); }
function hostBroadcast(msg, except) { Net.sendAll(msg, except); if (except !== 'H') clientHandle(msg); }
function rosterList() { return [...HS.players.values()].sort((a, b) => a.order - b.order).map(p => ({ id: p.id, name: p.name, team: p.team, k: p.k, d: p.d, out: p.out ? 1 : 0 })); }
function teamCountFor(rules, n) { return rules.kind === 'tdm' ? 2 : rules.kind === 'ffa' ? Math.max(1, n) : Math.max(1, Math.ceil(n / rules.squad)); }
function lobbyMsg() { return { t: 'lobby', code: Net.code, map: HS.map, rules: HS.rules, state: HS.state, players: rosterList() }; }
function broadcastLobby() { hostBroadcast(lobbyMsg()); }
function cleanName(n) { n = String(n || '').replace(/[^\w .\-]/g, '').trim().slice(0, 14); return n || 'Player'; }
function cleanRules(r) {
  const kind = ['tdm', 'ffa', 'br'].includes(r && r.kind) ? r.kind : 'tdm';
  return { kind, squad: clamp(Math.round(+(r && r.squad) || 2), 1, 4), limit: [15, 25, 40].includes(+(r && r.limit)) ? +r.limit : 25 };
}
// Teams are dealt out like cards, so they are always as even as they can be
function hostAssignTeams(shuffle) {
  const list = [...HS.players.values()].sort((a, b) => a.order - b.order);
  if (shuffle) for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
  const T = teamCountFor(HS.rules, list.length);
  list.forEach((p, i) => { p.team = i % T; p.out = false; });
}
function hostTeams() { return new Set([...HS.players.values()].filter(p => !p.out).map(p => p.team)); }
function hostAddPlayer(id, name) {
  const p = { id, name: cleanName(name), team: 0, k: 0, d: 0, hp: 100, armor: 0, alive: false, out: false, st: [0, 0, 0, 0, 0, 0, -1], lastHit: 0, spawnT: 0, order: ++HS.order };
  HS.players.set(id, p);
  if (HS.state !== 'match') hostAssignTeams(false);
  else if (HS.rules.kind === 'tdm') { const c = [0, 0]; for (const q of HS.players.values()) if (q !== p) c[q.team]++; p.team = c[0] <= c[1] ? 0 : 1; }
  else { const used = new Set([...HS.players.values()].filter(q => q !== p).map(q => q.team)); let t = 0; while (used.has(t)) t++; p.team = t; if (HS.rules.kind === 'br') p.out = true; }
  return p;
}
// After someone leaves a team match: if one side is up by two, move the newest player across
function hostRebalance() {
  if (HS.rules.kind !== 'tdm') return;
  const c = [0, 0]; for (const p of HS.players.values()) c[p.team]++;
  if (Math.abs(c[0] - c[1]) < 2) return;
  const big = c[0] > c[1] ? 0 : 1;
  const mover = [...HS.players.values()].filter(p => p.team === big).sort((a, b) => b.order - a.order)[0];
  if (!mover) return;
  mover.team = 1 - big;
  hostBroadcast({ t: 'note', m: `${mover.name} moved to ${TEAM[mover.team % TEAM.length].name} to even the teams` });
  if (HS.state === 'match' && mover.alive) { mover.alive = false; hostBroadcast({ t: 'roster', players: rosterList() }); hostRespawn(mover, 1.5); }
}
function hostSpawnPoint(p) {
  const enemies = [...HS.players.values()].filter(q => q.team !== p.team && q.alive);
  const cands = HS.rules.kind === 'tdm' ? world.spawns[p.team % 2] : Array.from({ length: 24 }, () => randomClear(0, 0, world.half * 0.85, 1.2));
  let best = null, bestD = -1;
  for (const [x, z] of cands) {
    let d = 1e9; for (const e of enemies) d = Math.min(d, Math.hypot(e.st[0] - x, e.st[2] - z));
    d += Math.random() * 6;
    if (d > bestD) { bestD = d; best = [x, z]; }
  }
  return best || [0, 0];
}
function hostRespawn(p, delay) {
  setTimeout(() => {
    if (HS.state !== 'match' || !HS.players.has(p.id) || HS.rules.kind === 'br') return;
    const [x, z] = hostSpawnPoint(p);
    p.hp = 100; p.armor = 0; p.alive = true; p.spawnT = performance.now(); p.st[0] = x; p.st[2] = z;
    hostBroadcast({ t: 'spawn', id: p.id, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
  }, delay * 1000);
}
function hostCanStart() { return HS.players.size >= 2 && teamCountFor(HS.rules, HS.players.size) >= 2; }
function hostStartMatch() {
  if (!hostCanStart() || HS.state === 'match') return;
  clearTimeout(HS.endTimer);
  hostAssignTeams(false);
  loadMap(HS.map);
  HS.state = 'match'; HS.score = Array(MAX_PLAYERS).fill(0); HS.endAt = performance.now() + MATCH_MINUTES * 60000;
  HS.seed = (Math.random() * 4e9) >>> 0; HS.opened = new Set(); HS.vehOwner = new Map();
  const spawns = {}, used = {}, H = world.half, br = HS.rules.kind === 'br';
  let zone = null;
  if (br) zone = [Math.round(R(-0.17, 0.17) * H), Math.round(R(-0.17, 0.17) * H)];
  const teams = [...hostTeams()].sort((a, b) => a - b), drops = {};
  const a0 = R(0, 6.28);
  teams.forEach((t, i) => { const a = a0 + i / teams.length * Math.PI * 2, rr = H * R(0.35, 0.65); drops[t] = randomClear(Math.cos(a) * rr, Math.sin(a) * rr, 10, 1.2); });
  const taken = [];
  for (const p of HS.players.values()) {
    p.k = 0; p.d = 0; p.hp = 100; p.armor = 0; p.alive = true; p.out = false; p.spawnT = performance.now();
    let pt;
    if (br) pt = [drops[p.team][0] + R(-4, 4), drops[p.team][1] + R(-4, 4), BR_DROP];
    else if (HS.rules.kind === 'tdm') { const pts = world.spawns[p.team]; used[p.team] = (used[p.team] || 0) + 1; pt = pts[(used[p.team] - 1) % pts.length]; }
    else { let best = null, bd = -1; for (let i = 0; i < 24; i++) { const c = randomClear(0, 0, H * 0.85, 1.2); let d = 1e9; for (const q of taken) d = Math.min(d, Math.hypot(q[0] - c[0], q[1] - c[1])); if (d > bd) { bd = d; best = c; } } pt = best; taken.push(best); }
    p.st[0] = pt[0]; p.st[2] = pt[1]; spawns[p.id] = pt.map(v => Math.round(v * 100) / 100);
  }
  hostBroadcast({ t: 'start', map: HS.map, rules: HS.rules, endIn: MATCH_MINUTES * 60000, score: HS.score, players: rosterList(), spawns, seed: HS.seed, zone });
}
function hostEndMatch(winTeam) {
  if (HS.state !== 'match') return;
  HS.state = 'ended';
  let win = winTeam;
  if (win == null) { let best = -1; win = -1; HS.score.forEach((v, t) => { if (v > best) { best = v; win = t; } else if (v === best) win = -1; }); }
  hostBroadcast({ t: 'end', score: HS.score, win, players: rosterList(), rules: HS.rules });
  HS.endTimer = setTimeout(() => { HS.state = 'lobby'; for (const p of HS.players.values()) { p.alive = false; p.out = false; } hostAssignTeams(false); broadcastLobby(); }, 9000);
}
function hostReleaseVehicle(p) {
  for (const [i, o] of HS.vehOwner) if (o === p.id) { HS.vehOwner.delete(i); hostBroadcast({ t: 'veh', v: i, on: 0, by: p.id, x: Math.round(p.st[0] * 100) / 100, z: Math.round(p.st[2] * 100) / 100, y: Math.round(p.st[3] * 100) / 100 }); }
}
function hostKill(v, p, head) { // p: the killer, or null for the zone
  v.hp = 0; v.alive = false; v.d++;
  hostReleaseVehicle(v);
  if (p) { p.k++; if (HS.rules.kind !== 'br') HS.score[p.team]++; }
  hostBroadcast({ t: 'kill', k: p ? p.id : 'Z', v: v.id, h: head ? 1 : 0, score: HS.score, kk: p ? p.k : 0, vd: v.d });
  if (HS.rules.kind === 'br') { hostBrCheck(); return; }
  if (p && HS.score[p.team] >= HS.rules.limit) hostEndMatch(p.team); else hostRespawn(v, 3.5);
}
function hostBrCheck() {
  const alive = new Set([...HS.players.values()].filter(p => p.alive).map(p => p.team));
  if (alive.size <= 1) setTimeout(() => hostEndMatch(alive.size ? [...alive][0] : -1), 1500);
}
function hostHandle(id, m) {
  const p = HS.players.get(id);
  if (m.t === 'hello') {
    if (p) return;
    if (HS.players.size >= MAX_PLAYERS) { Net.sendTo(id, { t: 'full' }); setTimeout(() => Net.kick(id), 300); return; }
    const np = hostAddPlayer(id, m.name);
    Net.sendTo(id, { t: 'welcome', id });
    if (HS.state === 'match') {
      const left = Math.max(0, HS.endAt - performance.now());
      np.alive = false;
      Net.sendTo(id, { t: 'start', map: HS.map, rules: HS.rules, endIn: left, score: HS.score, players: rosterList(), spawns: {}, seed: HS.seed, zone: [Z.cx, Z.cz], opened: [...HS.opened], vehs: vehicles.map(v => [Math.round(v.pos.x * 100) / 100, Math.round(v.pos.z * 100) / 100, Math.round(v.yaw * 100) / 100, HS.vehOwner.get(v.i) || null]) });
      hostBroadcast({ t: 'roster', players: rosterList() }, id);
      hostBroadcast({ t: 'note', m: HS.rules.kind === 'br' ? `${np.name} is watching and joins next round` : `${np.name} joined ${TEAM[np.team % TEAM.length].name}` });
      if (HS.rules.kind !== 'br') hostRespawn(np, 1);
    } else broadcastLobby();
    return;
  }
  if (!p) return;
  if (m.t === 'st' && Array.isArray(m.p)) { for (let i = 0; i < 6; i++) p.st[i] = +m.p[i] || 0; p.st[6] = m.p[6] == null ? -1 : (m.p[6] | 0); }
  else if (m.t === 'veh' && HS.state === 'match') {
    const i = m.v | 0, v = vehicles[i]; if (!v) return;
    if (m.on) {
      if (!p.alive || HS.vehOwner.has(i) || [...HS.vehOwner.values()].includes(id)) return;
      if (Math.hypot(v.pos.x - p.st[0], v.pos.z - p.st[2]) > 5) return;
      HS.vehOwner.set(i, id); hostBroadcast({ t: 'veh', v: i, on: 1, by: id });
    } else if (HS.vehOwner.get(i) === id) { HS.vehOwner.delete(i); hostBroadcast({ t: 'veh', v: i, on: 0, by: id, x: +m.x || 0, z: +m.z || 0, y: +m.y || 0 }); }
  }
  else if (m.t === 'ping') Net.sendTo(id, { t: 'pong', n: m.n });
  else if (m.t === 'shot' && HS.state === 'match' && p.alive) { hostBroadcast({ t: 'shot', id, a: m.a, b: m.b, s: m.s, q: m.q }, id); }
  else if (m.t === 'open' && HS.state === 'match' && p.alive) {
    const c = crates[m.c | 0];
    if (!c || HS.opened.has(c.i) || Math.hypot(c.x - p.st[0], c.z - p.st[2]) > 4.5) return;
    HS.opened.add(c.i);
    if (HS.rules.kind === 'br') p.armor = Math.min(100, p.armor + c.armor);
    hostBroadcast({ t: 'crate', c: c.i, by: id });
  }
  else if (m.t === 'hit' && HS.state === 'match') {
    const v = HS.players.get(m.v);
    let d = clamp(+m.d || 0, 0, 400);
    if (!v || !p.alive || !v.alive || v.team === p.team || d <= 0) return;
    if (performance.now() - v.spawnT < 1500 && HS.rules.kind !== 'br') return; // spawn protection
    if (v.armor > 0) { const ab = Math.min(v.armor, d * 0.7); v.armor -= ab; d -= ab; }
    v.hp -= d; v.lastHit = performance.now();
    if (v.hp > 0) { hostBroadcast({ t: 'hp', id: v.id, hp: Math.round(v.hp), by: id }); return; }
    hostKill(v, p, m.h);
  }
}
function hostLeave(id) {
  const p = HS.players.get(id); if (!p) return;
  HS.players.delete(id);
  hostReleaseVehicle(p);
  hostBroadcast({ t: 'note', m: `${p.name} left` });
  if (HS.state === 'lobby') { hostAssignTeams(false); broadcastLobby(); return; }
  hostRebalance();
  hostBroadcast({ t: 'roster', players: rosterList() });
  if (HS.state === 'match' && HS.rules.kind === 'br') hostBrCheck();
  if (HS.state === 'match' && HS.players.size < 2) hostEndMatch();
}
function hostTick(dt) {
  if (HS.state !== 'match') return;
  const now = performance.now(), br = HS.rules.kind === 'br';
  const me = HS.players.get('H');
  if (me) { me.st = [P.pos.x, P.feet, P.pos.z, P.veh ? P.veh.yaw : P.yaw, P.pitch, P.crouch ? 1 : 0, P.veh ? P.veh.i : -1]; }
  for (const p of HS.players.values()) if (p.alive && p.hp < 100 && now - p.lastHit > 5000) p.hp = Math.min(100, p.hp + 22 * dt);
  if (br) {
    zoneTick(dt);
    for (const p of HS.players.values()) {
      if (!p.alive || Math.hypot(p.st[0] - Z.cx, p.st[2] - Z.cz) <= Z.r) continue;
      p.hp -= zoneDps() * dt; p.lastHit = now;
      if (p.hp <= 0) hostKill(p, null, false);
    }
  }
  HS.snapT -= dt;
  if (HS.snapT <= 0) {
    HS.snapT = 1 / 15;
    const r2 = v => Math.round(v * 100) / 100;
    const s = {};
    for (const p of HS.players.values()) s[p.id] = [r2(p.st[0]), r2(p.st[1]), r2(p.st[2]), r2(p.st[3]), r2(p.st[4]), p.st[5] ? 1 : 0, p.alive ? 1 : 0, Math.round(p.hp), Math.round(p.armor), p.st[6] == null ? -1 : p.st[6]];
    hostBroadcast({ t: 's', p: s, z: br ? [r2(Z.r), Z.phase, Z.state === 'shrink' ? 1 : 0, r2(Z.t)] : null });
  }
  if (now > HS.endAt) hostEndMatch();
}

/* --- every player, host included, reacts to these --- */
function nameOf(id) { const p = MP.players.get(id); return p ? p.name : 'someone'; }
function teamOf(id) { const p = MP.players.get(id); return p ? p.team : 0; }
function tagName(id) { return id === 'Z' ? 'The zone' : tagHtml(nameOf(id), teamOf(id)); }
function clientHandle(m) {
  switch (m.t) {
    case 'welcome': MP.me = m.id; break;
    case 'full': uiJoinStatus('That match is full (16 players).', true); Net.close(); break;
    case 'pong': FPS.ping = Math.round(performance.now() - m.n); break;
    case 'lobby':
      MP.lobby = m; MP.map = m.map; MP.rules = cleanRules(m.rules);
      setRoster(m.players);
      if (m.state === 'lobby' && G.mode === 'net') leaveMatchToLobby();
      if (m.state === 'lobby' || !G.playing) uiShowLobby();
      break;
    case 'start': enterMatch(m); break;
    case 'roster': setRoster(m.players); syncAvatars(); break;
    case 'note': feed(escHtml(m.m)); break;
    case 's': if (G.mode === 'net') applySnap(m); break;
    case 'veh': {
      if (G.mode !== 'net') break;
      const v = vehicles[m.v]; if (!v) break;
      if (m.on) {
        if (m.by === MP.me) { if (P.alive && !P.veh) enterVehicle(v); }
        else v.driver = m.by;
      } else if (m.by !== MP.me) vehicleFromNet(m.v, m.x, m.z, m.y, null);
      else if (P.veh === v && !P.alive) { P.veh = null; v.driver = null; stopEngine(); }
      else if (P.veh !== v) v.driver = null;
      break;
    }
    case 'crate': { const c = crates[m.c]; if (c && G.mode === 'net') openCrate(c, m.by === MP.me ? 'me' : 'other'); break; }
    case 'shot': {
      if (G.mode !== 'net' || m.id === MP.me) break;
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
      feed(m.k === 'Z' ? `${tagName(m.v)} lost to the zone` : `${tagName(m.k)} → ${tagName(m.v)}${m.h ? ' · headshot' : ''}`);
      if (m.v === MP.me) {
        if (P.veh) { P.veh.driver = null; P.veh.speed = 0; P.veh = null; stopEngine(); }
        P.alive = false; P.hp = 0; G.stats.deaths++; MP.respawnAt = G.time + 3.5;
        MP.killer = m.k === 'Z' ? 'THE ZONE' : (kp ? kp.name.toUpperCase() : 'SOMEONE');
        if (MP.rules.kind === 'br') { MP.out = true; G.spec = [...MP.avatars.values()].find(a => a.alive && a.team === MP.team) || null; }
      } else {
        const av = MP.avatars.get(m.v);
        if (av) { av.alive = false; av.rb.group.visible = false; scrapBurst(av.pos.clone().setY(av.feet), teamHex(av.team)); }
        if (G.spec && G.spec.id === m.v) G.spec = [...MP.avatars.values()].find(a => a.alive && a.team === MP.team) || null;
      }
      if (m.k === MP.me) {
        G.stats.kills++; if (m.h) G.stats.heads++;
        hitMarker(true); beep(880, .12, .14, 'triangle'); beep(1320, .1, .1, 'triangle', .06);
        guns.forEach(g => g.reserveLeft = Math.min(g.s.reserve * 2, g.reserveLeft + g.s.mag));
      }
      break;
    }
    case 'spawn':
      if (m.id === MP.me) mpRespawn(m.x, m.z, 0);
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
function disposeAvatar(av) { disposeRobot(av.rb); disposeTag(av.tag); }
function syncAvatars() {
  for (const [id, av] of MP.avatars) {
    const p = MP.players.get(id);
    if (!p || p.team !== av.team || av.myTeam !== MP.team) { disposeAvatar(av); MP.avatars.delete(id); }
  }
  for (const p of MP.players.values()) {
    if (p.id === MP.me || MP.avatars.has(p.id)) continue;
    const mate = p.team === MP.team;
    const rb = buildRobot(0x6d757c, mate ? teamHex(p.team) : 0xff5a3c, { remote: p.id }, teamHex(p.team));
    world.shootables.push(...rb.parts);
    const av = { id: p.id, kind: 'avatar', team: p.team, myTeam: MP.team, rb, pos: new THREE.Vector3(), target: new THREE.Vector3(), feet: 0, yaw: 0, tyaw: 0,
      alive: false, lastShot: -99, quiet: false, tag: null, hp: 100, veh: -1 };
    if (mate) { av.tag = makeNameTag(p.name, teamCss(p.team)); rb.group.add(av.tag); }
    rb.group.visible = false;
    MP.avatars.set(p.id, av);
  }
}
function applySnap(m) {
  const s = m.p;
  for (const id in s) {
    const st = s[id];
    if (id === MP.me) { if (P.alive && st[6]) { P.hp = st[7]; P.armor = st[8] || 0; } continue; }
    const av = MP.avatars.get(id); if (!av) continue;
    const wasAlive = av.alive;
    av.target.set(st[0], st[1], st[2]); av.tyaw = st[3]; av.crouch = st[5]; av.hp = st[7];
    const vi = st[9] == null ? -1 : st[9];
    if (vi !== av.veh) { if (vehicles[av.veh] && vehicles[av.veh].driver === id) vehicles[av.veh].driver = null; av.veh = vi; if (vehicles[vi] && vehicles[vi].driver !== 'me') vehicles[vi].driver = id; }
    if (st[6] && !wasAlive) { av.pos.copy(av.target); av.feet = st[1]; }
    av.alive = !!st[6]; av.rb.group.visible = av.alive;
  }
  if (m.z && !Net.isHost) { Z.r = m.z[0]; Z.phase = m.z[1]; Z.state = m.z[2] ? 'shrink' : 'wait'; Z.t = m.z[3]; }
}
function updateAvatars(dt) {
  const k = 1 - Math.exp(-14 * dt);
  for (const av of MP.avatars.values()) {
    if (!av.alive) continue;
    const ox = av.pos.x, oz = av.pos.z;
    av.pos.x = lerp(av.pos.x, av.target.x, k); av.pos.z = lerp(av.pos.z, av.target.z, k); av.feet = lerp(av.feet, av.target.y, k);
    // camera yaw looks down -z; the robot faces +z, so turn it half a circle
    const veh = av.veh >= 0 ? vehicles[av.veh] : null;
    let d = (veh ? av.tyaw : av.tyaw + Math.PI) - av.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); av.yaw += d * k;
    if (veh && veh.driver !== 'me') {
      const moved = Math.hypot(av.pos.x - veh.pos.x, av.pos.z - veh.pos.z);
      veh.pos.x = av.pos.x; veh.pos.z = av.pos.z; veh.feet = av.feet - veh.T.seat; veh.yaw = av.yaw;
      veh.spin += moved / veh.T.wheel; for (const w of veh.wheels) w.rotation.x = veh.spin;
      placeVehicle(veh);
    }
    const bobY = animateRobot(av.rb, Math.hypot(av.pos.x - ox, av.pos.z - oz), dt);
    av.rb.group.position.set(av.pos.x, av.feet + bobY - (av.crouch ? .35 : 0), av.pos.z);
    av.rb.group.rotation.y = av.yaw;
  }
}
function clearAvatars() { for (const av of MP.avatars.values()) disposeAvatar(av); MP.avatars.clear(); }
function enterMatch(m) {
  G.mode = 'net'; G.rules = MP.rules = cleanRules(m.rules); G.over = false; G.time = 0; G.stats = { kills: 0, heads: 0, shots: 0, hits: 0, deaths: 0 };
  clearOffline(); clearAvatars(); zoneMesh.visible = false; $('zonetint').style.opacity = 0;
  MP.state = 'match'; MP.map = m.map; MP.score = m.score; MP.endAt = G.time + m.endIn / 1000; MP.out = false; G.spec = null;
  if (world.id !== m.map) loadMap(m.map);
  setRoster(m.players); syncAvatars();
  PL.team = MP.team;
  spawnVehicles(m.seed);
  (m.vehs || []).forEach((q, i) => vehicleFromNet(i, q[0], q[1], q[2], q[3]));
  if (MP.rules.kind === 'br') {
    spawnCrates(m.seed);
    (m.opened || []).forEach(i => { if (crates[i]) openCrate(crates[i], 'other'); });
    if (m.zone) zoneSetup(m.zone[0], m.zone[1]);
  }
  equip(); P.armor = 0;
  const sp = m.spawns[MP.me];
  if (sp) mpRespawn(sp[0], sp[1], sp[2] || 0);
  else {
    P.alive = false; MP.respawnAt = G.time + 1; MP.out = MP.rules.kind === 'br';
    MP.killer = MP.out ? 'WATCHING · YOU PLAY NEXT ROUND' : 'JOINING ' + TEAM[MP.team % TEAM.length].name.toUpperCase();
    P.pos.set(0, 0, 0); P.feet = groundAt(0, 0, 999) + 20;
    if (MP.out) G.spec = [...MP.avatars.values()].find(a => a.alive) || null;
  }
  for (const k in hudCache) delete hudCache[k];
  $('feed').innerHTML = '';
  feed(`${modeLabel(MP.rules)} · ${MAPS[m.map].name}${MP.rules.kind === 'ffa' ? '' : ` · you're on ${tagHtml(TEAM[MP.team % TEAM.length].name, MP.team)}`}`);
  uiEnterGame(true);
}
function mpRespawn(x, z, drop) {
  if (pendingLoadout) equip(); else guns.forEach(g => { g.magLeft = g.s.mag; g.reserveLeft = g.s.reserve; });
  resetPlayer(x, z, drop);
  P.yaw = Math.atan2(x - (MP.rules.kind === 'br' ? Z.cx : 0), z - (MP.rules.kind === 'br' ? Z.cz : 0));
}
function leaveMatchToLobby() {
  G.playing = false; G.mode = null; MP.state = 'lobby';
  clearAvatars(); clearOffline(); zoneMesh.visible = false;
  if (document.exitPointerLock && locked) document.exitPointerLock();
  $('hud').hidden = true; $('pause').hidden = true; $('end').hidden = true;
}
function netPlayersList() { return [...MP.players.values()].map(p => ({ name: p.name, team: p.team, k: p.k, d: p.d, me: p.id === MP.me, tag: p.id === 'H' ? 'host' : '' })); }
function showMatchEnd(m) {
  setRoster(m.players);
  G.over = true; mouse.l = mouse.r = false;
  if (document.exitPointerLock && locked) document.exitPointerLock();
  const mine = MP.team, ru = cleanRules(m.rules);
  $('endeye').textContent = `${modeLabel(ru)} · ${MAPS[MP.map].name}`;
  if (ru.kind === 'br') $('endtitle').textContent = m.win === mine ? (ru.squad > 1 ? 'Victory · your squad won' : 'Victory · last one standing') : m.win >= 0 ? `${TEAM[m.win % TEAM.length].name} won the round` : 'Nobody made it';
  else if (ru.kind === 'ffa') { const me = MP.players.get(MP.me), list = [...MP.players.values()].sort((a, b) => b.k - a.k); $('endtitle').textContent = `Placed #${list.indexOf(me) + 1} · ${me ? me.k : 0} kills`; }
  else $('endtitle').textContent = m.win === -1 ? `Draw ${m.score[0]}–${m.score[1]}` : (m.win === mine ? 'Your team won ' : 'Your team lost ') + `${m.score[mine]}–${m.score[1 - mine]}`;
  const s = G.stats;
  $('sk0').textContent = 'KILLS'; $('sh0').textContent = 'DEATHS';
  $('sk').textContent = s.kills; $('sh').textContent = s.deaths;
  $('sa').textContent = s.shots ? Math.round(s.hits / s.shots * 100) + '%' : '—';
  $('st').textContent = fmt(G.time);
  const list = netPlayersList();
  $('endTeams').innerHTML = ru.kind === 'ffa' ? ffaTable(list) : teamsHtml(list, true, ru.kind === 'tdm' ? m.score : null);
  $('endTeams').hidden = false;
  $('again').hidden = true;
  $('endStatus').textContent = 'Back to the lobby in a few seconds.';
  $('hud').hidden = true; $('pause').hidden = true; $('end').hidden = false;
  G.paused = true;
}
function updateNet(dt) {
  if (Net.isHost) hostTick(dt);
  updateAvatars(dt);
  updateCrates(dt);
  if (MP.rules.kind === 'br' && zoneDraw() && P.alive && Math.random() < dt * 2) toast('OUTSIDE THE ZONE');
  MP.sendT -= dt;
  if (MP.sendT <= 0 && !Net.isHost) {
    MP.sendT = 1 / 15;
    const r2 = v => Math.round(v * 100) / 100;
    Net.sendHost({ t: 'st', p: [r2(P.pos.x), r2(P.feet), r2(P.pos.z), r2(P.veh ? P.veh.yaw : P.yaw), r2(P.pitch), P.crouch ? 1 : 0, P.veh ? P.veh.i : -1] });
  }
  MP.pingT -= dt;
  if (MP.pingT <= 0 && !Net.isHost) { MP.pingT = 2; Net.sendHost({ t: 'ping', n: performance.now() }); }
  if (G.spec && !G.spec.alive) G.spec = [...MP.avatars.values()].find(a => a.alive && (MP.out && MP.rules.kind === 'br' ? true : a.team === MP.team)) || null;
}
function netView() {
  const ru = MP.rules, chips = [], dots = [];
  for (const av of MP.avatars.values()) {
    if (!av.alive) continue;
    if (av.team === MP.team) dots.push({ x: av.pos.x, z: av.pos.z, col: teamCss(av.team) });
    else if (G.time - av.lastShot < 2 && !av.quiet) dots.push({ x: av.pos.x, z: av.pos.z, col: '#ff5c4d', r: 3.6 });
  }
  const list = netPlayersList();
  if (ru.kind === 'br') {
    const alive = new Set([...MP.avatars.values()].filter(a => a.alive).map(a => a.team)); if (P.alive) alive.add(MP.team);
    chips.push(zoneChip());
    chips.push({ k: ru.squad > 1 ? 'SQUADS LEFT' : 'LEFT ALIVE', v: String(ru.squad > 1 ? alive.size : [...MP.avatars.values()].filter(a => a.alive).length + (P.alive ? 1 : 0)) });
    chips.push({ k: 'KILLS', v: String(G.stats.kills) });
  } else if (ru.kind === 'tdm') {
    chips.push({ k: 'ORANGE', v: String(MP.score[0] || 0), col: teamCss(0), cls: MP.team === 0 ? 'mine' : '' });
    chips.push({ k: 'FIRST TO ' + ru.limit, v: fmt(MP.endAt - G.time) });
    chips.push({ k: 'BLUE', v: String(MP.score[1] || 0), col: teamCss(1), cls: MP.team === 1 ? 'mine' : '' });
    chips.push({ k: 'YOU K/D', v: `${G.stats.kills}/${G.stats.deaths}` });
  } else {
    const ks = list.map(p => p.k), meK = (MP.players.get(MP.me) || { k: 0 }).k;
    chips.push({ k: 'YOUR KILLS', v: String(meK) });
    chips.push({ k: 'FIRST TO ' + ru.limit, v: fmt(MP.endAt - G.time) });
    chips.push({ k: 'LEADER', v: String(Math.max(0, ...ks)) });
    chips.push({ k: 'YOUR PLACE', v: '#' + (1 + ks.filter(k => k > meK).length) });
  }
  const squad = ru.kind === 'ffa' ? [] : [...MP.avatars.values()].filter(a => a.team === MP.team).map(a => ({ name: nameOf(a.id), hp: a.hp, alive: a.alive, team: a.team }));
  const board = () => ru.kind === 'ffa' ? `<div class="eyebrow" style="margin-bottom:8px">Free-for-all</div>${ffaTable(list)}` : teamsHtml(list, true, ru.kind === 'tdm' ? MP.score : null);
  return { chips, squad, board, armor: ru.kind === 'br', dots, spec: !P.alive && G.spec ? nameOf(G.spec.id) : null,
    respawnIn: ru.kind === 'br' ? null : MP.respawnAt - G.time, respawnWho: (MP.killer.startsWith('JOIN') ? '' : 'KNOCKED OUT BY ') + MP.killer };
}
