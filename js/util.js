// Small math + event helpers shared by every module.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const smooth = (t) => t * t * (3 - 2 * t);
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class Emitter {
  constructor() { this.handlers = {}; }
  on(evt, fn) { (this.handlers[evt] ||= []).push(fn); return fn; }
  emit(evt, data) { const hs = this.handlers[evt]; if (hs) for (const h of hs.slice()) h(data); }
}
// Point inside axis-aligned rect {x0,z0,x1,z1}
export const inRect = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
export const isTouchDevice = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
