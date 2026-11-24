/*
 * node test/run.js
 *
 * The account layer is the only part of the Arcade with logic worth checking -
 * the rest of the page is markup the build already vouches for. The pieces
 * that touch the browser are kept behind a storage object that is swapped out
 * here, so none of this needs a page to run in.
 */
import {
  cleanName, nameProblem, passProblem, addressFor, nameFrom, display,
  ADDRESS_DOMAIN, NAME_MAX,
} from '../account/names.js';
import * as device from '../account/local.js';
import * as account from '../account/arcade.js';

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    process.stdout.write('.');
  } catch (err) {
    failed++;
    failures.push({ name, err });
    process.stdout.write('F');
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'expected equal'}: got ${a}, want ${b}`);
}

async function throws(fn, wanted, msg) {
  try {
    await fn();
  } catch (err) {
    if (wanted && !err.message.includes(wanted)) {
      throw new Error(`${msg || 'wrong refusal'}: got "${err.message}", wanted "${wanted}"`);
    }
    return;
  }
  throw new Error(msg || 'expected it to be refused');
}

/**
 * A storage that starts empty, so one test cannot be read by the next. Signs
 * out as well: the account module holds who is signed in in memory, which is
 * right on a page and would otherwise carry from one test into the next.
 */
async function freshStore() {
  await account.signOut().catch(() => {});
  const held = new Map();
  const store = {
    getItem: (k) => (held.has(k) ? held.get(k) : null),
    setItem: (k, v) => held.set(k, String(v)),
    removeItem: (k) => held.delete(k),
  };
  device.setStore(store);
  return store;
}

/* ------------------------------------------------------------------- names */

await test('a name has to be long enough, short enough, and a name', async () => {
  eq(nameProblem('jake'), null, 'an ordinary name is fine');
  eq(nameProblem('a_1'), null, 'digits and underscores are allowed');
  assert(nameProblem('jo'), 'two letters is too short');
  assert(nameProblem('j'.repeat(NAME_MAX + 1)), 'seventeen is too long');
  assert(nameProblem('1jake'), 'a name does not start with a digit');
  assert(nameProblem('_jake'), 'nor with an underscore');
  assert(nameProblem('jake smith'), 'a space is out');
  assert(nameProblem('jake@home'), 'and so is punctuation');
  assert(nameProblem(''), 'and nothing at all is not a name');
  assert(nameProblem(null), 'nor is a missing one');
});

await test('names are matched without case, so there is one Jake', async () => {
  eq(cleanName('  JAKE  '), 'jake', 'trimmed and folded');
  eq(cleanName('JaKe'), 'jake');
  eq(addressFor('JAKE'), addressFor('jake'), 'both reach the same account');
});

await test('a name becomes an address that can never be a real one', async () => {
  eq(addressFor('jake'), `jake@${ADDRESS_DOMAIN}`);
  eq(ADDRESS_DOMAIN.endsWith('.invalid'), true, 'reserved by RFC 2606');
  eq(nameFrom('jake@arcade.invalid'), 'jake', 'and reads back out again');
  eq(nameFrom('jake'), 'jake', 'even without the domain');
  // A bad name must never be quietly turned into a bad address.
  await throws(() => addressFor('jake smith'), 'no spaces', 'a bad name is refused here too');
});

await test('passwords have a floor and a ceiling', async () => {
  eq(passProblem('hunter22'), null);
  assert(passProblem('short'), 'five characters is not enough');
  assert(passProblem(''), 'and none is certainly not');
  assert(passProblem('x'.repeat(500)), 'nor is a novel');
});

await test('a name is shown with a capital and nothing else changed', async () => {
  eq(display('jake'), 'Jake');
  eq(display('a_1'), 'A_1');
  eq(display(''), '', 'and nothing stays nothing');
});

/* ------------------------------------------------------- the device store */

await test('a password is stored as a hash, salted so two alike differ', async () => {
  const once = await device.hashPassword('hunter22', 'abc');
  const again = await device.hashPassword('hunter22', 'abc');
  eq(once, again, 'the same password and salt give the same answer');
  eq(once.length, 64, 'a SHA-256 in hex');
  assert(once !== await device.hashPassword('hunter22', 'xyz'),
    'a different salt gives a different answer');
  assert(once !== await device.hashPassword('hunter23', 'abc'),
    'and so does a different password');
});

await test('making an account signs you in, and the password is not kept', async () => {
  const store = await freshStore();
  const who = await device.createLocal('jake', 'hunter22');
  eq(who.name, 'jake');
  const raw = store.getItem('arcade.accounts.v1');
  assert(raw.includes('jake'), 'the account is there');
  assert(!raw.includes('hunter22'), 'but the password itself is not');
  eq(device.currentLocal().name, 'jake', 'and the session is open');
});

await test('two people cannot have the same name on one device', async () => {
  await freshStore();
  await device.createLocal('jake', 'hunter22');
  await throws(() => device.createLocal('jake', 'different'), 'taken');
});

await test('the right password gets in and the wrong one does not', async () => {
  await freshStore();
  await device.createLocal('jake', 'hunter22');
  device.signOutLocal();
  eq(device.currentLocal(), null, 'signed out');
  eq((await device.signInLocal('jake', 'hunter22')).name, 'jake');
  device.signOutLocal();
  await throws(() => device.signInLocal('jake', 'hunter23'), 'Wrong name or password');
  eq(device.currentLocal(), null, 'and a failed try does not sign anybody in');
});

await test('a name nobody has is refused in the same words as a bad password', async () => {
  await freshStore();
  await device.createLocal('jake', 'hunter22');
  let unknown = '';
  let wrong = '';
  try { await device.signInLocal('nobody', 'hunter22'); } catch (e) { unknown = e.message; }
  try { await device.signInLocal('jake', 'nope12'); } catch (e) { wrong = e.message; }
  // Two different sentences would tell whoever is guessing which half landed.
  eq(unknown, wrong, 'the same refusal either way');
});

await test('changing a password needs the old one', async () => {
  await freshStore();
  await device.createLocal('jake', 'hunter22');
  await throws(() => device.changeLocalPassword('jake', 'guess1', 'newpass1'),
    'not the current password');
  await device.changeLocalPassword('jake', 'hunter22', 'newpass1');
  device.signOutLocal();
  await throws(() => device.signInLocal('jake', 'hunter22'), 'Wrong',
    'the old one stops working');
  eq((await device.signInLocal('jake', 'newpass1')).name, 'jake', 'and the new one works');
});

await test('each game gets its own corner and cannot tread on another', async () => {
  await freshStore();
  await device.createLocal('jake', 'hunter22');
  eq(device.loadLocal('jake', 'poker'), null, 'nothing saved yet');
  device.saveLocal('jake', 'poker', { vault: 12000 });
  device.saveLocal('jake', 'hockey', { season: 3 });
  eq(device.loadLocal('jake', 'poker').vault, 12000);
  eq(device.loadLocal('jake', 'hockey').season, 3, 'and the other is untouched');
  eq(device.loadLocal('jake', 'racing'), null, 'a game that has saved nothing has nothing');
});

await test('two accounts on one device keep separate saves', async () => {
  await freshStore();
  await device.createLocal('jake', 'hunter22');
  device.saveLocal('jake', 'poker', { vault: 500 });
  await device.createLocal('jason', 'hunter33');
  device.saveLocal('jason', 'poker', { vault: 9000 });
  eq(device.loadLocal('jake', 'poker').vault, 500, 'one is left alone');
  eq(device.loadLocal('jason', 'poker').vault, 9000, 'and the other is its own');
});

await test('a browser that refuses to store anything says so instead of pretending', async () => {
  device.setStore({
    getItem: () => null,
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => {},
  });
  await throws(() => device.createLocal('jake', 'hunter22'), 'will not let');
});

/* ----------------------------------------------------- the shared account */

await test('with nothing configured the Arcade still has accounts, on the device', async () => {
  await freshStore();
  eq(account.isConfigured(), false, 'no project yet');
  eq(await account.start(), 'device');
  eq(account.mode(), 'device');
  eq(account.whoami(), null, 'and nobody signed in');
});

await test('signing up, saving, signing out and coming back', async () => {
  await freshStore();
  const seen = [];
  account.onAccount((who) => seen.push(who ? who.name : null));

  await account.signUp('jake', 'hunter22');
  eq(account.whoami().name, 'jake');
  account.save('poker', { vault: 12000 });
  eq((await account.load('poker')).vault, 12000, 'it reads back');

  await account.signOut();
  eq(account.whoami(), null);
  eq(await account.load('poker'), null, 'and says nothing to nobody');

  await account.signIn('jake', 'hunter22');
  eq((await account.load('poker')).vault, 12000, 'the save was waiting');
  assert(seen.length >= 3, 'and every change was announced');
});

await test('the same rules apply through the shared door', async () => {
  await freshStore();
  await throws(() => account.signUp('jo', 'hunter22'), 'at least 3');
  await throws(() => account.signUp('jake', 'short'), 'at least 6');
  await throws(() => account.signUp('jake smith', 'hunter22'), 'no spaces');
  eq(account.whoami(), null, 'and none of that signed anybody in');
});

await test('a save with nobody signed in goes nowhere rather than anywhere wrong', async () => {
  await freshStore();
  await account.signUp('jake', 'hunter22');
  await account.signOut();
  account.save('poker', { vault: 999 });
  await account.signIn('jake', 'hunter22');
  eq(await account.load('poker'), null, 'nothing was written under anyone');
});

await test('changing a password through the shared door needs the old one', async () => {
  await freshStore();
  await account.signUp('jake', 'hunter22');
  await throws(() => account.changePassword('wrong1', 'newpass1'), 'not the current');
  await throws(() => account.changePassword('hunter22', 'tiny'), 'at least 6');
  await account.changePassword('hunter22', 'newpass1');
  await account.signOut();
  await throws(() => account.signIn('jake', 'hunter22'), 'Wrong');
  eq((await account.signIn('jake', 'newpass1')).name, 'jake');
});

/* ------------------------------------------------------------------ report */

console.log('\n');
for (const f of failures) {
  console.error(`FAIL  ${f.name}\n      ${f.err.message}\n`);
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
