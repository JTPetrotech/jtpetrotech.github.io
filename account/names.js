/**
 * What counts as a name and a password here.
 *
 * Nothing in this file touches the browser or the network, which is why it is
 * on its own: it is the part worth testing, and `node test/run.js` can load it
 * without pretending to be a page.
 */

/**
 * A name is turned into an email address before it ever reaches Firebase,
 * because Firebase has no idea what a username is - it signs people in by
 * email, and asking for an email is the thing we are trying to avoid.
 *
 * `.invalid` is reserved by RFC 2606 and can never be a real domain, so these
 * addresses cannot collide with somebody's actual mail and cannot be mailed by
 * accident. The consequence is that nothing can ever be sent to one, which is
 * why there is no "forgot my password" link - see the README.
 *
 * One line to change if a provider ever refuses the domain.
 */
export const ADDRESS_DOMAIN = 'arcade.invalid';

export const NAME_MIN = 3;
export const NAME_MAX = 16;
export const PASS_MIN = 6;
export const PASS_MAX = 200;

/** Names are matched without case, so Jake and jake are one account. */
export function cleanName(raw) {
  return String(raw == null ? '' : raw).trim().toLowerCase();
}

/**
 * Why a name cannot be used, in a sentence that can go straight on the screen,
 * or null when it is fine.
 *
 * Letters, digits and underscores only, starting with a letter. That is not
 * primness: a name becomes part of an email address and gets shown to other
 * players, and allowing spaces or punctuation means two names that look
 * identical on screen but are not the same account.
 */
export function nameProblem(raw) {
  const name = cleanName(raw);
  if (!name) return 'Pick a name.';
  if (name.length < NAME_MIN) return `Names are at least ${NAME_MIN} letters.`;
  if (name.length > NAME_MAX) return `Names are at most ${NAME_MAX} letters.`;
  if (!/^[a-z]/.test(name)) return 'Names start with a letter.';
  if (!/^[a-z0-9_]+$/.test(name)) {
    return 'Letters, numbers and underscores only - no spaces.';
  }
  return null;
}

/** Why a password cannot be used, or null. */
export function passProblem(pw) {
  const pass = String(pw == null ? '' : pw);
  if (!pass) return 'Pick a password.';
  if (pass.length < PASS_MIN) return `Passwords are at least ${PASS_MIN} characters.`;
  if (pass.length > PASS_MAX) return 'That password is too long.';
  return null;
}

/** The address a name signs in under. Throws rather than build a bad one. */
export function addressFor(raw) {
  const name = cleanName(raw);
  const problem = nameProblem(name);
  if (problem) throw new Error(problem);
  return `${name}@${ADDRESS_DOMAIN}`;
}

/** The name back out of an address, for showing who is signed in. */
export function nameFrom(address) {
  const at = String(address == null ? '' : address).indexOf('@');
  return at < 0 ? cleanName(address) : cleanName(String(address).slice(0, at));
}

/** How a name is written when shown: jake -> Jake, no other change. */
export function display(raw) {
  const name = cleanName(raw);
  return name ? name[0].toUpperCase() + name.slice(1) : '';
}
