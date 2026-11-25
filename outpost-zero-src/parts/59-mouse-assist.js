/* ---------- aim assist for the mouse (optional, off unless chosen) ----------
   The controller has had aim assist from the start (57-pad.js); this is the
   same idea, lighter, for anyone on a mouse who wants it:

     - pressing aim near an enemy brings the sights onto them
     - while the mouse is moving, the sights lean a little towards the enemy
       you are following, so tracking is easier

   It never shoots for you and never moves the view while the mouse is still.
   It reuses the pad's target finder, so it sees what the pad sees: enemies
   only, in range, in a small cone, and not through walls. With a controller
   in hand this steps aside, since the pad's own assist is already doing it. */
const MOUSE_ASSISTS = [[0, 'Off'], [0.5, 'Low'], [1, 'Normal']];
let mouseAssist = (() => { const v = +store.get('mouseAssist', 0); return MOUSE_ASSISTS.some(a => a[0] === v) ? v : 0; })();
let maLast = 0, maMoved = -1e9, maWasAim = false, maSnapT = 0;

addEventListener('mousemove', e => { if ((e.movementX || 0) || (e.movementY || 0)) maMoved = performance.now(); });

function mouseAssistFrame(now) {
  requestAnimationFrame(mouseAssistFrame);
  const dt = Math.min(0.05, (now - (maLast || now)) / 1000); maLast = now;
  const aiming = mouse.r && !padMouseR;               // aim held on the mouse, not the pad
  const live = mouseAssist > 0 && G.playing && !G.paused && !G.over && P.alive && !P.veh && !padUsing;
  if (!live) { maWasAim = aiming; maSnapT = 0; return; }
  if (aiming && !maWasAim) maSnapT = 0.15;            // aim just pressed: a short pull onto the target
  maWasAim = aiming;

  const moving = now - maMoved < 120;
  if (maSnapT <= 0 && !moving) return;
  const tgt = padAimTarget(aiming ? 3.5 : 2.5);
  if (tgt) {
    if (maSnapT > 0 && aiming) {
      const k = Math.min(1, dt / 0.06) * 0.7 * mouseAssist;
      P.yaw += tgt.ey * k; P.pitch += tgt.ep * k;
    } else if (moving) {
      const k = Math.min(1, dt * (aiming ? 3 : 2)) * (1 - tgt.ang / tgt.cone) * mouseAssist;
      P.yaw += tgt.ey * k * 0.35; P.pitch += tgt.ep * k * 0.3;
    }
  }
  maSnapT = Math.max(0, maSnapT - dt);
}
requestAnimationFrame(mouseAssistFrame);

// The menu setting, next to Look speed.
(() => {
  const sel = $('mAssist');
  if (!sel) return;
  sel.innerHTML = MOUSE_ASSISTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  sel.value = String(mouseAssist);
  sel.addEventListener('change', () => { mouseAssist = +sel.value || 0; store.set('mouseAssist', mouseAssist); });
})();
