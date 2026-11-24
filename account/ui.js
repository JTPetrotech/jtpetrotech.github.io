/**
 * The sign-in corner on the Arcade page.
 *
 * The markup is in the page rather than built here, so the pill is drawn with
 * the first paint and does not pop in late. This file only wires it up, and if
 * it never loads the page is exactly the page it was before.
 */
import * as account from './arcade.js';

const $ = (id) => document.getElementById(id);

let panelOpen = false;
let changing = false;

function show(el, on) {
  if (el) el.hidden = !on;
}

function say(text, bad) {
  const el = $('acctSay');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('bad', Boolean(bad));
  show(el, Boolean(text));
}

function openPanel(on) {
  panelOpen = on;
  show($('acctPanel'), on);
  $('acctBtn').setAttribute('aria-expanded', String(on));
  if (on) {
    say('');
    const first = account.whoami() ? null : $('acctName');
    if (first) first.focus();
  } else {
    changing = false;
  }
}

/** Everything the panel shows follows from who is signed in and which mode. */
function paint() {
  const who = account.whoami();
  const mode = account.mode();

  $('acctBtn').textContent = who ? account.display(who.name) : 'Sign in';
  $('acctBtn').classList.toggle('on', Boolean(who));

  show($('acctIn'), !who);
  show($('acctOut'), Boolean(who));
  show($('acctChange'), Boolean(who) && changing);
  show($('acctChangeBtn'), Boolean(who) && !changing);

  const title = $('acctTitle');
  if (title) title.textContent = who ? `Signed in as ${account.display(who.name)}` : 'Arcade account';

  // The note is the one place the difference between the modes is admitted,
  // and it is admitted plainly: somebody making an account deserves to know
  // whether it will be there on their phone.
  const note = $('acctNote');
  if (note) {
    if (mode === 'unreachable') {
      note.textContent = 'Accounts cannot be reached right now. Check your connection and reload.';
    } else if (mode === 'device') {
      note.textContent = 'Saved in this browser only - an account made here will not be on your phone yet.';
    } else {
      note.textContent = 'One name and password for every game, on any device you sign in on.';
    }
  }
}

/** Keeps a button from being pressed twice while the first press is in flight. */
async function working(btn, job) {
  if (btn.disabled) return;
  const was = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    await job();
  } catch (err) {
    say((err && err.message) || 'Something went wrong.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = was;
  }
}

function creds() {
  return [$('acctName').value, $('acctPass').value];
}

function clearFields() {
  for (const id of ['acctName', 'acctPass', 'acctOld', 'acctNew']) {
    const el = $(id);
    if (el) el.value = '';
  }
}

function wire() {
  $('acctBtn').addEventListener('click', () => openPanel(!panelOpen));

  $('acctSignIn').addEventListener('click', (e) => working(e.currentTarget, async () => {
    const [name, pass] = creds();
    await account.signIn(name, pass);
    clearFields();
    say('');
    openPanel(false);
  }));

  $('acctSignUp').addEventListener('click', (e) => working(e.currentTarget, async () => {
    const [name, pass] = creds();
    await account.signUp(name, pass);
    clearFields();
    say('');
    openPanel(false);
  }));

  // Enter in either field signs in, which is what pressing it means here.
  for (const id of ['acctName', 'acctPass']) {
    $(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('acctSignIn').click();
      }
    });
  }

  $('acctSignOut').addEventListener('click', (e) => working(e.currentTarget, async () => {
    await account.signOut();
    clearFields();
    say('');
    openPanel(false);
  }));

  $('acctChangeBtn').addEventListener('click', () => {
    changing = true;
    say('');
    paint();
    $('acctOld').focus();
  });

  $('acctSave').addEventListener('click', (e) => working(e.currentTarget, async () => {
    await account.changePassword($('acctOld').value, $('acctNew').value);
    clearFields();
    changing = false;
    paint();
    say('Password changed.');
  }));

  $('acctCancel').addEventListener('click', () => {
    changing = false;
    clearFields();
    say('');
    paint();
  });

  // Out of the way on Escape, or on a click anywhere that is not the panel.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelOpen) openPanel(false);
  });
  document.addEventListener('click', (e) => {
    if (!panelOpen) return;
    if (!$('acct').contains(e.target)) openPanel(false);
  });
}

async function go() {
  const corner = $('acct');
  if (!corner) return;
  wire();
  account.onAccount(paint);
  await account.start();
  paint();
  show(corner, true);
}

go();
