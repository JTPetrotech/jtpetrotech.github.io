/* Input and the frame loop. */

function modeView() { return G.mode === 'net' ? netView() : botsView(); }
function update(dt) {
  G.time += dt;
  runTimers();
  const input = !G.paused && !G.over;
  const { scoped, spdH } = updatePlayer(dt, input);
  if (G.mode === 'bots') updateOffline(dt);
  else if (G.mode === 'net') updateNet(dt);
  if (!P.alive && G.spec) spectateCam(G.spec);
  updateHUD(dt, scoped, spdH);
}

/* ---------- input ----------
   Every action has a fixed "canonical" key - the one the rest of the game
   reads (keys.KeyW, keys.Space...) - and up to two keys or mouse buttons the
   player has bound to it. A press is translated to the canonical key here, so
   nothing else in the game needs to know about rebinding. */
const ACTIONS = [
  ['fwd', 'KeyW', 'Move forward', ['KeyW', 'ArrowUp']],
  ['back', 'KeyS', 'Move back', ['KeyS', 'ArrowDown']],
  ['left', 'KeyA', 'Move left', ['KeyA', 'ArrowLeft']],
  ['right', 'KeyD', 'Move right', ['KeyD', 'ArrowRight']],
  ['fire', 'Mouse0', 'Fire', ['Mouse0', '']],
  ['aim', 'Mouse2', 'Aim down sights', ['Mouse2', '']],
  ['jump', 'Space', 'Jump', ['Space', '']],
  ['sprint', 'ShiftLeft', 'Sprint · steady scope', ['ShiftLeft', '']],
  ['crouch', 'KeyC', 'Crouch', ['KeyC', 'ControlLeft']],
  ['reload', 'KeyR', 'Reload', ['KeyR', '']],
  ['use', 'KeyE', 'Use · pick up · drive', ['KeyE', 'KeyF']],
  ['gun1', 'Digit1', 'Gun 1', ['Digit1', '']],
  ['gun2', 'Digit2', 'Gun 2', ['Digit2', '']],
  ['swap', 'SwapGun', 'Switch gun', ['KeyQ', '']],
  ['board', 'Tab', 'Scoreboard', ['Tab', '']],
];
const ACT = Object.fromEntries(ACTIONS.map(a => [a[0], a]));
let binds = {};
let bindRev = {};
function loadBinds() {
  const saved = store.get('binds', null) || {};
  binds = {};
  for (const [id, , , def] of ACTIONS) {
    const s = saved[id];
    binds[id] = Array.isArray(s) && s.length === 2 ? s.map(c => typeof c === 'string' ? c : '') : def.slice();
  }
  rebuildBinds();
}
function rebuildBinds() {
  bindRev = {};
  for (const [id, canon] of ACTIONS) for (const c of binds[id]) if (c && !bindRev[c]) bindRev[c] = canon;
}
function saveBinds() { store.set('binds', binds); rebuildBinds(); }
// put a key on an action's slot, taking it off whatever had it before
function setBind(id, slot, code) {
  if (code) for (const a in binds) for (let i = 0; i < 2; i++) if (binds[a][i] === code) binds[a][i] = '';
  binds[id][slot] = code;
  saveBinds();
}
function resetBinds() { for (const [id, , , def] of ACTIONS) binds[id] = def.slice(); saveBinds(); }
const KEY_NAMES = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', AltRight: 'R-Alt',
  Tab: 'Tab', CapsLock: 'Caps', Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5' };
function keyName(code) {
  if (!code) return '—';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return code;
}
// the key to show for an action in prompts: its first bound key
function bindKey(id) { const b = binds[id] || []; return keyName(b[0] || b[1]); }
function bindKbd(id) { return `<kbd>${escHtml(bindKey(id))}</kbd>`; }
loadBinds();

function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && G.playing && !G.paused && !G.over) uiPause();
});
const typing = t => t && ((t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox') || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
let bindCapture = null; // set by the Controls screen while it waits for a key
function pressAction(canon, down) {
  if (canon === 'Mouse0') { mouse.l = down; if (down) triggerT = G.time; }
  else if (canon === 'Mouse2') mouse.r = down;
  else keys[canon] = down;
  if (!down || !G.playing || G.paused || G.over) return;
  if (canon === 'KeyR') startReload();
  if (canon === 'Digit1') swapTo(0); if (canon === 'Digit2') swapTo(1);
  if (canon === 'SwapGun') swapTo(1 - cur);
  if (canon === 'KeyC') P.crouch = !P.crouch;
  if (canon === 'KeyE') interact();
}
addEventListener('keydown', e => {
  if (bindCapture) { e.preventDefault(); e.stopPropagation(); bindCapture(e.code); return; }
  if (typing(e.target)) return;
  const canon = bindRev[e.code];
  if (G.playing && (canon || ['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code))) e.preventDefault();
  if (canon && !(e.repeat && canon !== 'Mouse0')) pressAction(canon, true);
  if (!G.playing || G.paused || G.over) return;
  if (e.code === 'Escape' && !locked) uiPause();
}, true);
addEventListener('keyup', e => { const canon = bindRev[e.code]; if (canon) pressAction(canon, false); });
// Listen on the whole page, not just the canvas: a click anywhere in the game fires
addEventListener('mousedown', e => {
  if (bindCapture) { e.preventDefault(); e.stopPropagation(); bindCapture('Mouse' + e.button); return; }
  if (!G.playing || G.paused || G.over) return;
  if (e.target && e.target.closest && e.target.closest('.ov')) return;
  if (!locked) lock();
  const canon = bindRev['Mouse' + e.button];
  if (canon) { e.preventDefault(); pressAction(canon, true); }
}, true);
addEventListener('mouseup', e => { const canon = bindRev['Mouse' + e.button]; if (canon) pressAction(canon, false); });
addEventListener('contextmenu', e => { if (G.playing || bindCapture) e.preventDefault(); });
addEventListener('mousemove', e => {
  if (!G.playing || G.paused || !P.alive) return;
  const s = 0.0022 * sens * (camera.fov / 75), mx = e.movementX || 0, my = e.movementY || 0;
  if (Math.abs(mx) > 400 || Math.abs(my) > 400) return; // a jump some browsers send when the pointer locks
  P.yaw -= mx * s; P.pitch = clamp(P.pitch - my * s, -1.5, 1.5);
  lookDX += mx; lookDY += my;
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
  const live = G.playing && (G.mode === 'net' || !G.paused);
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
  if (G.playing) fpsTick(dt); else $('fps').hidden = true;
  const fp = camera.position;
  sun.position.set(fp.x + SUN_OFF.x, fp.y + SUN_OFF.y, fp.z + SUN_OFF.z); sun.target.position.set(fp.x, 0, fp.z);
  sky.position.copy(fp);
  renderer.clear();
  renderer.render(scene, camera);
  if (G.playing) { renderer.clearDepth(); renderer.render(wScene, wCam); }
}
