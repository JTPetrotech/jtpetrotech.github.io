/* ---------- controller ----------
   Default layout, the one most shooters use (buttons by position, so on a
   Nintendo pad "A" here is the bottom button, which Nintendo labels B):
     left stick   move, analog (click: sprint, click twice: tactical sprint)
     right stick  look
     LT or LB aim   RT or RB fire (hold for semi-autos too)   A jump   B crouch / slide
     X reload, or use / pick up / drive when there is something to use
     Y switch gun   d-pad up armor plate   d-pad down switch gun
     R3 steady a scope   View/Back scoreboard   Start pause
   Every action can be moved to any button on the Controls screen, and the
   button names shown follow the pad: Xbox, PlayStation or Nintendo.
   Driving: fire is gas, aim is brake and reverse, the left stick steers.

   It presses the game's own inputs - keys, mouse, triggerT, P.yaw/pitch -
   plus padMove/padDrive for analog movement, so a keyboard and a pad can both
   be in use at once. It polls on its own frame: the Gamepad API has no events.

   Aim assist, as console shooters have it, only for the controller: the look
   slows down over an enemy, follows them a little while you move, and pulling
   aim near one brings the sights onto them. It never shoots for you. */
const padHeld = new Set();
let padMouseL = false, padMouseR = false, padSprint = false, padLast = 0, padHeldTurn = 0, padSnapT = 0;
let padUsing = false;                 // the last thing touched was the pad: prompts show pad buttons
let padSeen = null;                   // the pad last seen, for the Controls screen
const padMove = { x: 0, y: 0 };       // analog move, -1..1, y forward
const padDrive = { on: false, thr: 0, steer: 0 };
const padRest = {};                   // per pad: the axes as first seen, to spot triggers that rest at -1
const padPrevAct = {};

/* ---------- which pad, and what its buttons are called ---------- */
const PAD_TYPES = [['auto', 'Auto'], ['xbox', 'Xbox'], ['ps', 'PlayStation'], ['nintendo', 'Nintendo']];
const PAD_BTN = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'Xbox'],
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'PS'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'Home'],
};
let padTypeSet = store.get('padType', 'auto');
function padTypeOf(gp) {
  if (padTypeSet !== 'auto') return padTypeSet;
  const id = (gp && gp.id) || '';
  if (/057e|nintendo|pro controller|joy-?con|switch/i.test(id)) return 'nintendo';
  if (/054c|dualsense|dualshock|playstation|wireless controller|ps[345]/i.test(id)) return 'ps';
  return 'xbox';
}
function padCodeName(code, type) {
  if (!code) return '—';
  const m = /^b(\d+)$/.exec(code); if (m) return (PAD_BTN[type || padTypeOf(padSeen)] || PAD_BTN.xbox)[+m[1]] || 'Button ' + m[1];
  const a = /^a(\d+)([+-])$/.exec(code); if (a) return `Axis ${a[1]}${a[2]}`;
  return code;
}

/* ---------- what each button does ---------- */
const PAD_ACTS = [
  ['fire', 'Fire · gas', ['b7', 'b5']],
  ['aim', 'Aim · brake', ['b6', 'b4']],
  ['jump', 'Jump', ['b0', '']],
  ['crouch', 'Crouch · slide', ['b1', '']],
  ['use', 'Reload · use · drive', ['b2', '']],
  ['swap', 'Switch gun', ['b3', 'b13']],
  ['plate', 'Armor plate', ['b12', '']],
  ['sprint', 'Sprint · tactical sprint', ['b10', '']],
  ['steady', 'Steady scope', ['b11', '']],
  ['board', 'Scoreboard', ['b8', '']],
];
let padBinds = {};
function loadPadBinds() {
  const s = store.get('padBinds', null) || {};
  padBinds = {};
  for (const [id, , def] of PAD_ACTS) padBinds[id] = Array.isArray(s[id]) && s[id].length === 2 ? s[id].map(c => typeof c === 'string' ? c : '') : def.slice();
}
function savePadBinds() { store.set('padBinds', padBinds); }
function setPadBind(id, slot, code) {
  if (code) for (const a in padBinds) for (let i = 0; i < 2; i++) if (padBinds[a][i] === code) padBinds[a][i] = '';
  padBinds[id][slot] = code; savePadBinds();
}
function resetPadBinds() { for (const [id, , def] of PAD_ACTS) padBinds[id] = def.slice(); savePadBinds(); }
function padLabel(id) { const b = padBinds[id] || []; return padCodeName(b[0] || b[1]); }
loadPadBinds();

function padVal(gp, i) { const b = gp.buttons[i]; return b ? (b.value || (b.pressed ? 1 : 0)) : 0; }
function padCodeVal(gp, code) {
  if (!code) return 0;
  if (code[0] === 'b') return padVal(gp, +code.slice(1));
  const i = +code.slice(1, -1), v = gp.axes[i] || 0, rest = (padRest[gp.id] || [])[i] || 0;
  if (rest < -0.8) return code.endsWith('+') ? clamp((v + 1) / 2, 0, 1) : 0; // a trigger on an axis
  return code.endsWith('+') ? Math.max(0, v) : Math.max(0, -v);
}
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
  padMouseL = padMouseR = padSprint = false; padPlateHeld = false;
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
// The sticks: left moves, right looks. A pad without the standard layout keeps
// its triggers on axes that rest at -1, and its right stick on the next two others.
function padSticks(gp) {
  let look = [2, 3], trig = [];
  if (gp.mapping !== 'standard') {
    const rest = padRest[gp.id];
    for (let i = 2; i < gp.axes.length; i++) if (rest[i] < -0.8) trig.push(i);
    const st = []; for (let i = 2; i < gp.axes.length && st.length < 2; i++) if (!trig.includes(i)) st.push(i);
    if (st.length === 2) look = st;
  }
  return { look, trig };
}

/* ---------- waiting for a button on the Controls screen ---------- */
let padCapture = null; // { done(code), armed, t0 }
function padCaptureStep(gp) {
  const c = padCapture, rest = padRest[gp.id], { look } = padSticks(gp);
  let hit = null, anyHeld = false;
  gp.buttons.forEach((b, i) => { if (b && (b.pressed || b.value > 0.5)) { anyHeld = true; if (!hit) hit = 'b' + i; } });
  for (let i = 0; i < gp.axes.length; i++) {
    if (i < 2 || look.includes(i)) continue; // the sticks stay sticks
    const d = (gp.axes[i] || 0) - (rest[i] || 0);
    if (Math.abs(d) > 0.6) { anyHeld = true; if (!hit) hit = 'a' + i + (d > 0 ? '+' : '-'); }
  }
  if (!c.armed) { if (!anyHeld) c.armed = true; }
  else if (hit) { padCapture = null; c.done(hit === 'b9' ? null : hit); return; } // Start cancels
  if (performance.now() - c.t0 > 8000) { padCapture = null; c.done(null); }
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
    const y = f + 1.35, dy = y - cy;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, dh);
    const ey = Math.atan2(Math.sin(yaw - P.yaw), Math.cos(yaw - P.yaw)), ep = pitch - P.pitch;
    const ang = Math.hypot(ey * Math.cos(P.pitch), ep);
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
  padSeen = gp;
  if (!gp) { if (padHeld.size || padMouseL || padMouseR || padDrive.on) padRelease(); return; }
  if (!padRest[gp.id]) padRest[gp.id] = gp.axes.slice();
  if (padCapture) { padCaptureStep(gp); return; }
  const S = padSticks(gp);
  // every action's value, and its press this frame
  const A = {};
  for (const [id] of PAD_ACTS) {
    let v = 0; for (const c of padBinds[id]) v = Math.max(v, padCodeVal(gp, c));
    A[id] = { v, on: v > 0.35, edge: v > 0.35 && !padPrevAct[id] };
  }
  // a pad without the standard layout: its axis triggers fire and aim as well
  if (gp.mapping !== 'standard' && S.trig.length >= 2) {
    const L = clamp(((gp.axes[S.trig[0]] || -1) + 1) / 2, 0, 1), R = clamp(((gp.axes[S.trig[1]] || -1) + 1) / 2, 0, 1);
    if (L > A.aim.v) A.aim = { v: L, on: L > .35, edge: L > .35 && !padPrevAct.aim };
    if (R > A.fire.v) A.fire = { v: R, on: R > .35, edge: R > .35 && !padPrevAct.fire };
  }
  for (const id in A) padPrevAct[id] = A[id].on;
  const [mx, my] = padStick2(gp.axes[0] || 0, gp.axes[1] || 0);
  const [lx, ly] = padStick2(gp.axes[S.look[0]] || 0, gp.axes[S.look[1]] || 0, 0.12);
  const anyBtn = gp.buttons.some(b => b && (b.pressed || b.value > .35));
  if (anyBtn || mx || my || lx || ly) padUsing = true;
  padShowInfo(gp, A);

  if (!G.playing || G.paused || G.over || !P.alive) { if (padHeld.size || padMouseL || padMouseR || padDrive.on) padRelease(); padSnapT = 0; return; }

  // move: analog through padMove; the d-pad left/right still strafes
  padMove.x = mx + padVal(gp, 15) - padVal(gp, 14); padMove.y = -my;
  const fwd = padMove.y > 0.5;
  if (A.sprint.edge) { padSprint = true; sprintTap(); }
  if (!fwd) padSprint = false;
  padKey('KeyW', fwd && padSprint);                 // sprint wants W held, as on a keyboard
  padKey('ShiftLeft', padSprint || A.steady.on);
  padKey('Space', A.jump.on);
  padKey('Tab', A.board.on);
  padPlateHeld = A.plate.on;

  // driving: analog gas and brake, the stick steers
  padDrive.on = !!P.veh;
  if (P.veh) {
    padDrive.thr = A.fire.v - A.aim.v + (A.fire.v < .1 && A.aim.v < .1 ? Math.max(0, -my) - Math.max(0, my) : 0);
    padDrive.steer = -mx;
    if (padMouseL) { mouse.l = false; padMouseL = false; }
    if (padMouseR) { mouse.r = false; padMouseR = false; }
  } else {
    if (A.aim.on && !mouse.r) { mouse.r = true; padMouseR = true; padSnapT = 0.18; }
    else if (!A.aim.on && padMouseR) { mouse.r = false; padMouseR = false; }
    if (A.fire.on && !mouse.l) { mouse.l = true; padMouseL = true; triggerT = G.time; }
    else if (!A.fire.on && padMouseL) { mouse.l = false; padMouseL = false; }
    // holding the trigger keeps a semi-auto firing as fast as it can, as console shooters do
    if (padMouseL && guns[cur] && !guns[cur].s.auto) triggerT = G.time;
    if (A.crouch.edge) crouchPress();
  }
  // use whatever is in front of you, otherwise reload
  if (A.use.edge) { if (P.veh || findInteract()) interact(); else startReload(); }
  if (!P.veh && A.swap.edge) swapTo(1 - cur);

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
    lookDX += lx * 6; lookDY += ly * 6;
  }
  if (tgt) {
    if (padSnapT > 0 && aiming) { const k = Math.min(1, dt / 0.06) * 0.8; P.yaw += tgt.ey * k; P.pitch += tgt.ep * k; }
    else if (lm > 0.05 || Math.hypot(mx, my) > 0.1) { const k = Math.min(1, dt * (aiming ? 4 : 2.5)) * (1 - tgt.ang / tgt.cone); P.yaw += tgt.ey * k * .5; P.pitch += tgt.ep * k * .4; }
  }
  padSnapT = Math.max(0, padSnapT - dt);
}
requestAnimationFrame(padFrame);
// On the pause and Controls screens: which pad the game sees and what it is pressing
let padInfoT = 0;
function padShowInfo(gp, A) {
  const now = performance.now(); if (now - padInfoT < 100) return; padInfoT = now;
  const type = padTypeOf(gp), names = PAD_BTN[type];
  const on = gp.buttons.map((b, i) => b && (b.pressed || b.value > .35) ? (names[i] || 'b' + i) : null).filter(Boolean);
  for (let i = 0; i < gp.axes.length; i++) { const d = (gp.axes[i] || 0) - ((padRest[gp.id] || [])[i] || 0); if (Math.abs(d) > .6 && i > 3) on.push(`axis ${i}`); }
  const acts = PAD_ACTS.filter(([id]) => A[id] && A[id].on).map(a => a[1].split(' ·')[0].toLowerCase());
  const txt = `Controller: ${gp.id.replace(/\s*\(.*$/, '').slice(0, 40)} · ${PAD_TYPES.find(t => t[0] === type)[1]} buttons · ${gp.mapping === 'standard' ? 'standard layout' : 'non-standard layout'} · pressing: ${on.length ? on.join(', ') : 'nothing'}${acts.length ? ' → ' + acts.join(', ') : ''}`;
  for (const [id, show] of [['padInfo', G.paused && !$('pause').hidden], ['padInfo2', !$('controls').hidden]]) { const el = $(id); if (!el) continue; el.hidden = !show; if (show) el.textContent = txt; }
}
// a key or the mouse means the keyboard is in charge again
addEventListener('keydown', () => { padUsing = false; });
addEventListener('mousedown', () => { padUsing = false; });

if (window.PadNav) {
  PadNav.active = () => !padCapture && (!G.playing || G.paused || G.over);
  PadNav.onStart = () => {
    if (padCapture || !G.playing || G.over) return;
    if (!G.paused) uiPause();
    else if (!$('pause').hidden) $('resume').click();
  };
}
