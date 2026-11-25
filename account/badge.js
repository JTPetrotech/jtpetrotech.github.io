/**
 * The sign-in button inside each game.
 *
 * sync.js mounts it, so every game that keeps its progress in the account gets
 * it with nothing of its own to change. It is a small pill in a top corner,
 * shown only while the game has a menu up - the same question the controller
 * support already asks (PadNav.active()) - so it never sits over play.
 *
 * Signing in or out here is the same as on the Arcade page. sync.js hears the
 * change and puts the right save in place, reloading the game if the save is
 * different, so there is nothing to do here once the account call returns.
 *
 * Everything is scoped under #arc-acct and reset, because each game has its
 * own idea of what a button looks like. Keys pressed in the panel stop here,
 * so typing a name never steers a car or fires a gun.
 */
import * as account from './arcade.js';

// Where the pill sits, per game, when the default corner is taken.
const PLACE = {
  poker: { top: 14, right: 66 }, // left of the settings gear
};

const CSS = `
#arc-acct{position:fixed;z-index:2147482000;font:500 14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e8eef6;text-align:left;letter-spacing:normal;text-transform:none}
#arc-acct *{box-sizing:border-box;font:inherit;letter-spacing:normal;text-transform:none}
#arc-acct button,#arc-acct input{all:unset;box-sizing:border-box;font:inherit}
#arc-acct .aa-pill{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px 0 6px;border-radius:999px;cursor:pointer;
  background:rgba(10,16,26,.82);border:1px solid rgba(255,255,255,.16);color:#e8eef6;font-weight:700;font-size:13px;
  box-shadow:0 6px 20px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:border-color .15s,background .15s}
#arc-acct .aa-pill:hover,#arc-acct .aa-pill:focus-visible{border-color:#ffc43d;background:rgba(16,24,38,.92)}
#arc-acct .aa-av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#2a3648;color:#c7d3e3;font-size:12px;font-weight:800}
#arc-acct .aa-av svg{width:15px;height:15px}
#arc-acct.aa-in .aa-pill{border-color:rgba(62,201,138,.55)}
#arc-acct.aa-in .aa-av{background:#3ec98a;color:#05080d}
#arc-acct .aa-panel{position:absolute;top:46px;right:0;width:290px;padding:16px;border-radius:16px;
  background:#0e1621;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 50px rgba(0,0,0,.55)}
#arc-acct .aa-panel[hidden]{display:none}
#arc-acct h2{margin:0 0 4px;font-size:15px;font-weight:800;color:#fff}
#arc-acct p{margin:0 0 12px;font-size:12.5px;color:#93a4ba}
#arc-acct label{display:block;margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#93a4ba}
#arc-acct input{display:block;width:100%;height:38px;padding:0 12px;margin:0 0 10px;border-radius:10px;background:#05080d;border:1px solid rgba(255,255,255,.16);color:#fff;cursor:text}
#arc-acct input:focus{border-color:#ffc43d}
#arc-acct .aa-row{display:flex;gap:8px;margin-top:4px}
#arc-acct .aa-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;height:38px;padding:0 12px;border-radius:10px;cursor:pointer;
  font-weight:800;font-size:13px;background:#1b2636;border:1px solid rgba(255,255,255,.14);color:#e8eef6}
#arc-acct .aa-btn.aa-go{background:#ffc43d;border-color:#ffc43d;color:#05080d}
#arc-acct .aa-btn:hover,#arc-acct .aa-btn:focus-visible{filter:brightness(1.12)}
#arc-acct .aa-btn[disabled]{opacity:.55;cursor:default}
#arc-acct .aa-say{margin:2px 0 10px;font-size:12.5px;color:#3ec98a}
#arc-acct .aa-say.aa-bad{color:#ff7a6b}
#arc-acct .aa-say:empty{display:none}
#arc-acct .aa-x{position:absolute;top:10px;right:10px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:#93a4ba;font-size:16px}
#arc-acct .aa-x:hover{color:#fff;background:#1b2636}
`;

const PERSON = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.2" r="3" fill="currentColor"/><path d="M2.2 14.5c.6-3 3-4.8 5.8-4.8s5.2 1.8 5.8 4.8" fill="currentColor"/></svg>';

function el(tag, attrs, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

let mounted = false;

export function mount(game) {
  if (mounted || !document.body) return;
  mounted = true;

  const style = el('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const place = PLACE[game] || { top: 14, right: 14 };
  const root = el('div', { id: 'arc-acct' });
  root.style.top = place.top + 'px';
  root.style.right = place.right + 'px';

  const pill = el('button', { type: 'button', class: 'aa-pill', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
  const av = el('span', { class: 'aa-av' });
  const label = el('span');
  pill.append(av, label);

  const panel = el('div', { class: 'aa-panel', role: 'dialog', 'aria-label': 'Arcade account' });
  panel.hidden = true;
  const close = el('button', { type: 'button', class: 'aa-x', 'aria-label': 'Close' }, '×');
  const title = el('h2');
  const note = el('p');
  const say = el('div', { class: 'aa-say', role: 'status' });

  // Signed out: name, password, two ways in.
  const formOut = el('div');
  const nameL = el('label', { for: 'arcAcctName' }, 'Name');
  const name = el('input', { id: 'arcAcctName', autocomplete: 'username', spellcheck: 'false', autocapitalize: 'off', placeholder: 'jake', maxlength: '16' });
  const passL = el('label', { for: 'arcAcctPass' }, 'Password');
  const pass = el('input', { id: 'arcAcctPass', type: 'password', autocomplete: 'current-password', placeholder: 'at least 6 characters' });
  const rowOut = el('div', { class: 'aa-row' });
  const inBtn = el('button', { type: 'button', class: 'aa-btn aa-go' }, 'Sign in');
  const upBtn = el('button', { type: 'button', class: 'aa-btn' }, 'Make one');
  rowOut.append(inBtn, upBtn);
  formOut.append(nameL, name, passL, pass, rowOut);

  // Signed in: who, and a way out.
  const formIn = el('div');
  const rowIn = el('div', { class: 'aa-row' });
  const outBtn = el('button', { type: 'button', class: 'aa-btn' }, 'Sign out');
  const doneBtn = el('button', { type: 'button', class: 'aa-btn aa-go' }, 'Close');
  rowIn.append(outBtn, doneBtn);
  formIn.append(rowIn);

  panel.append(close, title, note, say, formOut, formIn);
  root.append(pill, panel);
  document.body.appendChild(root);

  // Keep the game's keyboard and mouse handlers out of the panel.
  for (const t of ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup', 'wheel']) {
    root.addEventListener(t, (e) => e.stopPropagation());
  }

  function paint() {
    const who = account.whoami();
    root.classList.toggle('aa-in', Boolean(who));
    av.innerHTML = '';
    if (who) av.textContent = account.display(who.name).slice(0, 1).toUpperCase();
    else av.innerHTML = PERSON;
    label.textContent = who ? account.display(who.name) : 'Sign in';
    title.textContent = who ? `Signed in as ${account.display(who.name)}` : 'Arcade account';
    note.textContent = account.mode() === 'unreachable'
      ? 'Accounts cannot be reached right now. Check your connection and reload.'
      : who
        ? 'Your progress in every Arcade game is saved to your account, on any device you sign in on.'
        : 'Sign in to keep your progress in every Arcade game, on any device. The game reloads once to load your save.';
    formOut.hidden = Boolean(who);
    formIn.hidden = !who;
    // Where a controller's highlight starts when the panel opens.
    name.toggleAttribute('data-pad-default', !who);
    doneBtn.toggleAttribute('data-pad-default', Boolean(who));
  }

  // While the panel is open, a controller moves only inside it.
  let rooted = false;
  let prevRoot = null;
  function open(on) {
    panel.hidden = !on;
    pill.setAttribute('aria-expanded', String(on));
    const PN = window.PadNav;
    if (on) {
      say.textContent = '';
      say.classList.remove('aa-bad');
      paint();
      if (PN) {
        if (!rooted) { prevRoot = PN.root; rooted = true; }
        PN.root = () => panel;
        if (PN.using) setTimeout(() => PN.reset && PN.reset(), 30);
      }
      if (!account.whoami() && !(PN && PN.using)) setTimeout(() => name.focus(), 0);
    } else if (PN && rooted) {
      PN.root = prevRoot;
      rooted = false;
      if (PN.using) setTimeout(() => PN.reset && PN.reset(), 30);
    }
  }

  async function act(btn, job, ok) {
    if (btn.disabled) return;
    btn.disabled = true;
    say.classList.remove('aa-bad');
    say.textContent = 'One moment…';
    try {
      await job();
      say.textContent = ok;
      pass.value = '';
      paint();
      setTimeout(() => open(false), 900);
    } catch (err) {
      say.classList.add('aa-bad');
      say.textContent = (err && err.message) || 'Something went wrong.';
    } finally {
      btn.disabled = false;
    }
  }

  pill.addEventListener('click', () => open(panel.hidden));
  close.addEventListener('click', () => open(false));
  doneBtn.addEventListener('click', () => open(false));
  inBtn.addEventListener('click', () => act(inBtn, () => account.signIn(name.value, pass.value), 'Signed in.'));
  upBtn.addEventListener('click', () => act(upBtn, () => account.signUp(name.value, pass.value), 'Account made. Your progress is saved to it.'));
  outBtn.addEventListener('click', () => act(outBtn, () => account.signOut(), 'Signed out.'));
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') inBtn.click(); });
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') pass.focus(); });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { open(false); pill.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!panel.hidden && !root.contains(e.target)) open(false); }, true);

  // Shown only while the game has a menu up, and only once the account has
  // answered, so somebody signed in never sees "Sign in" flash up first.
  let known = false;
  function visible() {
    const PN = window.PadNav;
    let menus = known;
    try { if (PN && typeof PN.active === 'function') menus = PN.active() !== false; } catch {}
    if (document.pointerLockElement) menus = false;
    root.style.display = menus ? '' : 'none';
    if (!menus && !panel.hidden) open(false);
  }
  setInterval(visible, 250);
  visible();

  account.onAccount(() => { known = true; paint(); visible(); });
  paint();
  // The account can fail to load at all; say so rather than show nothing.
  account.start().then(() => { if (account.mode() === 'unreachable') { known = true; paint(); visible(); } }).catch(() => {});

  // For a game with an account button of its own to open this one instead.
  window.ArcadeAccount = { open: () => { root.style.display = ''; open(true); } };
}
