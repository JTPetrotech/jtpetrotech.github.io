/**
 * Accounts kept in this browser, for when there is no project to talk to.
 *
 * This is the honest version of a static site's account: a name and a password
 * that work, and work only here. It exists for two reasons. It means the
 * Arcade has something real before anybody sets a server up, and it means the
 * screens, the rules and the error messages are the same ones the connected
 * version uses, so switching over changes no behaviour.
 *
 * What it is not: security. The password is stored as a salted SHA-256 rather
 * than as itself, which keeps it out of plain sight and off the screen of
 * anybody idly reading storage - but whoever is holding the device can clear
 * the lot and make a new account anyway. There is nothing here worth guarding
 * beyond a chip balance, and the screens say "this device only" out loud.
 */

let store = null;

/** Swapped out by the tests, which have no localStorage to speak of. */
export function setStore(replacement) {
  store = replacement;
}

/**
 * Storage can throw rather than simply be missing - a browser set to block
 * site data raises on the first touch - so every read and write goes through
 * here and a failure degrades to "no accounts" instead of a broken page.
 */
function mem() {
  const held = new Map();
  return {
    getItem: (k) => (held.has(k) ? held.get(k) : null),
    setItem: (k, v) => held.set(k, String(v)),
    removeItem: (k) => held.delete(k),
  };
}

function storage() {
  if (store) return store;
  try {
    const probe = '__arcade_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    store = globalThis.localStorage;
  } catch {
    store = mem();
  }
  return store;
}

const ACCOUNTS = 'arcade.accounts.v1';
const SESSION = 'arcade.session.v1';

function read(key, fallback) {
  try {
    const raw = storage().getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    storage().setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function accounts() {
  return read(ACCOUNTS, {});
}

// ------------------------------------------------------------------ hashing

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newSalt() {
  return hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Salted so that two people choosing the same password do not end up with the
 * same stored value, which would otherwise say so plainly to anyone looking.
 */
export async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  return hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
}

// ----------------------------------------------------------------- accounts

/** Makes an account on this device. Throws with a message fit for the screen. */
export async function createLocal(name, password) {
  const all = accounts();
  if (all[name]) throw new Error('That name is taken on this device. Sign in instead.');
  const salt = newSalt();
  all[name] = {
    salt,
    hash: await hashPassword(password, salt),
    created: Date.now(),
    games: {},
  };
  if (!write(ACCOUNTS, all)) {
    throw new Error('This browser will not let the Arcade save anything, so an account cannot be kept.');
  }
  write(SESSION, { name });
  return { name, uid: `device:${name}` };
}

export async function signInLocal(name, password) {
  const account = accounts()[name];
  // Deliberately the same sentence for an unknown name and a wrong password:
  // separate ones tell whoever is guessing which half they got right.
  const refuse = () => {
    throw new Error('Wrong name or password.');
  };
  if (!account) refuse();
  if ((await hashPassword(password, account.salt)) !== account.hash) refuse();
  write(SESSION, { name });
  return { name, uid: `device:${name}` };
}

export function signOutLocal() {
  try {
    storage().removeItem(SESSION);
  } catch {
    /* nothing to do: there is no session to end */
  }
}

/** Whoever this browser last signed in as, or null. */
export function currentLocal() {
  const session = read(SESSION, null);
  const name = session && typeof session.name === 'string' ? session.name : '';
  if (!name || !accounts()[name]) return null;
  return { name, uid: `device:${name}` };
}

export async function changeLocalPassword(name, oldPassword, newPassword) {
  const all = accounts();
  const account = all[name];
  if (!account) throw new Error('No such account on this device.');
  if ((await hashPassword(oldPassword, account.salt)) !== account.hash) {
    throw new Error('That is not the current password.');
  }
  account.salt = newSalt();
  account.hash = await hashPassword(newPassword, account.salt);
  write(ACCOUNTS, all);
}

// -------------------------------------------------------------- saved games

/** What a game last put away for this account, or null. */
export function loadLocal(name, game) {
  const account = accounts()[name];
  if (!account || !account.games) return null;
  return account.games[game] ?? null;
}

export function saveLocal(name, game, data) {
  const all = accounts();
  const account = all[name];
  if (!account) return false;
  account.games = account.games || {};
  account.games[game] = data;
  return write(ACCOUNTS, all);
}
