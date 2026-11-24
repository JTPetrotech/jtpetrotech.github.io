/* The heads-up display: chips across the top, the squad list, ammo, minimap,
   kill feed, frame rate. Each game mode hands over what to show through
   modeView(), so this file does not care whether the match is online. */

const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).innerHTML = v; } }
function feed(html) { const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d); setTimeout(() => d.remove(), 4500); while ($('feed').children.length > 6) $('feed').lastChild.remove(); }
let toastTimer = 0, hitTimer = 0;
function toast(t) { $('toast').textContent = t; toastTimer = 1.6; }
function hitMarker(kill) { $('hit').classList.toggle('kill', !!kill); hitTimer = kill ? .35 : .18; }
function dmgArc(from) {
  const dx = from.x - P.pos.x, dz = from.z - P.pos.z;
  const lx = dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw), lf = -(dx * Math.sin(P.yaw) + dz * Math.cos(P.yaw));
  const d = document.createElement('div'); d.className = 'arc'; d.style.transform = `rotate(${Math.atan2(lx, lf) * 180 / Math.PI}deg)`;
  $('dmg').appendChild(d); setTimeout(() => d.remove(), 1100);
}
const tagHtml = (name, team) => `<span style="color:${teamCss(team)}">${escHtml(name)}</span>`;
const MODE_NAMES = { br: 'Battle royale', tdm: 'Team deathmatch', ffa: 'Free-for-all' };
const SQUAD_NAMES = ['', 'Solos', 'Duos', 'Trios', 'Squads'];
function modeLabel(r) { return r.kind === 'br' ? `Battle royale · ${SQUAD_NAMES[r.squad]}` : MODE_NAMES[r.kind]; }

/* frame rate, averaged over half a second */
const FPS = { on: store.get('fps', true), n: 0, t: 0, v: 0, ping: null };
function fpsTick(dt) {
  FPS.n++; FPS.t += dt;
  if (FPS.t >= 0.5) { FPS.v = Math.round(FPS.n / FPS.t); FPS.n = 0; FPS.t = 0; }
  const el = $('fps');
  el.hidden = !FPS.on;
  if (FPS.on) setText('fps', `${FPS.v} FPS${FPS.ping != null && G.mode === 'net' && !Net.isHost ? ` · ${FPS.ping} MS` : ''}`);
}

function chipsHtml(list) {
  return list.map(c => `<div class="chip${c.cls ? ' ' + c.cls : ''}"${c.col ? ` style="border-top:3px solid ${c.col}"` : ''}><div class="k">${c.k}</div><div class="v"${c.col ? ` style="color:${c.col}"` : ''}>${c.v}</div></div>`).join('');
}
function zoneChip() {
  const ph = Z.phases[Z.phase];
  if (!ph) return { k: 'FINAL ZONE', v: '—', cls: 'zone' };
  if (Z.state === 'wait') return { k: 'ZONE MOVES', v: fmt(ph.wait - Z.t), cls: 'zone' };
  return { k: 'ZONE CLOSING', v: fmt(ph.shrink - Z.t), cls: 'zone closing' };
}
function updateHUD(dt, scoped, spdH) {
  const g = guns[cur], s = g.s, V = modeView();
  setText('hpv', String(Math.ceil(P.hp))); setText('arv', String(Math.ceil(P.armor)));
  $('hpbar').firstChild.style.width = P.hp + '%'; $('arbar').firstChild.style.width = P.armor + '%';
  $('armorrow').hidden = !V.armor;
  setText('ammon', `${g.magLeft} <small>/ ${g.reserveLeft}</small>`);
  setText('wname', `${escHtml(s.name)}${g.skin !== 'factory' ? ` <span class="skin">${SKINS[g.skin].name}</span>` : ''}`);
  setText('watt', escHtml(modSummary(g)));
  setText('slot0', '1 ' + escHtml(guns[0].s.name.toUpperCase())); setText('slot1', '2 ' + escHtml(guns[1].s.name.toUpperCase()));
  $('slot0').classList.toggle('on', cur === 0); $('slot1').classList.toggle('on', cur === 1);
  setText('topc', chipsHtml(V.chips));
  // squad list
  const sq = V.squad || [];
  setText('squad', sq.map(m => `<div class="sqm${m.alive ? '' : ' out'}"><span style="color:${teamCss(m.team)}">${escHtml(m.name)}</span><b><i style="width:${m.alive ? Math.max(0, m.hp) : 0}%"></i></b></div>`).join(''));
  // scoreboard
  const showBoard = keys.Tab && !G.over;
  $('board').hidden = !showBoard;
  if (showBoard) setText('board', V.board());
  // prompts
  let prompt = '';
  const it = findInteract(), K = padUsing ? '<kbd>X</kbd>' : bindKbd('use');
  if (!P.alive) prompt = V.spec ? `SPECTATING ${escHtml(V.spec.toUpperCase())}` : '';
  else if (P.veh) prompt = `${Math.round(Math.abs(P.veh.speed) * 3.6)} KM/H · ` + (padUsing ? '<kbd>RT</kbd> GAS · <kbd>LT</kbd> BRAKE · STICK STEERS · <kbd>X</kbd> GET OUT' : `${bindKbd('fwd')}${bindKbd('back')} DRIVE · ${bindKbd('left')}${bindKbd('right')} STEER · ${K} GET OUT`);
  else if (P.drop) prompt = padUsing ? 'PARACHUTING · STEER WITH THE LEFT STICK' : `PARACHUTING · STEER WITH ${escHtml(bindKey('fwd') + bindKey('left') + bindKey('back') + bindKey('right'))}`;
  else if (it && it.kind === 'veh') prompt = `${K} DRIVE ${it.v.T.name.toUpperCase()}`;
  else if (it && it.kind === 'bench') prompt = `${K} USE WORKBENCH · GUNS, SCOPES, MODS, SKINS`;
  else if (it && it.kind === 'gun') prompt = `${K} TAKE <span style="color:${TIERS[it.gg.tier].css}">${escHtml(GUNS[it.gg.id].name.toUpperCase())}</span> · DROPS ${escHtml(s.name.toUpperCase())}`;
  else if (it && it.kind === 'crate') prompt = `${K} OPEN <span style="color:${TIERS[it.c.tier].css}">${TIERS[it.c.tier].name.toUpperCase()}</span> CRATE`;
  else if (reloading) prompt = 'RELOADING';
  else if (g.magLeft === 0 && g.reserveLeft === 0) prompt = 'NO AMMO · SWITCH GUNS';
  else if (g.magLeft <= Math.ceil(s.mag * .2)) prompt = padUsing ? 'PRESS X TO RELOAD' : `PRESS ${escHtml(bindKey('reload').toUpperCase())} TO RELOAD`;
  setText('prompt', prompt);
  const rb = $('reloadbar');
  rb.hidden = !reloading;
  if (reloading) rb.firstChild.style.width = clamp(100 * (1 - (reloadEnd - G.time) / s.reload), 0, 100) + '%';
  toastTimer -= dt; $('toast').style.opacity = toastTimer > 0 ? 1 : 0;
  hitTimer -= dt; $('hit').style.opacity = hitTimer > 0 ? 1 : 0;
  vignT -= dt; $('vign').style.opacity = Math.max(0, vignT * 2.5) + (P.alive && P.hp < 35 ? (35 - P.hp) / 50 : 0);
  const moveMul = (1 + spdH / 6 * .9) * (P.onGround ? 1 : 2.2) * (P.crouch ? .75 : 1);
  const spread = s.pellets > 1 ? lerp(s.pelHip, s.ads, adsT) : lerp(s.hip, s.ads, adsT) * moveMul;
  const gap = 4 + spread * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
  const ch = $('cross').children;
  ch[0].style.top = (-gap - 9) + 'px'; ch[1].style.top = gap + 'px'; ch[2].style.left = (-gap - 9) + 'px'; ch[3].style.left = gap + 'px';
  $('cross').style.opacity = adsT > .4 || P.sprint || !P.alive || P.veh ? 0 : 1;
  $('scope').hidden = !scoped; $('scope').className = 'hud' + (s.overlay === 'x3' ? ' x3' : '');
  $('breath').hidden = !(scoped && s.sway);
  if (scoped && s.sway) $('breathfill').style.width = (P.breath * 100) + '%';
  const rs = $('respawn');
  if (V.respawnIn != null && !P.alive && !G.over) { rs.hidden = false; setText('respawnn', String(Math.max(0, Math.ceil(V.respawnIn)))); setText('respawnwho', V.respawnWho || ''); }
  else rs.hidden = true;
  drawMinimap(V);
}
function modSummary(g) {
  const out = [OPTICS[g.att.optic].name];
  for (const cat of ['muzzle', 'barrel', 'under', 'mag', 'stock']) { const v = g.att[cat]; if (v !== 'none' && v !== 'std') out.push(MODS[cat][v].name); }
  return out.join(' · ');
}
// list: [{name, team, k, d, me, tag}], grouped by team
function teamsHtml(list, withKd, score, teamOrder) {
  const teams = teamOrder || [...new Set(list.map(p => p.team))].sort((a, b) => a - b);
  const cols = teams.map(t => {
    const ps = list.filter(p => p.team === t);
    if (withKd) ps.sort((a, b) => b.k - a.k || a.d - b.d);
    const items = ps.map(p => `<li class="${p.me ? 'me' : ''}" style="border-left-color:${teamCss(t)}"><span>${escHtml(p.name)}${p.tag ? ' · ' + p.tag : ''}</span>${withKd ? `<span class="kd">${p.k} / ${p.d}</span>` : ''}</li>`).join('')
      || `<li class="empty">Nobody yet</li>`;
    const right = score ? score[t] : ps.length + (ps.length === 1 ? ' player' : ' players');
    return `<div class="team"><h3 style="color:${teamCss(t)}"><span>${TEAM[t % TEAM.length].name}</span><span>${right == null ? '' : right}</span></h3><ol>${items}</ol></div>`;
  });
  return `<div class="teams${teams.length > 2 ? ' many' : ''}">${cols.join('')}</div>`;
}
const mm = $('minimap'), mctx = mm.getContext('2d');
function drawMinimap(V) {
  const W2 = mm.width, c = W2 / 2, range = Math.min(110, world.half * 1.1), sc = W2 / 2 / range;
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, W2, W2);
  mctx.save(); mctx.beginPath(); mctx.rect(0, 0, W2, W2); mctx.clip();
  mctx.translate(c, c); mctx.scale(sc, sc); mctx.rotate(P.yaw); mctx.translate(-P.pos.x, -P.pos.z);
  if (world.water != null) { mctx.fillStyle = 'rgba(61,127,149,.45)'; mctx.fillRect(-world.half * 2, -world.half * 2, world.half * 4, world.half * 4); }
  mctx.fillStyle = 'rgba(205,214,200,.55)';
  for (const b of world.boxes) { if (Math.abs(b.minX - P.pos.x) > range * 1.5 || Math.abs(b.minZ - P.pos.z) > range * 1.5) continue; mctx.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ); }
  for (const ci of world.circles) if (ci.tall) { mctx.beginPath(); mctx.arc(ci.x, ci.z, ci.r, 0, 6.29); mctx.fill(); }
  const dot = (x, z, col, r = 3.2) => { mctx.fillStyle = col; mctx.beginPath(); mctx.arc(x, z, r / sc, 0, Math.PI * 2); mctx.fill(); };
  for (const cr of crates) if (!cr.open && Math.abs(cr.x - P.pos.x) < range * 1.5 && Math.abs(cr.z - P.pos.z) < range * 1.5) { mctx.fillStyle = TIERS[cr.tier].css; const s = 4.2 / sc; mctx.fillRect(cr.x - s / 2, cr.z - s / 2, s, s); }
  if (zoneMesh.visible) {
    mctx.lineWidth = 2.2 / sc; mctx.strokeStyle = '#8d7dff';
    mctx.beginPath(); mctx.arc(Z.cx, Z.cz, Z.r, 0, Math.PI * 2); mctx.stroke();
    const ph = Z.phases[Z.phase];
    if (ph && Z.state === 'wait') { mctx.setLineDash([6 / sc, 5 / sc]); mctx.strokeStyle = 'rgba(255,255,255,.8)'; mctx.beginPath(); mctx.arc(Z.cx, Z.cz, ph.to, 0, Math.PI * 2); mctx.stroke(); mctx.setLineDash([]); }
  }
  for (const v of vehicles) { mctx.save(); mctx.translate(v.pos.x, v.pos.z); mctx.rotate(-v.yaw); mctx.fillStyle = v.driver === 'me' ? '#ffb547' : '#e9eff1'; const w = 5 / sc, l = 8 / sc; mctx.fillRect(-w / 2, -l / 2, w, l); mctx.restore(); }
  for (const [x, z] of world.benchPts) { mctx.fillStyle = '#ffb547'; mctx.beginPath(); mctx.moveTo(x, z - 6 / sc); mctx.lineTo(x + 5 / sc, z + 4 / sc); mctx.lineTo(x - 5 / sc, z + 4 / sc); mctx.closePath(); mctx.fill(); }
  for (const d of V.dots) dot(d.x, d.z, d.col, d.r || 3.2);
  mctx.restore();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.fillStyle = '#ffffff'; mctx.beginPath(); mctx.moveTo(c, c - 9); mctx.lineTo(c + 6, c + 6); mctx.lineTo(c, c + 2); mctx.lineTo(c - 6, c + 6); mctx.closePath(); mctx.fill();
}
