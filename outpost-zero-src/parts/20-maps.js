/* Maps. Every map is built from a seed made from its name, so two browsers
   that load "docks" get exactly the same yard - that is what lets an online
   match share a map without sending it. Maps meant for team play are built
   point-symmetric: whatever stands at (x, z) also stands at (-x, -z). */

const world = { id: null, half: 200, h: () => 0, boxes: [], circles: [], shootables: [], objs: [], spawns: [[], []] };
const heightAt = (x, z) => world.h(x, z);

function isClear(x, z, r) {
  for (const b of world.boxes) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return false;
  for (const c of world.circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return false;
  return Math.abs(x) < world.half - r - 1 && Math.abs(z) < world.half - r - 1;
}
function cornerRange(x, z, w, d) {
  let lo = Infinity, hi = -Infinity;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const h = heightAt(x + a * w / 2, z + b * d / 2); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return [lo, hi];
}

const WALLS = [0xb9b2a3, 0xa79f8d, 0xc8c0ae, 0x8e999b, 0xb38f6f, 0x98a38a, 0xc4b39a];
const ADOBE = [0xd6b88c, 0xcfa676, 0xe0c9a0, 0xbf9468, 0xc99e73];
const CONCRETE = [0x9aa0a4, 0x8c9296, 0xa8adb0, 0x7f868b];
const BOXCOL = [0xb5452f, 0x2f6fa8, 0x3f8a5a, 0xd19a2e, 0x7a7f86, 0xa8b3b8, 0x8e3f6b];

function makeBuilder(seed) {
  const r = mulberry(seed);
  const B = {
    r, R: (a, b) => a + (b - a) * r(), pick: arr => arr[(r() * arr.length) | 0],
    inst: { box: [], win: [], trunk: [], crown: [], rock: [], mtn: [] },
    box(x, z, w, d, h, color, opt = {}) {
      const [lo, hi] = cornerRange(x, z, w, d);
      let bottom = lo - 0.6, top = hi + h;
      if (opt.base != null) { bottom = opt.base; top = opt.base + h; }
      if (opt.top != null) top = opt.top;
      const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: bottom, maxY: top, ground: hi };
      b.box3 = new THREE.Box3(new THREE.Vector3(b.minX, bottom, b.minZ), new THREE.Vector3(b.maxX, top, b.maxZ));
      world.boxes.push(b);
      B.inst.box.push({ p: [x, (top + bottom) / 2, z], s: [w, top - bottom, d], c: color });
      return b;
    },
    // place at (x,z) and at the mirrored point, but only if both spots are free
    mirror(x, z, rad, place) {
      if (!isClear(x, z, rad) || !isClear(-x, -z, rad)) return false;
      place(x, z); place(-x, -z); return true;
    },
    building(x, z, w, d, h, stairs, cols = WALLS, force) {
      if (!force && !isClear(x, z, Math.max(w, d) / 2 + 1)) return null;
      const b = B.box(x, z, w, d, h, B.pick(cols));
      B.inst.box.push({ p: [x, b.maxY + 0.12, z], s: [w + 0.25, 0.24, d + 0.25], c: 0x5e5a54 });
      b.maxY += 0.24; b.box3.max.y = b.maxY;
      const floors = Math.max(1, Math.floor(h / 3));
      for (let f = 0; f < floors; f++) {
        const y = b.ground + 1.7 + f * 3; if (y > b.maxY - 0.9) break;
        const nx = Math.max(1, Math.floor((w - 1.5) / 2.6)), nz = Math.max(1, Math.floor((d - 1.5) / 2.6));
        for (let i = 0; i < nx; i++) { const px = x - w / 2 + (i + 0.5) * w / nx;
          B.inst.win.push({ p: [px, y, z + d / 2 + 0.04], s: [1.0, 1.2, 0.08], c: 0x2c3a45 });
          B.inst.win.push({ p: [px, y, z - d / 2 - 0.04], s: [1.0, 1.2, 0.08], c: 0x2c3a45 }); }
        for (let i = 0; i < nz; i++) { const pz = z - d / 2 + (i + 0.5) * d / nz;
          B.inst.win.push({ p: [x + w / 2 + 0.04, y, pz], s: [0.08, 1.2, 1.0], c: 0x2c3a45 });
          B.inst.win.push({ p: [x - w / 2 - 0.04, y, pz], s: [0.08, 1.2, 1.0], c: 0x2c3a45 }); }
      }
      B.inst.win.push({ p: [x, b.ground + 1.05, z + d / 2 + 0.05], s: [1.3, 2.1, 0.1], c: 0x5a4632 });
      B.inst.win.push({ p: [x, b.ground + 1.05, z - d / 2 - 0.05], s: [1.3, 2.1, 0.1], c: 0x5a4632 });
      if (stairs) {
        // crate staircase up the -x side so the roof is reachable
        let top = b.maxY - 0.9, i = 0;
        while (top > heightAt(x - w / 2 - 0.7 - i * 1.3, z) + 0.45 && i < 12) {
          const sx = x - w / 2 - 0.7 - i * 1.3, sz = z - d / 2 + 0.8;
          B.box(sx, sz, 1.3, 1.4, 0, i % 2 ? 0x7d6140 : 0x8c6d47, { top });
          top -= 0.9; i++;
        }
      }
      return b;
    },
    crate(x, z, stack, cols = [0x8a6a43, 0x5f6b45]) {
      const c1 = B.pick(cols), c2 = B.pick(cols);
      const b = B.box(x, z, 1.3, 1.3, 1.3, c1);
      if (stack) B.box(x + B.R(-0.15, 0.15), z + B.R(-0.15, 0.15), 1.2, 1.2, 1.2, c2, { base: b.maxY });
    },
    wall(x, z, len, along, h, cols = [0x9b9585, 0x8b8f80]) {
      B.box(x, z, along ? len : 0.6, along ? 0.6 : len, h, B.pick(cols));
    },
    container(x, z, along, len, stack, color) {
      const w = along ? len : 2.5, d = along ? 2.5 : len;
      let base = null;
      for (let i = 0; i < stack; i++) {
        const col = i === 0 ? color : B.pick(BOXCOL);
        const b = B.box(x, z, w, d, 2.6, col, base == null ? {} : { base });
        base = b.maxY;
        // dark door ends so a stack reads as containers, not blocks
        const y = (b.minY + b.maxY) / 2 + (i === 0 ? 0.3 : 0), hh = i === 0 ? b.maxY - b.ground - 0.2 : 2.4;
        if (along) { B.inst.win.push({ p: [x - w / 2 - 0.03, b.maxY - hh / 2 - 0.1, z], s: [0.06, hh, 2.2], c: 0x2a2d31 }); B.inst.win.push({ p: [x + w / 2 + 0.03, b.maxY - hh / 2 - 0.1, z], s: [0.06, hh, 2.2], c: 0x2a2d31 }); }
        else { B.inst.win.push({ p: [x, b.maxY - hh / 2 - 0.1, z - d / 2 - 0.03], s: [2.2, hh, 0.06], c: 0x2a2d31 }); B.inst.win.push({ p: [x, b.maxY - hh / 2 - 0.1, z + d / 2 + 0.03], s: [2.2, hh, 0.06], c: 0x2a2d31 }); }
      }
    },
    crane(x, z) {
      const col = 0xd9a52b;
      for (const [a, c] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) B.box(x + a, z + c, 0.9, 0.9, 17, col);
      const g = heightAt(x, z);
      B.box(x, z, 18, 1.6, 1.4, col, { base: g + 17 });
      B.box(x + 3, z, 3, 2.6, 2.2, 0x3b4148, { base: g + 14.6 });
    },
    mast(x, z, h, col = 0xb5453a) {
      B.box(x, z, 1.1, 1.1, h, col);
      B.box(x, z, 2.4, 2.4, 0.4, 0x6a6f74, { base: heightAt(x, z) + h * 0.6 });
    },
    tree(x, z, style) {
      const g = heightAt(x, z);
      world.circles.push({ x, z, r: style === 'palm' ? 0.3 : 0.35, top: g + 50 });
      if (style === 'palm') {
        const th = B.R(5, 7);
        B.inst.trunk.push({ p: [x, g + th / 2, z], s: [0.7, th, 0.7], c: 0x8a6a48 });
        const green = new THREE.Color().setHSL(0.25 + B.R(-0.03, 0.03), 0.45, B.R(0.3, 0.38)).getHex();
        B.inst.crown.push({ p: [x, g + th + 0.3, z], s: [3.2, 1.0, 3.2], c: green, r: [0, B.R(0, 3), 0] });
        return;
      }
      const th = B.R(1.4, 2.4), cr = style === 'leaf' ? B.R(1.4, 2.3) : B.R(1.2, 1.8), ch = style === 'leaf' ? B.R(3.2, 5.2) : B.R(5, 7.5);
      B.inst.trunk.push({ p: [x, g + th / 2, z], s: [1, th, 1], c: 0x6b4f36 });
      const green = style === 'leaf' ? new THREE.Color().setHSL(0.27 + B.R(-0.04, 0.05), 0.42, B.R(0.24, 0.34)).getHex()
        : new THREE.Color().setHSL(0.36 + B.R(-0.03, 0.03), 0.35, B.R(0.18, 0.25)).getHex();
      B.inst.crown.push({ p: [x, g + th + ch / 2 - 0.3, z], s: [cr, ch, cr], c: green });
      B.inst.crown.push({ p: [x, g + th + ch * 0.95, z], s: [cr * 0.65, ch * 0.6, cr * 0.65], c: style === 'snow' ? 0xeef3f6 : green });
    },
    rock(x, z, s, cols = [0x8c8d86, 0x7b7d78, 0x9a9890]) {
      const g = heightAt(x, z);
      world.circles.push({ x, z, r: s * 0.95, top: g + s * 0.75, rock: true });
      B.inst.rock.push({ p: [x, g + s * 0.2, z], s: [s * 1.3, s * 0.85, s * 1.1], r: [B.R(0, 3), B.R(0, 3), B.R(0, 3)], c: B.pick(cols) });
    },
    mountains(rmin, rmax, cols, smin, smax) {
      for (let i = 0; i < 64; i++) {
        const a = i / 64 * Math.PI * 2, rr = B.R(rmin, rmax), s = B.R(smin, smax);
        B.inst.mtn.push({ p: [Math.cos(a) * rr, s * 0.4 - 4, Math.sin(a) * rr], s: [s, s * B.R(0.7, 1.2), s], c: B.pick(cols) });
      }
    },
    fence(h, color) {
      const H = world.half;
      B.box(0, -H, H * 2 + 1, 1, h, color, { force: true });
      B.box(0, H, H * 2 + 1, 1, h, color);
      B.box(-H, 0, 1, H * 2 + 1, h, color);
      B.box(H, 0, 1, H * 2 + 1, h, color);
    },
  };
  return B;
}

function instanced(list, geo, shoot, shadow = true) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, shininess: 4, specular: 0x111111 }), list.length);
  const col = new THREE.Color();
  list.forEach((o, i) => {
    _e.set(...(o.r || [0, 0, 0])); _q.setFromEuler(_e);
    _m.compose(_v.set(...o.p), _q, _s.set(...o.s)); im.setMatrixAt(i, _m);
    im.setColorAt(i, col.setHex(o.c));
  });
  im.castShadow = shadow; im.receiveShadow = true;
  scene.add(im); world.objs.push(im); if (shoot) world.shootables.push(im);
  return im;
}

/* ---------- the maps ---------- */
function buildValley(B) {
  const H = world.half;
  for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 2; gz++) {
    if (gx === 0 && gz === 0) continue;
    if (B.r() < 0.22) continue;
    const h = B.r() < 0.4 ? B.R(3.4, 4.6) : B.R(5, 10);
    B.building(gx * 24 + B.R(-3, 3), gz * 24 + B.R(-3, 3), B.R(8, 13), B.R(8, 13), h, h < 7 && B.r() < 0.55);
  }
  for (let i = 0; i < 10; i++) { const x = B.R(-8, 8), z = B.R(-8, 8); if (isClear(x, z, 1)) B.crate(x, z, B.r() < 0.3); }
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + B.R(-0.3, 0.3), rr = B.R(95, 165), cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    const n = 2 + (B.r() * 3 | 0);
    for (let i = 0; i < n; i++) { const h = B.r() < 0.5 ? B.R(3.4, 4.6) : B.R(5, 8); B.building(cx + B.R(-16, 16), cz + B.R(-16, 16), B.R(7, 12), B.R(7, 12), h, h < 6 && B.r() < 0.6); }
    for (let i = 0; i < 6; i++) { const x = cx + B.R(-20, 20), z = cz + B.R(-20, 20); if (isClear(x, z, 1)) B.crate(x, z, B.r() < 0.35); }
    for (let i = 0; i < 4; i++) { const x = cx + B.R(-22, 22), z = cz + B.R(-22, 22), l = B.R(3, 7), al = B.r() < 0.5; if (isClear(x, z, l / 2 + 0.5)) B.wall(x, z, l, al, B.R(1.1, 1.4)); }
  }
  for (let i = 0; i < 80; i++) { const x = B.R(-H + 10, H - 10), z = B.R(-H + 10, H - 10), l = B.R(3, 7), al = B.r() < 0.5; if (isClear(x, z, l / 2 + 0.5)) B.wall(x, z, l, al, B.R(1.1, 1.4)); }
  for (let i = 0; i < 70; i++) { const x = B.R(-H + 10, H - 10), z = B.R(-H + 10, H - 10); if (isClear(x, z, 1)) B.crate(x, z, B.r() < 0.3); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.6; B.building(Math.cos(a) * 60, Math.sin(a) * 60, 4, 4, 7.5, true); }
  for (let i = 0; i < 80; i++) { const x = B.R(-H, H), z = B.R(-H, H), s = B.R(0.7, 2.4); if (Math.hypot(x, z) > 18 && isClear(x, z, s + 0.5)) B.rock(x, z, s); }
  for (let i = 0, n = 0; i < 600 && n < 230; i++) { const x = B.R(-H, H), z = B.R(-H, H); if (Math.hypot(x, z) < 62 || !isClear(x, z, 1.6)) continue; n++; B.tree(x, z, 'leaf'); }
}
function buildDocks(B) {
  B.fence(3.6, 0x8d9095);
  const hall = (x, z, w, d, h) => B.mirror(x, z, Math.max(w, d) / 2, (px, pz) => B.building(px, pz, w, d, h, true, CONCRETE, true));
  hall(-52, 58, 26, 14, 7); hall(-64, -26, 14, 22, 5); hall(18, 66, 16, 10, 4.2);
  B.mirror(0, 34, 6, (x, z) => B.crane(x, z));
  for (let i = 0, n = 0; i < 400 && n < 30; i++) {
    const x = B.R(-80, 80), z = B.R(-84, -4), along = B.r() < 0.65, len = B.r() < 0.5 ? 6 : 12;
    const stack = B.r() < 0.55 ? 1 : B.r() < 0.7 ? 2 : 3, col = B.pick(BOXCOL);
    if (Math.abs(x) < 8 && Math.abs(z) < 10) continue;
    if (B.mirror(x, z, (along ? len : 2.5) / 2 + 1.6, (px, pz) => B.container(px, pz, along, len, stack, col))) n++;
  }
  for (let i = 0; i < 40; i++) { const x = B.R(-80, 80), z = B.R(-84, 0), l = B.R(2.5, 5), al = B.r() < 0.5, h = B.R(1.0, 1.3);
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, h, [0xc9c3b2, 0xb7b09c])); }
  for (let i = 0; i < 40; i++) { const x = B.R(-80, 80), z = B.R(-84, 0), st = B.r() < 0.35; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st)); }
  for (const [x, z] of [[0, 0], [4, 6], [-4, -6]]) if (isClear(x, z, 1)) B.crate(x, z, false);
  B.mountains(world.half + 120, world.half + 170, [0x75806f, 0x868c84], 25, 55);
}
function buildSandline(B) {
  B.fence(4.5, 0xc9a77a);
  for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
    if (!(gx < 0 || (gx === 0 && gz < 0))) continue;
    if (B.r() > 0.82) continue;
    const x = gx * 19 + B.R(-2, 2), z = gz * 19 + B.R(-2, 2), w = B.R(7, 12), d = B.R(7, 12);
    const h = B.r() < 0.5 ? B.R(3.4, 4.4) : B.R(5, 8), st = B.r() < 0.6;
    B.mirror(x, z, Math.max(w, d) / 2 + 1, (px, pz) => B.building(px, pz, w, d, h, st, ADOBE, true));
  }
  B.rock(0, 0, 1.6, [0xb89a70]);
  for (let i = 0; i < 24; i++) { const x = B.R(-70, 70), z = B.R(-70, 0); B.mirror(x, z, 1.2, (px, pz) => B.tree(px, pz, 'palm')); }
  for (let i = 0; i < 26; i++) { const x = B.R(-70, 70), z = B.R(-70, 0), l = B.R(2.5, 6), al = B.r() < 0.5, h = B.R(1.1, 2.2);
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, h, [0xcfae84, 0xbf9a6c])); }
  for (let i = 0; i < 30; i++) { const x = B.R(-70, 70), z = B.R(-70, 0), st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st, [0x8a6a43, 0x6e5a3e, 0x9b7b4d])); }
  B.mountains(world.half + 110, world.half + 160, [0xc7a77c, 0xb5956a], 25, 60);
}
function buildFrost(B) {
  for (let i = 0; i < 7; i++) { const x = B.R(-95, 95), z = B.R(-95, -8), w = B.R(8, 12), d = B.R(6, 9), h = B.R(2.6, 3.6);
    B.mirror(x, z, Math.max(w, d) / 2 + 1.5, (px, pz) => B.building(px, pz, w, d, h, true, CONCRETE, true)); }
  B.mirror(-22, 30, 3, (x, z) => B.mast(x, z, 22));
  for (let i = 0; i < 26; i++) { const x = B.R(-100, 100), z = B.R(-100, 0), l = B.R(3, 7), al = B.r() < 0.5, h = B.R(1.1, 1.5);
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, h, [0x8f979d, 0x7d858b])); }
  for (let i = 0; i < 24; i++) { const x = B.R(-100, 100), z = B.R(-100, 0), st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st, [0x5f6b45, 0x4e5a3a])); }
  for (let i = 0; i < 40; i++) { const x = B.R(-105, 105), z = B.R(-105, 0), s = B.R(0.8, 2.6); B.mirror(x, z, s + 0.5, (px, pz) => B.rock(px, pz, s, [0x80888e, 0x6f777d, 0x959ca1])); }
  for (let i = 0, n = 0; i < 500 && n < 90; i++) { const x = B.R(-105, 105), z = B.R(-105, 0); if (B.mirror(x, z, 1.6, (px, pz) => B.tree(px, pz, 'snow'))) n++; }
  B.mountains(world.half + 50, world.half + 90, [0xdfe6ec, 0xc5ced5, 0xa9b3bb], 35, 70);
}
function buildPit(B) {
  B.fence(4, 0x6d6f72);
  B.building(0, 0, 7, 7, 3.2, true, [0xa08b6a], true);
  const ply = [0xb58b57, 0xa67e4e];
  const plan = [[-9, 12, 10, true, 3], [-20, 5, 9, false, 3], [-14, -11, 8, true, 1.2], [-27, 16, 6, false, 1.2], [-6, 24, 8, false, 3],
                [-24, -4, 5, true, 1.2], [-31, -15, 6, true, 3], [-12, -24, 7, true, 1.2], [-3, -16, 4, false, 1.2]];
  for (const [x, z, l, al, h] of plan) B.mirror(x, z, 0.2, (px, pz) => B.wall(px, pz, l, al, h, ply));
  for (let i = 0; i < 12; i++) { const x = B.R(-32, 32), z = B.R(-32, 0), st = B.r() < 0.35; B.mirror(x, z, 1.1, (px, pz) => B.crate(px, pz, st)); }
  B.mountains(world.half + 120, world.half + 160, [0x6f6a5e, 0x5e5b52], 30, 60);
}

const MAPS = {
  valley: { name: 'Valley', blurb: 'Huge open valley, town in the middle', half: 200, axis: 'x', sky: 0xa8c6d4, fog: [80, 320], hemi: [0xdcefff, 0x5d6b3c, 0.78], sun: [0xfff0d4, 0.85],
    h: (x, z) => 2.4 * Math.sin(x * 0.028) * Math.cos(z * 0.022) + 1.1 * Math.sin(x * 0.061 + z * 0.047) + 0.6 * Math.cos(z * 0.09 - x * 0.02),
    ground: (c, h, n) => h < -2.6 ? c.setHex(0xbcae84) : c.setHSL(0.22 + n * 0.05, 0.32, 0.34 + n * 0.05 + h * 0.012),
    build: buildValley, mtn: true },
  docks: { name: 'Dockyard', blurb: 'Container stacks and cranes, medium size', half: 90, axis: 'x', sky: 0xb9c6cf, fog: [55, 240], hemi: [0xe0ecf5, 0x5b6066, 0.8], sun: [0xfff4e2, 0.85],
    h: (x, z) => 0.1 * Math.sin(x * 0.21) * Math.cos(z * 0.19),
    ground: (c, h, n, x, z) => (Math.abs(x) > 93 || Math.abs(z) > 93) ? c.setHSL(0.56, 0.42, 0.34 + n * 0.04) : c.setHSL(0.58, 0.05, 0.36 + n * 0.05),
    build: buildDocks },
  sandline: { name: 'Sandline', blurb: 'Tight desert town with flat roofs', half: 75, axis: 'z', sky: 0xdccfb4, fog: [45, 220], hemi: [0xfff1d8, 0x9c7f55, 0.85], sun: [0xffe4b8, 0.95],
    h: (x, z) => 0.8 * Math.sin(x * 0.045) * Math.cos(z * 0.05) + 0.35 * Math.sin(x * 0.13 + z * 0.09),
    ground: (c, h, n) => c.setHSL(0.09, 0.36, 0.5 + n * 0.05 + h * 0.02),
    build: buildSandline },
  frost: { name: 'Frostbite', blurb: 'Snowy hills, pines and bunkers', half: 110, axis: 'x', sky: 0xcdd8e1, fog: [35, 210], hemi: [0xeef5ff, 0x8da0b0, 0.85], sun: [0xf2f6ff, 0.8],
    h: (x, z) => 3.4 * Math.sin(x * 0.03) * Math.cos(z * 0.027) + 1.2 * Math.sin(x * 0.07 - z * 0.05),
    ground: (c, h, n) => c.setHSL(0.58, 0.18, Math.min(0.95, 0.84 + n * 0.06 + h * 0.008)),
    build: buildFrost },
  pit: { name: 'The Pit', blurb: 'Small walled arena, great for 1v1', half: 36, axis: 'x', sky: 0x9fb1bd, fog: [60, 190], hemi: [0xdde8f0, 0x6b5a45, 0.8], sun: [0xfff0d4, 0.9],
    h: () => 0, ground: (c, h, n) => c.setHSL(0.09, 0.25, 0.36 + n * 0.06),
    build: buildPit },
};

function clearWorld() {
  for (const o of world.objs) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  world.objs = []; world.boxes = []; world.circles = []; world.shootables = [];
}
function loadMap(id) {
  if (!MAPS[id]) id = 'valley';
  const M = MAPS[id];
  clearWorld();
  world.id = id; world.half = M.half; world.h = M.h;
  scene.background.setHex(M.sky); scene.fog.color.setHex(M.sky); scene.fog.near = M.fog[0]; scene.fog.far = M.fog[1];
  hemi.color.setHex(M.hemi[0]); hemi.groundColor.setHex(M.hemi[1]); hemi.intensity = M.hemi[2];
  sun.color.setHex(M.sun[0]); sun.intensity = M.sun[1];
  // terrain
  const size = M.half * 2 + 2 * Math.max(120, M.half * 0.6), seg = clamp(Math.round(size / 5.5), 40, 116);
  const tr = mulberry(hashStr(id) ^ 99);
  const tg = new THREE.PlaneGeometry(size, size, seg, seg);
  tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position, cols = [], c = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i), h = M.h(x, z); tp.setY(i, h);
    M.ground(c, h, tr(), x, z); cols.push(c.r, c.g, c.b);
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, specular: 0x000000 }));
  terrain.receiveShadow = true; scene.add(terrain); world.objs.push(terrain); world.shootables.push(terrain);
  // props
  const B = makeBuilder(hashStr(id));
  M.build(B);
  if (M.mtn) B.mountains(M.half * 1.25, M.half * 1.45, [0x7f8c6d, 0x8a8f86], 30, 60);
  instanced(B.inst.box, new THREE.BoxGeometry(1, 1, 1), true);
  instanced(B.inst.win, new THREE.BoxGeometry(1, 1, 1), false, false);
  instanced(B.inst.trunk, new THREE.CylinderGeometry(0.2, 0.28, 1, 6), true);
  instanced(B.inst.crown, new THREE.ConeGeometry(1, 1, 7), true);
  instanced(B.inst.rock, new THREE.DodecahedronGeometry(1, 0), true);
  instanced(B.inst.mtn, new THREE.ConeGeometry(1, 1, 6), false, false);
  // team spawns: team 0 on the negative side of the map's axis, team 1 mirrored
  const pts = [];
  for (let i = 0; i < 600 && pts.length < 10; i++) {
    const along = -M.half * B.R(0.72, 0.9), across = B.R(-0.55, 0.55) * M.half;
    const x = M.axis === 'x' ? along : across, z = M.axis === 'x' ? across : along;
    if (isClear(x, z, 1.3) && isClear(-x, -z, 1.3)) pts.push([x, z]);
  }
  if (!pts.length) pts.push(M.axis === 'x' ? [-M.half * 0.8, 0] : [0, -M.half * 0.8]);
  world.spawns = [pts, pts.map(([x, z]) => [-x, -z])];
}
