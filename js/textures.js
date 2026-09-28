// Procedural pixel textures for the 3D diorama (HD-2D style: crisp texels on low-poly geometry).
import * as THREE from 'three';
import { PixelArt, mix } from './pixel.js';
import { mulberry32 } from './util.js';

function toTex(pa, { nearest = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(pa instanceof PixelArt ? pa.toCanvas(1) : pa);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function noise(pa, rng, palette, weights) {
  const tot = weights.reduce((a, b) => a + b, 0);
  for (let y = 0; y < pa.h; y++)
    for (let x = 0; x < pa.w; x++) {
      let r = rng() * tot, i = 0;
      while (r > weights[i]) { r -= weights[i]; i++; }
      pa.set(x, y, palette[i]);
    }
}

export function makeTextures() {
  const T = {};
  const rng = mulberry32(1234);

  // Grass: bright spring lawn with blade strokes and tiny flowers
  {
    const a = new PixelArt(64, 64);
    noise(a, rng, ['#8fd463', '#86cb5a', '#98da6c'], [5, 3, 2]);
    for (let i = 0; i < 90; i++) { const x = (rng() * 64) | 0, y = (rng() * 64) | 0; a.set(x, y, '#72b84b'); a.set(x, y + 1, '#79bf51'); }
    for (let i = 0; i < 40; i++) { const x = (rng() * 64) | 0, y = (rng() * 64) | 0; a.set(x, y, '#a9e37c'); }
    for (let i = 0; i < 5; i++) { const x = (rng() * 62) | 0, y = (rng() * 62) | 0; const c = ['#ffffff', '#ffe066', '#ff9ec4'][i % 3]; a.set(x, y, c); a.set(x + 1, y, c); }
    T.grass = toTex(a);
  }
  // Garden soil with furrows
  {
    const a = new PixelArt(32, 32);
    noise(a, rng, ['#a26a43', '#94603b', '#b37a50'], [5, 3, 2]);
    for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x++) { a.set(x, y, '#7e5032'); if (rng() < 0.5) a.set(x, y + 1, '#8a5a38'); }
    for (let i = 0; i < 12; i++) a.set((rng() * 32) | 0, (rng() * 32) | 0, '#c9966a');
    T.dirt = toTex(a);
  }
  // Den soil: no furrows, leaf litter + pebbles
  {
    const a = new PixelArt(32, 32);
    noise(a, rng, ['#a87450', '#9a6a47', '#b8845c', '#8f6040'], [4, 3, 2, 1]);
    for (let i = 0; i < 10; i++) a.set((rng() * 32) | 0, (rng() * 32) | 0, '#d9b48a');
    for (let i = 0; i < 6; i++) { const x = (rng() * 30) | 0, y = (rng() * 30) | 0, c = ['#e0a040', '#c8642e', '#8fb04a'][i % 3]; a.set(x, y, c); a.set(x + 1, y, c); a.set(x, y + 1, c); }
    T.soil = toTex(a);
  }
  // Crazy-paving path
  {
    const a = new PixelArt(64, 64);
    a.rect(0, 0, 64, 64, '#bba88e');
    const cells = [];
    for (let i = 0; i < 22; i++) cells.push([rng() * 64, rng() * 64, ['#eadcc5', '#e2d2b8', '#f2e6d2', '#dccbb0'][i % 4]]);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      let best = 1e9, second = 1e9, bc = null;
      for (const [cx, cy, c] of cells) {
        for (const ox of [-64, 0, 64]) for (const oy of [-64, 0, 64]) {
          const d = Math.hypot(x - cx - ox, y - cy - oy);
          if (d < best) { second = best; best = d; bc = c; } else if (d < second) second = d;
        }
      }
      a.set(x, y, second - best < 1.6 ? '#b5a184' : bc);
    }
    T.path = toTex(a);
  }
  // Sidewalk slabs
  {
    const a = new PixelArt(32, 32);
    noise(a, rng, ['#dedad2', '#d6d1c8', '#e6e2da'], [5, 3, 2]);
    for (let i = 0; i < 32; i++) { a.set(i, 0, '#b8b2a6'); a.set(0, i, '#b8b2a6'); }
    T.sidewalk = toTex(a);
  }
  // Asphalt
  {
    const a = new PixelArt(64, 64);
    noise(a, rng, ['#6c7282', '#646a79', '#737a8a', '#5d6271'], [5, 3, 2, 1]);
    for (let i = 0; i < 30; i++) a.set((rng() * 64) | 0, (rng() * 64) | 0, '#858c9c');
    T.asphalt = toTex(a);
  }
  // Terracotta patio tiles
  {
    const a = new PixelArt(32, 32);
    noise(a, rng, ['#e0906e', '#d98666', '#e89c7a'], [5, 3, 2]);
    for (let i = 0; i < 32; i++) { a.set(i, 0, '#b86a50'); a.set(0, i, '#b86a50'); a.set(i, 16, '#b86a50'); a.set(16, i, '#b86a50'); }
    T.patio = toTex(a);
  }
  // Wood planks (vertical boards)
  {
    const a = new PixelArt(32, 32);
    for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) {
      const board = (x / 8) | 0;
      const base = ['#d09a64', '#c68f59', '#d6a26d', '#c99460'][board];
      a.set(x, y, x % 8 === 0 ? '#9c6a3c' : rng() < 0.08 ? mix(base, '#9c6a3c', 0.4) : base);
    }
    for (let i = 0; i < 4; i++) { const x = i * 8 + 3 + ((rng() * 3) | 0), y = (rng() * 30) | 0; a.set(x, y, '#8a5a30'); a.set(x + 1, y, '#a8703f'); }
    T.wood = toTex(a);
  }
  // Clapboard siding (light, tinted by material color)
  {
    const a = new PixelArt(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const r = y % 8;
      a.set(x, y, r === 7 ? '#c4c0ba' : r === 6 ? '#e6e3de' : r === 0 ? '#ffffff' : rng() < 0.04 ? '#efece8' : '#f7f5f2');
    }
    T.siding = toTex(a);
  }
  // Roof shingles (light, tinted)
  {
    const a = new PixelArt(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const row = (y / 6) | 0, off = row % 2 ? 4 : 0;
      const edge = y % 6 === 5 || (x + off) % 8 === 0;
      a.set(x, y, edge ? '#b3aea8' : y % 6 === 0 ? '#ffffff' : rng() < 0.08 ? '#e2ded9' : '#f2efeb');
    }
    T.shingles = toTex(a);
  }
  // Brick
  {
    const a = new PixelArt(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const row = (y / 4) | 0, off = row % 2 ? 4 : 0;
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      a.set(x, y, mortar ? '#e8d8c4' : rng() < 0.15 ? '#b8563d' : (row + (((x + off) / 8) | 0)) % 3 === 0 ? '#d4705a' : '#c9634b');
    }
    T.brick = toTex(a);
  }
  // Foliage / hedge leaves
  {
    const a = new PixelArt(32, 32);
    noise(a, rng, ['#5cae4a', '#4a9a3c', '#6fc257', '#3f8a35'], [4, 3, 2, 1]);
    for (let i = 0; i < 40; i++) { const x = (rng() * 32) | 0, y = (rng() * 32) | 0; a.set(x, y, '#85d468'); a.set(x + 1, y, '#78c95f'); a.set(x, y + 1, '#3a7d30'); }
    T.leaves = toTex(a);
  }
  // Water
  {
    const a = new PixelArt(32, 32);
    noise(a, rng, ['#5fcbe6', '#58c2df', '#69d3ec'], [5, 3, 2]);
    for (let i = 0; i < 10; i++) { const x = (rng() * 28) | 0, y = (rng() * 32) | 0; for (let k = 0; k < 4; k++) a.set(x + k, y, '#b6effa'); }
    T.water = toTex(a);
  }
  // Window (frame + four panes with reflections)
  {
    const a = new PixelArt(32, 32);
    a.rect(0, 0, 32, 32, '#ffffff');
    a.rect(3, 3, 26, 26, '#8fcff0');
    for (let y = 3; y < 29; y++) for (let x = 3; x < 29; x++) if ((x + y) % 23 < 3 && x + y > 20 && x + y < 40) a.set(x, y, '#d9f3ff');
    a.rect(15, 3, 2, 26, '#ffffff'); a.rect(3, 15, 26, 2, '#ffffff');
    a.rect(3, 3, 26, 2, '#6fb3d9');
    T.window = toTex(a, { repeat: false });
  }
  // Door (tinted)
  {
    const a = new PixelArt(32, 64);
    a.rect(0, 0, 32, 64, '#f2f2f2');
    a.rect(5, 6, 9, 22, '#d9d9d9'); a.rect(18, 6, 9, 22, '#d9d9d9'); a.rect(5, 34, 9, 24, '#d9d9d9'); a.rect(18, 34, 9, 24, '#d9d9d9');
    a.rect(6, 7, 7, 20, '#ececec'); a.rect(19, 7, 7, 20, '#ececec'); a.rect(6, 35, 7, 22, '#ececec'); a.rect(19, 35, 7, 22, '#ececec');
    a.rect(24, 32, 3, 3, '#ffd166');
    T.door = toTex(a, { repeat: false });
  }
  // Brushed metal (bins, grill)
  {
    const a = new PixelArt(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) a.set(x, y, x % 4 === 0 ? '#d8dde3' : rng() < 0.1 ? '#e9edf1' : '#f4f6f8');
    T.metal = toTex(a);
  }
  // Blob shadow (soft, not pixel)
  {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, 'rgba(40,20,60,0.55)'); grd.addColorStop(0.6, 'rgba(40,20,60,0.35)'); grd.addColorStop(1, 'rgba(40,20,60,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    T.shadow = new THREE.CanvasTexture(c);
  }
  // Flower sprites atlas 4x (16x16): tulip, daisy, white daisy, violet
  {
    const a = new PixelArt(64, 16);
    const stem = (x0) => { a.rect(x0 + 7, 7, 2, 9, '#3f9a3a'); a.rect(x0 + 4, 11, 3, 2, '#55b24a'); a.rect(x0 + 9, 9, 3, 2, '#55b24a'); };
    stem(0); a.ellipse(8, 5, 3.5, 3.5, '#ff5f8f'); a.tri(4.5, 3, 6.5, 0, 7.5, 3, '#ff5f8f'); a.tri(8.5, 3, 9.5, 0, 11.5, 3, '#ff5f8f'); a.set(7, 4, '#ffb3cb');
    stem(16); a.circle(24, 5, 4, '#ffd23f'); a.circle(24, 5, 1.5, '#e8741a');
    stem(32); a.circle(40, 5, 4, '#ffffff'); a.circle(40, 5, 1.5, '#ffd23f');
    stem(48); a.circle(56, 5, 3.5, '#a77bf0'); a.circle(56, 5, 1.2, '#fff3b0');
    a.outline('#2d5a2a');
    T.flowers = toTex(a, { repeat: false });
  }
  // Grass tuft sprite
  {
    const a = new PixelArt(16, 16);
    for (let i = 0; i < 7; i++) { const x = 2 + i * 2; const h = 6 + ((i * 5) % 7); a.line(x, 15, x + (i % 3) - 1, 15 - h, i % 2 ? '#5fae45' : '#78c95a'); }
    T.tuft = toTex(a, { repeat: false });
  }
  return T;
}
