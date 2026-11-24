/* ---------- controller ----------
   Standard layout, the one most shooters use:
     left stick   move, analog (click it to sprint)     right stick  look
     LT or LB aim   RT or RB fire (hold for semi-autos too)   A jump   B crouch
     X reload, or use / pick up / drive when there is something to use
     Y or d-pad up/down switch gun   click right stick to steady a scope
     View/Back scoreboard   Start pause
   Pads that do not report the standard layout often put their triggers on
   axes that rest at -1; those are found and read as triggers too.
   Driving: RT gas, LT brake and reverse, left stick steers, X or RB gets out.
   The menus are PadNav's job (padnav.js, prepended by the build).

   It presses the game's own inputs - keys, mouse, triggerT, P.yaw/pitch -
   plus padMove/padDrive for analog movement, so a keyboard and a pad can both
   be in use at once. It polls on its own frame: the Gamepad API has no events.

   Aim assist, as console shooters have it, only for the controller: the look
   slows down over an enemy, follows them a little while you move, and pulling
   LT near one brings the sights onto them. It never shoots for you. */
const padHeld = new Set();
let padMouseL = false, padMouseR = false, padSprint = false, padLast = 0, padHeldTurn = 0, padSnapT = 0;
let padUsing = false;                 // the last thing touched was the pad: prompts show pad buttons
const padMove = { x: 0, y: 0 };       // analog move, -1..1, y forward
const padDrive = { on: false, thr: 0, steer: 0 };
const padPrev = [];
const padRest = {};                   // per pad: the axes as first seen, to spot triggers that rest at -1
// how far a trigger is pulled, 0..1: the trigger, its bumper, or a trigger on an axis
function padTrigs(gp) {
  let L = Math.max(padVal(gp, 6), padVal(gp, 4)), R = Math.max(padVal(gp, 7), padVal(gp, 5));
  let look = [2, 3];
  if (gp.mapping !== 'standard') {
    const rest = padRest[gp.id] || (padRest[gp.id] = gp.axes.slice());
    const trig = [];
    for (let i = 2; i < gp.axes.length; i++) if (rest[i] < -0.8) trig.push(i);
    if (trig.length >= 2) { L = Math.max(L, (gp.axes[trig[0]] + 1) / 2); R = Math.max(R, (gp.axes[trig[1]] + 1) / 2); }
    const sticks = []; for (let i = 2; i < gp.axes.length && sticks.length < 2; i++) if (!trig.includes(i)) sticks.push(i);
    if (sticks.length === 2) look = sticks;
  }
  return { L, R, look };
}

function padDown(gp, i) { const b = gp.buttons[i]; return !!(b && (b.pressed || b.value > 0.35)); }
function padVal(gp, i) { const b = gp.buttons[i]; return b ? (b.value || (b.pressed ? 1 : 0)) : 0; }
// radial dead zone, so a stick pushed straight up does not drift sideways
function padStick2(x, y, dz = 0.14) {
  const m = Math.hypot(x, y);
  if (m < dz) return [0, 0];
  const k = Math.min(1, (m - dz) / (1 - dz)) / m;
  return [x * k, y * k];
}
function padKey(code, on) {
  if (on) { if (!keys[code]) { keys[code] = true; padHeld.add(code); } }
  else if (padHeld.has(code)) { keys[code] = false; padHeld.delete(code); }
}
function padRelease() {
  for (const k of padHeld) keys[k] = false;
  padHeld.clear();
  if (padMouseL) mouse.l = false; if (padMouseR) mouse.r = false;
  padMouseL = padMouseR = padSprint = false;
  padMove.x = padMove.y = 0; padDrive.on = false; padDrive.thr = padDrive.steer = 0;
}
function padFind() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let any = null;
  for (const p of pads) if (p && p.connected) { if (p.mapping === 'standard') return p; any = any || p; }
  return any;
}
function padRumble(strong, weak, ms) {
  const gp = padUsing && padFind(), a = gp && gp.vibrationActuator;
  if (a && a.playEffect) try { a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {}); } catch (e) {}
}
// The enemy nearest the crosshair, if one is close to it and in sight
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3();
function padAimTarget(maxDeg) {
  const list = [];
  if (G.mode === 'bots') { for (const b of bots) if (!b.dead && b.team !== PL.team && b.rb.group.visible) list.push([b.pos.x, b.feet, b.pos.z]); }
  else if (G.mode === 'net' && MP.avatars) { for (const av of MP.avatars.values()) if (av.alive && av.team !== MP.team) list.push([av.pos.x, av.feet, av.pos.z]); }
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  let best = null, bestA = 1e9;
  for (const [x, f, z] of list) {
    const dx = x - cx, dz = z - cz, dh = Math.hypot(dx, dz);
    if (dh > 160 || dh < 0.5) continue;
    const y = f + (P.crouch ? 1.25 : 1.35), dy = y - cy;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, dh);
    const ey = Math.atan2(Math.sin(yaw - P.yaw), Math.cos(yaw - P.yaw)), ep = pitch - P.pitch;
    const ang = Math.hypot(ey * Math.cos(P.pitch), ep);
    // the cone is a couple of degrees plus the body's own width at that distance
    const cone = maxDeg * Math.PI / 180 + Math.atan(0.55 / dh);
    if (ang < cone && ang < bestA) { bestA = ang; best = { ey, ep, ang, cone, dh, x, y, z }; }
  }
  if (best && !hasLOS(_pa.set(cx, cy, cz), _pb.set(best.x, best.y, best.z))) return null;
  return best;
}

function padFrame(now) {
  requestAnimationFrame(padFrame);
  const dt = Math.min(0.05, (now - (padLast || now)) / 1000); padLast = now;
  const gp = padFind();
  if (!gp) { if (padHeld.size || padMouseL || padMouseR || padDrive.on) padRelease(); return; }
  const down = gp.buttons.map((b, i) => padDown(gp, i));
  const was = padPrev.slice();
  const edge = i => down[i] && !was[i];
  for (let i = 0; i < down.length; i++) padPrev[i] = down[i];
  const [mx, my] = padStick2(gp.axes[0] || 0, gp.axes[1] || 0);
  const T = padTrigs(gp), ltOn = T.L > 0.3, rtOn = T.R > 0.3;
  const [lx, ly] = padStick2(gp.axes[T.look[0]] || 0, gp.axes[T.look[1]] || 0, 0.12);
  if (down.some(Boolean) || mx || my || lx || ly || ltOn || rtOn) padUsing = true;
  padShowInfo(gp, down, T);

  if (!G.playing || G.paused || G.over || !P.alive) { if (padHeld.size || padMouseL || padMouseR || padDrive.on) padRelease(); padSnapT = 0; return; }

  // move: analog through padMove; the d-pad left/right still strafes
  padMove.x = mx + (down[15] ? 1 : 0) - (down[14] ? 1 : 0); padMove.y = -my;
  const fwd = padMove.y > 0.5;
  if (edge(10)) padSprint = true;
  if (!fwd) padSprint = false;
  padKey('KeyW', fwd && padSprint);                 // sprint wants W held, as on a keyboard
  padKey('ShiftLeft', padSprint || down[11]);       // R3 steadies a scope, same key
  padKey('Space', down[0]);
  padKey('Tab', down[8]);

  // driving: analog throttle on the triggers, the stick steers
  padDrive.on = !!P.veh;
  if (P.veh) {
    padDrive.thr = T.R - T.L + (T.R < .1 && T.L < .1 ? Math.max(0, -my) - Math.max(0, my) : 0);
    padDrive.steer = -mx;
    if (padMouseL) { mouse.l = false; padMouseL = false; }
    if (padMouseR) { mouse.r = false; padMouseR = false; }
  } else {
    // triggers: LT aim, RT fire
    if (ltOn && !mouse.r) { mouse.r = true; padMouseR = true; padSnapT = 0.18; }
    else if (!ltOn && padMouseR) { mouse.r = false; padMouseR = false; }
    if (rtOn && !mouse.l) { mouse.l = true; padMouseL = true; triggerT = G.time; }
    else if (!rtOn && padMouseL) { mouse.l = false; padMouseL = false; }
    // holding the trigger keeps a semi-auto firing as fast as it can, as console shooters do
    if (padMouseL && guns[cur] && !guns[cur].s.auto) triggerT = G.time;
    if (edge(1)) P.crouch = !P.crouch;
  }
  // X: use whatever is in front of you, otherwise reload
  if (edge(2)) { if (P.veh || findInteract()) interact(); else startReload(); }
  if (!P.veh && (edge(3) || edge(12) || edge(13))) swapTo(1 - cur);

  // look: an expo curve for fine aim near the centre, a turn boost when the
  // stick is held right over, slower while aiming down the sights
  const lm = Math.hypot(lx, ly);
  padHeldTurn = lm > 0.92 ? padHeldTurn + dt : 0;
  const boost = 1 + Math.min(1, Math.max(0, padHeldTurn - 0.18) / 0.35) * 0.9;
  const aiming = mouse.r && !P.veh;
  let rate = 3.2 * sens * (camera.fov / 75) * (aiming ? 0.55 : 1) * boost;
  const curve = lm ? Math.pow(lm, 1.8) / lm : 0;
  const tgt = !P.veh ? padAimTarget(aiming ? 4 : 3) : null;
  if (tgt) rate *= aiming ? 0.5 : 0.62;          // slows over a target
  if (lx || ly) {
    P.yaw -= lx * curve * rate * dt;
    P.pitch = clamp(P.pitch - ly * curve * rate * 0.8 * dt, -1.5, 1.5);
    lookDX += lx * 6; lookDY += ly * 6;          // the gun sways with the look, as with a mouse
  }
  if (tgt) {
    // pulling LT near an enemy brings the sights onto them
    if (padSnapT > 0 && aiming) { const k = Math.min(1, dt / 0.06) * 0.8; P.yaw += tgt.ey * k; P.pitch += tgt.ep * k; }
    // and while you move or look, the aim follows them a little
    else if (lm > 0.05 || Math.hypot(mx, my) > 0.1) { const k = Math.min(1, dt * (aiming ? 4 : 2.5)) * (1 - tgt.ang / tgt.cone); P.yaw += tgt.ey * k * .5; P.pitch += tgt.ep * k * .4; }
  }
  padSnapT = Math.max(0, padSnapT - dt);
}
requestAnimationFrame(padFrame);
// On the pause screen: which controller the game sees and what it is pressing,
// so a controller that misbehaves can be checked button by button.
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Start', 'L-stick', 'R-stick', 'Up', 'Down', 'Left', 'Right', 'Home'];
let padInfoT = 0;
function padShowInfo(gp, down, T) {
  const el = $('padInfo'); if (!el) return;
  const show = G.paused && !$('pause').hidden;
  el.hidden = !show; if (!show) return;
  const now = performance.now(); if (now - padInfoT < 100) return; padInfoT = now;
  const on = down.map((d, i) => d ? (PAD_NAMES[i] || 'b' + i) : null).filter(Boolean);
  if (T.L > 0.05) on.push('aim ' + Math.round(T.L * 100) + '%'); if (T.R > 0.05) on.push('fire ' + Math.round(T.R * 100) + '%');
  el.textContent = `Controller: ${gp.id.replace(/\s*\(.*$/, '').slice(0, 40)} · ${gp.mapping === 'standard' ? 'standard layout' : 'non-standard layout'} · pressing: ${on.length ? on.join(', ') : 'nothing'}`;
}
// a key or the mouse means the keyboard is in charge again
addEventListener('keydown', () => { padUsing = false; });
addEventListener('mousedown', () => { padUsing = false; });

if (window.PadNav) {
  PadNav.active = () => !G.playing || G.paused || G.over;
  PadNav.onStart = () => {
    if (!G.playing || G.over) return;
    if (!G.paused) uiPause();
    else if (!$('pause').hidden) $('resume').click();
  };
}
