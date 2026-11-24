/* Playing against bots: battle royale in solos, duos, trios or squads (bots
   fill your squad), team deathmatch, and free-for-all. */

const OFF = { score: [], respawnAt: 0, endAt: 0, place: 0, teams: 0, killer: '' };
const BR_DROP = 70;

function clearBots() { bots.forEach(b => b.remove()); bots = []; }
function clearOffline() { clearBots(); clearLoot(); clearCrates(); clearVehicles(); clearFx(); G.timers = []; G.spec = null; }
function resetPlayer(x, z, drop) {
  if (P.veh) { P.veh.driver = null; P.veh.speed = 0; P.veh = null; stopEngine(); }
  P.pos.set(x, 0, z); P.feet = groundAt(x, z, 999) + (drop || 0); P.vel.set(0, 0, 0); P.vy = 0; P.drop = !!drop;
  P.pitch = 0; P.hp = 100; P.alive = true; P.crouch = false; P.plating = false; P.slideT = 0; P.tac = P.tacReq = false; P.plates = 2; P.breath = 1; adsT = 0; reloading = false; burstLeft = 0; recoilAcc = 0;
}
function farSpawn(team, pts) {
  const enemies = [];
  if (PL.team !== team && P.alive) enemies.push(P.pos);
  for (const b of bots) if (!b.dead && b.team !== team) enemies.push(b.pos);
  let best = null, bestD = -1;
  const cands = pts || Array.from({ length: 24 }, () => randomClear(0, 0, world.half * 0.85, 1.2));
  for (const [x, z] of cands) {
    let d = 1e9; for (const e of enemies) d = Math.min(d, Math.hypot(e.x - x, e.z - z));
    d += Math.random() * 6;
    if (d > bestD) { bestD = d; best = [x, z]; }
  }
  return best || [0, 0];
}
function startOffline() {
  const ru = G.rules;
  G.mode = 'bots';
  clearOffline();
  if (world.id !== G.map) loadMap(G.map);
  G.over = false; G.time = 0; G.stats = { kills: 0, heads: 0, shots: 0, hits: 0, deaths: 0 };
  PL.team = 0; P.armor = 0;
  botSerial = 1; zoneMesh.visible = false;
  equip();
  const H = world.half;
  spawnVehicles((Math.random() * 4e9) >>> 0);
  if (ru.kind === 'br') {
    const N = ru.squad, base = clamp(Math.round((10 + H / 200 * 22) * G.crowd), 10, clamp(Math.round(H * 0.4), 16, 120)), T = Math.max(2, Math.floor(base / N));
    OFF.teams = T;
    zoneSetup(R(-0.17, 0.17) * H, R(-0.17, 0.17) * H);
    const a0 = R(0, 6.28);
    for (let t = 0; t < T; t++) {
      const a = a0 + t / T * Math.PI * 2 + R(-0.2, 0.2), rr = H * R(0.3, 0.7);
      const [cx, cz] = randomClear(Math.cos(a) * rr, Math.sin(a) * rr, 12, 1.2);
      for (let k = 0; k < N; k++) {
        const x = cx + R(-5, 5), z = cz + R(-5, 5);
        if (t === 0 && k === 0) { resetPlayer(cx, cz, BR_DROP); P.yaw = Math.atan2(cx - Z.cx, cz - Z.cz); continue; }
        bots.push(new Bot(x, z, t, { ally: t === 0, name: t === 0 ? CALLSIGNS[k - 1] : null, drop: BR_DROP + R(-6, 8) }));
      }
    }
    spawnCrates((Math.random() * 4e9) >>> 0);
    const nl = Math.round(16 * clamp(H / 200, 0.3, 1));
    for (let i = 0; i < nl; i++) { const [x, z] = randomClear(0, 0, H * 0.85, .8); spawnLoot(i % 3 === 0 ? 'armor' : 'ammo', x, z); }
    feed(`${modeLabel(ru)} · ${MAPS[world.id].name} · ${T} squads`);
  } else if (ru.kind === 'tdm') {
    OFF.score = [0, 0]; OFF.endAt = 8 * 60;
    const pts = world.spawns;
    const per = clamp(Math.round((4 + H / 200 * 3) * G.crowd), 4, clamp(Math.round(H / 8), 6, 32));
    const [px, pz] = pts[0][0]; resetPlayer(px, pz, 0); P.yaw = Math.atan2(px, pz);
    for (let i = 1; i < per; i++) { const p = pts[0][i % pts[0].length]; bots.push(new Bot(p[0] + R(-2, 2), p[1] + R(-2, 2), 0, { ally: true, name: CALLSIGNS[(i - 1) % CALLSIGNS.length] })); }
    for (let i = 0; i < per; i++) { const p = pts[1][i % pts[1].length]; bots.push(new Bot(p[0] + R(-2, 2), p[1] + R(-2, 2), 1)); }
    feed(`Team deathmatch · ${MAPS[world.id].name} · first to ${ru.limit}`);
  } else {
    OFF.score = []; OFF.endAt = 8 * 60;
    const n = clamp(Math.round((5 + H / 200 * 6) * G.crowd), 5, clamp(Math.round(H / 4), 10, 60));
    const [px, pz] = randomClear(0, 0, H * 0.8, 1.2); resetPlayer(px, pz, 0);
    for (let i = 1; i <= n; i++) { const [x, z] = farSpawn(i); bots.push(new Bot(x, z, i)); }
    feed(`Free-for-all · ${MAPS[world.id].name} · first to ${ru.limit}`);
  }
  for (const k in hudCache) delete hudCache[k];
}
function myTeamAlive() { return P.alive || bots.some(b => !b.dead && b.team === PL.team); }
function teamsAlive() { const s = new Set(); if (P.alive) s.add(PL.team); for (const b of bots) if (!b.dead) s.add(b.team); return s; }
function brCheck() {
  if (G.over || G.rules.kind !== 'br' || G.mode !== 'bots') return;
  const alive = teamsAlive();
  if (!myTeamAlive()) { OFF.place = alive.size + 1; afterTimer(1.4, () => endOffline(false)); G.over = true; }
  else if (alive.size === 1) { OFF.place = 1; afterTimer(1, () => endOffline(true)); G.over = true; }
}
function nameOfSrc(src) { return src === 'zone' ? 'the zone' : src && src.isPlayer ? 'You' : src ? src.name : 'someone'; }
function teamOfSrc(src) { return src && src !== 'zone' ? src.team : 0; }
function onBotKilled(b, src, head) {
  if (G.mode !== 'bots') return;
  const ru = G.rules;
  if (src && src.isPlayer) {
    G.stats.kills++; if (head) G.stats.heads++;
    beep(880, .12, .14, 'triangle'); beep(1320, .1, .1, 'triangle', .06);
  } else if (src && src !== 'zone') src.k++;
  feed(src === 'zone' ? `${tagHtml(b.name, b.team)} lost to the zone` : `${tagHtml(nameOfSrc(src), teamOfSrc(src))} → ${tagHtml(b.name, b.team)}${head ? ' · headshot' : ''}`);
  if (b.ally) feed(`${escHtml(b.name)} is down`);
  const r = Math.random(); if (r < .55) spawnLoot('ammo', b.pos.x, b.pos.z); else if (r < .8 && ru.kind === 'br') spawnLoot('armor', b.pos.x, b.pos.z);
  if (ru.kind === 'br') { brCheck(); return; }
  if (src && src !== 'zone') {
    if (ru.kind === 'tdm') OFF.score[src.team]++;
    if (ru.kind === 'tdm' ? OFF.score[src.team] >= ru.limit : (src.isPlayer ? G.stats.kills : src.k) >= ru.limit) { G.over = true; afterTimer(1, () => endOffline(src.isPlayer || src.team === PL.team)); return; }
  }
  afterTimer(3, () => {
    if (G.mode !== 'bots' || G.over) return;
    const [x, z] = ru.kind === 'tdm' ? farSpawn(b.team, world.spawns[b.team]) : farSpawn(b.team);
    const k = b.k, d = b.d; b.spawn(x, z, 0); b.k = k; b.d = d;
  });
}
function onPlayerKilled(src) {
  const ru = G.rules;
  G.stats.deaths++;
  if (P.veh) leaveVehicle(true);
  OFF.killer = nameOfSrc(src);
  feed(`${tagHtml(nameOfSrc(src), teamOfSrc(src))} → ${tagHtml('You', PL.team)}`);
  if (src && src !== 'zone') src.k++;
  if (ru.kind === 'br') {
    const mate = bots.find(b => !b.dead && b.team === PL.team);
    if (mate) { G.spec = mate; feed('Your squad is still in. Watching ' + escHtml(mate.name)); }
    brCheck(); return;
  }
  if (src && src !== 'zone') {
    if (ru.kind === 'tdm') OFF.score[src.team]++;
    if (ru.kind === 'tdm' ? OFF.score[src.team] >= ru.limit : src.k >= ru.limit) { G.over = true; afterTimer(1.2, () => endOffline(false)); return; }
  }
  OFF.respawnAt = G.time + 3;
  afterTimer(3, () => {
    if (G.mode !== 'bots' || G.over) return;
    const [x, z] = ru.kind === 'tdm' ? farSpawn(PL.team, world.spawns[PL.team]) : farSpawn(PL.team);
    resetPlayer(x, z, 0); P.yaw = Math.atan2(x, z); P.armor = 0;
    if (pendingLoadout) equip(); else guns.forEach(g => { g.magLeft = g.s.mag; g.reserveLeft = g.s.reserve; });
  });
}
function updateOffline(dt) {
  for (const b of bots) if (!b.dead) b.update(dt);
  if (G.rules.kind === 'br') {
    zoneTick(dt);
    if (zoneDraw() && P.alive) { hurt(zoneDps() * dt, null, 'zone'); if (Math.random() < dt * 2) toast('OUTSIDE THE ZONE'); }
    if (G.spec && G.spec.dead) { G.spec = bots.find(b => !b.dead && b.team === PL.team) || null; }
  } else if (!G.over && G.time >= OFF.endAt) {
    G.over = true;
    const mine = G.rules.kind === 'tdm' ? OFF.score[0] >= OFF.score[1] : ffaRank() === 1;
    afterTimer(.5, () => endOffline(mine));
  }
  updateLoot(dt); updateCrates(dt);
  if (P.alive && G.time - P.lastHurt > 4.5 && P.hp < 100) P.hp = Math.min(100, P.hp + 22 * dt);
}
function ffaRank() { const mine = G.stats.kills; return 1 + bots.filter(b => b.k > mine).length; }
function botsView() {
  const ru = G.rules, chips = [];
  const dots = [];
  for (const b of bots) {
    if (b.dead) continue;
    if (b.team === PL.team) dots.push({ x: b.pos.x, z: b.pos.z, col: teamCss(b.team) });
    else if (G.time - b.lastFired < 2.5) dots.push({ x: b.pos.x, z: b.pos.z, col: '#ff5c4d', r: 3.6 });
  }
  if (ru.kind === 'br') {
    const alive = teamsAlive();
    chips.push(zoneChip());
    chips.push({ k: ru.squad > 1 ? 'SQUADS LEFT' : 'LEFT ALIVE', v: String(ru.squad > 1 ? alive.size : bots.filter(b => !b.dead).length + (P.alive ? 1 : 0)) });
    chips.push({ k: 'KILLS', v: String(G.stats.kills) });
  } else if (ru.kind === 'tdm') {
    chips.push({ k: 'YOUR TEAM', v: String(OFF.score[0]), col: teamCss(0) });
    chips.push({ k: 'FIRST TO ' + ru.limit, v: fmt(OFF.endAt - G.time) });
    chips.push({ k: 'ENEMY', v: String(OFF.score[1]), col: teamCss(1) });
    chips.push({ k: 'YOU K/D', v: `${G.stats.kills}/${G.stats.deaths}` });
  } else {
    const lead = Math.max(G.stats.kills, ...bots.map(b => b.k));
    chips.push({ k: 'YOUR KILLS', v: String(G.stats.kills) });
    chips.push({ k: 'FIRST TO ' + ru.limit, v: fmt(OFF.endAt - G.time) });
    chips.push({ k: 'LEADER', v: String(lead) });
    chips.push({ k: 'YOUR PLACE', v: '#' + ffaRank() });
  }
  const squad = ru.kind === 'ffa' ? [] : bots.filter(b => b.team === PL.team).slice(0, 5).map(b => ({ name: b.name, hp: b.hp, alive: !b.dead, team: b.team }));
  const board = () => {
    const list = [{ name: MP.myName || 'You', team: PL.team, k: G.stats.kills, d: G.stats.deaths, me: true }, ...bots.map(b => ({ name: b.name, team: b.team, k: b.k, d: b.d }))];
    if (ru.kind === 'ffa') return `<div class="eyebrow" style="margin-bottom:8px">Free-for-all</div>` + ffaTable(list);
    if (ru.kind === 'br') { const mine = list.filter(p => p.team === PL.team); return `<div class="eyebrow" style="margin-bottom:8px">${modeLabel(ru)} · ${teamsAlive().size} squads left</div>` + teamsHtml(mine, true); }
    return teamsHtml(list, true, OFF.score, [0, 1]);
  };
  return { chips, squad, board, armor: ru.kind === 'br', dots, spec: !P.alive && G.spec ? G.spec.name : null,
    respawnIn: ru.kind !== 'br' ? OFF.respawnAt - G.time : null, respawnWho: 'KNOCKED OUT BY ' + OFF.killer.toUpperCase() };
}
function ffaTable(list) {
  list = list.slice().sort((a, b) => b.k - a.k || a.d - b.d);
  return `<ol class="ffa">${list.map((p, i) => `<li class="${p.me ? 'me' : ''}"><span>#${i + 1} <span style="color:${teamCss(p.team)}">${escHtml(p.name)}</span></span><span class="kd">${p.k} / ${p.d}</span></li>`).join('')}</ol>`;
}
function endOffline(won) {
  if (!G.playing) return;
  G.over = true; G.playing = false; mouse.l = mouse.r = false;
  if (document.exitPointerLock && locked) document.exitPointerLock();
  const ru = G.rules, s = G.stats;
  $('endeye').textContent = `${modeLabel(ru)} · ${MAPS[world.id].name} · ${DIFF[G.diff].name} bots`;
  if (ru.kind === 'br') $('endtitle').textContent = won ? (ru.squad > 1 ? 'Victory · your squad won' : 'Victory · last one standing') : `Placed #${OFF.place} of ${OFF.teams}`;
  else if (ru.kind === 'tdm') $('endtitle').textContent = (won ? 'Your team won ' : 'Your team lost ') + `${OFF.score[0]}–${OFF.score[1]}`;
  else $('endtitle').textContent = won ? `First place · ${s.kills} kills` : `Placed #${ffaRank()} · ${s.kills} kills`;
  $('sk0').textContent = 'KILLS'; $('sh0').textContent = 'HEADSHOTS';
  $('sk').textContent = s.kills; $('sh').textContent = s.heads;
  $('sa').textContent = s.shots ? Math.round(s.hits / s.shots * 100) + '%' : '—';
  $('st').textContent = fmt(G.time);
  $('again').textContent = 'Play again'; $('again').hidden = false; $('endTeams').hidden = true; $('endStatus').textContent = '';
  $('hud').hidden = true; $('end').hidden = false;
}
