/* Menus: main menu, loadout, join, lobby, pause, end. */

const OVERLAYS = ['menu', 'joinov', 'lobby', 'loadout', 'pause', 'end', 'controls', 'workshop'];
function showOnly(id) { for (const o of OVERLAYS) $(o).hidden = o !== id; }

/* ---------- name, settings ---------- */
MP.myName = cleanName(store.get('name', 'Player' + (10 + ((Math.random() * 89) | 0))));
$('pname').value = MP.myName;
$('pname').addEventListener('input', e => { MP.myName = cleanName(e.target.value); store.set('name', MP.myName); });
$('sens').value = sens; $('vol').value = volume; $('fpsOn').checked = FPS.on;
$('sens').addEventListener('input', e => { sens = +e.target.value; store.set('sens', sens); });
$('vol').addEventListener('input', e => { volume = +e.target.value; store.set('vol', volume); if (master) master.gain.value = volume; });
$('fpsOn').addEventListener('change', e => { FPS.on = e.target.checked; store.set('fps', FPS.on); });
function refreshBest() { $('loSummary').textContent = loadout.map(sl => GUNS[sl.id].name).join(' + '); $('best').textContent = ''; }
refreshBest();

/* ---------- chips: mode, squad size, bots, map ---------- */
const OFF_LIMITS = { tdm: 30, ffa: 20, br: 0 };
const offRules = { kind: store.get('offKind', 'br'), squad: store.get('offSquad', 1) };
if (!MODE_NAMES[offRules.kind]) offRules.kind = 'br';
offRules.squad = clamp(offRules.squad | 0 || 1, 1, 4);
function chipRow(items, sel, attr, disabled) {
  return items.map(([v, label, sub]) => `<button data-${attr}="${v}" class="${String(v) === String(sel) ? 'on' : ''}"${disabled ? ' disabled' : ''}><b>${label}</b>${sub || ''}</button>`).join('');
}
const MODE_ITEMS = [['br', 'Battle royale', 'Drop in, loot crates, last squad standing'], ['tdm', 'Team deathmatch', 'Two teams, respawns, first to the kill limit'], ['ffa', 'Free-for-all', 'Everyone for themselves']];
const SQUAD_ITEMS = [[1, 'Solos', 'Just you'], [2, 'Duos', 'Squads of 2'], [3, 'Trios', 'Squads of 3'], [4, 'Squads', 'Squads of 4']];
const CROWD_ITEMS = [[1, 'Normal', 'The usual number'], [2, 'Lots', 'About twice as many'], [3, 'Swarm', 'Three times, up to 120']];
const DIFF_ITEMS = Object.entries(DIFF).map(([k, d]) => [k, d.name, k === 'easy' ? 'Slow to react' : k === 'normal' ? 'A fair fight' : 'Sharp and fast']);
function mapChipsHtml(sel, disabled) { return chipRow(MAP_IDS.map(id => [id, MAPS[id].name, MAPS[id].blurb]), sel, 'map', disabled); }
function renderMenu() {
  $('modeChips').innerHTML = chipRow(MODE_ITEMS, offRules.kind, 'mode');
  $('squadChips').innerHTML = chipRow(SQUAD_ITEMS, offRules.squad, 'squad');
  $('squadRow').hidden = offRules.kind !== 'br';
  $('diffChips').innerHTML = chipRow(DIFF_ITEMS, G.diff, 'diff');
  $('crowdChips').innerHTML = chipRow(CROWD_ITEMS, G.crowd, 'crowd');
  $('mapChips').innerHTML = mapChipsHtml(G.map, false);
  $('play').textContent = offRules.kind === 'br' ? `Play ${SQUAD_NAMES[offRules.squad].toLowerCase()} vs bots` : `Play ${MODE_NAMES[offRules.kind].toLowerCase()} vs bots`;
}
$('modeChips').addEventListener('click', e => { const b = e.target.closest('button[data-mode]'); if (!b) return; offRules.kind = b.dataset.mode; store.set('offKind', offRules.kind); renderMenu(); });
$('squadChips').addEventListener('click', e => { const b = e.target.closest('button[data-squad]'); if (!b) return; offRules.squad = +b.dataset.squad; store.set('offSquad', offRules.squad); renderMenu(); });
$('crowdChips').addEventListener('click', e => { const b = e.target.closest('button[data-crowd]'); if (!b) return; G.crowd = +b.dataset.crowd; store.set('crowd', G.crowd); renderMenu(); });
$('diffChips').addEventListener('click', e => { const b = e.target.closest('button[data-diff]'); if (!b) return; G.diff = b.dataset.diff; store.set('diff', G.diff); renderMenu(); });
$('mapChips').addEventListener('click', e => {
  const b = e.target.closest('button[data-map]'); if (!b) return;
  G.map = b.dataset.map; store.set('map', G.map); renderMenu();
  if (!G.playing) loadMap(G.map);
});
renderMenu();

/* ---------- entering and leaving play ---------- */
function uiEnterGame(net) {
  initAudio();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  showOnly(null); $('hud').hidden = false;
  G.playing = true;
  for (const k in keys) keys[k] = false;
  const gesture = !navigator.userActivation || navigator.userActivation.isActive;
  if (net && !gesture) {
    G.paused = true;
    $('pauseEye').textContent = 'Match started'; $('pauseTitle').textContent = 'Drop in';
    $('pauseText').textContent = 'Click below to lock the mouse and join the fight.';
    $('resume').textContent = 'Drop in'; $('quitBtn').textContent = 'Leave match'; $('pauseNote').textContent = '';
    $('pause').hidden = false;
  } else { G.paused = false; lock(); canvas.focus(); }
}
function uiPause() {
  if (!G.playing || G.over) return;
  G.paused = true; mouse.l = mouse.r = false;
  const net = G.mode === 'net';
  $('pauseEye').textContent = 'Paused';
  $('pauseTitle').textContent = net ? 'Match still running' : 'Holding position';
  $('pauseText').textContent = net ? 'You can still be hit while this is open.' : 'Click below to lock the mouse and get back in.';
  $('resume').textContent = 'Resume'; $('quitBtn').textContent = net ? 'Leave match' : 'Quit to menu';
  $('pauseNote').textContent = net && Net.isHost ? 'You are hosting. Leaving ends the match for everyone.' : '';
  $('pause').hidden = false;
}
/* ---------- controls: rebinding keys ---------- */
let controlsFrom = 'menu', swallowClick = 0;
function renderLegend() {
  const k = id => bindKbd(id);
  $('keyLegend').innerHTML = [
    `${k('fwd')}${k('left')}${k('back')}${k('right')} Move`,
    `${k('fire')} Fire · ${k('aim')} Aim`,
    `${k('gun1')}${k('gun2')} / ${k('swap')} / wheel Switch gun`,
    `${k('reload')} Reload · ${k('use')} Use: crates, guns, vehicles, workbenches`,
    `${k('sprint')} Sprint · steady scope`,
    `${k('jump')} Jump · ${k('crouch')} Crouch`,
    `${k('board')} Scoreboard`,
    `<kbd>Esc</kbd> Pause · change loadout`,
    `${k('plate')} Armor plate · double-tap ${k('sprint')} tactical sprint · ${k('crouch')} while sprinting slides`,
    `<kbd>Controller</kbd> ${['fire', 'aim', 'jump', 'crouch', 'use', 'swap', 'plate'].map(id => escHtml(padLabel(id)) + ' ' + PAD_ACTS.find(a => a[0] === id)[1].split(' ·')[0].toLowerCase()).join(' · ')} · Start pause`,
  ].map(h => `<div>${h}</div>`).join('');
}
function renderBinds(waitId, waitSlot) {
  $('bindList').innerHTML = ACTIONS.map(([id, , label]) => `<div class="lbl">${escHtml(label)}</div>` + [0, 1].map(i => {
    const c = binds[id][i], wait = id === waitId && i === waitSlot;
    return `<button class="bk${c ? '' : ' empty'}${wait ? ' wait' : ''}${i ? ' alt2' : ''}" data-bind="${id}" data-slot="${i}" aria-label="${escHtml(label)}, ${i ? 'second' : 'first'} key: ${escHtml(keyName(c))}">${wait ? 'Press a key…' : escHtml(keyName(c))}</button>`;
  }).join('')).join('');
}
function renderPadBinds(waitId, waitSlot) {
  $('padTypeChips').innerHTML = chipRow(PAD_TYPES.map(([k, n]) => [k, n, k === 'auto' ? (padSeen ? 'Looks like ' + PAD_TYPES.find(t => t[0] === padTypeOf(padSeen) || false)[1] : 'From the controller') : 'Its button names']), padTypeSet, 'padtype');
  $('padBindList').innerHTML = PAD_ACTS.map(([id, label]) => `<div class="lbl">${escHtml(label)}</div>` + [0, 1].map(i => {
    const c = padBinds[id][i], wait = id === waitId && i === waitSlot;
    return `<button class="bk${c ? '' : ' empty'}${wait ? ' wait' : ''}${i ? ' alt2' : ''}" data-pbind="${id}" data-slot="${i}" aria-label="${escHtml(label)}, ${i ? 'second' : 'first'} button: ${escHtml(padCodeName(c))}">${wait ? 'Press a button…' : escHtml(padCodeName(c))}</button>`;
  }).join('')).join('');
}
$('padTypeChips').addEventListener('click', e => { const b = e.target.closest('button[data-padtype]'); if (!b) return; padTypeSet = b.dataset.padtype; store.set('padType', padTypeSet); renderPadBinds(); renderLegend(); });
$('padReset').addEventListener('click', () => { resetPadBinds(); renderPadBinds(); });
$('padBindList').addEventListener('click', e => {
  const b = e.target.closest('button[data-pbind]'); if (!b) return;
  const id = b.dataset.pbind, slot = +b.dataset.slot;
  renderPadBinds(id, slot);
  padCapture = { armed: false, t0: performance.now(), done: code => {
    if (code) setPadBind(id, slot, code);
    renderPadBinds();
    const again = $('padBindList').querySelector(`button[data-pbind="${id}"][data-slot="${slot}"]`); if (again) { again.focus(); if (window.PadNav && PadNav.reset) setTimeout(() => again.focus(), 80); }
  } };
});
function openControls(from) {
  controlsFrom = from; renderBinds(); renderPadBinds(); renderSticks(); $('ctlCode').value = controlsCode(); $('ctlMsg').textContent = '';
  if (from === 'pause') $('pause').hidden = true; else showOnly(null);
  $('controls').hidden = false;
}
function closeControls() {
  bindCapture = null; padCapture = null; $('controls').hidden = true; renderLegend();
  if (controlsFrom === 'pause') $('pause').hidden = false; else showOnly('menu');
}
$('openControls').addEventListener('click', () => openControls('menu'));
$('pauseControls').addEventListener('click', () => openControls('pause'));
$('bindsDone').addEventListener('click', closeControls);
$('bindsReset').addEventListener('click', () => { resetBinds(); renderBinds(); });
function renderBreath() { const b = $('breath'); if (b && b.firstChild) b.firstChild.textContent = `HOLD ${bindKey('sprint').toUpperCase()} TO STEADY`; }
$('bindList').addEventListener('click', e => {
  const b = e.target.closest('button[data-bind]'); if (!b || performance.now() < swallowClick) return;
  const id = b.dataset.bind, slot = +b.dataset.slot;
  renderBinds(id, slot);
  bindCapture = code => {
    bindCapture = null; if (/^Mouse/.test(code)) swallowClick = performance.now() + 400;
    if (code === 'Backspace' || code === 'Delete') setBind(id, slot, '');
    else if (code !== 'Escape' && code) setBind(id, slot, code);
    renderBinds();
    const again = $('bindList').querySelector(`button[data-bind="${id}"][data-slot="${slot}"]`); if (again) again.focus();
  };
});
// the click that follows a mouse button being bound must not start another wait
addEventListener('click', e => { if (performance.now() < swallowClick && e.target.closest && e.target.closest('#bindList')) { e.preventDefault(); e.stopPropagation(); } }, true);
renderLegend(); renderBreath();
$('resume').addEventListener('click', () => { initAudio(); $('pause').hidden = true; G.paused = false; lock(); canvas.focus(); });
function toMenu(note) {
  G.playing = false; G.paused = false; G.mode = null;
  clearOffline(); clearAvatars(); zoneMesh.visible = false;
  if (document.exitPointerLock && locked) document.exitPointerLock();
  $('hud').hidden = true; showOnly('menu');
  refreshBest();
  if (note) $('best').textContent = note;
  if (world.id !== G.map) loadMap(G.map);
}
function netReset() {
  Net.close();
  clearTimeout(HS.endTimer); HS.players.clear(); HS.state = 'lobby'; HS.order = 0;
  MP.me = null; MP.players = new Map(); MP.state = 'idle'; MP.lobby = null; FPS.ping = null;
}
function startOfflineGame() {
  G.rules = { kind: offRules.kind, squad: offRules.kind === 'br' ? offRules.squad : 1, limit: OFF_LIMITS[offRules.kind] };
  uiEnterGame(false); startOffline();
}
$('quitBtn').addEventListener('click', () => { if (G.mode === 'net') netReset(); toMenu(); });
$('again').addEventListener('click', startOfflineGame);
$('endMenu').addEventListener('click', () => { if (G.mode === 'net' || Net.peer) netReset(); toMenu(); });
$('play').addEventListener('click', startOfflineGame);

/* ---------- loadout ---------- */
let loSlot = 0, loReturn = 'menu';
function openLoadout(from) {
  loReturn = from; showOnly('loadout');
  $('loEye').textContent = from === 'bench' ? 'Workbench · swap guns, change scopes and mods, pick a skin' : 'Loadout · two guns, mods and a skin on each';
  $('loDone').textContent = from === 'bench' ? 'Done · back to the fight' : 'Done';
  renderLoadout();
}
// A workbench edits the guns you are holding right now, and saves them as your loadout.
function openBench() {
  if (!G.playing || G.paused) return;
  G.paused = true; mouse.l = mouse.r = false; // paused first, so losing the mouse lock does not open the pause menu
  if (document.exitPointerLock && locked) document.exitPointerLock();
  loadout = guns.map(g => ({ id: g.id, att: Object.assign({}, g.att), skin: g.skin }));
  loSlot = cur; sndClick(700); sndClick(900, .1);
  openLoadout('bench');
}
function closeBench() {
  saveLoadout(); refreshBest();
  guns = loadout.map((sl, i) => {
    const old = guns[i];
    if (old && old.id === sl.id && old.skin === sl.skin && JSON.stringify(old.att) === JSON.stringify(sl.att)) return old;
    const h = makeHeld(sl);
    if (old && old.id === sl.id) { h.magLeft = Math.min(h.s.mag, old.magLeft); h.reserveLeft = old.reserveLeft; }
    if (old) disposeGunModel(old.m);
    return h;
  });
  reloading = false; swapT = 0; burstLeft = 0; cur = loSlot;
  showOnly(null); G.paused = false; lock(); canvas.focus();
  toast('WORKBENCH · GUNS UPDATED');
}
$('openLoadout').addEventListener('click', () => openLoadout('menu'));
$('lobbyLoadout').addEventListener('click', () => openLoadout('lobby'));
$('pauseLoadout').addEventListener('click', () => openLoadout('pause'));
$('loTabs').addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (!b) return; loSlot = +b.dataset.s; renderLoadout(); });
$('loGuns').addEventListener('click', e => {
  const b = e.target.closest('button[data-g]'); if (!b) return;
  if (loadout[loSlot].id !== b.dataset.g) loadout[loSlot] = { id: b.dataset.g, att: defaultAtt(b.dataset.g), skin: loadout[loSlot].skin || 'factory' };
  renderLoadout();
});
$('loAtts').addEventListener('click', e => {
  const b = e.target.closest('button[data-cat]'); if (!b) return;
  loadout[loSlot].att[b.dataset.cat] = b.dataset.v; renderLoadout();
});
$('loSkins').addEventListener('click', e => { const b = e.target.closest('button[data-skin]'); if (!b) return; loadout[loSlot].skin = b.dataset.skin; renderLoadout(); });
$('loReset').addEventListener('click', () => { loadout[loSlot].att = defaultAtt(loadout[loSlot].id); renderLoadout(); });
$('loDone').addEventListener('click', () => {
  if (loReturn === 'bench') { closeBench(); return; }
  saveLoadout(); refreshBest();
  if (G.playing) {
    if (G.mode === 'bots') { equip(); toast('LOADOUT SWAPPED'); }
    else { pendingLoadout = true; toast('NEW LOADOUT ON NEXT SPAWN'); }
  }
  showOnly(loReturn);
  if (loReturn === 'lobby') uiShowLobby();
});
function renderLoadout() {
  const sl = loadout[loSlot], id = sl.id;
  for (const b of $('loTabs').children) {
    const s = +b.dataset.s; b.classList.toggle('on', s === loSlot);
    b.textContent = `Slot ${s + 1} · ${GUNS[loadout[s].id].name}`;
  }
  $('loGuns').innerHTML = loadoutGunIds().map(g => `<button data-g="${g}" class="${g === id ? 'on' : ''}"><b>${escHtml(GUNS[g].name)}</b>${escHtml(GUNS[g].cls)}</button>`).join('');
  $('loAtts').innerHTML = MOD_CATS.map(([cat, label]) => {
    const ch = modChoices(id, cat);
    if (ch.length <= 1) return '';
    const table = cat === 'optic' ? OPTICS : MODS[cat];
    const sel = sl.att[cat];
    return `<div class="attrow"><div class="k">${label.toUpperCase()}</div><div><div class="chips">${
      ch.map(v => `<button data-cat="${cat}" data-v="${v}" class="${v === sel ? 'on' : ''}">${table[v].name}</button>`).join('')
    }</div><div class="attdesc">${table[sel].desc || ''}</div></div></div>`;
  }).join('');
  $('loSkins').innerHTML = SKIN_IDS.map(k => `<button data-skin="${k}" class="sw${k === sl.skin ? ' on' : ''}" aria-label="${escHtml(SKINS[k].name)} skin"><i style="background:${skinSwatch(k)}"></i>${escHtml(SKINS[k].name)}</button>`).join('');
  const s = gunStats(id, sl.att), base = gunStats(id, defaultAtt(id));
  $('loName').textContent = GUNS[id].name;
  $('loSub').textContent = `${GUNS[id].cls} · ${SKINS[sl.skin || 'factory'].name} · ${modSummary(sl)}`;
  const bb = statBars(base);
  $('loStats').innerHTML = statBars(s).map(([label, v, txt], i) => {
    const b = bb[i][1], cv = Math.round(v * 100), bv = Math.round(b * 100);
    let bars;
    if (Math.abs(cv - bv) < 1) bars = `<i style="width:${cv}%"></i>`;
    else if (cv > bv) bars = `<i style="width:${bv}%"></i><i class="up" style="left:${bv}%;width:${cv - bv}%"></i>`;
    else bars = `<i style="width:${cv}%"></i><i class="dn" style="left:${cv}%;width:${bv - cv}%"></i>`;
    return `<div class="sb"><span>${label}</span><span class="tr">${bars}</span><span>${txt}</span></div>`;
  }).join('');
  $('loNote').textContent = loReturn === 'bench' ? (G.mode === 'net' ? 'The match keeps going while you work, so pick a quiet spot.' : 'The game is paused while you work.') : G.mode === 'net' && G.playing ? 'Changes take effect the next time you spawn.' : 'Green is better than this gun with no mods, red is worse. Skins only change the look.';
}

/* ---------- joining ---------- */
function uiJoinStatus(t, bad) { const s = $('joinStatus'); s.textContent = t; s.classList.toggle('bad', !!bad); }
$('joinBtn').addEventListener('click', () => { showOnly('joinov'); uiJoinStatus(''); $('joinCode').focus(); });
$('joinBack').addEventListener('click', () => { netReset(); showOnly('menu'); });
$('joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinGo').click(); });
$('joinGo').addEventListener('click', () => {
  const code = $('joinCode').value.toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { uiJoinStatus('A match code is four letters.', true); return; }
  initAudio();
  netReset();
  uiJoinStatus('Connecting to ' + code + '…');
  $('joinGo').disabled = true;
  Net.onClientMsg = clientHandle;
  Net.onDrop = () => { const was = G.mode === 'net' || MP.lobby; netReset(); toMenu(was ? 'Lost the connection to the host.' : undefined); };
  Net.join(code, () => { $('joinGo').disabled = false; uiJoinStatus('Connected. Waiting for the lobby…'); Net.sendHost({ t: 'hello', name: MP.myName }); },
    msg => { $('joinGo').disabled = false; uiJoinStatus(msg, true); });
});

/* ---------- hosting ---------- */
$('hostBtn').addEventListener('click', () => {
  initAudio();
  netReset();
  MP.lobby = null;
  showOnly('lobby');
  $('lobbyCode').textContent = '····'; $('inviteLink').value = '';
  $('lobbyTeams').innerHTML = ''; $('hostCtl').hidden = true; $('startBtn').hidden = true;
  setLobbyStatus('Getting a match code…');
  Net.onHostMsg = hostHandle; Net.onJoin = () => {}; Net.onLeave = hostLeave;
  Net.host(code => {
    MP.me = 'H'; HS.state = 'lobby'; HS.map = G.map;
    HS.rules = cleanRules({ kind: offRules.kind, squad: offRules.kind === 'br' ? offRules.squad : 2, limit: +$('scoreLimit').value });
    hostAddPlayer('H', MP.myName);
    broadcastLobby();
  }, msg => setLobbyStatus(msg, true));
});
function setLobbyStatus(t, bad) { const s = $('lobbyStatus'); s.textContent = t; s.classList.toggle('bad', !!bad); }
function inviteUrl(code) { return location.origin + location.pathname + '?join=' + code; }
function uiShowLobby() {
  const L = MP.lobby; if (!L) return;
  if (!$('loadout').hidden) return; // don't yank someone out of the loadout screen
  showOnly('lobby'); $('hud').hidden = true;
  if (!G.playing && world.id !== L.map) loadMap(L.map);
  const ru = cleanRules(L.rules), host = Net.isHost;
  $('lobbyEye').textContent = 'Online match · ' + modeLabel(ru).toLowerCase();
  $('lobbyCode').textContent = L.code || Net.code || '----';
  $('inviteLink').value = inviteUrl(L.code || Net.code || '');
  const list = L.players.map(p => ({ name: p.name, team: p.team, k: p.k, d: p.d, me: p.id === MP.me, tag: p.id === 'H' ? 'host' : '' }));
  $('lobbyTeams').innerHTML = ru.kind === 'ffa' ? ffaTable(list) : teamsHtml(list, false);
  $('hostCtl').hidden = !host;
  $('lobbyModes').innerHTML = chipRow(MODE_ITEMS, ru.kind, 'mode', !host);
  $('lobbySquad').innerHTML = chipRow(SQUAD_ITEMS, ru.squad, 'squad', !host);
  $('lobbySquadRow').hidden = ru.kind !== 'br';
  $('limitRow').hidden = ru.kind === 'br';
  $('shuffleBtn').hidden = ru.kind === 'ffa';
  $('lobbyMaps').innerHTML = mapChipsHtml(L.map, !host);
  $('scoreLimit').value = String(ru.limit);
  const T = teamCountFor(ru, L.players.length);
  $('lobbyMapNote').textContent = `${MAPS[L.map].name}: ${MAPS[L.map].blurb.toLowerCase()} · ` + (ru.kind === 'br'
    ? `${SQUAD_NAMES[ru.squad].toLowerCase()}, the zone closes in, crates hold guns and armor, no respawns.`
    : ru.kind === 'tdm' ? `first team to ${ru.limit} kills, ${MATCH_MINUTES} minute cap.` : `first to ${ru.limit} kills, ${MATCH_MINUTES} minute cap.`);
  $('startBtn').hidden = !host;
  $('startBtn').disabled = !(L.players.length >= 2 && T >= 2);
  if (L.state === 'match' && !G.playing) setLobbyStatus('A match is running. You will drop in in a moment.');
  else if (host) setLobbyStatus(L.players.length < 2 ? 'Send the code to friends. You need at least two players to start.'
    : T < 2 ? `Everyone fits in one squad of ${ru.squad}. Pick a smaller squad size, or wait for more players.`
    : ru.kind === 'ffa' ? `${L.players.length} players, everyone on their own.` : `${L.players.length} players in ${T} teams. Teams stay even as people join.`);
  else setLobbyStatus('Waiting for the host to start the match.');
}
$('lobbyMaps').addEventListener('click', e => { const b = e.target.closest('button[data-map]'); if (!b || !Net.isHost) return; HS.map = b.dataset.map; broadcastLobby(); });
$('lobbyModes').addEventListener('click', e => { const b = e.target.closest('button[data-mode]'); if (!b || !Net.isHost) return; HS.rules = cleanRules({ ...HS.rules, kind: b.dataset.mode }); hostAssignTeams(false); broadcastLobby(); });
$('lobbySquad').addEventListener('click', e => { const b = e.target.closest('button[data-squad]'); if (!b || !Net.isHost) return; HS.rules = cleanRules({ ...HS.rules, squad: +b.dataset.squad }); hostAssignTeams(false); broadcastLobby(); });
$('scoreLimit').addEventListener('change', e => { if (!Net.isHost) return; HS.rules = cleanRules({ ...HS.rules, limit: +e.target.value }); broadcastLobby(); });
$('shuffleBtn').addEventListener('click', () => { if (!Net.isHost) return; hostAssignTeams(true); broadcastLobby(); });
$('startBtn').addEventListener('click', () => { if (Net.isHost) hostStartMatch(); });
$('leaveBtn').addEventListener('click', () => { netReset(); toMenu(); });
$('copyLink').addEventListener('click', () => {
  const el = $('inviteLink'), url = el.value;
  const fallback = () => { el.focus(); el.select(); setLobbyStatus('Link selected. Press Ctrl+C to copy it.'); };
  try { navigator.clipboard.writeText(url).then(() => setLobbyStatus('Invite link copied.'), fallback); } catch (e) { fallback(); }
});

/* ---------- start ---------- */
loadMap(G.map);
{
  const j = new URLSearchParams(location.search).get('join');
  if (j && /^[A-Za-z]{4}$/.test(j)) { showOnly('joinov'); $('joinCode').value = j.toUpperCase(); uiJoinStatus('Check your name on the main menu, then press Join.'); }
}
// Test hook for driving the game from a script; only exists with ?ozdebug in the address.
if (/[?&]ozdebug\b/.test(location.search)) window.__oz = { world, P, G, MP, HS, bots: () => bots, crates: () => crates, groundGuns: () => groundGuns, guns: () => guns, fire: () => fire(), mpSend, interact, loadMap, FPS };
requestAnimationFrame(frame);
addEventListener('keydown', e => { if (bindCapture || e.code !== 'Escape' || $('controls').hidden) return; if (padCapture) { padCapture = null; renderPadBinds(); } else closeControls(); });


/* ---------- controller stick settings ---------- */
const CURVES = [[1, 'Linear', 'Even all the way'], [1.8, 'Standard', 'Fine aim near the middle'], [2.6, 'Precise', 'Very fine near the middle']];
const ASSISTS = [[0, 'Off', 'None at all'], [0.5, 'Low', 'A light touch'], [1, 'Normal', 'Like most console shooters'], [1.4, 'High', 'Strong pull']];
function renderSticks() {
  $('psSens').value = padCfg.sens; $('psVert').value = padCfg.vert; $('psDz').value = padCfg.dz;
  $('psInvert').checked = padCfg.invert; $('psBoost').checked = padCfg.boost;
  $('psCurve').innerHTML = chipRow(CURVES, CURVES.reduce((a, c) => Math.abs(c[0] - padCfg.curve) < Math.abs(a[0] - padCfg.curve) ? c : a)[0], 'curve');
  $('psAssist').innerHTML = chipRow(ASSISTS, ASSISTS.reduce((a, c) => Math.abs(c[0] - padCfg.assist) < Math.abs(a[0] - padCfg.assist) ? c : a)[0], 'assist');
}
const stickChanged = () => { savePadCfg(); $('ctlCode').value = controlsCode(); };
for (const [id, k] of [['psSens', 'sens'], ['psVert', 'vert'], ['psDz', 'dz']]) $(id).addEventListener('input', e => { padCfg[k] = +e.target.value; stickChanged(); });
$('psInvert').addEventListener('change', e => { padCfg.invert = e.target.checked; stickChanged(); });
$('psBoost').addEventListener('change', e => { padCfg.boost = e.target.checked; stickChanged(); });
$('psCurve').addEventListener('click', e => { const b = e.target.closest('button[data-curve]'); if (!b) return; padCfg.curve = +b.dataset.curve; stickChanged(); renderSticks(); });
$('psAssist').addEventListener('click', e => { const b = e.target.closest('button[data-assist]'); if (!b) return; padCfg.assist = +b.dataset.assist; stickChanged(); renderSticks(); });

/* ---------- sharing a whole controls setup ---------- */
// only what differs from the defaults goes in the code, so it stays short
function controlsCode() {
  const k = {}, p = {}, c = {};
  for (const [id, , , def] of ACTIONS) if (binds[id].join() !== def.join()) k[id] = binds[id];
  for (const [id, , def] of PAD_ACTS) if (padBinds[id].join() !== def.join()) p[id] = padBinds[id];
  for (const key in PAD_CFG_DEF) if (padCfg[key] !== PAD_CFG_DEF[key]) c[key] = padCfg[key];
  return shareEncode('C', { k, p, t: padTypeSet, c, s: sens });
}
function applyControls(o) {
  const keyOk = c => typeof c === 'string' && /^[A-Za-z0-9]{0,24}$/.test(c), padOk = c => typeof c === 'string' && /^(|b\d{1,2}|a\d{1,2}[+-])$/.test(c);
  for (const [id, , , def] of ACTIONS) { const v = o.k && o.k[id]; binds[id] = Array.isArray(v) && v.length === 2 && v.every(keyOk) ? v.slice() : def.slice(); }
  saveBinds();
  for (const [id, , def] of PAD_ACTS) { const v = o.p && o.p[id]; padBinds[id] = Array.isArray(v) && v.length === 2 && v.every(padOk) ? v.slice() : def.slice(); }
  savePadBinds();
  if (PAD_TYPES.some(t => t[0] === o.t)) { padTypeSet = o.t; store.set('padType', padTypeSet); }
  padCfg = cleanPadCfg(o.c); savePadCfg();
  if (Number.isFinite(+o.s)) { sens = clamp(+o.s, 0.3, 2.5); store.set('sens', sens); $('sens').value = sens; }
}
async function copyText(input, msgEl, ok) {
  input.select(); let done = false;
  try { await navigator.clipboard.writeText(input.value); done = true; } catch (e) { try { done = document.execCommand('copy'); } catch (e2) {} }
  msgEl.textContent = done ? ok : 'Select the code and copy it (Ctrl+C).';
}
$('ctlCopy').addEventListener('click', () => { $('ctlCode').value = controlsCode(); copyText($('ctlCode'), $('ctlMsg'), 'Copied. Send it to a friend.'); });
$('ctlApply').addEventListener('click', () => {
  const d = shareDecode($('ctlPaste').value);
  if (!d) { $('ctlMsg').textContent = 'That code did not work. Check it was copied whole.'; return; }
  if (d.tag !== 'C') { $('ctlMsg').textContent = 'That is a gun or skin code: add it in the Workshop.'; return; }
  applyControls(d.obj); renderBinds(); renderPadBinds(); renderSticks(); renderLegend(); renderBreath();
  $('ctlCode').value = controlsCode(); $('ctlPaste').value = '';
  $('ctlMsg').textContent = 'Done: you are using their controls now. Reset buttons put yours back to the defaults.';
});

/* ---------- the workshop ---------- */
let wsTab = 'gun', wsFrom = 'menu', wsEdit = { gun: null, skin: null }, wsGun = cleanGunSpec({}), wsSkin = cleanSkinSpec({});
let wsR = null, wsScene, wsCam, wsModel = null, wsSpin = 0, wsLoop = false;
const WS_GUN = '__ws_gun', WS_SKIN = '__ws_skin';
function statHtml(s, base) {
  const bb = statBars(base);
  return statBars(s).map(([label, v, txt], i) => {
    const b = bb[i][1], cv = Math.round(v * 100), bv = Math.round(b * 100);
    let bars;
    if (Math.abs(cv - bv) < 1) bars = `<i style="width:${cv}%"></i>`;
    else if (cv > bv) bars = `<i style="width:${bv}%"></i><i class="up" style="left:${bv}%;width:${cv - bv}%"></i>`;
    else bars = `<i style="width:${cv}%"></i><i class="dn" style="left:${cv}%;width:${bv - cv}%"></i>`;
    return `<div class="sb"><span>${label}</span><span class="tr">${bars}</span><span>${txt}</span></div>`;
  }).join('');
}
function wsInitView() {
  if (wsR) return;
  try {
    wsR = new THREE.WebGLRenderer({ canvas: $('wsView'), antialias: true, alpha: true });
    wsR.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    wsR.toneMapping = renderer.toneMapping; wsR.toneMappingExposure = renderer.toneMappingExposure; wsR.outputEncoding = renderer.outputEncoding;
  } catch (e) { wsR = null; return; }
  wsScene = new THREE.Scene();
  wsScene.add(new THREE.HemisphereLight(0xffffff, 0x40464c, 0.9));
  const l = new THREE.DirectionalLight(0xffffff, 0.9); l.position.set(2, 3, 2); wsScene.add(l);
  const l2 = new THREE.DirectionalLight(0xbfd4ff, 0.35); l2.position.set(-2, 1, -2); wsScene.add(l2);
  wsCam = new THREE.PerspectiveCamera(30, 720 / 380, 0.1, 20);
}
function wsShowModel() {
  if (!wsR) return;
  if (wsModel) { disposeGunModel(wsModel); wsModel = null; }
  let id, skin;
  if (wsTab === 'gun') { GUNS[WS_GUN] = buildCustomGun(wsGun); id = WS_GUN; skin = 'factory'; }
  else { setSkin(WS_SKIN, wsSkin); id = loadout[0] ? loadout[0].id : 'vk7'; skin = WS_SKIN; }
  wsModel = makeGunModel(id, defaultAtt(id), skin, true);
  const g = wsModel.group; wsScene.add(g); g.scale.setScalar(1); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  g.position.sub(c);
  const pivot = new THREE.Group(); pivot.add(g); wsScene.add(pivot); wsModel.pivot = pivot;
  const L = Math.max(size.z, size.y * 2, .3);
  wsCam.position.set(0, L * 0.12, L * 1.45); wsCam.lookAt(0, 0, 0);
}
function wsFrame() {
  if (!wsLoop) return;
  requestAnimationFrame(wsFrame);
  if (!wsR || !wsModel) return;
  const cv = $('wsView'), w = cv.clientWidth, h = cv.clientHeight;
  if (w && h && (cv.width !== Math.round(w * wsR.getPixelRatio()) || cv.height !== Math.round(h * wsR.getPixelRatio()))) { wsR.setSize(w, h, false); wsCam.aspect = w / h; wsCam.updateProjectionMatrix(); }
  wsSpin += 0.006;
  wsModel.pivot.rotation.y = Math.PI / 2 + Math.sin(wsSpin) * 0.6;
  wsModel.pivot.rotation.x = Math.sin(wsSpin * 0.7) * 0.08;
  wsR.render(wsScene, wsCam);
}
const wsChips = (label, items, sel, attr) => `<div class="attrow"><div class="k">${label}</div><div><div class="chips">${items.map(([v, n]) => `<button data-${attr}="${v}" class="${String(v) === String(sel) ? 'on' : ''}">${n}</button>`).join('')}</div></div></div>`;
function wsRender() {
  for (const b of $('wsTabs').children) b.classList.toggle('on', b.dataset.t === wsTab);
  let h = '';
  if (wsTab === 'gun') {
    const s = wsGun, P = partsFor(s.f);
    h += `<div class="attrow"><div class="k">NAME</div><div><input class="txt" id="wsNameIn" maxlength="16" value="${escHtml(s.n)}" aria-label="Gun name" autocomplete="off" spellcheck="false"></div></div>`;
    h += wsChips('FRAME', Object.entries(GUN_FRAMES).map(([k, f]) => [k, f.name]), s.f, 'wf');
    h += wsChips('FIRE MODE', P.modes.map(k => [k, GUN_MODES[k]]), s.x, 'wx');
    if (P.barrels.length > 1) h += wsChips('BARREL', P.barrels.map(k => [k, GUN_BARRELS[k]]), s.b, 'wb');
    if (P.stocks.length > 1) h += wsChips('STOCK', P.stocks.map(k => [k, GUN_STOCKS[k]]), s.s, 'ws');
    h += wsChips('MAGAZINE', P.mags.map(k => [k, GUN_MAGS[k]]), s.m, 'wm');
    h += `<div class="attrow"><div class="k">COLOUR</div><div><div class="chips">${GUN_COLOURS.map((c, i) => `<button data-wc="${i}" class="${i === s.c ? 'on' : ''}" aria-label="Colour ${i + 1}"><span class="swc" style="background:#${c.toString(16).padStart(6, '0')}"></span></button>`).join('')}</div></div></div>`;
    const notes = [PART_NOTES[s.b], s.s === 'heavy' ? PART_NOTES.heavyStock : s.s === 'none' ? PART_NOTES.none : '', PART_NOTES[s.m]].filter(n => n && n !== 'Balanced');
    h += `<div class="attdesc">${notes.join(' · ') || 'Every part changes the numbers: try them and watch the bars.'}</div>`;
  } else {
    const s = wsSkin;
    h += `<div class="attrow"><div class="k">NAME</div><div><input class="txt" id="wsNameIn" maxlength="16" value="${escHtml(s.n)}" aria-label="Skin name" autocomplete="off" spellcheck="false"></div></div>`;
    h += wsChips('PATTERN', Object.entries(SKIN_KINDS), s.k, 'wk');
    h += `<div class="attrow"><div class="k">COLOURS</div><div class="colors">${['Base', 'Second', 'Third', 'Fourth'].map((n, i) => `<label>${n} <input type="color" data-wcol="${i}" value="${s.c[i]}"></label>`).join('')}</div></div>`;
    h += `<div class="row" style="margin-top:8px"><button class="alt" id="wsShuffle">Shuffle the pattern</button></div>`;
    h += `<div class="attdesc">Shown on the gun in your first loadout slot. Save it, then pick it in the loadout like any skin.</div>`;
  }
  $('wsEditor').innerHTML = h;
  wsRenderSide();
  wsRenderList();
}
function wsRenderSide() {
  const editing = wsEdit[wsTab];
  if (wsTab === 'gun') {
    GUNS[WS_GUN] = buildCustomGun(wsGun);
    const F = GUN_FRAMES[wsGun.f], s = gunStats(WS_GUN, defaultAtt(WS_GUN)), base = gunStats(F.t, defaultAtt(F.t));
    $('wsName').textContent = wsGun.n;
    $('wsSub').textContent = `${F.name} · ${GUN_MODES[wsGun.x]} · bars compare it with the stock ${GUNS[F.t].name}`;
    $('wsStats').innerHTML = statHtml(s, base);
  } else {
    $('wsName').textContent = wsSkin.n; $('wsSub').textContent = `${SKIN_KINDS[wsSkin.k]} skin`; $('wsStats').innerHTML = '';
  }
  $('wsSave').textContent = editing ? 'Save changes' : wsTab === 'gun' ? 'Save gun' : 'Save skin';
  wsShowModel();
}
function wsRenderList() {
  const items = wsTab === 'gun' ? customGuns.map(g => ({ id: g.id, n: g.spec.n, sub: `${GUN_FRAMES[g.spec.f].name} · ${GUN_MODES[g.spec.x]}` }))
    : customSkins.map(s => ({ id: s.id, n: s.spec.n, sub: SKIN_KINDS[s.spec.k], sw: skinSwatch(s.id) }));
  $('wsList').innerHTML = items.length ? items.map(it => `<div class="it${wsEdit[wsTab] === it.id ? ' on' : ''}">${it.sw ? `<span class="swc" style="background:${it.sw}"></span>` : ''}<b>${escHtml(it.n)}</b><span>${escHtml(it.sub)}</span>
    <button class="alt" data-wedit="${it.id}">Edit</button><button class="alt" data-wcopy="${it.id}">Copy code</button><button class="alt" data-wdel="${it.id}">Delete</button></div>`).join('')
    : `<div class="note">Nothing saved yet. Design one above and press Save; it then shows up in your loadout.</div>`;
}
function openWorkshop(from, tab) {
  wsFrom = from; if (tab) wsTab = tab;
  showOnly('workshop'); $('wsMsg').textContent = '';
  wsInitView(); wsRender();
  if (!wsLoop) { wsLoop = true; requestAnimationFrame(wsFrame); }
}
function closeWorkshop() {
  wsLoop = false; if (wsModel) { disposeGunModel(wsModel); wsModel = null; }
  if (wsFrom === 'loadout') { showOnly('loadout'); renderLoadout(); } else showOnly('menu');
}
$('openWorkshop').addEventListener('click', () => openWorkshop('menu'));
$('loDesign').addEventListener('click', () => { if (loReturn === 'bench') { toast('USE THE WORKSHOP FROM THE MAIN MENU'); return; } openWorkshop('loadout'); });
$('wsDone').addEventListener('click', closeWorkshop);
$('wsTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; wsTab = b.dataset.t; $('wsMsg').textContent = ''; wsRender(); });
$('wsEditor').addEventListener('input', e => {
  if (e.target.id === 'wsNameIn') { const s = wsTab === 'gun' ? wsGun : wsSkin; s.n = e.target.value.slice(0, 16); $('wsName').textContent = s.n; return; }
  if (e.target.dataset.wcol != null) { wsSkin.c[+e.target.dataset.wcol] = e.target.value; wsShowModel(); }
});
$('wsEditor').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (b.id === 'wsShuffle') { wsSkin.s = (Math.random() * 65535) | 0; wsShowModel(); return; }
  if (d.wf) { wsGun = cleanGunSpec(Object.assign({}, wsGun, { f: d.wf, x: null })); }
  else if (d.wx) wsGun.x = d.wx; else if (d.wb) wsGun.b = d.wb; else if (d.ws) wsGun.s = d.ws; else if (d.wm) wsGun.m = d.wm;
  else if (d.wc != null) wsGun.c = +d.wc; else if (d.wk) wsSkin.k = d.wk; else return;
  wsRender();
});
$('wsSave').addEventListener('click', () => {
  if (wsTab === 'gun') {
    wsGun = cleanGunSpec(wsGun);
    const id = saveCustomGun(wsEdit.gun, wsGun);
    if (!id) { $('wsMsg').textContent = 'You can keep 12 guns. Delete one to make room.'; return; }
    wsEdit.gun = id; $('wsMsg').textContent = `Saved. Find "${wsGun.n}" at the end of the gun list in your loadout.`;
  } else {
    wsSkin = cleanSkinSpec(wsSkin);
    const id = saveCustomSkin(wsEdit.skin, wsSkin);
    if (!id) { $('wsMsg').textContent = 'You can keep 12 skins. Delete one to make room.'; return; }
    wsEdit.skin = id; $('wsMsg').textContent = `Saved. "${wsSkin.n}" is now in the skin list in your loadout.`;
  }
  wsRender();
});
$('wsNew').addEventListener('click', () => {
  wsEdit[wsTab] = null;
  if (wsTab === 'gun') wsGun = cleanGunSpec({ f: wsGun.f }); else wsSkin = cleanSkinSpec({ k: wsSkin.k, c: wsSkin.c });
  $('wsMsg').textContent = ''; wsRender();
});
$('wsList').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.wedit) {
    if (wsTab === 'gun') { const g = customGuns.find(x => x.id === d.wedit); if (g) { wsGun = cleanGunSpec(g.spec); wsEdit.gun = g.id; } }
    else { const s = customSkins.find(x => x.id === d.wedit); if (s) { wsSkin = cleanSkinSpec(s.spec); wsEdit.skin = s.id; } }
    $('wsMsg').textContent = ''; wsRender();
  } else if (d.wcopy) {
    const code = wsTab === 'gun' ? gunCode(d.wcopy) : skinCode(d.wcopy);
    $('wsPaste').value = code; copyText($('wsPaste'), $('wsMsg'), 'Code copied. Send it to a friend; they paste it here, under "Add a friend\'s design".');
  } else if (d.wdel) {
    if (wsTab === 'gun') deleteCustomGun(d.wdel); else deleteCustomSkin(d.wdel);
    if (wsEdit[wsTab] === d.wdel) wsEdit[wsTab] = null;
    $('wsMsg').textContent = 'Deleted.'; wsRender();
  }
});
$('wsImport').addEventListener('click', () => {
  const d = shareDecode($('wsPaste').value);
  if (!d) { $('wsMsg').textContent = 'That code did not work. Check it was copied whole.'; return; }
  if (d.tag === 'C') { $('wsMsg').textContent = 'That is a controls code: paste it in Controls instead.'; return; }
  if (d.tag === 'G') {
    const spec = cleanGunSpec(d.obj), id = saveCustomGun(null, spec);
    if (!id) { $('wsMsg').textContent = 'You can keep 12 guns. Delete one to make room.'; return; }
    wsTab = 'gun'; wsGun = spec; wsEdit.gun = id; $('wsMsg').textContent = `Added "${spec.n}". It is in your loadout now.`;
  } else {
    const spec = cleanSkinSpec(d.obj), id = saveCustomSkin(null, spec);
    if (!id) { $('wsMsg').textContent = 'You can keep 12 skins. Delete one to make room.'; return; }
    wsTab = 'skin'; wsSkin = spec; wsEdit.skin = id; $('wsMsg').textContent = `Added "${spec.n}". It is in your skin list now.`;
  }
  $('wsPaste').value = ''; wsRender();
});
addEventListener('keydown', e => { if (e.code === 'Escape' && !$('workshop').hidden && !typing(e.target)) closeWorkshop(); });
