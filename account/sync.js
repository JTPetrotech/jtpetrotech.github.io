/**
 * Puts a game's saved progress in whoever is signed in to the Arcade.
 *
 *   import('/account/sync.js').then(m => m.syncGame('topshelf', ['ts_save_v1', 'sa_tut']));
 *
 * Every game already keeps its progress in localStorage. Rather than teach
 * each one about accounts, this watches the keys a game names and keeps a copy
 * of them in the account, and puts the account's copy back when somebody signs
 * in. The game never knows: it reads and writes its storage exactly as before.
 *
 * A key ending in '*' means every key starting with what comes before it.
 *
 * The rules, in the order they are checked when a game page opens:
 *
 *   signed in, account has a save   the account's copy is the one you play,
 *                                   unless this browser holds a newer one it
 *                                   never got to send, which is sent instead
 *   signed in, account is empty     the progress in this browser becomes the
 *                                   account's (your first sign-in keeps what
 *                                   you played as a guest)
 *   signed out                      the guest's own progress comes back, so
 *                                   signing out never leaves the last
 *                                   person's save lying about for the next
 *
 * Games read their save once, when they start, so a change of save is put in
 * place and the page reloaded once. A guard stops that ever becoming a loop.
 */
import * as account from './arcade.js';

const OWNER = (g) => `arcade.sync.${g}.owner`; // whose progress is in storage now: a name, or '' for the guest
const STAMP = (g) => `arcade.sync.${g}.t`;     // when that progress last changed
const GUEST = (g) => `arcade.sync.${g}.guest`; // the guest's progress, put aside while somebody is signed in
const RELOAD = (g) => `arcade.sync.${g}.reload`;

const ls = (() => {
  try { const s = globalThis.localStorage; s.getItem('x'); return s; } catch { return null; }
})();

function get(k) { try { return ls.getItem(k); } catch { return null; } }
function put(k, v) { try { if (v == null) ls.removeItem(k); else ls.setItem(k, v); } catch {} }

function matcher(keys) {
  const exact = new Set(keys.filter((k) => !k.endsWith('*')));
  const prefixes = keys.filter((k) => k.endsWith('*')).map((k) => k.slice(0, -1));
  return (k) => exact.has(k) || prefixes.some((p) => k.startsWith(p));
}

/** The game's keys as they stand, as { key: string }. */
function snapshot(mine) {
  const out = {};
  try {
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && mine(k) && !k.startsWith('arcade.')) out[k] = ls.getItem(k);
    }
  } catch {}
  return out;
}

/** Makes storage hold exactly `keys` for this game. True if anything changed. */
function apply(mine, keys) {
  const now = snapshot(mine);
  let changed = false;
  for (const k of Object.keys(now)) if (!(k in keys)) { put(k, null); changed = true; }
  for (const [k, v] of Object.entries(keys)) if (now[k] !== v) { put(k, v); changed = true; }
  return changed;
}

const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
function sorted(o) { const r = {}; for (const k of Object.keys(o || {}).sort()) r[k] = o[k]; return r; }

function reloadOnce(game, chosen) {
  // Two reloads inside ten seconds as a page opens means something is
  // fighting the save; stop rather than spin. The game plays on with whatever
  // it has. A reload because somebody just signed in or out here is what they
  // asked for, so it always happens.
  const last = Number(sessionStorage.getItem(RELOAD(game)) || 0);
  if (!chosen && Date.now() - last < 10000) return;
  try { sessionStorage.setItem(RELOAD(game), String(Date.now())); } catch {}
  location.reload();
}

function toast(text) {
  if (!document.body) return;
  const el = document.createElement('div');
  el.textContent = text;
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483000;'
    + 'padding:8px 16px;border-radius:999px;background:rgba(10,16,26,.92);color:#e8eef6;'
    + 'border:1px solid rgba(62,201,138,.6);font:600 13px/1.3 system-ui,sans-serif;'
    + 'box-shadow:0 8px 24px rgba(0,0,0,.4);pointer-events:none;transition:opacity .4s';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; }, 3200);
  setTimeout(() => el.remove(), 3700);
}

/**
 * Starts keeping `game`'s keys in the signed-in account. Call once per page.
 * Quietly does nothing where there is no storage or the Arcade is unreachable.
 */
export async function syncGame(game, keys) {
  if (!ls || !game || !keys || !keys.length) return;
  const mine = matcher(keys);
  // The sign-in button inside the game, put up straight away rather than after
  // the account code has loaded. A failure to load it costs the button, never
  // the save.
  import('./badge.js').then((b) => b.mount(game)).catch(() => {});
  await account.start();
  if (account.mode() === 'unreachable') return; // no answer about who is signed in, so touch nothing

  let lastSent = null;
  let who = null;
  let opening = true; // the first answer is the page opening, not a change made here

  async function settle(now) {
    // Let a sign-in or sign-out finish being written down before acting on
    // it; reloading before then would undo it.
    await account.idle();
    now = account.whoami();
    who = now;
    const owner = get(OWNER(game)) || '';
    const here = snapshot(mine);

    if (!who) {
      if (owner === '') return;
      // Somebody signed out: their copy is safe in their account, so put the
      // guest's progress back.
      let guest = {};
      try { guest = JSON.parse(get(GUEST(game)) || '{}'); } catch {}
      put(OWNER(game), '');
      put(GUEST(game), null);
      put(STAMP(game), null);
      if (apply(mine, guest)) reloadOnce(game, !opening);
      return;
    }

    if (owner === '') put(GUEST(game), JSON.stringify(here));
    const saved = await account.load(game).catch(() => null);
    const stampHere = Number(get(STAMP(game)) || 0);

    if (saved && saved.keys && !(owner === who.name && stampHere > (saved.t || 0) && !same(here, saved.keys))) {
      put(OWNER(game), who.name);
      put(STAMP(game), String(saved.t || Date.now()));
      lastSent = saved.keys;
      if (apply(mine, saved.keys)) { reloadOnce(game, !opening); return; }
      if (owner !== who.name) toast(`Playing as ${account.display(who.name)} — progress saves to your account`);
      return;
    }

    // Nothing in the account yet, or this browser is ahead of it: what is
    // here becomes the account's. A different account's leftovers are not
    // handed over, though - only a guest's.
    let keep = here;
    if (!saved && owner !== '' && owner !== who.name) {
      try { keep = JSON.parse(get(GUEST(game)) || '{}'); } catch { keep = {}; }
      if (apply(mine, keep)) {
        put(OWNER(game), who.name);
        put(STAMP(game), String(Date.now()));
        account.save(game, { keys: keep, t: Date.now() });
        account.flush();
        reloadOnce(game, !opening);
        return;
      }
    }
    put(OWNER(game), who.name);
    send(keep);
    if (owner !== who.name) toast(`Playing as ${account.display(who.name)} — progress saves to your account`);
  }

  function send(keys) {
    const t = Date.now();
    put(STAMP(game), String(t));
    account.save(game, { keys, t });
    lastSent = keys;
  }

  // The game writes whenever it likes; look every couple of seconds and send
  // what changed. arcade.js holds writes for a moment, so this costs nothing
  // while nothing is happening.
  function check(now) {
    if (!who || get(OWNER(game)) !== who.name) return;
    const here = snapshot(mine);
    if (lastSent && same(here, lastSent)) return;
    send(here);
    if (now) account.flush();
  }
  setInterval(check, 2000);
  addEventListener('pagehide', () => check(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) check(true); });

  let running = Promise.resolve();
  account.onAccount((now) => {
    running = running.then(() => settle(now)).catch(() => {}).then(() => { opening = false; });
  });
}
