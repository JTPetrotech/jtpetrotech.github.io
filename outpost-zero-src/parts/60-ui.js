/* Menus: main menu, loadout, join, lobby, pause, end. */

const OVERLAYS = ['menu', 'joinov', 'lobby', 'loadout', 'pause', 'end'];
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
  $('loGuns').innerHTML = GUN_IDS.map(g => `<button data-g="${g}" class="${g === id ? 'on' : ''}"><b>${GUNS[g].name}</b>${GUNS[g].cls}</button>`).join('');
  $('loAtts').innerHTML = MOD_CATS.map(([cat, label]) => {
    const ch = modChoices(id, cat);
    if (ch.length <= 1) return '';
    const table = cat === 'optic' ? OPTICS : MODS[cat];
    const sel = sl.att[cat];
    return `<div class="attrow"><div class="k">${label.toUpperCase()}</div><div><div class="chips">${
      ch.map(v => `<button data-cat="${cat}" data-v="${v}" class="${v === sel ? 'on' : ''}">${table[v].name}</button>`).join('')
    }</div><div class="attdesc">${table[sel].desc || ''}</div></div></div>`;
  }).join('');
  $('loSkins').innerHTML = SKIN_IDS.map(k => `<button data-skin="${k}" class="sw${k === sl.skin ? ' on' : ''}" aria-label="${SKINS[k].name} skin"><i style="background:linear-gradient(135deg,${SKINS[k].sw[0]} 50%,${SKINS[k].sw[1]} 50%)"></i>${SKINS[k].name}</button>`).join('');
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
