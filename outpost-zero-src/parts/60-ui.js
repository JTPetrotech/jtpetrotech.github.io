/* Menus: main menu, loadout, join, lobby, pause, end. */

const OVERLAYS = ['menu', 'joinov', 'lobby', 'loadout', 'pause', 'end'];
function showOnly(id) { for (const o of OVERLAYS) $(o).hidden = o !== id; }

/* ---------- name, settings ---------- */
MP.myName = cleanName(store.get('name', 'Player' + (10 + ((Math.random() * 89) | 0))));
$('pname').value = MP.myName;
$('pname').addEventListener('input', e => { MP.myName = cleanName(e.target.value); store.set('name', MP.myName); });
$('sens').value = sens; $('vol').value = volume;
$('sens').addEventListener('input', e => { sens = +e.target.value; store.set('sens', sens); });
$('vol').addEventListener('input', e => { volume = +e.target.value; store.set('vol', volume); if (master) master.gain.value = volume; });
function refreshBest() {
  $('best').textContent = G.round > 1 ? `Solo: you're on round ${G.round}. Each round brings more bots with sharper aim.` : '';
  $('loSummary').textContent = loadout.map(sl => GUNS[sl.id].name).join(' + ');
}
refreshBest();

/* ---------- map chips ---------- */
function mapChipsHtml(sel, disabled) {
  return Object.entries(MAPS).map(([id, m]) =>
    `<button data-map="${id}" class="${id === sel ? 'on' : ''}"${disabled ? ' disabled' : ''}><b>${m.name}</b>${m.blurb}</button>`).join('');
}
function renderMenuMaps() { $('mapChips').innerHTML = mapChipsHtml(G.map, false); }
$('mapChips').addEventListener('click', e => {
  const b = e.target.closest('button[data-map]'); if (!b) return;
  G.map = b.dataset.map; store.set('map', G.map); renderMenuMaps();
  if (!G.playing) loadMap(G.map);
});
renderMenuMaps();

/* ---------- entering and leaving play ---------- */
function uiEnterGame(net) {
  initAudio();
  showOnly(null); $('hud').hidden = false;
  G.playing = true;
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
  const tdm = G.mode === 'tdm';
  $('pauseEye').textContent = 'Paused';
  $('pauseTitle').textContent = tdm ? 'Match still running' : 'Holding position';
  $('pauseText').textContent = tdm ? 'You can still be hit while this is open.' : 'Click below to lock the mouse and get back in.';
  $('resume').textContent = 'Resume'; $('quitBtn').textContent = tdm ? 'Leave match' : 'Quit to menu';
  $('pauseNote').textContent = tdm && Net.isHost ? 'You are hosting. Leaving ends the match for everyone.' : '';
  $('pause').hidden = false;
}
$('resume').addEventListener('click', () => { initAudio(); $('pause').hidden = true; G.paused = false; lock(); canvas.focus(); });
function toMenu(note) {
  G.playing = false; G.paused = false; G.mode = null;
  clearSolo(); clearAvatars(); zoneMesh.visible = false;
  if (document.exitPointerLock && locked) document.exitPointerLock();
  $('hud').hidden = true; showOnly('menu');
  refreshBest();
  if (note) $('best').textContent = note;
  if (world.id !== G.map) loadMap(G.map);
}
function netReset() {
  Net.close();
  clearTimeout(HS.endTimer); HS.players.clear(); HS.state = 'lobby'; HS.order = 0;
  MP.me = null; MP.players = new Map(); MP.state = 'idle'; MP.lobby = null;
}
$('quitBtn').addEventListener('click', () => { if (G.mode === 'tdm') netReset(); toMenu(); });
$('again').addEventListener('click', () => { uiEnterGame(false); startSolo(); });
$('endMenu').addEventListener('click', () => { if (G.mode === 'tdm' || Net.peer) netReset(); toMenu(); });
$('play').addEventListener('click', () => { uiEnterGame(false); startSolo(); });

/* ---------- loadout ---------- */
let loSlot = 0, loReturn = 'menu';
function openLoadout(from) { loReturn = from; showOnly('loadout'); renderLoadout(); }
$('openLoadout').addEventListener('click', () => openLoadout('menu'));
$('lobbyLoadout').addEventListener('click', () => openLoadout('lobby'));
$('pauseLoadout').addEventListener('click', () => openLoadout('pause'));
$('loTabs').addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (!b) return; loSlot = +b.dataset.s; renderLoadout(); });
$('loGuns').addEventListener('click', e => {
  const b = e.target.closest('button[data-g]'); if (!b) return;
  if (loadout[loSlot].id !== b.dataset.g) loadout[loSlot] = { id: b.dataset.g, att: defaultAtt(b.dataset.g) };
  renderLoadout();
});
$('loAtts').addEventListener('click', e => {
  const b = e.target.closest('button[data-cat]'); if (!b) return;
  loadout[loSlot].att[b.dataset.cat] = b.dataset.v; renderLoadout();
});
$('loReset').addEventListener('click', () => { loadout[loSlot].att = defaultAtt(loadout[loSlot].id); renderLoadout(); });
$('loDone').addEventListener('click', () => {
  saveLoadout(); refreshBest();
  if (G.playing) {
    if (G.mode === 'solo') { equip(); toast('LOADOUT SWAPPED'); }
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
  const s = gunStats(id, sl.att), base = gunStats(id, defaultAtt(id));
  $('loName').textContent = GUNS[id].name;
  $('loSub').textContent = `${GUNS[id].cls} · ${modSummary(sl)}`;
  const bb = statBars(base);
  $('loStats').innerHTML = statBars(s).map(([label, v, txt], i) => {
    const b = bb[i][1], cv = Math.round(v * 100), bv = Math.round(b * 100);
    let bars;
    if (Math.abs(cv - bv) < 1) bars = `<i style="width:${cv}%"></i>`;
    else if (cv > bv) bars = `<i style="width:${bv}%"></i><i class="up" style="left:${bv}%;width:${cv - bv}%"></i>`;
    else bars = `<i style="width:${cv}%"></i><i class="dn" style="left:${cv}%;width:${bv - cv}%"></i>`;
    return `<div class="sb"><span>${label}</span><span class="tr">${bars}</span><span>${txt}</span></div>`;
  }).join('');
  $('loNote').textContent = G.mode === 'tdm' && G.playing ? 'Changes take effect the next time you spawn.' : 'Green is better than this gun with no mods, red is worse.';
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
  Net.onDrop = () => { const was = G.mode === 'tdm' || MP.lobby; netReset(); toMenu(was ? 'Lost the connection to the host.' : undefined); };
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
    MP.me = 'H'; HS.state = 'lobby'; HS.map = G.map; HS.limit = +$('scoreLimit').value;
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
  $('lobbyCode').textContent = L.code || Net.code || '----';
  $('inviteLink').value = inviteUrl(L.code || Net.code || '');
  $('lobbyTeams').innerHTML = teamsHtml(L.players, false);
  const host = Net.isHost;
  $('hostCtl').hidden = !host;
  $('lobbyMaps').innerHTML = mapChipsHtml(L.map, !host);
  $('scoreLimit').value = String(L.limit);
  $('lobbyMapNote').textContent = `${MAPS[L.map].name}: ${MAPS[L.map].blurb.toLowerCase()} · first team to ${L.limit} kills, ${MATCH_MINUTES} minute cap.`;
  $('startBtn').hidden = !host;
  $('startBtn').disabled = L.players.length < 2;
  if (L.state === 'match' && !G.playing) setLobbyStatus('A match is running. You will drop in in a moment.');
  else if (host) setLobbyStatus(L.players.length < 2 ? 'Send the code to a friend. You need at least two players to start.' : `${L.players.length} players. Teams stay even as people join.`);
  else setLobbyStatus('Waiting for the host to start the match.');
}
$('lobbyMaps').addEventListener('click', e => {
  const b = e.target.closest('button[data-map]'); if (!b || !Net.isHost) return;
  HS.map = b.dataset.map; broadcastLobby();
});
$('scoreLimit').addEventListener('change', e => { if (!Net.isHost) return; HS.limit = +e.target.value; broadcastLobby(); });
$('shuffleBtn').addEventListener('click', () => { if (!Net.isHost) return; hostEvenTeams(true); broadcastLobby(); });
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
if (/[?&]ozdebug\b/.test(location.search)) window.__oz = { P, G, MP, HS, guns: () => guns, fire: () => fire(), mpSend };
requestAnimationFrame(frame);
