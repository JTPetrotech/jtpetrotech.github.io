/* ---------- controller ----------
   Standard layout, the one most shooters use:
     left stick   move (click it to sprint)     right stick  look
     LT aim   RT fire   A jump   B crouch   X reload   RB use / pick up
     Y or LB switch gun   click right stick to steady a scope
     View/Back scoreboard   Start pause
   The menus are PadNav's job (padnav.js, prepended by the build).

   This part only presses the game's own inputs - keys, mouse, triggerT,
   P.yaw/pitch - the same ones the keyboard and mouse press, so nothing
   else in the game needs to know a pad exists. It remembers which of those
   it is holding and only ever lets go of its own, so a keyboard and a pad
   can both be in use at once. It polls on its own frame because the Gamepad
   API has no events. */
const padHeld = new Set();
let padMouseL = false, padMouseR = false, padSprint = false, padLast = 0;
const padPrev = [];

function padDown(gp, i) { const b = gp.buttons[i]; return !!(b && (b.pressed || b.value > 0.35)); }
function padStick(v) { return Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85; }
function padKey(code, on) {
  if (on) { if (!keys[code]) { keys[code] = true; padHeld.add(code); } }
  else if (padHeld.has(code)) { keys[code] = false; padHeld.delete(code); }
}
function padRelease() {
  for (const k of padHeld) keys[k] = false;
  padHeld.clear();
  if (padMouseL) mouse.l = false; if (padMouseR) mouse.r = false;
  padMouseL = padMouseR = padSprint = false;
}
function padFind() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let any = null;
  for (const p of pads) if (p && p.connected) { if (p.mapping === 'standard') return p; any = any || p; }
  return any;
}

function padFrame(now) {
  requestAnimationFrame(padFrame);
  const dt = Math.min(0.05, (now - (padLast || now)) / 1000); padLast = now;
  const gp = padFind();
  if (!gp) { if (padHeld.size || padMouseL || padMouseR) padRelease(); return; }
  const down = gp.buttons.map((b, i) => padDown(gp, i));
  const was = padPrev.slice();
  const edge = i => down[i] && !was[i];
  for (let i = 0; i < down.length; i++) padPrev[i] = down[i];

  if (!G.playing || G.paused || G.over || !P.alive) { if (padHeld.size || padMouseL || padMouseR) padRelease(); return; }

  // move: stick or d-pad, as WASD
  const mx = padStick(gp.axes[0] || 0), my = padStick(gp.axes[1] || 0);
  const fwd = my < -0.35 || down[12], back = my > 0.35 || down[13];
  padKey('KeyW', fwd); padKey('KeyS', back);
  padKey('KeyA', mx < -0.35); padKey('KeyD', mx > 0.35);
  // sprint latches on a stick click and lasts until you stop pushing forward
  if (edge(10)) padSprint = true;
  if (!fwd) padSprint = false;
  padKey('ShiftLeft', padSprint || down[11]);   // R3 steadies a scope, same key
  padKey('Space', down[0]);
  padKey('Tab', down[8]);

  // triggers: LT aim, RT fire
  if (down[6] && !mouse.r) { mouse.r = true; padMouseR = true; }
  else if (!down[6] && padMouseR) { mouse.r = false; padMouseR = false; }
  if (down[7] && !mouse.l) { mouse.l = true; padMouseL = true; triggerT = G.time; }
  else if (!down[7] && padMouseL) { mouse.l = false; padMouseL = false; }

  if (edge(1)) P.crouch = !P.crouch;
  if (edge(2)) startReload();
  if (edge(5)) interact();
  if (edge(3) || edge(4)) swapTo(1 - cur);

  // look: squared response for fine aim near the centre, slower while aiming
  const lx = padStick(gp.axes[2] || 0), ly = padStick(gp.axes[3] || 0);
  if (lx || ly) {
    const rate = 3.4 * sens * (camera.fov / 75) * (mouse.r ? 0.6 : 1);
    P.yaw -= lx * Math.abs(lx) * rate * dt;
    P.pitch = clamp(P.pitch - ly * Math.abs(ly) * rate * 0.75 * dt, -1.5, 1.5);
  }
}
requestAnimationFrame(padFrame);

if (window.PadNav) {
  PadNav.active = () => !G.playing || G.paused || G.over;
  PadNav.onStart = () => {
    if (!G.playing || G.over) return;
    if (!G.paused) uiPause();
    else if (!$('pause').hidden) $('resume').click();
  };
}
