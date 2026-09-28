// Collision resolution, line-of-sight raycasts and grid A* pathfinding for the humans.
import { clamp } from './util.js';
import { F } from './world.js';

export class Nav {
  constructor(W) {
    this.W = W;
    const b = W.bounds;
    this.cell = 0.5; this.ox = b.x0; this.oz = b.z0;
    this.gw = Math.ceil((b.x1 - b.x0) / this.cell); this.gh = Math.ceil((b.z1 - b.z0) / this.cell);
    this.buildGrid();
  }
  buildGrid() {
    const { gw, gh, cell, ox, oz } = this;
    const g = (this.grid = new Uint8Array(gw * gh));
    const pad = 0.38;
    for (const c of this.W.colliders) {
      if (!(c.f & F.H)) continue;
      const x0 = c.type === 'rect' ? c.x0 : c.x - c.r, x1 = c.type === 'rect' ? c.x1 : c.x + c.r;
      const z0 = c.type === 'rect' ? c.z0 : c.z - c.r, z1 = c.type === 'rect' ? c.z1 : c.z + c.r;
      const i0 = clamp(Math.floor((x0 - pad - ox) / cell), 0, gw - 1), i1 = clamp(Math.floor((x1 + pad - ox) / cell), 0, gw - 1);
      const j0 = clamp(Math.floor((z0 - pad - oz) / cell), 0, gh - 1), j1 = clamp(Math.floor((z1 + pad - oz) / cell), 0, gh - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const cx = ox + (i + 0.5) * cell, cz = oz + (j + 0.5) * cell;
        if (this.distTo(c, cx, cz) < pad) g[j * gw + i] = 1;
      }
    }
  }
  distTo(c, x, z) {
    if (c.type === 'rect') { const dx = Math.max(c.x0 - x, 0, x - c.x1), dz = Math.max(c.z0 - z, 0, z - c.z1); return Math.hypot(dx, dz); }
    return Math.hypot(x - c.x, z - c.z) - c.r;
  }
  // push a circle entity out of colliders matching flag
  resolve(e, r, flag) {
    for (let it = 0; it < 2; it++) {
      for (const c of this.W.colliders) {
        if (!(c.f & flag)) continue;
        if (c.type === 'rect') {
          if (e.x < c.x0 - r || e.x > c.x1 + r || e.z < c.z0 - r || e.z > c.z1 + r) continue;
          const cx = clamp(e.x, c.x0, c.x1), cz = clamp(e.z, c.z0, c.z1);
          const dx = e.x - cx, dz = e.z - cz, d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-9) { const d = Math.sqrt(d2); e.x += (dx / d) * (r - d); e.z += (dz / d) * (r - d); }
          else {
            const l = e.x - c.x0, rr = c.x1 - e.x, t = e.z - c.z0, bb = c.z1 - e.z, m = Math.min(l, rr, t, bb);
            if (m === l) e.x = c.x0 - r; else if (m === rr) e.x = c.x1 + r; else if (m === t) e.z = c.z0 - r; else e.z = c.z1 + r;
          }
        } else {
          const dx = e.x - c.x, dz = e.z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-9) { const d = Math.sqrt(d2); e.x += (dx / d) * (rr - d); e.z += (dz / d) * (rr - d); }
        }
      }
    }
  }
  // distance along ray until a collider with flag is hit (or max)
  raycast(x, z, dx, dz, max, flag = F.S) {
    let best = max;
    for (const c of this.W.colliders) {
      if (!(c.f & flag)) continue;
      if (c.type === 'rect') {
        if (Math.min(x, x + dx * best) > c.x1 || Math.max(x, x + dx * best) < c.x0 || Math.min(z, z + dz * best) > c.z1 || Math.max(z, z + dz * best) < c.z0) continue;
        let t0 = 0, t1 = best;
        if (Math.abs(dx) < 1e-9) { if (x < c.x0 || x > c.x1) continue; }
        else { let a = (c.x0 - x) / dx, b = (c.x1 - x) / dx; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
        if (Math.abs(dz) < 1e-9) { if (z < c.z0 || z > c.z1) continue; }
        else { let a = (c.z0 - z) / dz, b = (c.z1 - z) / dz; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
        if (t0 <= t1 && t0 < best && t0 > 0.05) best = t0;
      } else {
        const fx = x - c.x, fz = z - c.z;
        const b = fx * dx + fz * dz, cc = fx * fx + fz * fz - c.r * c.r;
        const disc = b * b - cc;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > 0.05 && t < best) best = t;
      }
    }
    return best;
  }
  losClear(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    if (d < 1e-3) return true;
    return this.raycast(x0, z0, (x1 - x0) / d, (z1 - z0) / d, d, F.S) >= d - 0.05;
  }
  // ---------------------------------------------------------------- A*
  idx(x, z) { return [clamp(Math.floor((x - this.ox) / this.cell), 0, this.gw - 1), clamp(Math.floor((z - this.oz) / this.cell), 0, this.gh - 1)]; }
  free(i, j) { return i >= 0 && j >= 0 && i < this.gw && j < this.gh && this.grid[j * this.gw + i] === 0; }
  nearestFree(i, j) {
    if (this.free(i, j)) return [i, j];
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      if (this.free(i + di, j + dj)) return [i + di, j + dj];
    }
    return null;
  }
  lineFree(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.2);
    for (let k = 1; k <= n; k++) { const t = k / n; const [i, j] = this.idx(ax + (bx - ax) * t, az + (bz - az) * t); if (!this.free(i, j)) return false; }
    return true;
  }
  findPath(sx, sz, tx, tz) {
    const s = this.nearestFree(...this.idx(sx, sz)), t = this.nearestFree(...this.idx(tx, tz));
    if (!s || !t) return null;
    const { gw, gh } = this, N = gw * gh;
    const start = s[1] * gw + s[0], goal = t[1] * gw + t[0];
    if (start === goal) return [[tx, tz]];
    const g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; // [f, idx]
    const push = (f, i) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const h = (i) => { const dx = Math.abs((i % gw) - t[0]), dz = Math.abs(((i / gw) | 0) - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    g[start] = 0; push(h(start), start);
    let found = false, iter = 0;
    while (heap.length && iter++ < 20000) {
      const [, cur] = pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % gw, cj = (cur / gw) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
        const n = nj * gw + ni;
        if (closed[n]) continue;
        const ng = g[cur] + (di && dj ? 1.414 : 1);
        if (ng < g[n]) { g[n] = ng; came[n] = cur; push(ng + h(n), n); }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let c = goal; c !== -1 && c !== start; c = came[c]) pts.push([this.ox + ((c % gw) + 0.5) * this.cell, this.oz + (((c / gw) | 0) + 0.5) * this.cell]);
    pts.reverse();
    pts[pts.length - 1] = this.free(...this.idx(tx, tz)) ? [tx, tz] : pts[pts.length - 1];
    // string-pull smoothing
    const out = []; let ax = sx, az = sz, k = 0;
    while (k < pts.length) {
      let far = k;
      for (let m = pts.length - 1; m > k; m--) if (this.lineFree(ax, az, pts[m][0], pts[m][1])) { far = m; break; }
      out.push(pts[far]); [ax, az] = pts[far]; k = far + 1;
    }
    return out;
  }
}
