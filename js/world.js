// Builds the suburban diorama: geometry, colliders, hiding spots, interactables, item spawns, NPC routes.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

export const F = { R: 1, H: 2, S: 4 };
F.ALL = 7; F.RH = 3; F.HS = 6;

const V3 = THREE.Vector3;
function mergeGeos(geos) {
  let count = 0;
  const parts = geos.map((g) => { const n = g.index ? g.toNonIndexed() : g; count += n.attributes.position.count; return n; });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
class Batch {
  constructor() { this.groups = new Map(); }
  add(geo, mat, cast = true, receive = true) {
    const key = mat.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
    let g = this.groups.get(key);
    if (!g) { g = { mat, cast, receive, geos: [] }; this.groups.set(key, g); }
    g.geos.push(geo);
  }
  flush(parent) {
    const mats = [];
    for (const g of this.groups.values()) {
      const mesh = new THREE.Mesh(mergeGeos(g.geos), g.mat);
      mesh.castShadow = g.cast; mesh.receiveShadow = g.receive;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh); mats.push(g.mat);
    }
    this.groups.clear();
    return mats;
  }
}
function boxGeo(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!tile) return g;
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile); }
  return g;
}
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), ONE = new V3(1, 1, 1);
function place(g, x, y, z, rx = 0, ry = 0, rz = 0, s = ONE) {
  tmpQ.setFromEuler(tmpE.set(rx, ry, rz));
  g.applyMatrix4(tmpM.compose(new V3(x, y, z), tmpQ, s));
  return g;
}

export function buildWorld(scene, T) {
  const W = {
    colliders: [], hides: [], bushes: [], faders: [], spawns: [], anims: [], trashCans: [],
    bounds: { x0: -32.5, x1: 22.5, z0: -30.5, z1: 24.5 },
    sway: { value: 0 }, player: { value: new V3(0, 0, 0) },
  };
  const rng = mulberry32(77);
  let batch = new Batch();
  const root = new THREE.Group(); scene.add(root);

  // ---------- materials
  const lam = (map, color = '#ffffff', o = {}) => new THREE.MeshLambertMaterial({ map, color: new THREE.Color(color), ...o });
  const M = {
    grass: lam(T.grass), dirt: lam(T.dirt), path: lam(T.path), sidewalk: lam(T.sidewalk), asphalt: lam(T.asphalt), patio: lam(T.patio),
    wood: lam(T.wood), woodDark: lam(T.wood, '#b88a6a'), white: lam(null, '#f7f4ec'), leaves: lam(T.leaves, '#ffffff', { flatShading: true }),
    leavesDark: lam(T.leaves, '#b9d9a8', { flatShading: true }), hedge: lam(T.leaves, '#e8ffe0'), water: lam(T.water, '#ffffff'),
    brick: lam(T.brick), metal: lam(T.metal, '#b9c3cc'), binGreen: lam(T.metal, '#5f9e74'), trunk: lam(T.wood, '#9a6a45'),
    stone: lam(null, '#cfc8bd'), dark: lam(null, '#3a3346'), red: lam(null, '#e0504a'), yellow: lam(null, '#ffd23f'),
    roadLine: lam(null, '#fff4d0'), curb: lam(null, '#bdb7ad'), glass: lam(T.window), black: lam(null, '#2b2a33'),
    orange: lam(null, '#ff8a2a'), teal: lam(null, '#3aa6a0'), pink: lam(null, '#ff8fb8'), cardboard: lam(null, '#c9955a'),
    straw: lam(null, '#e8c46a'), plaid: lam(null, '#d64545'), hole: new THREE.MeshBasicMaterial({ color: '#2a1b20' }),
    mirror: lam(null, '#bfeaff', { emissive: new THREE.Color('#3a5a70') }),
  };
  const flowerMat = swayMat(T.flowers, W), tuftMat = swayMat(T.tuft, W);

  // ---------- primitive helpers
  const box = (x, y, z, w, h, d, mat, o = {}) => {
    const g = place(boxGeo(w, h, d, o.tile ?? 2), x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0);
    (o.batch || batch).add(g, mat, o.cast ?? true, o.receive ?? true);
  };
  const cyl = (x, y, z, rt, rb, h, seg, mat, o = {}) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, o.open || false);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.PI * 2 * rb) / 2, uv.getY(i) * h / 2);
    place(g, x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0);
    (o.batch || batch).add(g, mat, o.cast ?? true, o.receive ?? true);
  };
  const blob = (x, y, z, r, mat, o = {}) => {
    const g = new THREE.IcosahedronGeometry(r, o.detail ?? 1);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 3, uv.getY(i) * r * 1.5);
    place(g, x, y, z, 0, o.ry || 0, 0, new V3(o.sx || 1, o.sy || 1, o.sz || 1));
    (o.batch || batch).add(g, mat, o.cast ?? true, o.receive ?? true);
  };
  const flat = (x0, z0, x1, z1, y, mat, tile = 2, o = {}) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    place(g, (x0 + x1) / 2, y, (z0 + z1) / 2, -Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / tile, -p.getZ(i) / tile);
    (o.batch || batch).add(g, mat, false, true);
  };
  const tri = (a, b, c, mat, tile = 2, o = {}) => {
    const g = new THREE.BufferGeometry();
    const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)).normalize();
    const useX = Math.abs(n.x) > Math.abs(n.z);
    const pts = [a, b, c];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(pts.flatMap((p) => [(useX ? p.z : p.x) / tile, p.y / tile]), 2));
    (o.batch || batch).add(g, mat, true, true);
  };
  const rectC = (x0, z0, x1, z1, f) => W.colliders.push({ type: 'rect', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), f });
  const circC = (x, z, r, f) => W.colliders.push({ type: 'circle', x, z, r, f });

  // ---------- ground
  flat(-80, -70, 70, 60, 0, M.grass, 3.2);
  flat(-80, 4.5, 70, 10.5, 0.012, M.asphalt, 3.2);
  for (let x = -60; x < 60; x += 3) box(x, 0.012, 7.5, 1.6, 0.01, 0.16, M.roadLine, { cast: false });
  for (let i = 0; i < 6; i++) box(-15.2 + i * 0.8, 0.012, 7.5, 0.5, 0.012, 5.4, M.roadLine, { cast: false });
  const walkY = 0.06;
  box(-20, 0, 3.5, 160, walkY, 2, M.sidewalk, { tile: 1.6, cast: false });
  box(-20, 0, 11.5, 160, walkY, 2, M.sidewalk, { tile: 1.6, cast: false });
  box(-20, 0, 4.55, 160, 0.075, 0.12, M.curb, { cast: false }); box(-20, 0, 10.45, 160, 0.075, 0.12, M.curb, { cast: false });
  W.groundY = (x, z) => ((z > 2.5 && z < 4.5) || (z > 10.5 && z < 12.5) ? walkY : 0);
  // paths & patches
  flat(-13.9, -4.4, -12.1, 2.5, 0.015, M.path, 3.2);
  flat(13.2, -4.4, 14.8, 2.5, 0.015, M.path, 3.2);
  flat(-19.5, -19.5, -6.5, -14, 0.015, M.patio, 1.6);
  flat(-11, 12.5, 2.6, 24.5, 0.013, M.asphalt, 3.2); // alley
  flat(-28.5, -3.5, -22, 0.8, 0.016, M.dirt, 1.6); // veg patch
  flat(-19.6, -4.95, -14.3, -4.0, 0.016, M.dirt, 1.6); flat(-11.7, -4.95, -6.4, -4.0, 0.016, M.dirt, 1.6);
  flat(-16, -30.3, -8, -29.3, 0.016, M.dirt, 1.6);
  flat(8.6, -4.95, 12.8, -4.0, 0.016, M.dirt, 1.6); flat(15.2, -4.95, 19.4, -4.0, 0.016, M.dirt, 1.6);
  // den ground: worn dirt ring
  { const g = new THREE.CircleGeometry(3.5, 22); const p = g.attributes.position;
    for (let i = 1; i < p.count; i++) { const k = 1 + (rng() - 0.5) * 0.18; p.setXY(i, p.getX(i) * k, p.getY(i) * k); }
    place(g, -21.8, 0.014, 20.4, -Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.6, -p.getZ(i) / 1.6);
    batch.add(g, lam(T.soil), false, true); }

  // flowers + tufts (instanced, swaying, pushed aside by the raccoon)
  const flowers = [[], [], [], []];
  const flowerBed = (x0, z0, x1, z1, n) => { for (let i = 0; i < n; i++) flowers[(rng() * 4) | 0].push([x0 + rng() * (x1 - x0), z0 + rng() * (z1 - z0)]); };
  flowerBed(-19.5, -4.9, -14.4, -4.1, 22); flowerBed(-11.6, -4.9, -6.5, -4.1, 22); flowerBed(-16, -30.2, -8, -29.4, 26);
  flowerBed(8.7, -4.9, 12.7, -4.1, 16); flowerBed(15.3, -4.9, 19.3, -4.1, 16);
  flowerBed(-18.2, 21.5, -17, 23.5, 8); flowerBed(-31, 14, -26, 15, 10);
  const tufts = [];
  for (let i = 0; i < 420; i++) {
    const x = -32 + rng() * 54, z = -30 + rng() * 54;
    if (z > 2 && z < 13) continue;
    if (x > -20 && x < -6 && z > -19.5 && z < -4) continue;
    if (x > 8 && x < 20 && z > -14 && z < -4.5) continue;
    if (x > -11 && x < 20 && z > 12.5) continue;
    tufts.push([x, z]);
  }
  const inst = (geo, mat, list, scale = 1) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    const mm = new THREE.Matrix4();
    list.forEach(([x, z], i) => { const s = scale * (0.8 + rng() * 0.4); m.setMatrixAt(i, mm.compose(new V3(x, 0, z), new THREE.Quaternion(), new V3(s, s, s))); });
    m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false;
    root.add(m);
  };
  flowers.forEach((list, k) => {
    const g = new THREE.PlaneGeometry(0.5, 0.5); g.translate(0, 0.25, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / 4);
    if (list.length) inst(g, flowerMat, list, 1);
  });
  { const g = new THREE.PlaneGeometry(0.55, 0.55); g.translate(0, 0.27, 0); inst(g, tuftMat, tufts, 1); }

  // ---------- fences / hedges
  const picket = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const n = Math.floor(len / 0.28);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      box(x, 0, z, 0.12, 0.78, 0.05, M.white, { ry: -ang });
      const g = new THREE.ConeGeometry(0.085, 0.14, 4); place(g, x, 0.85, z, 0, Math.PI / 4 - ang); batch.add(g, M.white);
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, 0.22, cz, len, 0.07, 0.05, M.white, { ry: -ang }); box(cx, 0.58, cz, len, 0.07, 0.05, M.white, { ry: -ang });
  };
  const woodFence = (x0, z0, x1, z1, h = 1.9) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, 0, cz, len, h, 0.12, M.wood, { ry: -ang, tile: 1.6 });
    const n = Math.max(1, Math.round(len / 2.4));
    for (let i = 0; i <= n; i++) { const t = i / n; box(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.22, h + 0.12, 0.22, M.woodDark, { ry: -ang }); }
    box(cx, h - 0.25, cz, len, 0.1, 0.2, M.woodDark, { ry: -ang });
  };
  const hedge = (x0, z0, x1, z1, h = 1.15) => {
    box((x0 + x1) / 2, 0, (z0 + z1) / 2, Math.abs(x1 - x0), h, Math.abs(z1 - z0), M.hedge, { tile: 1.6 });
    box((x0 + x1) / 2, h, (z0 + z1) / 2, Math.abs(x1 - x0) - 0.2, 0.14, Math.abs(z1 - z0) - 0.2, M.hedge, { tile: 1.6 });
    rectC(x0, z0, x1, z1, F.ALL);
  };

  // ---------- trees (individual so they can fade when the raccoon walks behind them)
  const tree = (x, z, s = 1, fade = true) => {
    const g = new THREE.Group(); root.add(g);
    const tb = fade ? new Batch() : batch;
    const leafMat = fade ? M.leaves.clone() : M.leaves, trunkMat = fade ? M.trunk.clone() : M.trunk;
    cyl(x, 0, z, 0.2 * s, 0.32 * s, 2.2 * s, 7, trunkMat, { batch: tb });
    blob(x, 2.9 * s, z, 1.55 * s, leafMat, { batch: tb, ry: rng() * 3 });
    blob(x - 0.9 * s, 2.4 * s, z + 0.4 * s, 1.1 * s, leafMat, { batch: tb, ry: rng() * 3 });
    blob(x + 0.95 * s, 2.5 * s, z + 0.2 * s, 1.15 * s, leafMat, { batch: tb, ry: rng() * 3 });
    blob(x + 0.2 * s, 3.9 * s, z - 0.3 * s, 1.05 * s, leafMat, { batch: tb, ry: rng() * 3 });
    if (fade) tb.flush(g);
    circC(x, z, 0.38 * s, F.RH);
    if (fade) W.faders.push({ x0: x - 2.2 * s, x1: x + 2.2 * s, z0: z - 4.8 * s, z1: z + 0.2, mats: [leafMat, trunkMat], cur: 1 });
  };
  const bush = (x, z, r = 0.85) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const parts = [[0, 0.55, 0, r], [-r * 0.6, 0.4, 0.15, r * 0.72], [r * 0.6, 0.42, 0.1, r * 0.7]];
    const geos = parts.map(([px, py, pz, pr]) => {
      const bg = new THREE.IcosahedronGeometry(pr, 1);
      const uv = bg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * pr * 3, uv.getY(i) * pr * 1.5);
      return place(bg, px, py, pz, 0, rng() * 3, 0, new V3(1, 0.85, 1));
    });
    const m = new THREE.Mesh(mergeGeos(geos), M.leaves); m.castShadow = true; m.receiveShadow = true; g.add(m);
    W.bushes.push({ g, x, z, r: r * 1.05, shake: 0 });
    W.hides.push({ type: 'circle', x, z, r: r * 1.05 });
    circC(x, z, r * 0.9, F.H | F.S);
  };

  // ---------- houses (own batch + materials so they fade when the raccoon is behind them)
  const house = (x0, z0, x1, z1, o) => {
    const hb = new Batch(); const g = new THREE.Group(); root.add(g);
    const wallMat = lam(T.siding, o.wall), roofMat = lam(T.shingles, o.roof), trimMat = M.white.clone(), doorMat = lam(T.door, o.door);
    const winMat = M.glass.clone(), shutMat = lam(null, o.shutter || o.door), baseMat = M.stone.clone(), chimMat = M.brick.clone();
    const H = o.h || 3.2, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, 0, cz, w + 0.2, 0.35, d + 0.2, baseMat, { batch: hb });
    box(cx, 0.35, cz, w, H - 0.35, d, wallMat, { batch: hb, tile: 1.6 });
    // gable roof along X
    const rh = o.roofH || 2.1, ov = 0.55, half = d / 2 + ov, th = Math.atan2(rh, d / 2), slope = half / Math.cos(th);
    const midY = H + rh - (half / 2) * Math.tan(th);
    box(cx, midY - 0.08, cz + half / 2, w + ov * 2, 0.16, slope, roofMat, { batch: hb, rx: th, tile: 1.6 });
    box(cx, midY - 0.08, cz - half / 2, w + ov * 2, 0.16, slope, roofMat, { batch: hb, rx: -th, tile: 1.6 });
    tri(new V3(x1, H, z1), new V3(x1, H, z0), new V3(x1, H + rh, cz), wallMat, 1.6, { batch: hb });
    tri(new V3(x0, H, z0), new V3(x0, H, z1), new V3(x0, H + rh, cz), wallMat, 1.6, { batch: hb });
    box(cx, H + rh - 0.1, cz, w + ov * 2, 0.18, 0.3, trimMat, { batch: hb });
    box(x0 + w * 0.78, H + rh * 0.3, cz - d * 0.18, 0.7, rh + 0.4, 0.7, chimMat, { batch: hb, tile: 1 });
    // front door + steps + windows
    const dx = o.doorX ?? cx;
    box(dx, 0.3, z1 + 0.03, 1.1, 2.05, 0.1, doorMat, { batch: hb, tile: 0 });
    box(dx, 0.3, z1 + 0.02, 1.35, 2.25, 0.06, trimMat, { batch: hb });
    box(dx, 0, z1 + 0.35, 1.8, 0.3, 0.7, baseMat, { batch: hb });
    box(dx, 2.45, z1 + 0.45, 2.2, 0.12, 1.0, roofMat, { batch: hb });
    const winAt = (wx, wy, wz, face) => {
      box(wx, wy, wz, 1.1, 1.1, 0.08, winMat, { batch: hb, tile: 0, ry: face });
      box(wx, wy - 0.12, wz + (face ? 0 : 0.08), 1.3, 0.12, 0.16, trimMat, { batch: hb, ry: face });
      if (!face) { box(wx - 0.72, wy, wz, 0.28, 1.1, 0.08, shutMat, { batch: hb }); box(wx + 0.72, wy, wz, 0.28, 1.1, 0.08, shutMat, { batch: hb }); }
    };
    for (const wx of o.windows || [x0 + w * 0.22, x1 - w * 0.22]) winAt(wx, 1.2, z1 + 0.04, 0);
    const mats = hb.flush(g);
    rectC(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1, F.ALL);
    rectC(dx - 0.9, z1, dx + 0.9, z1 + 0.7, F.RH);
    W.faders.push({ x0: x0 - 0.6, x1: x1 + 0.6, z0: z0 - 7.5, z1: z0 + 1.5, mats, cur: 1 });
    return g;
  };

  // ======================================================= HOUSE A LOT (gardener front, dad back)
  house(-20, -14, -6, -5, { wall: '#f9dc8c', roof: '#e3645c', door: '#3aa6a0', doorX: -13, windows: [-17.3, -8.7] });
  // front garden
  picket(-30.9, 2.35, -14.2, 2.35); picket(-11.8, 2.35, 0.55, 2.35); picket(1.45, 2.35, 4, 2.35);
  rectC(-30.9, 2.25, -14.2, 2.45, F.RH); rectC(-11.8, 2.25, 0.55, 2.45, F.RH); rectC(1.45, 2.25, 4, 2.45, F.RH);
  rectC(0.55, 2.25, 1.45, 2.45, F.H); // loose picket: raccoon-sized gap
  box(1.0, 0, 2.5, 0.12, 0.5, 0.05, M.white, { rz: 1.1 });
  hedge(-31.8, -8, -30.9, 2.45);
  woodFence(-31, -8, -20, -8); rectC(-31, -8.1, -20, -7.9, F.ALL);
  woodFence(4, -30.5, 4, 2.35); rectC(3.9, -30.5, 4.1, 2.35, F.ALL);
  // side-passage fence with gate + dig spot
  woodFence(-6, -8, -4.5, -8); woodFence(-2.5, -8, 4, -8);
  rectC(-6, -8.1, -4.5, -7.9, F.ALL); rectC(-2.5, -8.1, 1.7, -7.9, F.ALL); rectC(2.7, -8.1, 4, -7.9, F.ALL);
  W.digFence = { type: 'rect', x0: 1.7, z0: -8.1, x1: 2.7, z1: -7.9, f: F.ALL }; W.colliders.push(W.digFence);
  W.gateCollider = { type: 'rect', x0: -4.5, z0: -8.1, x1: -2.5, z1: -7.9, f: F.R | F.S }; W.colliders.push(W.gateCollider);
  const gate = new THREE.Group(); gate.position.set(-4.5, 0, -8); root.add(gate);
  { const gm = new THREE.Mesh(boxGeo(2, 1.7, 0.1, 1.6), M.wood); gm.position.set(1, 0.9, 0); gm.castShadow = true; gate.add(gm);
    const gb = new THREE.Mesh(boxGeo(1.9, 0.12, 0.14, 1), M.woodDark); gb.position.set(1, 1.2, 0.03); gate.add(gb);
    const gl = new THREE.Mesh(boxGeo(0.12, 0.2, 0.2, 1), M.metal); gl.position.set(1.85, 1.0, 0.08); gate.add(gl); }
  W.gate = { g: gate, x: -3.5, z: -8, open: 0, timer: 0 };
  // dig spot visuals
  const digSoft = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), lam(T.dirt, '#e0b890')); digSoft.rotation.x = -Math.PI / 2; digSoft.position.set(2.2, 0.02, -7.4); digSoft.receiveShadow = true; root.add(digSoft);
  const holes = [];
  for (const hz of [-7.55, -8.45]) {
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), M.hole); h.rotation.x = -Math.PI / 2; h.position.set(2.2, 0.03, hz); h.visible = false; root.add(h); holes.push(h);
    const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), lam(T.dirt)); mound.scale.y = 0.45; mound.position.set(2.75, 0.05, hz + (hz > -8 ? 0.35 : -0.35)); mound.visible = false; root.add(mound); holes.push(mound);
  }
  const boardGap = new THREE.Mesh(boxGeo(0.9, 0.35, 0.14, 1), M.hole); boardGap.position.set(2.2, 0.17, -8); boardGap.visible = false; root.add(boardGap); holes.push(boardGap);
  W.dig = { front: { x: 2.2, z: -7.3 }, back: { x: 2.2, z: -8.8 }, dug: false, meshes: holes, soft: digSoft };
  // garden features
  box(-25, 0, -7.3, 1.9, 0.45, 0.55, M.wood); box(-25, 0.45, -7.55, 1.9, 0.55, 0.1, M.wood); // bench
  box(-25.8, 0, -7.3, 0.1, 0.45, 0.5, M.woodDark); box(-24.2, 0, -7.3, 0.1, 0.45, 0.5, M.woodDark);
  rectC(-26, -7.6, -24, -7.0, F.H); W.hides.push({ type: 'rect', x0: -25.9, z0: -7.6, x1: -24.1, z1: -7.0 });
  W.bench = { x: -25, z: -7.2, y: 0.5 };
  // veg patch plants
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const px = -27.6 + i * 2.1, pz = -2.6 + j * 2.2;
    box(px, 0, pz, 0.06, 1.1, 0.06, M.woodDark);
    blob(px, 0.55, pz, 0.45, M.leaves, { sy: 1.3, detail: 0 });
    if (!(i === 1 && j === 0)) { blob(px + 0.25, 0.6, pz + 0.3, 0.1, M.red, { detail: 0 }); blob(px - 0.2, 0.8, pz + 0.3, 0.09, M.red, { detail: 0 }); }
  }
  for (let i = 0; i < 6; i++) blob(-27.8 + i * 1.1, 0.12, 0.25, 0.22, M.leavesDark, { sy: 0.6, detail: 0 });
  box(-24.5, 0, -1.9, 0.9, 0.12, 0.9, M.white); // prize tomato plinth
  // tap + hose + sprinkler
  box(-19.3, 0.5, -4.93, 0.18, 0.18, 0.12, M.metal);
  const tapHandle = new THREE.Mesh(boxGeo(0.28, 0.06, 0.06, 1), M.red); tapHandle.position.set(-19.3, 0.72, -4.86); root.add(tapHandle);
  { const curve = new THREE.CatmullRomCurve3([new V3(-19.3, 0.5, -4.85), new V3(-19.2, 0.04, -4.2), new V3(-18.6, 0.04, -3.2), new V3(-18.8, 0.04, -2.2), new V3(-17.6, 0.04, -1.3)]);
    const tg = new THREE.TubeGeometry(curve, 24, 0.05, 5); batch.add(tg, lam(null, '#46b04a'), true, true); }
  cyl(-17.5, 0, -1.2, 0.12, 0.18, 0.14, 8, M.metal); cyl(-17.5, 0.14, -1.2, 0.04, 0.04, 0.1, 5, M.dark);
  W.tap = { x: -19.3, z: -4.5, on: false, handle: tapHandle };
  W.sprinkler = { x: -17.5, z: -1.2, r: 2.5 };
  // shed
  { const sb = batch; box(2.2, 0, -3, 3.2, 2.2, 3.2, lam(T.siding, '#9fdcb8'), { tile: 1.6 }); box(2.2, 2.2, -3, 3.6, 0.2, 3.6, lam(T.shingles, '#5a6b8a'));
    box(0.57, 0, -3, 0.08, 1.8, 1.1, lam(T.door, '#ffffff'), { tile: 0 }); void sb; }
  rectC(0.6, -4.6, 3.8, -1.4, F.ALL);
  // gnome plinth-ish stone
  blob(-7.6, 0.05, -2.3, 0.3, M.stone, { sy: 0.3, detail: 0 });
  // mailbox
  box(-15.6, walkY, 3.0, 0.1, 1.0, 0.1, M.woodDark); box(-15.6, 1.0, 3.0, 0.35, 0.3, 0.5, M.red);
  circC(-15.6, 3.0, 0.2, F.RH);
  tree(-28.6, -6.2, 1.0);
  bush(-9.8, 1.2); bush(-1.8, -0.3, 0.8); bush(-29.8, -5.2, 0.8); bush(-29.6, 1.2, 0.75); bush(-5.2, -6.8, 0.7);

  // ======================================================= BACKYARD
  woodFence(-31, -30.5, 4, -30.5); rectC(-31, -30.6, 4, -30.4, F.ALL);
  woodFence(-31, -30.5, -31, -8); rectC(-31.1, -30.5, -30.9, -8, F.ALL);
  // grill
  cyl(-8.6, 0, -16.9, 0.05, 0.05, 0.7, 4, M.dark); box(-8.6, 0.65, -16.9, 1.2, 0.28, 0.6, M.black); box(-8.6, 0.93, -16.9, 1.1, 0.03, 0.5, M.metal);
  box(-8.6, 0.93, -17.25, 1.2, 0.5, 0.08, M.black, { rx: -0.35 });
  box(-7.1, 0, -16.9, 0.7, 0.75, 0.5, M.wood); rectC(-9.3, -17.3, -6.7, -16.5, F.H | F.S);
  W.grill = { x: -8.6, z: -16.9 };
  // patio table + chairs + radio
  cyl(-15, 0, -17.6, 0.08, 0.1, 0.72, 6, M.dark); cyl(-15, 0.72, -17.6, 0.8, 0.8, 0.06, 12, M.white);
  box(-16.3, 0, -17.6, 0.5, 0.45, 0.5, M.white); box(-16.3, 0.45, -17.85, 0.5, 0.5, 0.06, M.white);
  box(-13.7, 0, -17.6, 0.5, 0.45, 0.5, M.white); box(-13.7, 0.45, -17.85, 0.5, 0.5, 0.06, M.white);
  circC(-15, -17.6, 0.8, F.H); W.hides.push({ type: 'circle', x: -15, z: -17.6, r: 0.7 });
  const radio = new THREE.Group(); radio.position.set(-14.5, 0.78, -17.5); root.add(radio);
  { const rb = new THREE.Mesh(boxGeo(0.55, 0.3, 0.2, 1), M.teal); rb.position.y = 0.15; rb.castShadow = true; radio.add(rb);
    const sp1 = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), M.dark); sp1.position.set(-0.13, 0.15, 0.101); radio.add(sp1);
    const sp2 = sp1.clone(); sp2.position.x = 0.13; radio.add(sp2);
    const ant = new THREE.Mesh(boxGeo(0.02, 0.4, 0.02, 1), M.metal); ant.position.set(0.2, 0.45, 0); ant.rotation.z = -0.4; radio.add(ant); }
  W.radio = { x: -14.5, z: -17.3, on: false, g: radio, timer: 0 };
  // lounger
  box(-23.5, 0, -21.5, 0.8, 0.3, 2.0, M.white); box(-23.5, 0.3, -22.3, 0.8, 0.5, 0.4, lam(null, '#5ab5f0'), { rx: -0.6 });
  box(-23.5, 0.3, -21.3, 0.75, 0.06, 1.6, lam(null, '#5ab5f0'));
  rectC(-23.9, -22.5, -23.1, -20.5, F.H); W.hides.push({ type: 'rect', x0: -23.9, z0: -22.5, x1: -23.1, z1: -20.5 });
  // kiddie pool
  cyl(-25.5, 0, -17.2, 1.4, 1.4, 0.35, 16, lam(null, '#5ab5f0'), { open: true });
  cyl(-25.5, 0, -17.2, 1.35, 1.35, 0.26, 16, M.water);
  circC(-25.5, -17.2, 1.4, F.H);
  W.pool = { x: -25.5, z: -17.2, r: 1.4 };
  // clothesline
  box(-26.5, 0, -26, 0.1, 1.7, 0.1, M.metal); box(-17.5, 0, -26, 0.1, 1.7, 0.1, M.metal);
  box(-22, 1.62, -26, 9, 0.025, 0.025, M.white, { cast: false });
  box(-21.6, 0.9, -26, 1.0, 0.75, 0.05, lam(null, '#ffe066')); box(-18.8, 0.95, -26, 0.8, 0.7, 0.05, lam(null, '#ff8fb8'));
  circC(-26.5, -26, 0.12, F.RH); circC(-17.5, -26, 0.12, F.RH);
  // kennel
  { const kx = 1.8, kz = -13.2;
    box(kx + 0.2, 0, kz, 1.4, 0.95, 1.2, M.wood); box(kx + 0.2, 0.95, kz + 0.33, 1.6, 0.1, 0.8, M.red, { rx: 0.55 }); box(kx + 0.2, 0.95, kz - 0.33, 1.6, 0.1, 0.8, M.red, { rx: -0.55 });
    box(kx - 0.52, 0.02, kz, 0.04, 0.65, 0.6, M.hole);
    rectC(kx - 0.5, kz - 0.6, kx + 0.9, kz + 0.6, F.ALL);
    W.kennel = { x: kx - 0.8, z: kz }; }
  box(-15.2, 0.03, -30.1, 0.1, 0.1, 0.1, M.white);
  tree(-28.5, -28.3, 1.15); tree(-2.2, -26, 0.95); tree(-12, -27.5, 0.8);
  bush(-6.5, -29.4, 0.8); bush(-29.5, -23.5); bush(-29.4, -12.5, 0.8); bush(2.9, -21.5); bush(-4.8, -20.2, 0.75); bush(-18.5, -29.4, 0.7);

  // ======================================================= HOUSE B (neighbour, open front yard)
  house(8, -14, 20, -5, { wall: '#a9d6f2', roof: '#5470a8', door: '#ffc84a', shutter: '#ffffff', doorX: 14, windows: [10.5, 17.5] });
  hedge(4.2, 2.1, 12.9, 2.6); hedge(15.1, 2.1, 22.6, 2.6);
  woodFence(4, -8, 8, -8); rectC(4, -8.1, 8, -7.9, F.ALL); woodFence(20, -8, 22.6, -8); rectC(20, -8.1, 22.6, -7.9, F.ALL);
  cyl(17.2, 0, -1.5, 0.15, 0.25, 0.7, 8, M.stone); cyl(17.2, 0.7, -1.5, 0.55, 0.35, 0.18, 10, M.stone); cyl(17.2, 0.8, -1.5, 0.45, 0.45, 0.07, 10, M.water, { cast: false });
  circC(17.2, -1.5, 0.45, F.RH);
  W.birdbath = { x: 17.2, z: -1.5 };
  box(12, walkY, 3.0, 0.1, 1.0, 0.1, M.woodDark); box(12, 1.0, 3.0, 0.35, 0.3, 0.5, lam(null, '#3a6fe0')); circC(12, 3, 0.2, F.RH);
  bush(6.2, 0.4); bush(21.3, -2.4, 0.8); bush(19.4, 0.9, 0.7); bush(6, -6.4, 0.75);
  tree(21.5, -6.4, 0.9);

  // ======================================================= STREET
  const car = (x, z, color, ry = 0) => {
    box(x, 0.28, z, 3.6, 0.62, 1.7, lam(null, color), { ry }); box(x - 0.2, 0.9, z, 2.0, 0.6, 1.5, M.glass, { ry, tile: 0 });
    box(x - 0.2, 1.48, z, 2.1, 0.08, 1.55, lam(null, color), { ry });
    for (const [wx, wz] of [[-1.15, -0.8], [1.15, -0.8], [-1.15, 0.8], [1.15, 0.8]]) cyl(x + wx, 0.22, z + wz, 0.32, 0.32, 0.2, 10, M.black, { rx: Math.PI / 2 });
    box(x + 1.82, 0.45, z, 0.05, 0.18, 1.3, M.white); box(x - 1.82, 0.45, z, 0.05, 0.16, 1.3, M.red);
    rectC(x - 1.8, z - 0.85, x + 1.8, z + 0.85, F.H | F.S);
    W.hides.push({ type: 'rect', x0: x - 1.7, z0: z - 0.8, x1: x + 1.7, z1: z + 0.8 });
  };
  car(-8.5, 5.9, '#ff7a59'); car(10.5, 9.1, '#6fb8e8');
  const lamp = (x, z) => { cyl(x, 0, z, 0.07, 0.09, 3.2, 6, M.dark); box(x, 3.1, z, 0.4, 0.3, 0.4, M.yellow); circC(x, z, 0.15, F.RH); };
  lamp(-19, 4.0); lamp(3, 4.0); lamp(-12.5, 11.1); lamp(16, 11.1);
  for (const bx of [-32.3, 22.3]) { box(bx, 0, 7.5, 0.3, 0.9, 5.5, M.orange); box(bx, 0.4, 7.5, 0.34, 0.2, 5.6, M.white); }

  // ======================================================= PARK + DEN
  tree(-23.6, 16.6, 1.35, false); // the den oak, behind the den
  // hollow log
  cyl(-24.4, 0.6 - 1.2, 20.1, 0.6, 0.6, 2.4, 10, M.trunk, { rz: Math.PI / 2 });
  const logEnd = new THREE.Mesh(new THREE.CircleGeometry(0.48, 10), M.hole); logEnd.position.set(-23.18, 0.6, 20.1); logEnd.rotation.y = Math.PI / 2; root.add(logEnd);
  rectC(-25.6, 19.5, -23.2, 20.7, F.ALL);
  // nest
  { const tg = new THREE.TorusGeometry(0.7, 0.22, 5, 12); place(tg, -21.2, 0.12, 20.8, Math.PI / 2); batch.add(tg, M.straw, true, true); }
  box(-21.2, 0, 20.8, 0.9, 0.1, 0.9, M.plaid);
  // mirror shard (wardrobe)
  box(-19.2, 0, 21.2, 0.9, 1.3, 0.1, M.woodDark, { rx: -0.2 }); box(-19.2, 0.1, 21.15, 0.72, 1.1, 0.06, M.mirror, { rx: -0.2 });
  rectC(-19.7, 21.0, -18.7, 21.4, F.RH);
  W.mirror = { x: -19.2, z: 20.6 };
  // string lights between oak and a post
  box(-18, 0, 19.2, 0.1, 2.4, 0.1, M.woodDark); circC(-18, 19.2, 0.12, F.RH);
  { const bulbMats = ['#ffd23f', '#ff6b9a', '#6fe0ff', '#9dff7a', '#ffb347'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    for (let i = 0; i <= 12; i++) { const t = i / 12, x = -22.6 + (4.6) * t, y = 2.35 - Math.sin(t * Math.PI) * 0.7, z = 17.4 + 1.8 * t;
      batch.add(place(new THREE.IcosahedronGeometry(0.075, 0), x, y, z), bulbMats[i % 5], false, false); } }
  W.den = { x: -21.8, z: 20.4, r: 3.1 };
  const denRing = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.12, 40), new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.55, depthWrite: false }));
  denRing.rotation.x = -Math.PI / 2; denRing.position.set(W.den.x, 0.03, W.den.z); root.add(denRing); W.denRing = denRing;
  // wooden sign
  box(-18.6, 0, 22.9, 0.08, 0.8, 0.08, M.woodDark); box(-18.6, 0.6, 22.95, 0.9, 0.45, 0.06, M.wood);
  // throne (hidden until built)
  const throne = new THREE.Group(); throne.position.set(-23.9, 0, 22.2); throne.visible = false; root.add(throne);
  { const addT = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; throne.add(m); };
    for (let i = 0; i < 4; i++) addT(boxGeo(1.3 - i * 0.03, 0.12, 1.1, 1), i % 2 ? M.white : M.cardboard, 0, 0.06 + i * 0.12, 0, 0, (i - 1.5) * 0.03);
    addT(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 16), lam(null, '#dfe6ee', { emissive: new THREE.Color('#303a44') }), 0, 1.25, -0.5, Math.PI / 2 - 0.15);
    addT(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), M.red, -0.62, 0.8, 0.1); addT(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), M.red, 0.62, 0.8, 0.1);
    addT(new THREE.ConeGeometry(0.22, 0.4, 5), M.yellow, 0, 2.2, -0.55); addT(new THREE.ConeGeometry(0.14, 0.3, 5), M.yellow, -0.45, 2.05, -0.55); addT(new THREE.ConeGeometry(0.14, 0.3, 5), M.yellow, 0.45, 2.05, -0.55);
    addT(new THREE.IcosahedronGeometry(0.2, 0), M.pink, 0, 1.3, -0.44); }
  W.throne = { g: throne, x: -23.9, z: 22.35, built: false, appear: 1 };
  // park furniture
  box(-15.5, 0, 21.2, 1.8, 0.45, 0.5, M.wood); box(-15.5, 0.45, 20.98, 1.8, 0.5, 0.08, M.wood); rectC(-16.4, 20.9, -14.6, 21.5, F.H);
  W.hides.push({ type: 'rect', x0: -16.3, z0: 20.95, x1: -14.7, z1: 21.45 });
  cyl(-29, 0, 18.2, 1.9, 1.9, 0.14, 16, M.stone); cyl(-29, 0.02, 18.2, 1.7, 1.7, 0.13, 16, M.water, { cast: false });
  circC(-29, 18.2, 1.9, F.RH); W.pond = { x: -29, z: 18.2 };
  lamp(-26.5, 13.2);
  tree(-31.2, 23.3, 1.0); tree(-13.5, 23.8, 0.9);
  bush(-31.3, 14.2, 0.8); bush(-17.2, 14.4, 0.8); bush(-12.4, 17.8); bush(-27, 23.6, 0.75); bush(-20, 13.8, 0.7);
  hedge(-11.5, 15, -10.8, 24.5, 0.9);

  // ======================================================= ALLEY + SHOP
  { const sh = new Batch(); const g = new THREE.Group(); root.add(g);
    const bm = M.brick.clone(), rm = lam(null, '#8a7f96'), aw = lam(null, '#ffffff'), awr = lam(null, '#e84a4a'), wm = M.glass.clone();
    box(11.5, 0, 19.8, 17, 3.3, 9.4, bm, { batch: sh, tile: 1.6 }); box(11.5, 3.3, 19.8, 17.4, 0.25, 9.8, rm, { batch: sh });
    for (let i = 0; i < 8; i++) box(4.4 + i * 1.02, 2.2, 15.0, 1.02, 0.12, 1.1, i % 2 ? aw : awr, { batch: sh, rx: -0.35 });
    box(7.5, 0.4, 15.05, 5, 1.5, 0.08, wm, { batch: sh, tile: 0 });
    const mats = sh.flush(g); rectC(3, 15.1, 20, 24.5, F.ALL);
    W.faders.push({ x0: 2.4, x1: 20.6, z0: 8.5, z1: 15.5, mats, cur: 1 }); }
  box(-4.2, 0, 24.4, 14, 1.1, 0.3, M.brick, { tile: 1.6 }); rectC(-11, 24.25, 3, 24.6, F.ALL);
  // dumpster + boxes
  box(0.2, 0, 22.5, 3.0, 1.3, 1.9, lam(T.metal, '#3f8f5f')); box(0.2, 1.3, 22.2, 3.1, 0.12, 1.5, lam(null, '#2f6f49'), { rx: -0.12 });
  rectC(-1.3, 21.5, 1.7, 23.5, F.ALL);
  box(2.0, 0, 19.4, 0.8, 0.6, 0.8, M.cardboard); box(2.0, 0.6, 19.3, 0.6, 0.5, 0.6, M.cardboard, { ry: 0.3 }); rectC(1.6, 19.0, 2.4, 19.8, F.RH);
  flat(-4.2, 16.9, -2.2, 18.3, 0.02, M.water, 2);
  // trash cans (dynamic, knockable)
  const binMat = M.binGreen, lidMat = lam(T.metal, '#76b58a');
  [[-6.5, 22.6, ['banana', 'soda']], [-5.1, 22.9, ['hambone', 'pizza']], [-3.7, 22.6, ['apple', 'boot']]].forEach(([x, z, spill], i) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0, z); root.add(pivot);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.95, 12), binMat); body.position.y = 0.475; body.castShadow = true; body.receiveShadow = true; pivot.add(body);
    for (const ry of [0.2, 0.5, 0.8]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.04, 12), lidMat); band.position.y = ry; pivot.add(band); }
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.07, 12), lidMat); lid.position.set(x, 0.99, z); lid.castShadow = true; root.add(lid);
    const col = { type: 'circle', x, z, r: 0.42, f: F.RH }; W.colliders.push(col);
    W.trashCans.push({ i, x, z, pivot, lid, knocked: false, t: 0, spill, col, dir: [-1, 1, 1][i] });
  });

  // ---------- boundary decoration + colliders
  for (let x = -34; x <= 26; x += 4.2) { tree(x + rng(), -33.5 - rng() * 2, 0.9 + rng() * 0.3, false); tree(x + rng() * 2, 27.5 + rng() * 2, 0.9 + rng() * 0.3, false); }
  for (let z = -30; z <= 26; z += 4.5) { if (z > 2 && z < 13) continue; tree(-35.5 - rng(), z, 1, false); tree(25.5 + rng(), z, 1, false); }
  hedge(-31, 24.6, -11, 25.3, 0.75); hedge(20, 24.6, 23, 25.3, 0.75);
  const b = W.bounds;
  rectC(b.x0 - 5, b.z0 - 5, b.x0, b.z1 + 5, F.ALL); rectC(b.x1, b.z0 - 5, b.x1 + 5, b.z1 + 5, F.ALL);
  rectC(b.x0 - 5, b.z0 - 5, b.x1 + 5, b.z0, F.ALL); rectC(b.x0 - 5, b.z1, b.x1 + 5, b.z1 + 5, F.ALL);

  // ---------- item spawns
  W.spawns.push(
    { id: 'gnome', x: -7.6, z: -2.3 }, { id: 'trowel', x: -21.4, z: 1.5 }, { id: 'tomato', x: -24.5, z: -1.9, y: 0.12 },
    { id: 'sausage', x: -8.9, z: -16.85, y: 0.95 }, { id: 'sausage', x: -8.55, z: -16.95, y: 0.95 }, { id: 'sausage', x: -8.2, z: -16.85, y: 0.95 },
    { id: 'spatula', x: -7.1, z: -16.8, y: 0.75 }, { id: 'trophy', x: -15.4, z: -17.5, y: 0.78 },
    { id: 'sock', x: -23.4, z: -25.95, y: 0.95 }, { id: 'sock2', x: -19.8, z: -25.95, y: 0.95 },
    { id: 'duck', x: -25.3, z: -17.1, y: 0.2 }, { id: 'ball', x: -0.8, z: -15.6 }, { id: 'flamingo', x: 10.6, z: -1.3 },
  );
  // ---------- NPC routines
  W.routes = {
    gardener: [
      { at: [-24.5, 1.75], look: -Math.PI / 2, anim: 'work', dur: 7, label: 'tomatoes' },
      { at: [-17.2, -3.5], look: -Math.PI / 2, anim: 'work', dur: 6 },
      { at: [-8.9, -2.3], look: 0, anim: 'work', dur: 4.5, label: 'gnome' },
      { at: [-30.2, -1.5], look: Math.PI, anim: 'work', dur: 6 },
      { at: [-25, -6.6], look: Math.PI / 2, anim: 'idle', dur: 6, label: 'bench' },
      { at: [-13, 1.4], look: Math.PI / 2, anim: 'idle', dur: 4 },
    ],
    dad: [
      { at: [-8.6, -15.9], look: -Math.PI / 2, anim: 'work', dur: 10, label: 'grill' },
      { at: [-15, -16.5], look: -Math.PI / 2, anim: 'idle', dur: 5 },
      { at: [-22.6, -21.4], look: Math.PI / 2, anim: 'idle', dur: 6 },
      { at: [-8.6, -15.9], look: -Math.PI / 2, anim: 'work', dur: 9, label: 'grill' },
      { at: [-1.4, -12.6], look: 0, anim: 'work', dur: 4, label: 'dog' },
      { at: [-0.2, -3], look: 0, anim: 'work', dur: 4, label: 'shed' },
    ],
  };
  W.territory = {
    gardener: [{ x0: -31, z0: -8.6, x1: 4.2, z1: 5.2 }],
    dad: [{ x0: -31, z0: -30.6, x1: 4.2, z1: -7.6 }, { x0: -6.2, z0: -8.6, x1: 4.2, z1: -0.5 }],
  };
  W.starts = { raccoon: [-20.8, 18.6], gardener: [-18, -2], dad: [-8.6, -15.9] };

  batch.flush(root);
  W.root = root;
  return W;
}

// Lambert material whose vertices sway in the breeze and bend away from the player
function swayMat(map, W) {
  const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = W.sway; sh.uniforms.uPlayer = W.player;
    sh.vertexShader = 'uniform float uTime; uniform vec3 uPlayer;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float hgt = max(0.0, position.y);
      transformed.x += sin(uTime * 2.1 + ip.x * 0.8 + ip.z * 0.6) * 0.07 * hgt * 2.0;
      vec2 dd = ip.xz - uPlayer.xz; float dl = length(dd);
      float push = max(0.0, 1.0 - dl / 0.75);
      transformed.x += (dd.x / max(dl, 0.001)) * push * hgt * 0.9;
      transformed.y -= push * hgt * 0.35;`);
  };
  return m;
}
