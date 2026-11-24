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

/* ---------- input ---------- */
function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && G.playing && !G.paused && !G.over) uiPause();
});
const typing = t => t && ((t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox') || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
addEventListener('keydown', e => {
  if (typing(e.target)) return;
  keys[e.code] = true;
  if (!G.playing) return;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (G.paused || G.over) return;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'Digit1') swapTo(0); if (e.code === 'Digit2') swapTo(1);
  if (e.code === 'KeyC' || e.code === 'ControlLeft') P.crouch = !P.crouch;
  if (e.code === 'KeyE' || e.code === 'KeyF') interact();
  if (e.code === 'Escape' && !locked) uiPause();
});
addEventListener('keyup', e => { keys[e.code] = false; });
// Listen on the whole page, not just the canvas: a click anywhere in the game fires
addEventListener('mousedown', e => {
  if (!G.playing || G.paused || G.over) return;
  if (e.target && e.target.closest && e.target.closest('.ov')) return;
  if (!locked) lock();
  if (e.button === 0) { mouse.l = true; triggerT = G.time; }
  if (e.button === 2) mouse.r = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
addEventListener('contextmenu', e => { if (G.playing) e.preventDefault(); });
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
