/* Maps. Every map is built from a seed made from its name, so two browsers
   that load "docks" get exactly the same yard - that is what lets an online
   match share a map without sending it. Maps meant for team play are built
   point-symmetric: whatever stands at (x, z) also stands at (-x, -z). */

const world = { id: null, half: 200, h: () => 0, boxes: [], circles: [], shootables: [], objs: [], spawns: [[], []], water: null, cratePts: [], benchPts: [], vehPts: [] };
const heightAt = (x, z) => world.h(x, z);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function isClear(x, z, r) {
  if (Math.abs(x) > world.half - r - 1 || Math.abs(z) > world.half - r - 1) return false;
  if (world.water != null && heightAt(x, z) < world.water + 0.2) return false;
  for (const b of world.boxes) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return false;
  for (const c of world.circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return false;
  return true;
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
const WOOD = [0x7a5a3c, 0x8a6542, 0x6b4e34, 0x94704a];
const TOWERS = [0x8e989f, 0x9da3a6, 0x7d878e, 0xb0a99a, 0x6f7b84, 0xa39b8c];
const CARS = [0xb23a2e, 0x2e5f9e, 0xd8d8d2, 0x2c3034, 0x6f7a3e, 0xc9a23a, 0x5a6b78];

function makeBuilder(seed) {
  const r = mulberry(seed);
  const B = {
    r, R: (a, b) => a + (b - a) * r(), pick: arr => arr[(r() * arr.length) | 0],
    inst: { box: [], win: [], trunk: [], crown: [], rock: [], mtn: [], cyl: [], wheel: [], roof: [] },
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
    tank(x, z, r, h, col) {
      const g = heightAt(x, z);
      world.circles.push({ x, z, r: r + 0.1, top: g + h, tall: true });
      B.inst.cyl.push({ p: [x, g + h / 2 - 0.3, z], s: [r, h + 0.6, r], c: col });
      B.inst.cyl.push({ p: [x, g + h + 0.15, z], s: [r * 0.97, 0.3, r * 0.97], c: 0x8d9296 });
      B.inst.cyl.push({ p: [x, g + h * 0.62, z], s: [r * 1.012, 0.4, r * 1.012], c: 0x9b5b3c });
      B.inst.win.push({ p: [x + r + 0.08, g + h / 2, z], s: [0.12, h, 0.5], c: 0x4a4f54 });
    },
    pipes(x, z, len, along) {
      const g = heightAt(x, z), n = Math.max(2, Math.round(len / 6));
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + i * len / n, px = along ? x + t : x, pz = along ? z : z + t;
        B.box(px, pz, 0.45, 0.45, 4.6, 0x6c7378);
      }
      const rot = along ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], cols = [0x9aa3a8, 0xb87a3e, 0x6f8a6a];
      for (let k = 0; k < 3; k++) {
        const o = (k - 1) * 0.65;
        B.inst.cyl.push({ p: [along ? x : x + o, g + 3.7 + (k === 1 ? 0.45 : 0), along ? z + o : z], s: [0.22, len + 1, 0.22], c: cols[k], r: rot });
      }
    },
    car(x, z, along, col) {
      const g = heightAt(x, z), w = along ? 4.3 : 1.9, d = along ? 1.9 : 4.3;
      const body = B.box(x, z, w, d, 0.8, col, { base: g + 0.32 });
      const cw = along ? 2.3 : 1.7, cd = along ? 1.7 : 2.3, cx = along ? x - 0.25 : x, cz = along ? z : z - 0.25;
      B.box(cx, cz, cw, cd, 0.62, col, { base: body.maxY });
      B.inst.win.push({ p: [cx, body.maxY + 0.32, cz], s: [cw + 0.04, 0.42, cd + 0.04], c: 0x23313b });
      for (const a of [-1, 1]) for (const b of [-1, 1]) {
        const wx = along ? x + a * 1.35 : x + b * 0.9, wz = along ? z + b * 0.9 : z + a * 1.35;
        B.inst.wheel.push({ p: [wx, g + 0.36, wz], s: [0.36, 0.26, 0.36], c: 0x1c1e20, r: along ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2] });
      }
    },
    lamp(x, z) {
      const g = heightAt(x, z);
      B.box(x, z, 0.18, 0.18, 5.2, 0x3b4045);
      B.inst.win.push({ p: [x, g + 5.25, z], s: [0.5, 0.18, 0.5], c: 0xf2e3b0 });
    },
    cabin(x, z, w, d, h, cols = WOOD) {
      const b = B.building(x, z, w, d, h, false, cols, true);
      if (!b) return null;
      B.inst.roof.push({ p: [x, b.maxY + 1.0, z], s: [(w / 2 + 0.5) / 0.7071, 2.0, (d / 2 + 0.5) / 0.7071], c: 0x5a3b2c, r: [0, Math.PI / 4, 0] });
      b.maxY += 1.2; b.box3.max.y = b.maxY;
      return b;
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

function instanced(list, geo, shoot, shadow = true, opt = {}) {
  if (!list.length) return null;
  const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: opt.smooth ? false : true, shininess: opt.shine || 4, specular: opt.shine ? 0x333333 : 0x111111 });
  if (opt.detail !== 0) detail(mat, opt.detail || 0.24, opt.scale || 1);
  const im = new THREE.InstancedMesh(geo, mat, list.length);
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

function buildRefinery(B) {
  B.fence(3.4, 0x8a8f94);
  B.building(0, 0, 12, 9, 4.4, true, CONCRETE, true);
  const TANKC = [0xd8dcd8, 0xc9cfcc, 0xbfc5c2, 0xe0d9c8];
  for (const [x, z, r, h] of [[-50, -40, 7, 9], [-50, -17, 6, 8], [-30, -52, 5, 7], [-64, -70, 8, 11], [-18, -74, 6, 8.5], [-28, 32, 5, 6.5], [-50, 54, 7, 9], [-20, 64, 5, 7]]) {
    const c = B.pick(TANKC); B.mirror(x, z, r + 1.5, (px, pz) => B.tank(px, pz, r, h, c));
  }
  B.mirror(-38, 2, 0.3, (x, z) => B.pipes(x, z, 22, false));
  B.mirror(-23, -28, 0.3, (x, z) => B.pipes(x, z, 24, true));
  B.mirror(-70, 22, 3, (x, z) => B.mast(x, z, 28, 0xb84a36));
  for (const [x, z, w, d, h] of [[-66, 40, 8, 6, 3.4], [-12, 28, 7, 7, 3.2], [-40, 76, 10, 7, 4.2], [-84, -40, 7, 6, 3.4]])
    B.mirror(x, z, Math.max(w, d) / 2 + 1, (px, pz) => B.building(px, pz, w, d, h, true, CONCRETE, true));
  for (let i = 0, n = 0; i < 200 && n < 10; i++) { const x = B.R(-90, -8), z = B.R(-85, 85), al = B.r() < 0.5, col = B.pick(BOXCOL);
    if (B.mirror(x, z, 5, (px, pz) => B.container(px, pz, al, 6, B.r() < 0.6 ? 1 : 2, col))) n++; }
  for (let i = 0; i < 40; i++) { const x = B.R(-92, -4), z = B.R(-90, 90), l = B.R(2.5, 5), al = B.r() < 0.5;
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, 1.1, [0xc9c3b2, 0xb7b09c, 0xd9b84a])); }
  for (let i = 0; i < 36; i++) { const x = B.R(-92, -4), z = B.R(-90, 90), st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st)); }
  B.mountains(world.half + 110, world.half + 160, [0x7a7f73, 0x8b8a7e], 25, 55);
}
function buildTimber(B) {
  B.building(0, 0, 14, 10, 5, true, WOOD, true);
  for (const [x, z, w, d, h] of [[-30, -18, 8, 7, 3.4], [-62, 22, 9, 7, 3.6], [-48, -66, 8, 6, 3.2], [-90, -30, 7, 7, 3.2], [-20, 58, 9, 6, 3.4], [-75, 70, 8, 8, 3.6]])
    B.mirror(x, z, Math.max(w, d) / 2 + 1.5, (px, pz) => B.cabin(px, pz, w, d, h));
  for (const [x, z] of [[-55, -12], [-26, 86], [-96, 60]]) B.mirror(x, z, 3.5, (px, pz) => B.building(px, pz, 3.6, 3.6, 8.5, true, WOOD, true));
  for (let i = 0; i < 40; i++) { const x = B.R(-110, 0), z = B.R(-110, 110), l = B.R(3, 6), al = B.r() < 0.5;
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, B.R(0.9, 1.3), [0x6b4e34, 0x7a5a3c])); }
  for (let i = 0; i < 30; i++) { const x = B.R(-110, 0), z = B.R(-110, 110), st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st, [0x6e5a3e, 0x5f6b45])); }
  for (let i = 0; i < 50; i++) { const x = B.R(-115, 0), z = B.R(-115, 115), s = B.R(0.8, 2.8); B.mirror(x, z, s + 0.5, (px, pz) => B.rock(px, pz, s)); }
  for (let i = 0, n = 0; i < 1400 && n < 230; i++) { const x = B.R(-116, 0), z = B.R(-116, 116), st = B.r() < 0.6 ? 'pine' : 'leaf';
    if (Math.hypot(x, z) < 14) continue; if (B.mirror(x, z, 1.7, (px, pz) => B.tree(px, pz, st))) n++; }
  B.mountains(world.half + 90, world.half + 150, [0x5d6e58, 0x6c7b62, 0x7f8a75], 35, 70);
}
function buildAtoll(B) {
  // central fort: a ring of walls with four gaps and a watchtower
  for (let k = 0; k < 16; k++) { if (k % 4 === 1) continue; const a = k / 16 * Math.PI * 2, x = Math.cos(a) * 16, z = Math.sin(a) * 16;
    const side = Math.abs(Math.cos(a)) > 0.7; B.box(x, z, side ? 1 : 6, side ? 6 : 1, 2.4, 0xb59f7c); }
  B.building(0, 0, 5, 5, 8, true, [0xa38a66], true);
  for (const [x, z, w, d, h] of [[-48, -30, 7, 6, 3.2], [-62, 18, 8, 6, 3.4], [-30, 50, 7, 7, 3.2], [-72, -10, 6, 6, 3], [-22, -66, 7, 6, 3.2]])
    B.mirror(x, z, Math.max(w, d) / 2 + 1.5, (px, pz) => B.cabin(px, pz, w, d, h, [0xc4a27a, 0xb08a60, 0xd2b48a]));
  for (const [x, z] of [[-40, 8], [-12, -40]]) B.mirror(x, z, 3, (px, pz) => B.building(px, pz, 3.6, 3.6, 6.5, true, WOOD, true));
  for (let i = 0; i < 34; i++) { const x = B.R(-95, 0), z = B.R(-95, 95), l = B.R(2.5, 5.5), al = B.r() < 0.5;
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, B.R(1.0, 1.6), [0xb8a07a, 0x9c8a6a])); }
  for (let i = 0; i < 30; i++) { const x = B.R(-95, 0), z = B.R(-95, 95), st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st)); }
  for (let i = 0; i < 40; i++) { const x = B.R(-100, 0), z = B.R(-100, 100), s = B.R(0.8, 2.4); B.mirror(x, z, s + 0.5, (px, pz) => B.rock(px, pz, s, [0x8f8a7c, 0x7d796d, 0xa29c8a])); }
  for (let i = 0, n = 0; i < 900 && n < 90; i++) { const x = B.R(-100, 0), z = B.R(-100, 100);
    if (B.mirror(x, z, 1.5, (px, pz) => B.tree(px, pz, heightAt(px, pz) < 1.3 ? 'palm' : 'leaf'))) n++; }
  B.mountains(world.half + 150, world.half + 200, [0x6e8270, 0x7f8f78], 30, 70);
}
function buildDowntown(B) {
  B.fence(5, 0x6d7276);
  const blocks = [-105, -75, -45, -15, 15, 45, 75, 105];
  for (const bx of blocks) for (const bz of blocks) {
    if (bx > 0) continue;
    if (Math.abs(bx) === 15 && Math.abs(bz) === 15) continue; // plaza
    if (B.r() < 0.12) continue;
    if (B.r() < 0.55) {
      const w = B.R(12, 17), d = B.R(12, 17), h = B.R(12, 28), c = B.pick(TOWERS);
      B.mirror(bx, bz, 1, (px, pz) => B.building(px, pz, w, d, h, false, [c], true));
    } else {
      const w = B.R(7, 9), d = B.R(14, 17), h = B.R(3.6, 5.5), st = B.r() < 0.7, c = B.pick(WALLS), off = B.R(4, 5.5);
      B.mirror(bx - off, bz, 1, (px, pz) => B.building(px, pz, w, d, h, st, [c], true));
      const cs = B.r() < 0.5;
      B.mirror(bx + off + 1.5, bz + B.R(-3, 3), 1.2, (px, pz) => B.crate(px, pz, cs));
    }
  }
  B.rock(0, 0, 2.2, [0x9aa0a4]);
  for (const [x, z, l, al] of [[-9, -6, 5, true], [-6, 9, 4, false], [-12, 4, 3, false]]) B.mirror(x, z, 0.3, (px, pz) => B.wall(px, pz, l, al, 1.0, CONCRETE));
  const streets = [-90, -60, -30, 0, 30, 60, 90];
  for (let i = 0, n = 0; i < 300 && n < 26; i++) {
    const onX = B.r() < 0.5, s = B.pick(streets), t = B.R(-110, 110), lane = B.pick([-2.4, 2.4]);
    const x = onX ? t : s + lane, z = onX ? s + lane : t, col = B.pick(CARS);
    if (x > 4) continue;
    if (B.mirror(x, z, 2.6, (px, pz) => B.car(px, pz, onX, col))) n++;
  }
  for (const s of streets) for (let t = -105; t <= 105; t += 30) B.mirror(s + 4.6, t, 0.4, (px, pz) => B.lamp(px, pz));
  for (let i = 0; i < 30; i++) { const s = B.pick(streets), t = B.R(-110, 0), onX = B.r() < 0.5, l = B.R(2.5, 4);
    const x = onX ? t : s + B.R(-3, 3), z = onX ? s + B.R(-3, 3) : t;
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, !onX, 1.05, [0xd8d3c4, 0xc9a23a])); }
  B.mountains(world.half + 120, world.half + 170, [0x7a858c, 0x8a9399], 30, 60);
}

// Frontier: the big one. Towns joined by dirt roads, a tank farm, a container yard, forests between.
const FRONTIER_TOWNS = [[0, 0, 1.25], [-190, -150, 1], [200, -170, 1], [-210, 170, 1], [185, 190, 1], [10, -245, 0.8], [-262, 8, 0.8], [262, 22, 0.8], [-5, 240, 0.8]];
const FRONTIER_ROADS = [];
for (let i = 1; i < FRONTIER_TOWNS.length; i++) FRONTIER_ROADS.push([0, 0, FRONTIER_TOWNS[i][0], FRONTIER_TOWNS[i][1]]);
FRONTIER_ROADS.push([-190, -150, 10, -245], [200, -170, 10, -245], [-210, 170, -5, 240], [185, 190, -5, 240], [-262, 8, -210, 170], [262, 22, 200, -170]);
function roadDist(x, z) {
  let best = 1e9;
  for (const [ax, az, bx, bz] of FRONTIER_ROADS) {
    const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
function buildFrontier(B) {
  B.fence(4, 0x8a8478);
  for (const [tx, tz, k] of FRONTIER_TOWNS) {
    const n = Math.round(10 * k);
    for (let i = 0, made = 0; i < 80 && made < n; i++) {
      const x = tx + B.R(-34, 34) * k, z = tz + B.R(-34, 34) * k;
      if (roadDist(x, z) < 9) continue;
      const h = B.r() < 0.45 ? B.R(3.4, 4.6) : B.R(5, 10), w = B.R(8, 13), d = B.R(8, 13);
      if (B.building(x, z, w, d, h, h < 7 && B.r() < 0.6)) made++;
    }
    for (let i = 0; i < 14 * k; i++) { const x = tx + B.R(-40, 40), z = tz + B.R(-40, 40); if (isClear(x, z, 1)) B.crate(x, z, B.r() < 0.35); }
    for (let i = 0; i < 10 * k; i++) { const x = tx + B.R(-45, 45), z = tz + B.R(-45, 45), l = B.R(3, 7), al = B.r() < 0.5; if (isClear(x, z, l / 2 + 0.5)) B.wall(x, z, l, al, B.R(1.1, 1.4)); }
    for (let i = 0; i < 6 * k; i++) { const x = tx + B.R(-30, 30), z = tz + B.R(-30, 30); if (roadDist(x, z) < 6 && isClear(x, z, 2.6)) B.car(x, z, B.r() < 0.5, B.pick(CARS)); }
  }
  for (const [x, z, r, h] of [[110, 40, 8, 10], [128, 22, 6, 8], [96, 62, 7, 9], [134, 60, 5, 7]]) if (isClear(x, z, r + 1)) B.tank(x, z, r, h, 0xd3d6d2);
  B.pipes(116, 82, 30, true);
  for (let i = 0, n = 0; i < 200 && n < 18; i++) { const x = -120 + B.R(-30, 30), z = -30 + B.R(-30, 30), al = B.r() < 0.6;
    if (isClear(x, z, 7)) { B.container(x, z, al, B.r() < 0.5 ? 6 : 12, B.r() < 0.5 ? 1 : 2, B.pick(BOXCOL)); n++; } }
  B.crane(-120, 10);
  for (const [x, z] of [[60, -90], [-90, 90], [150, -40], [-150, -60]]) if (isClear(x, z, 3)) B.mast(x, z, 24);
  for (let k = 0; k < 14; k++) {
    const cx = B.R(-290, 290), cz = B.R(-290, 290);
    for (let i = 0; i < 45; i++) { const x = cx + B.R(-40, 40), z = cz + B.R(-40, 40); if (roadDist(x, z) > 7 && isClear(x, z, 1.6)) B.tree(x, z, B.r() < 0.5 ? 'pine' : 'leaf'); }
  }
  for (let i = 0; i < 260; i++) { const x = B.R(-300, 300), z = B.R(-300, 300); if (roadDist(x, z) > 8 && isClear(x, z, 1.6)) B.tree(x, z, 'leaf'); }
  for (let i = 0; i < 160; i++) { const x = B.R(-300, 300), z = B.R(-300, 300), s = B.R(0.8, 3); if (roadDist(x, z) > 7 && isClear(x, z, s + 0.5)) B.rock(x, z, s); }
  for (let i = 0; i < 120; i++) { const x = B.R(-300, 300), z = B.R(-300, 300), l = B.R(3, 7), al = B.r() < 0.5; if (roadDist(x, z) > 7 && isClear(x, z, l / 2 + 0.5)) B.wall(x, z, l, al, B.R(1.0, 1.4), [0x8f8b80, 0x9e9888]); }
  B.mountains(world.half + 60, world.half + 120, [0x7f8c6d, 0x8a8f86, 0x9a9a8c], 45, 90);
}
/* ---------- Red Canyon: a long gorge between red cliffs, ruins and rock arches ---------- */
function canyonH(x, z) {
  const wall = sstep(22, 46, Math.abs(z + 9 * Math.sin(x * 0.03))) * 16;
  return wall + 0.9 * Math.sin(x * 0.07) * Math.cos(z * 0.09) + 0.5 * Math.cos(x * 0.13 + z * 0.05);
}
function buildCanyon(B) {
  const RED = [0xb05a3c, 0xa14f33, 0xc0704c, 0x8f4a30];
  for (const [x, w, d, h] of [[-80, 8, 7, 3.4], [-55, 9, 7, 5.5], [-30, 7, 7, 3.2], [-12, 10, 8, 4.2], [-100, 7, 6, 3.4]])
    B.mirror(x, B.R(-8, 8), Math.max(w, d) / 2 + 1, (px, pz) => B.building(px, pz, w, d, h, h > 4, ADOBE, true));
  // arches: two pillars and a span you can walk under
  for (const x of [-68, -22]) B.mirror(x, 0, 2, (px, pz) => { const g = heightAt(px, pz); B.box(px, pz - 9, 3, 3, 9, 0xa65638); B.box(px, pz + 9, 3, 3, 9, 0xa65638); B.box(px, pz, 3.2, 21, 2.4, 0xb4603f, { base: g + 8 }); });
  for (let i = 0; i < 70; i++) { const x = B.R(-108, 0), z = B.R(-26, 26), s = B.R(0.8, 3.2); B.mirror(x, z, s + 0.5, (px, pz) => B.rock(px, pz, s, RED)); }
  for (let i = 0; i < 40; i++) { const x = B.R(-108, 0), z = B.R(-24, 24), l = B.R(2.5, 6), al = B.r() < 0.6;
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, B.R(1.0, 1.6), [0xc49470, 0xb07f5c])); }
  for (let i = 0; i < 30; i++) { const x = B.R(-108, 0), z = B.R(-22, 22), st = B.r() < 0.35; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st, [0x8a6a43, 0x6e5a3e])); }
  for (let i = 0, n = 0; i < 600 && n < 26; i++) { const x = B.R(-108, 0), z = B.R(-24, 24); if (B.mirror(x, z, 1.2, (px, pz) => B.tree(px, pz, 'palm'))) n++; }
  // rocks scattered on the rims, for snipers
  for (let i = 0; i < 40; i++) { const x = B.R(-108, 0), z = B.R(36, 100) * (B.r() < 0.5 ? 1 : -1), s = B.R(1, 3.4); B.mirror(x, z, s + 0.5, (px, pz) => B.rock(px, pz, s, RED)); }
  B.mountains(world.half + 90, world.half + 150, [0xa75b3d, 0xb86c48, 0x92503a], 35, 75);
}

/* ---------- Airfield: a runway, hangars, a control tower and parked planes ---------- */
function plane(B, x, z, along, col) {
  const g = heightAt(x, z), L = 13, sx = along ? L : 1.9, sz = along ? 1.9 : L;
  B.box(x, z, sx, sz, 1.9, col, { base: g + 0.9 });                                       // fuselage
  B.box(x, z, along ? 2.6 : 14, along ? 14 : 2.6, 0.28, col, { base: g + 1.9 });            // wings
  const tx = along ? x - L / 2 + 0.8 : x, tz = along ? z : z - L / 2 + 0.8;
  B.box(tx, tz, along ? 1.4 : 5, along ? 5 : 1.4, 0.22, col, { base: g + 2.6 });             // tail plane
  B.box(tx, tz, along ? 1.6 : 0.25, along ? 0.25 : 1.6, 2.2, col, { base: g + 2.8 });        // fin
  B.inst.win.push({ p: [along ? x + L / 2 - 1.6 : x, g + 2.5, along ? z : z + L / 2 - 1.6], s: [along ? 1.6 : 1.7, 0.5, along ? 1.7 : 1.6], c: 0x23313b });
  for (const o of [-2.2, 2.2]) B.inst.wheel.push({ p: [along ? x + 1 : x + o, g + 0.4, along ? z + o : z + 1], s: [0.4, 0.3, 0.4], c: 0x1c1e20, r: along ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2] });
}
function buildAirfield(B) {
  B.fence(3.4, 0x9aa0a4);
  // control tower in the middle, south of the runway
  const g = heightAt(0, 24);
  const tw = B.building(0, 24, 5, 5, 14, true, CONCRETE, true);
  B.box(0, 24, 8, 8, 3.2, 0x6f7a84, { base: tw.maxY });
  B.inst.win.push({ p: [0, tw.maxY + 1.7, 24], s: [8.1, 1.6, 8.1], c: 0x2a3d4c });
  // hangars along both sides
  for (const [x, z] of [[-90, -42], [-50, -42], [-110, 40], [-62, 46]])
    B.mirror(x, z, 13, (px, pz) => { const h = B.building(px, pz, 24, 16, 8.5, false, [0x8a949a, 0x7d878e], true);
      B.inst.win.push({ p: [px, h.ground + 3.4, pz + (pz > 0 ? -8.06 : 8.06)], s: [16, 6.8, 0.1], c: 0x30363b }); });
  for (let i = 0, n = 0; i < 200 && n < 5; i++) { const x = B.R(-115, -15), z = B.R(-10, 10) + (B.r() < 0.5 ? 26 : -26), col = B.pick([0xd8dcdf, 0xb8c0c6, 0x8d9aa4, 0x6f7f5c]);
    if (B.mirror(x, z, 8, (px, pz) => plane(B, px, pz, true, col))) n++; }
  for (const [x, z, r, h] of [[-120, 75, 5, 6], [-108, 78, 4, 5]]) B.mirror(x, z, r + 1, (px, pz) => B.tank(px, pz, r, h, 0xd3d6d2));
  for (let i = 0, n = 0; i < 200 && n < 8; i++) { const x = B.R(-120, -10), z = B.R(50, 120) * (B.r() < 0.5 ? 1 : -1), al = B.r() < 0.5, col = B.pick(BOXCOL);
    if (B.mirror(x, z, 5, (px, pz) => B.container(px, pz, al, 6, B.r() < 0.5 ? 1 : 2, col))) n++; }
  for (let i = 0; i < 46; i++) { const x = B.R(-120, -4), z = B.R(-124, 124); if (Math.abs(z) < 16) continue; const l = B.R(2.5, 5), al = B.r() < 0.5;
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, 1.1, [0xc9c3b2, 0xd9b84a])); }
  for (let i = 0; i < 36; i++) { const x = B.R(-120, -4), z = B.R(-124, 124); if (Math.abs(z) < 14) continue; const st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st)); }
  for (let t = -120; t <= 120; t += 20) B.mirror(t, 15.5, 0.4, (px, pz) => B.lamp(px, pz));
  for (let i = 0, n = 0; i < 400 && n < 40; i++) { const x = B.R(-128, 0), z = B.R(70, 128) * (B.r() < 0.5 ? 1 : -1); if (B.mirror(x, z, 1.6, (px, pz) => B.tree(px, pz, 'leaf'))) n++; }
  B.mountains(world.half + 120, world.half + 170, [0x7f8c6d, 0x8a8f86], 25, 55);
}

/* ---------- Quarry: a stepped open pit with machinery on the benches ---------- */
function quarryH(x, z) {
  const r = Math.hypot(x, z);
  if (r > 74) return 0.6 * Math.sin(x * 0.05) * Math.cos(z * 0.06);
  const t = (74 - r) / 10, k = Math.floor(t), f = t - k;
  return -2.6 * (Math.min(k, 5) + (k < 5 ? sstep(0.78, 1, f) : 0));
}
function buildQuarry(B) {
  const STONE = [0xa39e94, 0x8f8a80, 0xb4aea2];
  // machinery: "dump trucks", conveyors, sheds on the benches
  for (const [x, z] of [[-30, 10], [-52, -20], [-14, -44], [-60, 28]]) B.mirror(x, z, 4, (px, pz) => {
    const g = heightAt(px, pz); B.box(px, pz, 6, 3.2, 2.4, 0xd19a2e, { base: g + 0.9 }); B.box(px + 2, pz, 2, 3, 1.6, 0x3b4148, { base: g + 3.3 });
    for (const a of [-2, 2]) for (const b of [-1.4, 1.4]) B.inst.wheel.push({ p: [px + a, g + 0.75, pz + b], s: [0.75, 0.5, 0.75], c: 0x1c1e20, r: [Math.PI / 2, 0, 0] }); });
  B.mirror(-40, 0, 2, (px, pz) => B.pipes(px, pz, 24, false));
  for (const [x, z, w, d, h] of [[-88, -20, 9, 7, 4.2], [-80, 30, 10, 8, 3.6], [-95, 70, 8, 8, 3.4], [-70, -80, 9, 7, 5.5]])
    B.mirror(x, z, Math.max(w, d) / 2 + 1, (px, pz) => B.building(px, pz, w, d, h, h > 4, CONCRETE, true));
  for (const [x, z] of [[-84, 0], [-60, 84]]) B.mirror(x, z, 6, (px, pz) => B.crane(px, pz));
  for (let i = 0; i < 90; i++) { const x = B.R(-100, 0), z = B.R(-100, 100), s = B.R(0.8, 2.8); B.mirror(x, z, s + 0.5, (px, pz) => B.rock(px, pz, s, STONE)); }
  for (let i = 0; i < 40; i++) { const x = B.R(-100, 0), z = B.R(-100, 100), l = B.R(2.5, 5), al = B.r() < 0.5; B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, 1.1, [0xd9b84a, 0x9b9585])); }
  for (let i = 0; i < 34; i++) { const x = B.R(-100, 0), z = B.R(-100, 100), st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st)); }
  for (let i = 0, n = 0; i < 400 && n < 50; i++) { const x = B.R(-100, 0), z = B.R(-100, 100); if (Math.hypot(x, z) < 80) continue; if (B.mirror(x, z, 1.6, (px, pz) => B.tree(px, pz, 'pine'))) n++; }
  B.mountains(world.half + 90, world.half + 150, [0x8a8f86, 0x9a9a8c, 0x7f8478], 30, 65);
}

/* ---------- Bayou: swamp water, islands, stilt shacks and boardwalks ---------- */
function bayouH(x, z) {
  return 0.9 * Math.sin(x * 0.045) * Math.sin(z * 0.05) + 0.6 * Math.cos(x * 0.09) * Math.cos(z * 0.08) + 0.35 - 0.3 * sstep(60, 110, Math.max(Math.abs(x), Math.abs(z)));
}
function buildBayou(B) {
  const SHACK = [0x7a6a52, 0x6b5e4a, 0x8a7a60, 0x5f6b55];
  // shacks on stilts: a wooden box raised off the water, with steps up
  for (const [x, z, w, d] of [[-20, -10, 7, 6], [-45, 30, 8, 6], [-70, -40, 7, 7], [-30, 70, 8, 6], [-85, 20, 7, 6], [-55, -80, 8, 7], [-10, 40, 6, 6]])
    B.mirror(x, z, Math.max(w, d) / 2 + 2, (px, pz) => {
      const g = Math.max(heightAt(px, pz), world.water) ;
      for (const a of [-1, 1]) for (const b of [-1, 1]) B.box(px + a * (w / 2 - 0.3), pz + b * (d / 2 - 0.3), 0.35, 0.35, 1.6, 0x4b3a2a);
      const hut = B.box(px, pz, w, d, 3.2, B.pick(SHACK), { base: g + 1.4 });
      B.inst.roof.push({ p: [px, hut.maxY + 0.9, pz], s: [(w / 2 + 0.6) / 0.7071, 1.8, (d / 2 + 0.6) / 0.7071], c: 0x4a3a2c, r: [0, Math.PI / 4, 0] });
      hut.maxY += 1.1; hut.box3.max.y = hut.maxY;
      B.inst.win.push({ p: [px, g + 2.6, pz + d / 2 + 0.05], s: [1.2, 1.8, 0.1], c: 0x2a2520 });
      for (let i = 0; i < 3; i++) B.box(px - 0.8 + 0, pz + d / 2 + 0.7 + i * 0.9, 1.6, 0.9, 0, 0x6b5238, { top: g + 1.4 - i * 0.5 });
    });
  // boardwalks across the water
  for (let i = 0, n = 0; i < 200 && n < 14; i++) { const x = B.R(-100, -5), z = B.R(-100, 100), al = B.r() < 0.5, l = B.R(8, 18);
    if (B.mirror(x, z, l / 2 + 0.5, (px, pz) => { const g = Math.max(heightAt(px, pz), world.water); B.box(px, pz, al ? l : 2, al ? 2 : l, 0, 0x7a5f40, { top: g + 0.35, base: g - 0.4 }); })) n++; }
  for (let i = 0, n = 0; i < 1600 && n < 200; i++) { const x = B.R(-110, 0), z = B.R(-110, 110); if (heightAt(x, z) < world.water + 0.15) continue;
    if (B.mirror(x, z, 1.6, (px, pz) => B.tree(px, pz, B.r() < 0.3 ? 'pine' : 'leaf'))) n++; }
  for (let i = 0; i < 40; i++) { const x = B.R(-105, 0), z = B.R(-105, 105), s = B.R(0.6, 1.8); B.mirror(x, z, s + 0.5, (px, pz) => B.rock(px, pz, s, [0x5f6455, 0x6b6e5e])); }
  for (let i = 0; i < 30; i++) { const x = B.R(-105, 0), z = B.R(-105, 105), st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st, [0x6e5a3e, 0x5f6b45])); }
  for (let i = 0; i < 26; i++) { const x = B.R(-105, 0), z = B.R(-105, 105), l = B.R(3, 6), al = B.r() < 0.5; B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, B.R(0.9, 1.2), [0x5a4a36, 0x6b5a44])); }
  B.mountains(world.half + 110, world.half + 160, [0x56664c, 0x627258], 25, 50);
}
/* ---------- Railyard: four tracks of boxcars, a station, a water tower ---------- */
const RAIL_Z = [-15, -5, 5, 15];
function buildRailyard(B) {
  const H = world.half;
  for (const tz of RAIL_Z) for (const o of [-0.72, 0.72]) B.inst.win.push({ p: [0, heightAt(0, tz) + 0.1, tz + o], s: [H * 2, 0.14, 0.12], c: 0x7b7d80 });
  // boxcars sitting on the tracks, wheels and all
  const CARS = [0x8a3b2a, 0x6b4a2e, 0x3d5a6b, 0x5a6b3d, 0x7a7f86, 0xa8672e];
  for (let i = 0, n = 0; i < 300 && n < 22; i++) {
    const x = B.R(-H + 12, -4), tz = B.pick(RAIL_Z), col = B.pick(CARS), L = B.r() < 0.5 ? 12 : 9;
    if (B.mirror(x, tz, L / 2 + 0.8, (px, pz) => {
      const g = heightAt(px, pz), car = B.box(px, pz, L, 2.8, 2.9, col, { base: g + 0.95 });
      B.inst.win.push({ p: [px, g + 2.2, pz + 1.43], s: [2.4, 2.2, 0.06], c: 0x2a2d31 }); B.inst.win.push({ p: [px, g + 2.2, pz - 1.43], s: [2.4, 2.2, 0.06], c: 0x2a2d31 });
      for (const a of [-L / 2 + 1.4, L / 2 - 1.4]) for (const b of [-0.72, 0.72]) B.inst.wheel.push({ p: [px + a, g + 0.45, pz + b], s: [0.45, 0.2, 0.45], c: 0x1c1e20, r: [Math.PI / 2, 0, 0] });
      return car; })) n++;
  }
  // the station and its platform
  B.mirror(0, 30, 11, (px, pz) => { B.building(px, pz, 22, 8, 5.2, true, [0xa38a66, 0x9a7f5e], true); });
  B.mirror(0, 21.5, 1, (px, pz) => B.box(px, pz, 44, 4, 0, 0x9aa0a4, { top: heightAt(px, pz) + 0.9 }));
  // water tower: legs and a tank up top
  B.mirror(-64, 32, 4, (px, pz) => { const g = heightAt(px, pz);
    for (const a of [-1.6, 1.6]) for (const b of [-1.6, 1.6]) B.box(px + a, pz + b, 0.4, 0.4, 9, 0x5a4a3a);
    B.inst.cyl.push({ p: [px, g + 11, pz], s: [3, 4, 3], c: 0x7a5a3c }); B.inst.cyl.push({ p: [px, g + 13.2, pz], s: [3.1, 0.4, 3.1], c: 0x4a3a2c }); });
  for (const [x, z] of [[-84, 38], [-40, 44], [-96, 62]]) B.mirror(x, z, 12, (px, pz) => B.building(px, pz, 20, 12, 7, false, CONCRETE, true));
  B.mirror(-24, 40, 6, (px, pz) => B.crane(px, pz));
  for (const x of [-90, -50, -10]) B.mirror(x, 0.1, 0.4, (px, pz) => B.mast(px, pz + (px < 0 ? 10 : -10), 7, 0x3b4045));
  for (let i = 0, n = 0; i < 200 && n < 10; i++) { const x = B.R(-100, -10), z = B.R(50, 100), al = B.r() < 0.6, col = B.pick(BOXCOL);
    if (B.mirror(x, z, 5, (px, pz) => B.container(px, pz, al, 6, B.r() < 0.5 ? 1 : 2, col))) n++; }
  for (let i = 0; i < 40; i++) { const x = B.R(-104, -4), z = B.R(-104, 104); if (Math.abs(z) < 19) continue; const l = B.R(2.5, 5), al = B.r() < 0.5;
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, 1.1, [0x9b9585, 0xd9b84a])); }
  for (let i = 0; i < 40; i++) { const x = B.R(-104, -4), z = B.R(-104, 104), st = B.r() < 0.35; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st)); }
  for (let t = -100; t <= 100; t += 25) B.mirror(t, 19.5, 0.4, (px, pz) => B.lamp(px, pz));
  for (let i = 0, n = 0; i < 400 && n < 40; i++) { const x = B.R(-108, 0), z = B.R(70, 108); if (B.mirror(x, z, 1.6, (px, pz) => B.tree(px, pz, 'leaf'))) n++; }
  B.mountains(world.half + 100, world.half + 150, [0x7a7f73, 0x8b8a7e], 25, 55);
}

/* ---------- Stronghold: a castle on a hill, a village around it ---------- */
function strongholdH(x, z) {
  const r = Math.hypot(x, z);
  return 7.5 * (1 - sstep(22, 62, r)) + 1.1 * Math.cos(x * 0.05) * Math.cos(z * 0.045) + 0.5 * Math.sin(x * 0.09 + z * 0.07);
}
function buildStronghold(B) {
  const STONE = [0x9a958a, 0x8b867c, 0xa8a397];
  const S = 19, top = heightAt(0, 0);
  // curtain walls with a gate in the middle of each side
  for (const sgn of [-1, 1]) for (const half of [-1, 1]) {
    B.box(half * (S / 2 + 3.5), sgn * S, S - 7, 1.6, 4.2, B.pick(STONE), { base: top - 1.2 });
    B.box(sgn * S, half * (S / 2 + 3.5), 1.6, S - 7, 4.2, B.pick(STONE), { base: top - 1.2 });
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) B.building(a * S, b * S, 5.5, 5.5, 10, true, STONE, true); // corner towers
  B.building(0, 0, 10, 10, 11, true, STONE, true); // the keep
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.2; B.crate(Math.cos(a) * 9, Math.sin(a) * 9, i % 3 === 0); }
  // the village below
  for (const [x, z, w, d, h] of [[-48, -60, 8, 7, 3.4], [-70, -30, 9, 7, 3.6], [-30, -82, 8, 6, 3.2], [-86, -64, 8, 8, 3.6], [-62, -92, 7, 7, 3.2], [-20, -58, 7, 6, 3.4], [-92, -18, 8, 7, 3.4]])
    B.mirror(x, z, Math.max(w, d) / 2 + 1.5, (px, pz) => B.cabin(px, pz, w, d, h, [0xc9b89a, 0xb8a684, 0xd6c6a6]));
  B.mirror(-60, -10, 3, (px, pz) => B.building(px, pz, 3.6, 3.6, 8.5, true, STONE, true));
  for (let i = 0; i < 50; i++) { const x = B.R(-105, 105), z = B.R(-105, -30), l = B.R(3, 8), al = B.r() < 0.5;
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, B.R(0.9, 1.3), [0x8f8a7c, 0x7d796d])); }
  for (let i = 0; i < 30; i++) { const x = B.R(-105, 105), z = B.R(-105, -28), st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st, [0x6e5a3e, 0x8a6a43])); }
  for (let i = 0; i < 40; i++) { const x = B.R(-105, 105), z = B.R(-105, -30), s = B.R(0.8, 2.4); B.mirror(x, z, s + 0.5, (px, pz) => B.rock(px, pz, s)); }
  for (let i = 0, n = 0; i < 800 && n < 120; i++) { const x = B.R(-108, 108), z = B.R(-108, -34); if (B.mirror(x, z, 1.6, (px, pz) => B.tree(px, pz, B.r() < 0.5 ? 'pine' : 'leaf'))) n++; }
  B.mountains(world.half + 90, world.half + 150, [0x6c7b62, 0x7f8a75, 0x8a8f86], 35, 75);
}

/* ---------- Suburbs: streets of houses with yards, a school, a park ---------- */
const suburbStreet = v => Math.abs(v - Math.round(v / 40) * 40);
function buildSuburbs(B) {
  const HOUSE = [0xd8cfc0, 0xc9b8a0, 0xb8c4c8, 0xd6c6a6, 0xc4a98a, 0xa8b89a, 0xe0d6c4];
  B.fence(3, 0x8d9095);
  // houses on the lots between streets, each with a low yard fence
  for (const bx of [-100, -60, -20]) for (const bz of [-100, -60, -20, 20, 60, 100]) for (const [ox, oz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
    if (B.r() < 0.18) continue;
    const x = bx + ox + B.R(-1.5, 1.5), z = bz + oz + B.R(-1.5, 1.5), w = B.R(7, 9.5), d = B.R(6.5, 8.5), h = B.R(3, 3.6), col = B.pick(HOUSE);
    B.mirror(x, z, Math.max(w, d) / 2 + 0.6, (px, pz) => B.cabin(px, pz, w, d, h, [col]));
    const al = B.r() < 0.5;
    B.mirror(x + (al ? 0 : (ox > 0 ? 6 : -6)), z + (al ? (oz > 0 ? 6 : -6) : 0), 4, (px, pz) => B.wall(px, pz, B.R(5, 8), al, 0.9, [0xe8e4d8, 0x8a6a4a]));
  }
  // a school and a park
  B.mirror(-40, 0, 12, (px, pz) => B.building(px, pz, 22, 14, 6.5, true, [0xb5452f, 0xa8492f], true));
  for (let i = 0, n = 0; i < 300 && n < 30; i++) { const x = B.R(-16, 16), z = B.R(-16, 16); if (Math.hypot(x, z) < 4) continue; if (B.mirror(x, z, 1.6, (px, pz) => B.tree(px, pz, 'leaf'))) n++; }
  B.rock(0, 0, 1.4, [0x9aa0a4]);
  for (let i = 0, n = 0; i < 400 && n < 30; i++) {
    const onX = B.r() < 0.5, s = B.pick([-80, -40, 0, 40, 80]), t = B.R(-115, 0), lane = B.pick([-2.2, 2.2]);
    const x = onX ? t : s + lane, z = onX ? s + lane : t;
    if (B.mirror(x, z, 2.6, (px, pz) => B.car(px, pz, onX, B.pick(CARS)))) n++;
  }
  for (const s of [-80, -40, 0, 40, 80]) for (let t = -110; t <= 0; t += 30) B.mirror(s + 4.2, t, 0.4, (px, pz) => B.lamp(px, pz));
  for (let i = 0; i < 26; i++) { const x = B.R(-115, 0), z = B.R(-115, 115), st = B.r() < 0.3; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st, [0x8a6a43, 0x6e7a8a])); }
  B.mountains(world.half + 100, world.half + 160, [0x7f8c6d, 0x8a8f86], 25, 50);
}

/* ---------- Polar Station: research modules, radar masts, a frozen lake ---------- */
function polarH(x, z) {
  const r = Math.hypot(x, z);
  return r < 26 ? -0.6 : 1.6 * Math.sin(x * 0.04) * Math.cos(z * 0.035) * sstep(26, 50, r) + 0.6 * Math.cos(x * 0.1 + z * 0.06) * sstep(26, 50, r) - 0.6 * (1 - sstep(26, 34, r));
}
function buildPolar(B) {
  const WHITE = [0xdfe4e8, 0xcfd6dc, 0xe8ecef], ORANGE = 0xd9662b;
  // modules: long low huts on legs, linked to fuel tanks
  for (const [x, z, w, d] of [[-46, -12, 14, 6], [-58, 20, 12, 6], [-34, 40, 10, 7], [-74, -34, 12, 6], [-40, -50, 9, 9], [-86, 8, 8, 8]])
    B.mirror(x, z, Math.max(w, d) / 2 + 1.2, (px, pz) => { const b = B.building(px, pz, w, d, 3.4, true, B.r() < 0.4 ? [ORANGE] : WHITE, true); if (b) B.inst.win.push({ p: [px, b.maxY + 0.1, pz], s: [w * 0.9, 0.2, d * 0.9], c: 0x8d9aa4 }); });
  for (const [x, z, r, h] of [[-62, -4, 3, 4], [-30, 18, 2.5, 3.5], [-50, 48, 3.5, 4.5]]) B.mirror(x, z, r + 1, (px, pz) => B.tank(px, pz, r, h, B.r() < 0.5 ? 0xe8ecef : ORANGE));
  for (const [x, z] of [[-70, 44], [-26, -36], [-92, -50]]) B.mirror(x, z, 3, (px, pz) => B.mast(px, pz, 20, 0xc0392b));
  for (let i = 0, n = 0; i < 200 && n < 8; i++) { const x = B.R(-95, -30), z = B.R(-95, 95), al = B.r() < 0.5;
    if (B.mirror(x, z, 5, (px, pz) => B.container(px, pz, al, 6, 1, B.pick([ORANGE, 0x2f6fa8, 0xa8b3b8])))) n++; }
  for (let i = 0; i < 40; i++) { const x = B.R(-98, -2), z = B.R(-98, 98); if (Math.hypot(x, z) < 30) continue; const l = B.R(3, 6), al = B.r() < 0.5, h = B.R(1.0, 1.4);
    B.mirror(x, z, l / 2 + 0.6, (px, pz) => B.wall(px, pz, l, al, h, [0xc8d0d6, 0xb0b9c0])); }
  for (let i = 0; i < 26; i++) { const x = B.R(-98, -2), z = B.R(-98, 98), st = B.r() < 0.3; if (Math.hypot(x, z) < 28) continue; B.mirror(x, z, 1, (px, pz) => B.crate(px, pz, st, [0x5f6b45, 0xd9662b])); }
  for (let i = 0; i < 40; i++) { const x = B.R(-100, 0), z = B.R(-100, 100), s = B.R(0.8, 2.6); if (Math.hypot(x, z) < 30) continue; B.mirror(x, z, s + 0.5, (px, pz) => B.rock(px, pz, s, [0x80888e, 0x6f777d])); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 14, z = Math.sin(a) * 14; if (isClear(x, z, 1)) B.crate(x, z, false, [0x5f6b45]); }
  for (let i = 0, n = 0; i < 500 && n < 60; i++) { const x = B.R(-100, 0), z = B.R(-100, 100); if (Math.hypot(x, z) < 36) continue; if (B.mirror(x, z, 1.6, (px, pz) => B.tree(px, pz, 'snow'))) n++; }
  B.mountains(world.half + 50, world.half + 90, [0xdfe6ec, 0xc5ced5, 0xa9b3bb], 40, 80);
}
const streetDist = v => Math.abs(v - Math.round(v / 30) * 30);
const MAPS = {
  valley: { name: 'Valley', blurb: 'Huge open valley, town in the middle', half: 200, axis: 'x', sky: 0xb4ccd8, fog: [80, 340], hemi: [0xdcefff, 0x5d6b3c, 0.78], sun: [0xfff0d4, 0.9],
    h: (x, z) => 2.4 * Math.sin(x * 0.028) * Math.cos(z * 0.022) + 1.1 * Math.sin(x * 0.061 + z * 0.047) + 0.6 * Math.cos(z * 0.09 - x * 0.02),
    ground: (c, h, n) => h < -2.6 ? c.setHex(0xbcae84) : c.setHSL(0.22 + n * 0.05, 0.32, 0.34 + n * 0.05 + h * 0.012),
    build: buildValley, mtn: true, grass: 5000 },
  docks: { name: 'Dockyard', blurb: 'Container stacks and cranes, medium size', half: 90, axis: 'x', sky: 0xbfcbd3, fog: [55, 250], hemi: [0xe0ecf5, 0x5b6066, 0.8], sun: [0xfff4e2, 0.9],
    h: (x, z) => Math.max(Math.abs(x), Math.abs(z)) > 92 ? -2.4 : 0.1 * Math.sin(x * 0.21) * Math.cos(z * 0.19),
    ground: (c, h, n) => h < -1 ? c.setHSL(0.1, 0.2, 0.3) : c.setHSL(0.58, 0.05, 0.36 + n * 0.05),
    build: buildDocks, water: -0.7 },
  sandline: { name: 'Sandline', blurb: 'Tight desert town with flat roofs', half: 75, axis: 'z', sky: 0xdfd3ba, fog: [45, 230], hemi: [0xfff1d8, 0x9c7f55, 0.85], sun: [0xffe4b8, 1.0],
    h: (x, z) => 0.8 * Math.sin(x * 0.045) * Math.cos(z * 0.05) + 0.35 * Math.sin(x * 0.13 + z * 0.09),
    ground: (c, h, n) => c.setHSL(0.09, 0.36, 0.5 + n * 0.05 + h * 0.02),
    build: buildSandline },
  frost: { name: 'Frostbite', blurb: 'Snowy hills, pines and bunkers', half: 110, axis: 'x', sky: 0xcfd9e2, fog: [35, 220], hemi: [0xeef5ff, 0x8da0b0, 0.85], sun: [0xf2f6ff, 0.85],
    h: (x, z) => 3.4 * Math.sin(x * 0.03) * Math.cos(z * 0.027) + 1.2 * Math.sin(x * 0.07 - z * 0.05),
    ground: (c, h, n) => c.setHSL(0.58, 0.18, Math.min(0.92, 0.8 + n * 0.06 + h * 0.008)),
    build: buildFrost, snow: true },
  pit: { name: 'The Pit', blurb: 'Small walled arena, great for 1v1', half: 36, axis: 'x', sky: 0xa9bac5, fog: [60, 200], hemi: [0xdde8f0, 0x6b5a45, 0.8], sun: [0xfff0d4, 0.95],
    h: () => 0, ground: (c, h, n) => c.setHSL(0.09, 0.25, 0.36 + n * 0.06),
    build: buildPit },
  refinery: { name: 'Refinery', blurb: 'Fuel tanks, pipe racks and a flare stack', half: 100, axis: 'x', sky: 0xc9c6b8, fog: [50, 250], hemi: [0xf0ebdc, 0x6b6450, 0.8], sun: [0xffe9c8, 0.95],
    h: (x, z) => 0.25 * Math.sin(x * 0.05) * Math.cos(z * 0.04),
    ground: (c, h, n) => c.setHSL(0.1, 0.1, 0.36 + n * 0.06),
    build: buildRefinery },
  timber: { name: 'Timberline', blurb: 'Thick forest, cabins and lookout towers', half: 120, axis: 'z', sky: 0xb6c9cf, fog: [30, 200], hemi: [0xdbeadf, 0x4d5a36, 0.78], sun: [0xfff0d0, 0.85],
    h: (x, z) => 3.0 * Math.cos(x * 0.026) * Math.cos(z * 0.031) + 1.3 * Math.cos(x * 0.071 + z * 0.052),
    ground: (c, h, n) => c.setHSL(0.24 + n * 0.04, 0.34, 0.27 + n * 0.05 + h * 0.01),
    build: buildTimber, grass: 6000 },
  atoll: { name: 'Atoll', blurb: 'Island fort ringed by beach and shallow water', half: 110, axis: 'x', sky: 0xb2d4e2, fog: [70, 320], hemi: [0xe6f6ff, 0x7b8a5a, 0.85], sun: [0xfff3d6, 1.0],
    h: (x, z) => { const r = Math.hypot(x, z), land = 1 - sstep(64, 98, r); return land * (1.4 + 1.1 * Math.cos(x * 0.05) * Math.cos(z * 0.045) + 0.5 * Math.cos(x * 0.11 + z * 0.07) + 1.4 * (1 - r / 98)) - (1 - land) * 1.4; },
    ground: (c, h, n) => h < -0.25 ? c.setHSL(0.11, 0.28, 0.42 + n * 0.04) : h < 1.1 ? c.setHSL(0.11, 0.45, 0.64 + n * 0.05) : c.setHSL(0.25 + n * 0.04, 0.4, 0.33 + n * 0.05),
    build: buildAtoll, water: -0.45, grass: 2500 },
  downtown: { name: 'Downtown', blurb: 'Tall towers, streets full of cars', half: 120, axis: 'x', sky: 0xbac6cc, fog: [45, 260], hemi: [0xe2ecf2, 0x5a5e62, 0.8], sun: [0xfff2dc, 0.95],
    h: () => 0, seg: 3,
    ground: (c, h, n, x, z) => (streetDist(x) < 5 || streetDist(z) < 5) ? c.setHSL(0.6, 0.05, 0.2 + n * 0.03) : c.setHSL(0.1, 0.06, 0.5 + n * 0.05),
    build: buildDowntown },
  frontier: { name: 'Frontier', blurb: 'The big one: nine towns, roads, forests', half: 320, axis: 'x', sky: 0xb7cdd8, fog: [110, 470], hemi: [0xdcefff, 0x5d6b3c, 0.8], sun: [0xfff0d4, 0.92],
    h: (x, z) => 4.2 * Math.sin(x * 0.011) * Math.cos(z * 0.013) + 1.8 * Math.sin(x * 0.031 + z * 0.024) + 0.7 * Math.cos(z * 0.07 - x * 0.02),
    ground: (c, h, n, x, z) => roadDist(x, z) < 4.5 ? c.setHSL(0.09, 0.22, 0.4 + n * 0.04) : c.setHSL(0.22 + n * 0.05, 0.3, 0.34 + n * 0.05 + h * 0.01),
    build: buildFrontier, grass: 9000, big: true },
  canyon: { name: 'Red Canyon', blurb: 'Long gorge between red cliffs, arches and ruins', half: 110, axis: 'x', sky: 0xe3c9a8, fog: [60, 280], hemi: [0xffe9cc, 0x8a4a30, 0.82], sun: [0xffd9a8, 1.0],
    h: canyonH,
    ground: (c, h, n) => h > 6 ? c.setHSL(0.04 + n * 0.02, 0.45, 0.4 + n * 0.05) : c.setHSL(0.07 + n * 0.02, 0.4, 0.5 + n * 0.05 + h * 0.01),
    build: buildCanyon, grass: 800, noGrass: (x, z) => canyonH(x, z) > 4 },
  airfield: { name: 'Airfield', blurb: 'Runway, hangars, a control tower and parked planes', half: 130, axis: 'x', sky: 0xb9cfdc, fog: [80, 330], hemi: [0xe2f0fa, 0x5f6b4a, 0.8], sun: [0xfff2d8, 0.95],
    h: (x, z) => Math.abs(z) < 18 ? 0 : 0.6 * Math.sin(x * 0.03) * Math.cos(z * 0.035) * sstep(18, 30, Math.abs(z)),
    ground: (c, h, n, x, z) => Math.abs(z) < 0.6 && ((x % 24) + 24) % 24 < 12 ? c.setHex(0xe8e4d8) : Math.abs(z) < 12 ? c.setHSL(0.6, 0.04, 0.24 + n * 0.03) : Math.abs(z) < 14 ? c.setHex(0xd9b84a) : c.setHSL(0.22 + n * 0.05, 0.3, 0.38 + n * 0.05),
    build: buildAirfield, grass: 4000, noGrass: (x, z) => Math.abs(z) < 15 },
  quarry: { name: 'Quarry', blurb: 'A stepped open pit with trucks on every ledge', half: 100, axis: 'x', sky: 0xc4ccd0, fog: [55, 260], hemi: [0xe8eef2, 0x6e6a60, 0.82], sun: [0xfff0d8, 0.95],
    h: quarryH,
    ground: (c, h, n) => h < -0.5 ? c.setHSL(0.09, 0.12, 0.5 + n * 0.06 + h * 0.008) : c.setHSL(0.2 + n * 0.05, 0.28, 0.36 + n * 0.05),
    build: buildQuarry, grass: 2500, noGrass: (x, z) => Math.hypot(x, z) < 76 },
  bayou: { name: 'Bayou', blurb: 'Swamp water, islands, shacks on stilts', half: 110, axis: 'z', sky: 0xa9b8a6, fog: [28, 190], hemi: [0xd8e4cc, 0x3f4a30, 0.75], sun: [0xf2e6c2, 0.8],
    h: bayouH,
    ground: (c, h, n) => h < 0.05 ? c.setHSL(0.15, 0.3, 0.26 + n * 0.04) : c.setHSL(0.2 + n * 0.05, 0.38, 0.27 + n * 0.05),
    build: buildBayou, water: 0.12, grass: 5000 },
  railyard: { name: 'Railyard', blurb: 'Four tracks of boxcars, a station and a water tower', half: 110, axis: 'x', sky: 0xbcc4c6, fog: [60, 270], hemi: [0xe6ecee, 0x5d5a50, 0.8], sun: [0xfff0d8, 0.92],
    h: (x, z) => Math.abs(z) < 20 ? 0 : 0.5 * Math.sin(x * 0.04) * Math.cos(z * 0.05) * sstep(20, 30, Math.abs(z)),
    ground: (c, h, n, x, z) => RAIL_Z.some(t => Math.abs(z - t) < 1.4) ? c.setHSL(0.07, 0.15, 0.3 + n * 0.04) : Math.abs(z) < 20 ? c.setHSL(0.08, 0.08, 0.45 + n * 0.05) : c.setHSL(0.22 + n * 0.05, 0.28, 0.36 + n * 0.05),
    build: buildRailyard, grass: 3000, noGrass: (x, z) => Math.abs(z) < 22 },
  stronghold: { name: 'Stronghold', blurb: 'A castle on a hill with a village below', half: 110, axis: 'z', sky: 0xb4c6d2, fog: [60, 280], hemi: [0xdfeaf2, 0x5d6b3c, 0.8], sun: [0xfff0d0, 0.92],
    h: strongholdH,
    ground: (c, h, n) => c.setHSL(0.23 + n * 0.05, 0.32, 0.32 + n * 0.05 + h * 0.008),
    build: buildStronghold, grass: 5000 },
  suburbs: { name: 'Suburbs', blurb: 'Streets of houses and yards, a school, a park', half: 120, axis: 'x', sky: 0xb8cfdc, fog: [55, 280], hemi: [0xe2f0fa, 0x5f6b4a, 0.82], sun: [0xfff2d8, 0.95],
    h: () => 0, seg: 3.5,
    ground: (c, h, n, x, z) => (suburbStreet(x) < 4 || suburbStreet(z) < 4) ? c.setHSL(0.6, 0.04, 0.24 + n * 0.03) : (suburbStreet(x) < 5.2 || suburbStreet(z) < 5.2) ? c.setHSL(0.1, 0.05, 0.62) : c.setHSL(0.24 + n * 0.04, 0.38, 0.38 + n * 0.05),
    build: buildSuburbs, grass: 3000, noGrass: (x, z) => suburbStreet(x) < 5.5 || suburbStreet(z) < 5.5 },
  polar: { name: 'Polar Station', blurb: 'Research huts and radar masts by a frozen lake', half: 100, axis: 'x', sky: 0xd4dee6, fog: [40, 230], hemi: [0xf2f7ff, 0x9aaab8, 0.88], sun: [0xf6f9ff, 0.9],
    h: polarH,
    ground: (c, h, n, x, z) => Math.hypot(x, z) < 27 ? c.setHSL(0.55, 0.35, 0.78 + n * 0.04) : c.setHSL(0.58, 0.16, Math.min(0.93, 0.82 + n * 0.06 + h * 0.01)),
    build: buildPolar, snow: true },
};
const MAP_IDS = Object.keys(MAPS);

function clearWorld() {
  for (const o of world.objs) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  world.objs = []; world.boxes = []; world.circles = []; world.shootables = []; world.cratePts = []; world.benchPts = []; world.vehPts = [];
}
function loadMap(id) {
  if (!MAPS[id]) id = 'valley';
  const M = MAPS[id];
  clearWorld();
  world.id = id; world.half = M.half; world.h = M.h; world.water = M.water == null ? null : M.water;
  const skyC = new THREE.Color(M.sky);
  skyMat.uniforms.hor.value.copy(skyC);
  skyMat.uniforms.top.value.copy(skyC).lerp(new THREE.Color(0x3c6ea6), M.snow ? 0.4 : 0.62);
  scene.fog.color.copy(skyC); scene.fog.near = M.fog[0]; scene.fog.far = M.fog[1];
  hemi.color.setHex(M.hemi[0]); hemi.groundColor.setHex(M.hemi[1]); hemi.intensity = M.hemi[2];
  sun.color.setHex(M.sun[0]); sun.intensity = M.sun[1];
  // terrain
  const size = M.half * 2 + 2 * Math.max(120, M.half * 0.6), seg = clamp(Math.round(size / (M.seg || 5.5)), 40, 170);
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
  const tm = detail(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 0, specular: 0x000000 }), M.snow ? 0.12 : 0.3, 0.8);
  const terrain = new THREE.Mesh(tg, tm);
  terrain.receiveShadow = true; scene.add(terrain); world.objs.push(terrain); world.shootables.push(terrain);
  if (world.water != null) {
    const wm = new THREE.MeshPhongMaterial({ color: 0x3d7f95, transparent: true, opacity: 0.8, shininess: 90, specular: 0x9fc3d2, depthWrite: false });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size), wm); water.rotation.x = -Math.PI / 2; water.position.y = world.water;
    water.receiveShadow = true; scene.add(water); world.objs.push(water);
  }
  // props
  const B = makeBuilder(hashStr(id));
  M.build(B);
  if (M.mtn) B.mountains(M.half * 1.25, M.half * 1.45, [0x7f8c6d, 0x8a8f86], 30, 60);
  // workbenches: a table, a pegboard and a lamp. Walk up and press E to change guns and mods.
  const nBench = clamp(Math.round(M.half / 45), 2, 10);
  for (let i = 0; i < 1200 && world.benchPts.length < nBench; i++) {
    const x = B.R(-M.half + 8, M.half - 8), z = B.R(-M.half + 8, M.half - 8);
    if (!isClear(x, z, 3)) continue;
    if (world.benchPts.some(([a, b]) => Math.hypot(a - x, b - z) < M.half * 0.5)) continue;
    const g = heightAt(x, z);
    B.box(x, z, 2.2, 0.95, 0.95, 0x6b4e34);
    B.box(x, z - 0.62, 2.2, 0.12, 1.25, 0x7d858b, { base: g + 0.95 });
    B.inst.win.push({ p: [x, g + 0.97, z], s: [2.24, 0.06, 0.99], c: 0x9b7b52 });
    B.inst.win.push({ p: [x - 0.6, g + 1.06, z + 0.1], s: [0.22, 0.14, 0.2], c: 0x2f3439 });
    B.inst.win.push({ p: [x + 0.3, g + 1.03, z + 0.05], s: [0.9, 0.07, 0.12], c: 0x24282c });
    B.inst.win.push({ p: [x, g + 2.32, z - 0.5], s: [1.4, 0.2, 0.2], c: 0xffb547 });
    world.benchPts.push([x, z]);
  }
  // vehicle parking spots, also by seed so every browser puts the same jeep in the same place
  const nVeh = M.half < 50 ? 0 : clamp(Math.round(M.half / 22), 3, 22);
  for (let i = 0; i < 1500 && world.vehPts.length < nVeh; i++) {
    const x = B.R(-M.half + 10, M.half - 10), z = B.R(-M.half + 10, M.half - 10);
    if (!isClear(x, z, 3.2)) continue;
    if (world.vehPts.some(([a, b]) => Math.hypot(a - x, b - z) < M.half * 0.18)) continue;
    world.vehPts.push([x, z, B.R(0, 6.28)]);
  }
  // crate spots for battle royale: decided by the map seed, so every browser agrees on them
  const nCrates = clamp(Math.round(M.half / 3), 10, 90);
  for (let i = 0; i < 900 && world.cratePts.length < nCrates; i++) {
    const x = B.R(-M.half + 6, M.half - 6), z = B.R(-M.half + 6, M.half - 6);
    if (!isClear(x, z, 1.3)) continue;
    if (world.cratePts.some(([a, b]) => Math.hypot(a - x, b - z) < 9)) continue;
    if (world.vehPts.some(([a, b]) => Math.hypot(a - x, b - z) < 4)) continue;
    world.cratePts.push([x, z]);
  }
  // grass and clouds are only looks: not solid, and they stop no bullets
  const grass = [], gcol = new THREE.Color();
  for (let i = 0; i < (M.grass || 0); i++) {
    const x = B.R(-M.half, M.half), z = B.R(-M.half, M.half), h = heightAt(x, z);
    if (world.water != null && h < 1.1) continue;
    if (M.noGrass && M.noGrass(x, z)) continue;
    let blocked = false;
    for (const b of world.boxes) if (x > b.minX - 0.3 && x < b.maxX + 0.3 && z > b.minZ - 0.3 && z < b.maxZ + 0.3) { blocked = true; break; }
    if (blocked) continue;
    M.ground(gcol, h, B.r(), x, z); gcol.offsetHSL(0.01, 0.05, -0.04);
    const s = B.R(0.5, 1.1);
    grass.push({ p: [x, h + 0.22 * s, z], s: [0.16 * s, 0.5 * s, 0.16 * s], c: gcol.getHex(), r: [B.R(-0.25, 0.25), B.R(0, 3), B.R(-0.25, 0.25)] });
  }
  const clouds = [];
  for (let k = 0; k < 14; k++) {
    const a = B.R(0, 6.28), r = B.R(0, M.half * 1.6), cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = B.R(95, 135);
    for (let j = 0; j < 5; j++) clouds.push({ p: [cx + B.R(-14, 14), cy + B.R(-2, 3), cz + B.R(-8, 8)], s: [B.R(9, 16), B.R(4, 7), B.R(7, 12)], c: 0xffffff, r: [0, B.R(0, 3), 0] });
  }
  instanced(B.inst.box, new THREE.BoxGeometry(1, 1, 1), true);
  instanced(B.inst.win, new THREE.BoxGeometry(1, 1, 1), false, false, { detail: 0.1, shine: 40 });
  instanced(B.inst.trunk, new THREE.CylinderGeometry(0.2, 0.28, 1, 6), true);
  instanced(B.inst.crown, new THREE.ConeGeometry(1, 1, 7), true, true, { detail: 0.35, scale: 2 });
  instanced(B.inst.rock, new THREE.DodecahedronGeometry(1, 0), true, true, { detail: 0.3, scale: 1.5 });
  instanced(B.inst.mtn, new THREE.ConeGeometry(1, 1, 6), false, false, { detail: 0.2, scale: 0.15 });
  instanced(B.inst.cyl, new THREE.CylinderGeometry(1, 1, 1, 20), true, true, { smooth: true, shine: 30 });
  instanced(B.inst.wheel, new THREE.CylinderGeometry(1, 1, 1, 10), false, true);
  instanced(B.inst.roof, new THREE.ConeGeometry(1, 1, 4), true);
  const gm = instanced(grass, new THREE.ConeGeometry(1, 1, 3), false, false, { detail: 0 });
  if (gm) gm.receiveShadow = true;
  const cm = instanced(clouds, new THREE.DodecahedronGeometry(1, 1), false, false, { detail: 0, smooth: true });
  if (cm) { cm.material.emissive = new THREE.Color(0x8a96a0); cm.material.transparent = true; cm.material.opacity = 0.92; cm.receiveShadow = false; }
  // team spawns: team 0 on the negative side of the map's axis, team 1 mirrored
  const pts = [];
  for (let i = 0; i < 800 && pts.length < 10; i++) {
    const along = -M.half * B.R(0.72, 0.9), across = B.R(-0.55, 0.55) * M.half;
    const x = M.axis === 'x' ? along : across, z = M.axis === 'x' ? across : along;
    if (isClear(x, z, 1.3) && isClear(-x, -z, 1.3)) pts.push([x, z]);
  }
  if (!pts.length) pts.push(M.axis === 'x' ? [-M.half * 0.8, 0] : [0, -M.half * 0.8]);
  world.spawns = [pts, pts.map(([x, z]) => [-x, -z])];
}
