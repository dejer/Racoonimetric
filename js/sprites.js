// Procedural pixel-art: raccoon (with fur + accessories), humans, dog, items, emotes.
import { PixelArt, Sheet, mix, glyph } from './pixel.js';

export const OUTLINE = '#2a1b30';
export const PX = 0.04; // world units per art pixel (shared by every sprite)

export const FURS = {
  classic: { fur: '#8f8b9e', light: '#b9b5c8', dark: '#676379', belly: '#ece8f2', mask: '#2c2537', ring: '#4b4659', paw: '#3a3345', nose: '#1a1520', ear: '#e3a2b6' },
  ginger: { fur: '#dc813b', light: '#f5a965', dark: '#a85a26', belly: '#fde8cf', mask: '#4a2414', ring: '#7a3e1a', paw: '#3d2014', nose: '#1a1210', ear: '#f3b3a2' },
  midnight: { fur: '#4f5478', light: '#737ba6', dark: '#363a59', belly: '#cdd1ea', mask: '#14152a', ring: '#23253f', paw: '#191a2e', nose: '#0b0b16', ear: '#b88bab' },
  snowy: { fur: '#eceaf3', light: '#ffffff', dark: '#c6c0d6', belly: '#ffffff', mask: '#a79fbd', ring: '#cdc6de', paw: '#b1a9c5', nose: '#e07a95', ear: '#ffc0d0' },
  golden: { fur: '#eab63a', light: '#ffe27c', dark: '#bf8a1c', belly: '#fff4c8', mask: '#6b4a10', ring: '#a8740f', paw: '#5a3c0c', nose: '#2a1a05', ear: '#ffb3a0' },
};

// ---------------------------------------------------------------- accessories
const leafy = (x, y) => ['#4caf50', '#3d9142', '#6cc75a', '#2f7a36'][(x * 7 + y * 13 + ((x * y) % 5)) % 4];
export const ACC_DRAW = {
  // head
  party_hat(a, hx, hy) {
    a.poly([[hx - 4, hy - 4], [hx + 2.5, hy - 4], [hx - 1, hy - 13]], (x, y) => ((y - hy) & 2) ? '#ffd23f' : '#ff5fa2');
    a.circle(hx - 1, hy - 13, 1.4, '#ffffff');
  },
  traffic_cone(a, hx, hy) {
    a.poly([[hx - 3.5, hy - 4], [hx + 2.5, hy - 4], [hx - 0.5, hy - 14]], (x, y) => (y >= hy - 10 && y <= hy - 8) ? '#ffffff' : (x < hx - 1 ? '#f0701d' : '#ff8f33'));
    a.rect(hx - 5, hy - 5, 10, 2, '#d9561a');
  },
  gnome_hat(a, hx, hy) {
    a.poly([[hx - 5, hy - 3], [hx + 3, hy - 3], [hx - 2, hy - 9], [hx - 7, hy - 13]], (x) => (x < hx - 2 ? '#c62834' : '#e8404a'));
    a.rect(hx - 5, hy - 4, 8, 1, '#a51f2a');
  },
  sun_hat(a, hx, hy) {
    a.ellipse(hx - 0.5, hy - 6.5, 3.8, 2.8, (x, y, nx, ny) => (ny < -0.3 ? '#ffe39a' : '#f2cf6b'));
    a.rect(hx - 4, hy - 6, 8, 1, '#e0474c');
    a.ellipse(hx - 0.5, hy - 4.5, 7.5, 1.4, (x, y, nx, ny) => (ny > 0.2 ? '#d9b04e' : '#f2cf6b'));
  },
  chef_hat(a, hx, hy) {
    a.rect(hx - 4, hy - 6, 7, 3, '#f4f6fb');
    a.line(hx - 4, hy - 4, hx + 2, hy - 4, '#d5dbe6');
    a.circle(hx - 3, hy - 8, 2.6, '#ffffff'); a.circle(hx + 1.5, hy - 8.5, 2.6, '#ffffff'); a.circle(hx - 0.5, hy - 10.5, 3, '#ffffff');
    a.set(hx + 2, hy - 7, '#dfe4ee'); a.set(hx - 4, hy - 7, '#dfe4ee');
  },
  miner_helmet(a, hx, hy) {
    a.ellipse(hx - 0.5, hy - 3.5, 5.5, 4.2, (x, y, nx, ny) => (y > hy - 4 ? null : ny < -0.5 ? '#ffe066' : '#ffc629'));
    a.rect(hx - 6, hy - 4, 12, 1, '#d99a1e');
    a.circle(hx + 3.5, hy - 6, 1.6, '#fff7c2'); a.set(hx + 3, hy - 7, '#ffffff');
  },
  crown(a, hx, hy) {
    const g = '#ffcf33', d = '#d99a1e';
    a.rect(hx - 4.5, hy - 7, 8, 3, g); a.line(hx - 4.5, hy - 5, hx + 3, hy - 5, d);
    a.tri(hx - 5, hy - 7, hx - 2.5, hy - 7, hx - 4, hy - 11, g);
    a.tri(hx - 2, hy - 7, hx + 0.5, hy - 7, hx - 1, hy - 12, g);
    a.tri(hx + 1, hy - 7, hx + 3.5, hy - 7, hx + 2.5, hy - 11, g);
    a.set(hx - 3, hy - 6, '#e8333a'); a.set(hx, hy - 6, '#3a8ee8'); a.set(hx + 2, hy - 6, '#3ac46a');
  },
  // face
  monocle(a, hx, hy) {
    for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; a.set(hx + 2.5 + Math.cos(t) * 1.9, hy + 0.5 + Math.sin(t) * 1.9, '#ffd166'); }
    a.line(hx + 1, hy + 2, hx - 1, hy + 6, '#e0b050');
  },
  goggles(a, hx, hy) {
    a.line(hx - 4, hy - 1, hx, hy - 1, '#3d7bd9');
    a.circle(hx + 2.2, hy, 2.3, '#2f5fb0'); a.circle(hx + 2.2, hy, 1.4, '#9fe8ff'); a.set(hx + 1.5, hy - 1, '#ffffff');
  },
  clown_nose(a, hx, hy) { a.circle(hx + 7.5, hy + 0.5, 1.8, '#ff2e3f'); a.set(hx + 7, hy - 0.5, '#ffb3b8'); },
  disco_shades(a, hx, hy) {
    a.line(hx - 3, hy - 1, hx, hy - 1, '#222233');
    a.rect(hx, hy - 1, 6, 2, '#ff4fd8'); a.set(hx + 1, hy - 1, '#8ff6ff'); a.set(hx + 4, hy - 1, '#8ff6ff'); a.set(hx + 3, hy, '#b02fa0');
  },
  // neck
  red_bandana(a, hx, hy) {
    a.poly([[hx - 6, hy + 2.5], [hx + 1, hy + 2.5], [hx - 3, hy + 7.5]], '#e23b3b');
    a.set(hx - 4, hy + 4, '#ffffff'); a.set(hx - 1, hy + 4, '#ffffff'); a.set(hx - 3, hy + 6, '#ffffff');
  },
  blue_ribbon(a, hx, hy) {
    a.line(hx - 3.5, hy + 6, hx - 4.5, hy + 9, '#2f58b8'); a.line(hx - 1.5, hy + 6, hx - 0.5, hy + 9, '#2f58b8');
    a.circle(hx - 2.5, hy + 4.5, 2.3, '#3a6fe0'); a.circle(hx - 2.5, hy + 4.5, 1, '#ffd23f');
  },
  dog_collar(a, hx, hy) {
    a.line(hx - 5, hy + 3, hx + 1, hy + 4, '#c0392b'); a.line(hx - 5, hy + 4, hx + 1, hy + 5, '#962d22');
    a.circle(hx - 1.5, hy + 6, 1.2, '#ffd166');
  },
  striped_scarf(a, hx, hy, ph = 0) {
    for (let x = hx - 6; x <= hx + 1; x++) for (let y = hy + 3; y <= hy + 4; y++) a.set(x, y, (x & 1) ? '#e84a4a' : '#ffffff');
    for (let i = 0; i < 6; i++) { const x = hx - 6 - i, y = hy + 4 + Math.round(i * 0.6 + (i > 2 ? ph : 0)); a.set(x, y, (i & 1) ? '#ffffff' : '#e84a4a'); a.set(x, y + 1, (i & 1) ? '#e84a4a' : '#ffffff'); }
  },
  gold_chain(a, hx, hy) {
    for (let i = 0; i <= 8; i++) { const t = i / 8; const x = hx - 5 + t * 6, y = hy + 3 + Math.sin(t * Math.PI) * 3.5; a.set(x, y, i & 1 ? '#d99a1e' : '#ffe066'); }
    a.rect(hx - 3, hy + 6, 2, 2, '#ffe680'); a.set(hx - 3, hy + 7, '#d99a1e');
  },
  // back (drawn over the body, under the head)
  leaf_cape(a, hx, hy, bx, by) {
    a.poly([[hx - 2, hy + 2], [hx - 5, hy + 5], [bx - 2, by - 6], [bx - 7, by - 5], [bx - 10, by], [bx - 9, by + 4], [bx - 5, by + 1], [bx + 1, by - 1], [hx - 3, hy + 6]], leafy);
  },
  royal_cape(a, hx, hy, bx, by) {
    a.poly([[hx - 2, hy + 2], [hx - 5, hy + 5], [bx - 2, by - 6], [bx - 7, by - 5], [bx - 10, by], [bx - 9, by + 4], [bx - 5, by + 1], [bx + 1, by - 1], [hx - 3, hy + 6]], (x, y) => (y > by + 1 || (x < bx - 8 && y > by - 2)) ? ((x + y) % 3 === 0 ? '#1d1a22' : '#ffffff') : (y < by - 4 ? '#d63a44' : '#b3202a'));
  },
};

// ---------------------------------------------------------------- raccoon
const RPOSE = {
  idle: [{ bob: 0, tail: 1, wag: 0 }, { bob: 0, tail: 1, wag: 1 }, { bob: 1, tail: 1, wag: 1 }, { bob: 1, tail: 1, wag: 0 }],
  walk: [
    { legs: [2, -2, -2, 2], bob: 0, tail: 0.8 }, { legs: [0, 0, 0, 0], bob: -1, tail: 0.8, wag: 1 },
    { legs: [-2, 2, 2, -2], bob: 0, tail: 0.8 }, { legs: [0, 0, 0, 0], bob: -1, tail: 0.8, wag: -1 }],
  run: [
    { legs: [3, 3, -3, -3], bob: 0, stretch: 1, tail: 0.15 }, { legs: [-1, -1, 2, 2], bob: -2, tail: 0.25, lift: 1 },
    { legs: [1, 2, -1, 0], bob: -1, stretch: 1, tail: 0.15 }, { legs: [-3, -3, 3, 3], bob: 0, tail: 0.2 }],
  sneak: [
    { legs: [1, -1, -1, 1], crouch: 2, headDX: 1, tail: 0.35 }, { legs: [0, 0, 0, 0], crouch: 2, headDX: 1, tail: 0.35, wag: 1 },
    { legs: [-1, 1, 1, -1], crouch: 2, headDX: 1, tail: 0.35 }, { legs: [0, 0, 0, 0], crouch: 2, headDX: 1, tail: 0.35, wag: -1 }],
  chitter: [{ headDY: -1, mouth: 1, tail: 1, wag: 1 }, { headDY: -1, mouth: 0, tail: 1, bob: 1 }],
  stun: [{ eyes: 'x', bob: 1, tail: 0.3 }, { eyes: 'x', bob: 1, tail: 0.3, wag: 1 }],
  dig: [{ headDY: 3, headDX: 1, crouch: 1, legs: [3, -1, 0, 0], tail: 1, wag: 1 }, { headDY: 3, headDX: 1, crouch: 1, legs: [-1, 3, 0, 0], tail: 1, wag: -1 }],
  sit: [{ bob: 0, tail: 1, eyes: 'closed' }],
};
export const RACCOON_ANIMS = {};
{
  let i = 0;
  for (const k of Object.keys(RPOSE)) { RACCOON_ANIMS[k] = RPOSE[k].map(() => i++); }
}

function leg(a, hipX, hipY, dx, footY, c, paw) {
  for (let y = hipY; y <= footY; y++) {
    const t = (y - hipY) / Math.max(1, footY - hipY);
    const x = Math.round(hipX + dx * t);
    a.rect(x, y, 2, 1, c);
  }
  a.rect(Math.round(hipX + dx), footY, 3, 1, paw);
}

export function drawRaccoon(p, pal, lo = {}, phase = 0) {
  const a = new PixelArt(32, 32);
  const bob = p.bob || 0, cr = p.crouch || 0, st = p.stretch || 0;
  const bx = 15, by = 21 + bob + cr;
  const brx = 7.5 + st, bry = 5 - cr * 0.4;
  const hx = 23 + (p.headDX || 0) + st, hy = 15 + bob + Math.round(cr * 1.5) + (p.headDY || 0);
  const L = p.legs || [0, 0, 0, 0];
  const footY = 29 - (p.lift || 0);
  const hipY = Math.round(by + 2);
  const bellyC = mix(pal.fur, pal.belly, 0.55);
  // far legs (darker)
  leg(a, bx - 5 + 1, hipY, L[3], footY, pal.dark, pal.paw);
  leg(a, bx + 4 + 1, hipY, L[1], footY, pal.dark, pal.paw);
  // tail
  const curl = p.tail ?? 1, wag = p.wag || 0;
  const tbx = bx - brx + 1.5, tby = by - 1;
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    const x = tbx - t * (6.5 + (1 - curl) * 2.5) + wag * t;
    const y = tby - t * t * 9 * curl - t * 1.5 * (1 - curl);
    const band = Math.floor(t * 6);
    a.circle(x, y, 2.7 - t * 0.7, band % 2 === 1 || band === 5 ? pal.ring : pal.fur);
  }
  // body
  a.ellipse(bx, by, brx, bry, (x, y, nx, ny) => (ny > 0.4 ? bellyC : ny < -0.45 ? pal.light : nx < -0.65 && ny > -0.1 ? pal.dark : pal.fur));
  if (lo.back && ACC_DRAW[lo.back]) ACC_DRAW[lo.back](a, hx, hy, bx, Math.round(by), phase);
  // near legs
  leg(a, bx - 5, hipY, L[2], footY, pal.fur, pal.paw);
  leg(a, bx + 4, hipY, L[0], footY, pal.fur, pal.paw);
  // head
  a.ellipse(hx, hy, 5, 4.5, (x, y, nx, ny) => (ny < -0.45 && nx < 0.3 ? pal.light : ny > 0.6 ? pal.dark : pal.fur));
  a.tri(hx - 4.5, hy - 2, hx - 3.5, hy - 7.5, hx - 0.8, hy - 3, pal.fur);
  a.tri(hx - 1, hy - 3, hx + 1, hy - 8, hx + 3, hy - 2.5, pal.fur);
  a.set(hx - 3, hy - 4, pal.ear); a.set(hx - 3, hy - 5, pal.ear); a.set(hx + 1, hy - 5, pal.ear); a.set(hx + 1, hy - 4, pal.ear);
  a.set(hx - 4, hy + 2, pal.belly); a.set(hx - 4, hy + 3, pal.belly); a.set(hx - 3, hy + 3, pal.belly); a.set(hx - 5, hy + 1, pal.light);
  // snout + nose
  a.ellipse(hx + 4.5, hy + 1.5, 2.9, 1.9, pal.belly);
  a.set(hx + 7, hy, pal.nose); a.set(hx + 7, hy + 1, pal.nose); a.set(hx + 6, hy, pal.nose);
  // brow + mask
  a.line(hx - 1, hy - 2, hx + 4, hy - 2, pal.belly);
  for (let y = hy - 1; y <= hy + 1; y++) for (let x = hx - 3; x <= hx + 4; x++) if (!(y === hy + 1 && x > hx + 3)) a.set(x, y, pal.mask);
  a.set(hx - 4, hy, pal.mask);
  const eyes = p.eyes || 'open';
  if (eyes === 'open') { a.set(hx + 2, hy, '#ffffff'); a.set(hx + 2, hy - 1, '#ffffff'); a.set(hx + 3, hy, '#0d0a12'); }
  else if (eyes === 'x') { a.set(hx + 1, hy - 1, '#ffffff'); a.set(hx + 3, hy + 1, '#ffffff'); a.set(hx + 2, hy, '#ffffff'); a.set(hx + 3, hy - 1, '#ffffff'); a.set(hx + 1, hy + 1, '#ffffff'); }
  else { a.line(hx + 1, hy, hx + 3, hy, '#8a8098'); }
  if (p.mouth) {
    a.line(hx + 3, hy + 3, hx + 6, hy + 3, '#3a1f2a');
    a.set(hx + 4, hy + 4, '#e06080'); a.set(hx + 5, hy + 4, '#e06080'); a.set(hx + 3, hy + 4, pal.belly);
  }
  // accessories
  if (lo.neck && ACC_DRAW[lo.neck]) ACC_DRAW[lo.neck](a, hx, hy, phase);
  if (lo.face && ACC_DRAW[lo.face]) ACC_DRAW[lo.face](a, hx, hy, phase);
  if (lo.head && ACC_DRAW[lo.head]) ACC_DRAW[lo.head](a, hx, hy, phase);
  a.outline(OUTLINE);
  return { art: a, mouth: [hx + 7, hy + 3], head: [hx, hy] };
}

export function buildRaccoonSheet(loadout) {
  const pal = FURS[loadout.fur] || FURS.classic;
  const frames = [], anchors = [];
  for (const k of Object.keys(RPOSE)) {
    RPOSE[k].forEach((pose, i) => {
      const r = drawRaccoon(pose, pal, loadout, i % 2);
      frames.push(r.art); anchors.push({ mouth: r.mouth, head: r.head });
    });
  }
  const sheet = new Sheet(32, 32, frames);
  sheet.anchors = anchors;
  sheet.anims = RACCOON_ANIMS;
  return sheet;
}

export function accessoryIcon(id, scale = 3) {
  const slot = id.includes('cape') ? 'back' : ['monocle', 'goggles', 'clown_nose', 'disco_shades'].includes(id) ? 'face' : ['red_bandana', 'blue_ribbon', 'dog_collar', 'striped_scarf', 'gold_chain'].includes(id) ? 'neck' : 'head';
  const full = drawRaccoon(RPOSE.idle[0], FURS.classic, { [slot]: id }).art;
  if (slot === 'back') return full.toCanvas(scale);
  const a = new PixelArt(24, 24);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { const v = full.get(x + 10, y + (slot === 'head' ? 0 : 4)); if (v) a.data[y * 24 + x] = v; }
  return a.toCanvas(scale);
}
export function raccoonPortrait(loadout, scale = 4, anim = 'idle', frame = 0) {
  const pal = FURS[loadout.fur] || FURS.classic;
  return drawRaccoon(RPOSE[anim][frame], pal, loadout, frame % 2).art.toCanvas(scale);
}

// ---------------------------------------------------------------- humans
export const HUMAN_SPECS = {
  gardener: { skin: '#f2c29b', skinD: '#d99f7a', hair: '#ececec', shirt: '#f7f2e2', shirtD: '#dcd4bd', pants: '#4f9d5a', pantsD: '#3b7d45', overalls: '#4f9d5a', shoes: '#6b4428', gloves: '#f28c28', hat: 'straw', mustache: '#f4f4f4', belly: 0, shortsSkin: false },
  dad: { skin: '#eab28c', skinD: '#c98d68', hair: '#5a3a22', shirt: '#4a86d9', shirtD: '#3a6cb5', pants: '#d9c08a', pantsD: '#bba26d', apron: true, shoes: '#3a3a3a', gloves: null, hat: 'cap', mustache: '#5a3a22', belly: 2, shortsSkin: true },
};
const HAND = {
  down: [1, 11], swingF: [4, 10], swingB: [-3, 10], reach: [9, 4], up: [3, -11], hold: [7, 6],
  work1: [7, 9], work2: [10, 4], wave1: [6, -9], wave2: [9, -6], out: [7, 8], danceA: [-3, -10], danceB: [7, -10], pick: [8, 14],
};
const HPOSE = {
  idle: [{ arm: 'down', armF: 'down' }, { arm: 'down', armF: 'down', bob: 1 }],
  walk: [
    { leg: 3, arm: 'swingB', armF: 'swingF' }, { leg: 0, arm: 'down', armF: 'down', bob: -1 },
    { leg: -3, arm: 'swingF', armF: 'swingB' }, { leg: 0, arm: 'down', armF: 'down', bob: -1 }],
  run: [
    { leg: 5, arm: 'swingB', armF: 'reach', lean: 1 }, { leg: 0, arm: 'down', armF: 'down', bob: -2, lean: 1 },
    { leg: -5, arm: 'reach', armF: 'swingB', lean: 1 }, { leg: 0, arm: 'down', armF: 'down', bob: -2, lean: 1 }],
  work: [{ arm: 'work1', armF: 'work1' }, { arm: 'work2', armF: 'work2', bob: 1 }],
  angry: [{ arm: 'up', armF: 'out' }, { arm: 'wave2', armF: 'out', bob: -1 }],
  hold: [{ arm: 'hold', armF: 'hold' }],
  holdwalk: [{ leg: 3, arm: 'hold', armF: 'hold' }, { leg: 0, arm: 'hold', armF: 'hold', bob: -1 }, { leg: -3, arm: 'hold', armF: 'hold' }, { leg: 0, arm: 'hold', armF: 'hold', bob: -1 }],
  dance: [{ arm: 'danceA', armF: 'danceB', leg: 2, lean: -1 }, { arm: 'danceB', armF: 'danceA', leg: -2, lean: 1, bob: -1 }],
  slip: [{ arm: 'up', armF: 'up', leg: 4, slip: true }],
  surprised: [{ arm: 'out', armF: 'out', bob: -1 }],
  pick: [{ arm: 'pick', armF: 'pick', bob: 2, lean: 2 }],
  wet: [{ arm: 'out', armF: 'out', bob: 0 }, { arm: 'out', armF: 'out', bob: 1, lean: 1 }],
};
export const HUMAN_ANIMS = {};
{
  let i = 0;
  for (const k of Object.keys(HPOSE)) HUMAN_ANIMS[k] = HPOSE[k].map(() => i++);
}

function drawHuman(s, p, hatOn) {
  const a = new PixelArt(48, 48);
  const lean = p.lean || 0, bob = p.bob || 0;
  const cx = 23, hipY = 33 + bob, shY = 21 + bob, headY = 12 + bob;
  const leg = p.leg || 0;
  const limb = (x0, y0, x1, y1, c, w) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) { const t = i / n; a.rect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), w, w, c); }
  };
  const drawLeg = (x, dx, far) => {
    const kneeY = hipY + 6;
    const c = far ? s.pantsD : s.pants;
    limb(x, hipY, x + dx * 0.5, kneeY, c, 3);
    limb(x + dx * 0.5, kneeY, x + dx, 43, s.shortsSkin ? (far ? s.skinD : s.skin) : c, 3);
    a.rect(Math.round(x + dx) - 1, 44, 6, 2, far ? mix(s.shoes, '#000000', 0.25) : s.shoes);
  };
  const drawArm = (pose, far) => {
    const [hdx, hdy] = HAND[pose] || HAND.down;
    const sx = cx + (far ? 2 : -1) + lean, sy = shY + 1;
    const ex = sx + hdx * 0.5, ey = sy + hdy * 0.5;
    limb(sx, sy, ex, ey, far ? s.shirtD : s.shirt, 3);
    limb(ex, ey, sx + hdx, sy + hdy, far ? s.skinD : s.skin, 3);
    a.rect(Math.round(sx + hdx) - 1, Math.round(sy + hdy) - 1, 4, 4, s.gloves ? (far ? mix(s.gloves, '#000000', 0.2) : s.gloves) : (far ? s.skinD : s.skin));
  };
  drawArm(p.armF || 'down', true);
  drawLeg(cx + 2, -leg, true);
  drawLeg(cx - 1, leg, false);
  // torso
  a.ellipse(cx + 1 + lean, (shY + hipY) / 2 + 1, 6, (hipY - shY) / 2 + 2.5, (x, y, nx, ny) => (nx < -0.55 ? s.shirtD : s.shirt));
  if (s.belly) a.ellipse(cx + 4 + lean, hipY - 5, 3 + s.belly, 5, (x, y, nx) => (nx > 0.6 ? s.shirtD : s.shirt));
  a.rect(cx - 4 + lean, hipY - 2, 11, 3, s.pants);
  if (s.overalls) {
    a.rect(cx - 2 + lean, shY + 4, 7, hipY - shY - 3, s.overalls);
    a.line(cx - 2 + lean, shY, cx - 2 + lean, shY + 4, s.overalls); a.line(cx + 4 + lean, shY, cx + 4 + lean, shY + 4, s.overalls);
    a.set(cx + 1 + lean, shY + 6, '#ffd166'); a.rect(cx + lean, shY + 8, 3, 2, s.pantsD);
  }
  if (s.apron) {
    a.rect(cx - 1 + lean, shY + 3, 8 + s.belly, hipY - shY + 2, '#fbfbf7');
    a.line(cx + lean, shY, cx + 2 + lean, shY + 3, '#fbfbf7');
    a.set(cx + 3 + lean, shY + 8, '#e8413c'); a.set(cx + 5 + lean, shY + 8, '#e8413c'); a.rect(cx + 3 + lean, shY + 9, 3, 1, '#e8413c'); a.set(cx + 4 + lean, shY + 10, '#e8413c');
  }
  // head
  const hx = cx + 2 + lean;
  a.rect(hx - 1, shY - 3, 3, 3, s.skinD);
  a.ellipse(hx, headY, 5.5, 6, (x, y, nx) => (nx < -0.6 ? s.skinD : s.skin));
  a.rect(hx + 5, headY, 2, 3, s.skin); a.set(hx + 6, headY + 2, s.skinD); // nose
  a.set(hx + 3, headY - 1, '#2a1b30'); a.set(hx + 3, headY - 2, '#2a1b30');
  a.set(hx - 2, headY + 1, s.skinD); a.set(hx - 2, headY, s.skinD); // ear
  if (s.mustache) { a.rect(hx + 3, headY + 3, 5, 2, s.mustache); a.set(hx + 7, headY + 5, s.mustache); }
  if (s.hat === 'straw' && hatOn) {
    a.ellipse(hx, headY - 5, 4.5, 2.8, (x, y, nx, ny) => (ny < -0.3 ? '#ffe39a' : '#f2cf6b'));
    a.rect(hx - 4, headY - 4, 9, 1, '#e0474c');
    a.ellipse(hx, headY - 3, 9, 1.5, (x, y, nx, ny) => (ny > 0.2 ? '#d9b04e' : '#f2cf6b'));
  } else if (s.hat === 'cap') {
    a.ellipse(hx, headY - 3, 5.5, 3.5, (x, y, nx, ny) => (y > headY - 3 ? null : ny < -0.4 ? '#ff6b61' : '#e8413c'));
    a.rect(hx + 3, headY - 4, 6, 2, '#c7302a');
    a.rect(hx - 5, headY - 3, 3, 3, s.hair);
  } else {
    // bald top with hair fringe (hat stolen!)
    a.rect(hx - 5, headY - 2, 3, 5, s.hair); a.set(hx - 4, headY - 3, s.hair);
    a.set(hx + 1, headY - 5, '#ffffff'); a.set(hx + 2, headY - 5, '#ffe5d0');
  }
  a.outline(OUTLINE);
  if (p.slip) return a.mapTo(48, 48, (x, y) => [y - 2, 46 - (x - 13)]);
  return a;
}

export function buildHumanSheet(kind, hatOn = true) {
  const s = HUMAN_SPECS[kind];
  const frames = [];
  for (const k of Object.keys(HPOSE)) for (const pose of HPOSE[k]) frames.push(drawHuman(s, pose, hatOn));
  const sheet = new Sheet(48, 48, frames);
  sheet.anims = HUMAN_ANIMS;
  return sheet;
}

// ---------------------------------------------------------------- dog
const DPOSE = {
  sleep: [{ sleep: 1 }, { sleep: 1, bob: 1 }],
  idle: [{ wag: 0 }, { wag: 1, bob: 1 }],
  run: [{ legs: [3, -3], stretch: 1 }, { legs: [0, 0], bob: -2 }, { legs: [-3, 3], stretch: 1 }, { legs: [0, 0], bob: -1 }],
  bark: [{ mouth: 1, bob: -1 }, { mouth: 0 }],
  wag: [{ wag: -1 }, { wag: 1, bob: 1 }],
  eat: [{ head: 4, wag: 1 }, { head: 3, wag: -1 }],
};
export const DOG_ANIMS = {};
{ let i = 0; for (const k of Object.keys(DPOSE)) DOG_ANIMS[k] = DPOSE[k].map(() => i++); }
function drawDog(p) {
  const a = new PixelArt(32, 32);
  const fur = '#d9a15a', furD = '#b37a3a', furL = '#f0c889', ear = '#7a4a24';
  const bob = p.bob || 0;
  if (p.sleep) {
    a.ellipse(16, 27 + bob * 0.5, 9, 3.6, (x, y, nx, ny) => (ny < -0.4 ? furL : fur));
    a.circle(8, 26, 2, fur); // tail curled
    a.ellipse(25, 26.5, 4.2, 3.2, fur); a.ellipse(28, 27.5, 2.2, 1.5, furL);
    a.set(30, 27, '#1a1520'); a.line(24, 26, 26, 26, '#4a2a18');
    a.poly([[21, 23], [24, 23], [22, 29]], ear);
    a.rect(20, 25, 1, 3, '#d6312f');
    a.outline(OUTLINE); return a;
  }
  const st = p.stretch || 0, by = 21 + bob;
  const L = p.legs || [0, 0];
  const legD = (x, dx, c) => { for (let y = by + 2; y <= 29; y++) a.rect(Math.round(x + dx * (y - by - 2) / 7), y, 2, 1, c); a.rect(Math.round(x + dx), 29, 3, 1, furD); };
  legD(10, -L[1], furD); legD(20, L[0], furD);
  const wag = p.wag || 0;
  a.line(8 - st, by - 1, 5 - st + wag, by - 6 + Math.abs(wag), fur, 2);
  a.ellipse(15, by, 8 + st, 4.6, (x, y, nx, ny) => (ny < -0.4 ? furL : ny > 0.5 ? furD : fur));
  legD(9, L[1], fur); legD(19, -L[0], fur);
  const hy = 15 + bob + (p.head || 0), hx = 24 + st;
  a.circle(hx, hy, 4.5, fur);
  a.ellipse(hx + 4, hy + 2, 2.8, 1.9, furL);
  a.set(hx + 6, hy + 1, '#1a1520'); a.set(hx + 7, hy + 1, '#1a1520');
  a.set(hx + 1, hy - 1, '#1a1520');
  if (p.mouth) { a.line(hx + 2, hy + 4, hx + 6, hy + 4, '#3a1f2a'); a.set(hx + 4, hy + 5, '#e06080'); }
  a.poly([[hx - 3, hy - 4], [hx, hy - 4], [hx - 2, hy + 3]], ear);
  a.rect(hx - 4, hy + 3, 2, 3, '#d6312f'); a.set(hx - 3, hy + 6, '#ffd166');
  a.outline(OUTLINE);
  return a;
}
export function buildDogSheet() {
  const frames = [];
  for (const k of Object.keys(DPOSE)) for (const pose of DPOSE[k]) frames.push(drawDog(pose));
  const sheet = new Sheet(32, 32, frames);
  sheet.anims = DOG_ANIMS;
  return sheet;
}

// ---------------------------------------------------------------- items (24x24, bottom-centered)
const ITEM_DRAW = {
  banana(a) {
    a.poly([[12, 12], [7, 20], [9, 21], [12, 16]], '#ffe14d'); a.poly([[12, 12], [17, 20], [15, 21], [12, 16]], '#f5cf2a');
    a.poly([[11, 12], [13, 12], [13, 21], [11, 21]], '#ffe985'); a.rect(11, 10, 2, 2, '#8a5a2b'); a.set(8, 21, '#8a5a2b'); a.set(16, 21, '#8a5a2b');
  },
  soda(a) { a.rect(9, 12, 7, 10, '#e8413c'); a.rect(9, 11, 7, 1, '#cfd6e0'); a.rect(9, 16, 7, 2, '#ffffff'); a.rect(10, 12, 1, 9, '#ff7a70'); },
  hambone(a) {
    a.circle(7, 17, 2.2, '#f4efe6'); a.circle(7, 20, 2.2, '#f4efe6'); a.rect(7, 17, 9, 3, '#f4efe6');
    a.ellipse(15, 18.5, 4, 3.5, '#e07a7a'); a.ellipse(15, 18, 2.5, 2, '#f09a9a');
  },
  pizza(a) { a.poly([[5, 13], [19, 13], [12, 22]], '#ffd166'); a.rect(5, 12, 15, 2, '#d99a4e'); a.circle(10, 16, 1.2, '#d64545'); a.circle(14, 17, 1.2, '#d64545'); a.set(12, 19, '#d64545'); },
  apple(a) { a.ellipse(12, 13, 3.5, 2, '#e23b3b'); a.rect(10, 14, 4, 5, '#fff3d6'); a.ellipse(12, 20, 3.5, 2, '#e23b3b'); a.line(12, 10, 13, 8, '#6b4428'); a.set(11, 16, '#4a2a18'); },
  boot(a) { a.rect(8, 9, 6, 11, '#7a4b2a'); a.rect(8, 17, 11, 4, '#7a4b2a'); a.rect(8, 21, 12, 1, '#3a2414'); a.line(9, 11, 12, 11, '#e8d9b0'); a.line(9, 13, 12, 13, '#e8d9b0'); a.rect(8, 9, 6, 1, '#5e3a20'); },
  gnome(a) {
    a.poly([[8, 9], [16, 9], [12, 1]], '#e8404a'); a.rect(8, 9, 8, 1, '#a51f2a');
    a.ellipse(12, 11, 3.5, 2.5, '#f7c8a4'); a.set(13, 11, '#e98a7a');
    a.poly([[8, 12], [16, 12], [12, 18]], '#ffffff');
    a.rect(8, 15, 8, 6, '#3a6fe0'); a.rect(8, 18, 8, 1, '#6b4428'); a.rect(8, 21, 3, 2, '#6b4428'); a.rect(13, 21, 3, 2, '#6b4428');
    a.poly([[8, 12], [16, 12], [12, 18]], '#ffffff');
  },
  trowel(a) { a.rect(11, 6, 3, 7, '#a0673a'); a.rect(11, 13, 3, 1, '#6d6d7a'); a.poly([[8, 14], [16, 14], [12, 22]], '#b8c2cc'); a.line(12, 15, 12, 20, '#8995a3'); },
  tomato(a) {
    a.ellipse(12, 16, 6.5, 5.5, (x, y, nx, ny) => (nx < -0.2 && ny < -0.2 ? '#ff6b5e' : ny > 0.5 ? '#c7261d' : '#ff3b30'));
    a.set(9, 13, '#ffd0c8'); a.poly([[9, 10], [15, 10], [12, 13]], '#3aa64a'); a.rect(11, 8, 2, 3, '#2f7a36');
    a.circle(17, 18, 1.8, '#3a6fe0'); a.set(17, 18, '#ffd23f');
  },
  sunhat(a) { a.ellipse(12, 16, 4.5, 3.5, (x, y, nx, ny) => (ny < -0.3 ? '#ffe39a' : '#f2cf6b')); a.rect(8, 17, 9, 2, '#e0474c'); a.ellipse(12, 19.5, 10, 2, (x, y, nx, ny) => (ny > 0.2 ? '#d9b04e' : '#f2cf6b')); },
  sausage(a) { a.ellipse(12, 17, 7, 2.6, '#b5452f'); a.line(8, 16, 9, 18, '#6e2a1c'); a.line(12, 16, 13, 18, '#6e2a1c'); a.line(16, 16, 17, 18, '#6e2a1c'); a.line(7, 16, 15, 15, '#d9735a'); },
  spatula(a) { a.rect(11, 3, 2, 9, '#2c2c34'); a.rect(8, 12, 8, 9, '#c9d1dc'); a.line(10, 14, 10, 19, '#8995a3'); a.line(12, 14, 12, 19, '#8995a3'); a.line(14, 14, 14, 19, '#8995a3'); },
  trophy(a) {
    a.rect(8, 20, 8, 3, '#6b4428'); a.rect(10, 17, 4, 3, '#d99a1e'); a.rect(11, 15, 2, 2, '#ffcf33');
    a.ellipse(12, 9, 5, 6, (x, y, nx, ny) => (y > 9 && ny > 0.6 ? '#d99a1e' : nx < -0.3 ? '#ffe680' : '#ffcf33'));
    a.rect(7, 4, 10, 2, '#ffcf33');
    for (let i = 0; i < 4; i++) { a.set(5, 6 + i, '#e0b030'); a.set(18, 6 + i, '#e0b030'); }
    a.set(12, 8, '#ffffff'); a.set(11, 9, '#ffffff'); a.set(13, 9, '#ffffff'); a.set(12, 10, '#ffffff');
  },
  sock(a) { a.rect(10, 5, 5, 11, '#ff7eb6'); a.rect(7, 13, 8, 5, '#ff7eb6'); a.rect(10, 5, 5, 2, '#ffffff'); a.set(12, 9, '#ffffff'); a.set(11, 12, '#ffffff'); a.set(13, 14, '#ffffff'); a.set(9, 15, '#ffffff'); },
  sock2(a) { a.rect(10, 5, 5, 11, '#5ab5f0'); a.rect(7, 13, 8, 5, '#5ab5f0'); for (let y = 5; y < 18; y += 3) a.rect(7, y, 8, 1, '#ffffff'); a.rect(7, 5, 3, 8, '#00000000'); },
  duck(a) { a.ellipse(11, 18, 6, 4, '#ffd23f'); a.circle(15, 12, 3.2, '#ffd23f'); a.rect(17, 12, 3, 2, '#ff8a2a'); a.set(16, 11, '#2a1b30'); a.ellipse(9, 17, 3, 1.5, '#f5b82a'); },
  ball(a) { a.circle(12, 17, 4.5, '#d4f04a'); a.line(9, 14, 11, 20, '#ffffff'); a.line(14, 14, 15, 20, '#ffffff'); },
  flamingo(a) {
    a.line(11, 14, 11, 23, '#2a2a2a'); a.line(13, 14, 14, 23, '#2a2a2a');
    a.ellipse(12, 12, 5, 3.5, '#ff7eb6'); a.line(15, 11, 16, 4, '#ff7eb6', 2); a.circle(16, 3, 2, '#ff7eb6');
    a.rect(18, 3, 2, 2, '#2a1b30'); a.set(17, 2, '#2a1b30'); a.ellipse(10, 12, 2.5, 1.5, '#ff5fa2');
  },
};
export const ITEM_FRAMES = {};
export function buildItemSheet() {
  const frames = [];
  Object.keys(ITEM_DRAW).forEach((k, i) => {
    const a = new PixelArt(24, 24);
    ITEM_DRAW[k](a);
    a.outline(OUTLINE);
    frames.push(a);
    ITEM_FRAMES[k] = i;
  });
  return new Sheet(24, 24, frames);
}
export function itemIcon(id, scale = 3) {
  const a = new PixelArt(24, 24);
  ITEM_DRAW[id]?.(a); a.outline(OUTLINE);
  return a.toCanvas(scale);
}

// ---------------------------------------------------------------- emotes / fx (16x16)
export const FX = { alert: 0, question: 1, heart: 2, note: 3, zzz: 4, star: 5, sparkle: 6, anger: 7, drop: 8, stink: 9 };
export function buildFxSheet() {
  const frames = [];
  const bubble = (c, ch) => {
    const a = new PixelArt(16, 16);
    a.ellipse(8, 7, 6.5, 6.5, '#ffffff');
    a.tri(6, 12, 10, 12, 7, 15, '#ffffff');
    glyph(a, ch, ch === '!' ? 7 : 6, 3, c, ch === '!' ? 2 : 1.5);
    if (ch === '!') { a.rect(7, 3, 2, 6, c); a.rect(7, 10, 2, 2, c); }
    if (ch === '?') { a.clear(); a.ellipse(8, 7, 6.5, 6.5, '#ffffff'); a.tri(6, 12, 10, 12, 7, 15, '#ffffff'); a.pattern(5, 2, ['.###.', '#...#', '...#.', '..#..', '.....', '..#..'], { '#': c }); }
    a.outline(OUTLINE); return a;
  };
  frames.push(bubble('#ff3b3b', '!'));
  frames.push(bubble('#e0a400', '?'));
  { const a = new PixelArt(16, 16); a.circle(5.5, 6, 3.2, '#ff5f8f'); a.circle(10.5, 6, 3.2, '#ff5f8f'); a.tri(2.5, 7, 13.5, 7, 8, 13, '#ff5f8f'); a.set(5, 5, '#ffd0de'); a.outline(OUTLINE); frames.push(a); }
  { const a = new PixelArt(16, 16); a.ellipse(6, 12, 2.5, 2, '#5b4bd6'); a.rect(8, 3, 1, 9, '#5b4bd6'); a.rect(8, 3, 4, 2, '#5b4bd6'); a.rect(11, 5, 1, 2, '#5b4bd6'); a.outline('#ffffff'); frames.push(a); }
  { const a = new PixelArt(16, 16); glyph(a, 'Z', 2, 7, '#7fb8ff', 2); glyph(a, 'Z', 9, 2, '#bcdcff', 1); a.outline(OUTLINE); frames.push(a); }
  { const a = new PixelArt(16, 16); a.poly([[8, 1], [10, 6], [15, 6], [11, 9], [13, 15], [8, 11], [3, 15], [5, 9], [1, 6], [6, 6]], '#ffd23f'); a.set(7, 6, '#fff3b0'); a.outline(OUTLINE); frames.push(a); }
  { const a = new PixelArt(16, 16); a.poly([[8, 0], [9.5, 6.5], [16, 8], [9.5, 9.5], [8, 16], [6.5, 9.5], [0, 8], [6.5, 6.5]], '#fff6b0'); a.rect(7, 7, 2, 2, '#ffffff'); frames.push(a); }
  { const a = new PixelArt(16, 16); const r = '#ff3b3b'; a.rect(3, 3, 3, 2, r); a.rect(3, 3, 2, 3, r); a.rect(10, 3, 3, 2, r); a.rect(11, 3, 2, 3, r); a.rect(3, 11, 2, 3, r); a.rect(3, 12, 3, 2, r); a.rect(11, 10, 2, 3, r); a.rect(10, 12, 3, 2, r); a.outline('#ffffff'); frames.push(a); }
  { const a = new PixelArt(16, 16); a.tri(8, 2, 4, 9, 12, 9, '#5ec8ff'); a.circle(8, 10, 4, '#5ec8ff'); a.set(6, 9, '#d8f4ff'); a.outline(OUTLINE); frames.push(a); }
  { const a = new PixelArt(16, 16); a.line(4, 13, 6, 3, '#9bd35a', 1); a.line(8, 13, 10, 3, '#9bd35a', 1); a.line(12, 13, 13, 5, '#9bd35a', 1); frames.push(a); }
  return new Sheet(16, 16, frames);
}
