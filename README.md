# The Arcade

A front door for the browser games: one page, two links, nothing to install.

Live: **https://jtpetrotech.github.io/**

- **[Top Shelf](https://jtpetrotech.github.io/top-shelf/)** — 3D hockey. Five a
  side on ice, four on roller, career mode, two players on one screen.
- **[Side Pot](https://jtpetrotech.github.io/poker-pages/)** — play-money
  No-Limit Hold'em, peer to peer, no server in the middle.
- **[Outpost Zero](https://jtpetrotech.github.io/outpost-zero/)** — low-poly
  first-person shooter against patrol bots, with a red-dot rifle, a scoped
  sniper and an SMG. The game itself lives in this repo at `outpost-zero/`.

## Why this repo is named the way it is

GitHub serves a repository called `<username>.github.io` at the root of your
Pages domain. That is what makes this the hub: both games already live
underneath it as paths, so one address covers everything.

## Building

`index.html` is generated, not hand-edited. Source is `src/index.html`.

```
node build.js
```

It inlines the web fonts (reusing the ones Top Shelf already embeds) so the
finished page has no external references at all — the only outbound links are
the two game links themselves.

## Adding a third game

Copy one of the `<a class="game">` blocks in `src/index.html`, change the
href, the name, the blurb and the `--accent` colour, drop in an inline SVG for
the art, and rebuild. The grid handles any number of cards.
