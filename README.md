# The Arcade

A front door for the browser games: one page, two links, nothing to install.

Live: **https://jtpetrotech.github.io/**

- **[Top Shelf](https://jtpetrotech.github.io/top-shelf/)** — 3D hockey. Five a
  side on ice, four on roller, career mode, two players on one screen.
- **[Side Pot](https://jtpetrotech.github.io/poker-pages/)** — play-money
  No-Limit Hold'em, peer to peer, no server in the middle.
- **[Outpost Zero](https://jtpetrotech.github.io/outpost-zero/)** — low-poly
  first-person shooter. Solo against bots, or online team deathmatch with a
  four-letter match code (peer to peer, like Side Pot). Eight guns with mods,
  five maps. Source is `outpost-zero-src/`; run `node build.js` there to
  rebuild `outpost-zero/index.html`.

## Accounts

A name and a password, no email and no Google. One account covers every game
on the shelf, because every game is served from `jtpetrotech.github.io` and a
browser treats that as one place: signing in on the Arcade *is* signing in to
Side Pot and Top Shelf, with nothing to pass between them.

The code is in `account/`. Nothing here is wired into the games yet - that is
the next job.

### Two modes

| | where accounts live | follows you to another device |
|---|---|---|
| **device** (now) | this browser | no |
| **cloud** (once configured) | a Firebase project | yes |

The screens, the rules and the error messages are identical either way, so
switching over changes no behaviour. **Device mode is what a static site can
honestly do on its own** - GitHub Pages hands out files and nothing else, so
there is no one to check a password or hold a profile. The panel says "saved
in this browser only" out loud rather than letting anyone assume otherwise.

The password is kept as a salted SHA-256 rather than as itself, which keeps it
off the screen of anyone reading storage. That is tidiness, not security:
whoever is holding the device could clear the lot and make a new account
anyway. There is nothing here worth guarding beyond a chip balance.

### Switching it on (about 10 minutes, free, no card)

This is the one part that cannot be done from here - it needs somebody to
create the project.

1. <https://console.firebase.google.com> -> **Add project**. Any name. Decline
   Google Analytics; nothing here uses it.
2. **Build -> Authentication -> Get started -> Email/Password**, turn the
   first toggle on, **Save**. (Names are turned into addresses behind the
   scenes - see below - so this is the right provider even though nobody is
   typing an email.)
3. **Build -> Firestore Database -> Create database**, a location near you,
   start in **production mode**.
4. **Rules** tab, paste this, **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /players/{uid} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   This is what actually protects the data: anyone signed in can read a
   profile, only you can write your own.
5. **Project settings** (the gear) -> **Your apps** -> the `</>` web icon.
   Register the app and copy the `firebaseConfig` object.
6. Paste those six values into `account/config.js`, run `node build.js`, commit.
7. **Authentication -> Settings -> Authorized domains** -> add
   `jtpetrotech.github.io`, or the live site is refused.

The config values are public by design. They name the project, they do not
open it.

Side Pot has its own copy of this in `poker-pages/firebase-config.js`. Point
both at the same project and they share one account.

### Names are not email addresses

Firebase signs people in by email, and asking for an email is the thing being
avoided, so `jake` is turned into `jake@arcade.invalid` before it is sent.
`.invalid` is reserved by RFC 2606 and can never be a real domain, so these
cannot collide with anybody's actual mail or be written to by accident. One
constant in `account/names.js` if it ever has to change.

Two consequences:

- **Names are unique across the Arcade**, free of charge - Firebase refuses a
  second account with the same address.
- **There is no "forgot my password"**, because there is nowhere to send a
  reset to. Changing one you know is in the panel. For one nobody knows, the
  account has to be fixed from the Firebase console under
  **Authentication -> Users**.

Names are folded to lower case, so `Jake` and `jake` are one account. Letters,
numbers and underscores, 3 to 16, starting with a letter.

### Using it from a game

```js
import * as account from 'https://jtpetrotech.github.io/account/arcade.js';

await account.start();
account.onAccount((who) => {            // now, and on every change
  console.log(who ? who.name : 'signed out');
});

const saved = await account.load('poker');   // just this game's data
account.save('poker', { vault: 12000 });     // debounced, returns at once
```

Each game gets its own corner of one document, so a player is one read rather
than one per game and no game can tread on another's data. Writes are held for
a moment and the last one wins: a chip balance changes on every bet and one
round trip per chip would be slow and pointless.

## Why this repo is named the way it is

GitHub serves a repository called `<username>.github.io` at the root of your
Pages domain. That is what makes this the hub: both games already live
underneath it as paths, so one address covers everything.

## Building

`index.html` is generated, not hand-edited. Source is `src/index.html`.

```
node build.js
node test/run.js
```

The build inlines the web fonts (reusing the ones Top Shelf already embeds) so
the finished page has no external references at all, and says so loudly if a
page ever grows one. The one exception is deliberate: once a Firebase project
is configured, `account/arcade.js` fetches the Firebase code the first time
somebody signs in. Nothing is fetched before that, so an Arcade with no
project configured still loads nothing from anywhere.

`node test/run.js` covers the account layer - the name and password rules, the
device store, and signing up, saving, signing out and coming back. The rest of
the page is markup the build already vouches for.

## Adding a third game

Copy one of the `<a class="game">` blocks in `src/index.html`, change the
href, the name, the blurb and the `--accent` colour, drop in an inline SVG for
the art, and rebuild. The grid handles any number of cards.
