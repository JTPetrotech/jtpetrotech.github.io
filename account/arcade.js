/**
 * One Arcade account, a name and a password, shared by every game.
 *
 *   import * as account from 'https://jtpetrotech.github.io/account/arcade.js';
 *
 *   await account.start();
 *   account.onAccount((who) => { ... });        // now, and on every change
 *   const saved = await account.load('poker');  // this game's data
 *   account.save('poker', { vault: 12000 });    // debounced
 *
 * Every game on the shelf is served from jtpetrotech.github.io, which is one
 * origin as far as a browser is concerned. That is the whole trick: a sign-in
 * on the Arcade is a sign-in for Side Pot, Top Shelf and the rest, with no
 * tokens to pass about and nothing to keep in step. The browser is already
 * holding it.
 *
 * Two modes, same screens and same rules either way:
 *
 *   device   nothing configured. Accounts live in this browser. Real enough to
 *            use, no use at all on a second device.
 *   cloud    config.js filled in. Accounts live in the project, so they follow
 *            whoever signs in to any device they sign in on.
 *
 * Nothing reaches the network in device mode - the Firebase code is only
 * fetched once there is a project to fetch it for.
 *
 * There is no "forgot my password". Names are not email addresses, so there is
 * nowhere to send a reset to. Changing one you know works; see the README for
 * what to do about one you do not.
 */
import { FIREBASE_CONFIG, isConfigured } from './config.js';
import { addressFor, cleanName, nameProblem, passProblem, display } from './names.js';
import * as device from './local.js';

export { cleanName, display, nameProblem, passProblem, isConfigured };

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';

let state = 'cold'; // cold | device | cloud | unreachable
// False until the first real answer about who is signed in. In cloud mode the
// project is reachable a moment before Firebase has said whether anyone is
// signed in, and "nobody" in that gap is a guess, not an answer.
let settled = false;
let mods = null;
let auth = null;
let db = null;
let who = null;
let profile = null;
const listeners = new Set();

let saveTimer = null;
let pending = null;

/** 'device', 'cloud' or 'unreachable'. Meaningful only after start(). */
export function mode() {
  return state === 'cold' ? 'device' : state;
}

/** Whoever is signed in, as { name, uid }, or null. */
export function whoami() {
  return who;
}

function announce() {
  settled = true;
  for (const fn of listeners) {
    try {
      fn(who);
    } catch {
      // A listener that throws is that game's problem, not everybody's.
    }
  }
}

/**
 * Called straight away with the current answer, and again on every change, so
 * a caller never has to work out whether it is early or late.
 */
export function onAccount(fn) {
  listeners.add(fn);
  if (settled) fn(who);
  return () => listeners.delete(fn);
}

// -------------------------------------------------------------------- start

export async function start() {
  if (state !== 'cold') return state;
  if (!isConfigured()) {
    state = 'device';
    who = device.currentLocal();
    announce();
    return state;
  }
  try {
    const [core, authMod, store] = await Promise.all([
      import(`${SDK}firebase-app.js`),
      import(`${SDK}firebase-auth.js`),
      import(`${SDK}firebase-firestore.js`),
    ]);
    mods = { core, authMod, store };
    const app = core.initializeApp(FIREBASE_CONFIG);
    auth = authMod.getAuth(app);
    db = store.getFirestore(app);
    // Stay signed in across reloads, tabs and games.
    await authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(() => {});
    state = 'cloud';
    authMod.onAuthStateChanged(auth, async (user) => {
      if (!user) {
        who = null;
        profile = null;
        announce();
        return;
      }
      who = { name: cleanName(user.displayName || user.email), uid: user.uid };
      profile = await fetchProfile(user.uid).catch(() => null);
      announce();
    });
  } catch {
    // The project is configured but its code could not be fetched. Falling
    // back to device accounts here would quietly hand somebody a different,
    // empty account under their own name, so say so instead.
    state = 'unreachable';
    announce();
  }
  return state;
}

// ------------------------------------------------------------------- errors

function friendly(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/email-already-in-use': 'That name is taken. Sign in instead, or pick another.',
    'auth/invalid-email': 'Letters, numbers and underscores only - no spaces.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Passwords are at least 6 characters.',
    'auth/invalid-credential': 'Wrong name or password.',
    'auth/wrong-password': 'Wrong name or password.',
    'auth/user-not-found': 'Wrong name or password.',
    'auth/invalid-login-credentials': 'Wrong name or password.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and have another go.',
    'auth/network-request-failed': 'Could not reach the Arcade. Check your connection.',
    'auth/requires-recent-login': 'Sign out and back in, then change it.',
    'auth/operation-not-allowed':
      'Accounts are not switched on for this project yet - turn Email/Password on in the Firebase console.',
  };
  return new Error(map[code] || (err && err.message) || 'Something went wrong.');
}

/** The rules are checked here as well so both modes refuse the same things. */
function vet(name, password) {
  const bad = nameProblem(name) || passProblem(password);
  if (bad) throw new Error(bad);
}

function refuseUnreachable() {
  if (state === 'unreachable') {
    throw new Error('Could not reach the Arcade. Check your connection and reload.');
  }
}

// ------------------------------------------------------------------ signing

export async function signUp(rawName, password) {
  await start();
  refuseUnreachable();
  const name = cleanName(rawName);
  vet(name, password);
  if (state === 'device') {
    who = await device.createLocal(name, password);
    profile = null;
    announce();
    return who;
  }
  try {
    const cred = await mods.authMod.createUserWithEmailAndPassword(
      auth, addressFor(name), password,
    );
    await mods.authMod.updateProfile(cred.user, { displayName: name });
    profile = { username: name, created: Date.now(), games: {} };
    await mods.store.setDoc(mods.store.doc(db, 'players', cred.user.uid), profile);
    who = { name, uid: cred.user.uid };
    announce();
    return who;
  } catch (err) {
    throw friendly(err);
  }
}

export async function signIn(rawName, password) {
  await start();
  refuseUnreachable();
  const name = cleanName(rawName);
  vet(name, password);
  if (state === 'device') {
    who = await device.signInLocal(name, password);
    announce();
    return who;
  }
  try {
    const cred = await mods.authMod.signInWithEmailAndPassword(
      auth, addressFor(name), password,
    );
    who = { name, uid: cred.user.uid };
    profile = await fetchProfile(cred.user.uid).catch(() => null);
    announce();
    return who;
  } catch (err) {
    throw friendly(err);
  }
}

export async function signOut() {
  flush();
  if (state === 'cloud' && auth) {
    await mods.authMod.signOut(auth).catch(() => {});
  } else {
    device.signOutLocal();
    who = null;
    announce();
  }
}

/**
 * Changing a password you know. There is no resetting one you do not: a name
 * is not an address, so there is nowhere to send a link.
 */
export async function changePassword(oldPassword, newPassword) {
  await start();
  refuseUnreachable();
  if (!who) throw new Error('Sign in first.');
  const bad = passProblem(newPassword);
  if (bad) throw new Error(bad);
  if (state === 'device') {
    await device.changeLocalPassword(who.name, oldPassword, newPassword);
    return;
  }
  try {
    // Firebase wants a fresh sign-in before it will take a new password, which
    // doubles as the check that the old one was right.
    await mods.authMod.signInWithEmailAndPassword(auth, addressFor(who.name), oldPassword);
    await mods.authMod.updatePassword(auth.currentUser, newPassword);
  } catch (err) {
    throw friendly(err);
  }
}

// -------------------------------------------------------------- saved games

async function fetchProfile(uid) {
  const snap = await mods.store.getDoc(mods.store.doc(db, 'players', uid));
  return snap.exists() ? snap.data() : { username: who ? who.name : '', games: {} };
}

/**
 * What `game` last put away for whoever is signed in, or null.
 *
 * Each game gets its own corner of one document, so a player is one read
 * rather than one per game, and no game can tread on another's data.
 */
export async function load(game) {
  await start();
  if (!who) return null;
  if (state !== 'cloud') return device.loadLocal(who.name, game);
  if (!profile) profile = await fetchProfile(who.uid).catch(() => null);
  return (profile && profile.games && profile.games[game]) ?? null;
}

/**
 * Puts this game's data away. Returns at once: a chip balance changes on every
 * bet and one round trip per chip would be both slow and pointless, so writes
 * are held for a moment and the last one wins.
 */
export function save(game, data) {
  if (!who) return;
  if (state !== 'cloud') {
    device.saveLocal(who.name, game, data);
    return;
  }
  profile = profile || { username: who.name, games: {} };
  profile.games = profile.games || {};
  profile.games[game] = data;
  pending = { uid: who.uid, game, data };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1500);
}

/** Sends a held write now. Safe to call at any time. */
export function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!pending || state !== 'cloud' || !db) return;
  const { uid, game, data } = pending;
  pending = null;
  mods.store.setDoc(
    mods.store.doc(db, 'players', uid),
    { games: { [game]: data } },
    { merge: true },
  ).catch(() => {
    // Offline or refused. The copy in memory still holds it and the next save
    // tries again; a failed write must never interrupt a game.
  });
}

if (typeof window !== 'undefined') {
  // A last chance to save when the tab goes away, which on a phone is the
  // usual way a game ends.
  window.addEventListener('pagehide', flush);
}
