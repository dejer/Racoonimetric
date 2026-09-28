// Tiny pixel-art rasterizer: every sprite and texture in the game is painted with this.
const cache = new Map();
export function col(c) {
  if (typeof c === 'number') return c;
  let v = cache.get(c);
  if (v !== undefined) return v;
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  cache.set(c, v);
  return v;
}
// Mix a hex color toward another (t 0..1) -> hex
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

export class PixelArt {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = new Uint32Array(w * h);
  }
  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = col(c);
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }
  clear() { this.data.fill(0); }
  rect(x, y, w, h, c) {
    const cc = col(c);
    for (let j = Math.floor(y); j < Math.floor(y + h); j++)
      for (let i = Math.floor(x); i < Math.floor(x + w); i++) this.set(i, j, cc);
  }
  // Filled ellipse; c may be a function (x,y,nx,ny)=>color for shading (nx,ny normalized -1..1)
  ellipse(cx, cy, rx, ry, c) {
    const fn = typeof c === 'function';
    const cc = fn ? 0 : col(c);
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) { const v = fn ? c(x, y, nx, ny) : cc; if (v != null) this.set(x, y, v); }
      }
    }
  }
  circle(cx, cy, r, c) { this.ellipse(cx, cy, r, r, c); }
  line(x0, y0, x1, y1, c, thick = 1) {
    const cc = col(c);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (thick <= 1) this.set(x, y, cc);
      else this.rect(Math.round(x - (thick - 1) / 2), Math.round(y - (thick - 1) / 2), thick, thick, cc);
    }
  }
  tri(ax, ay, bx, by, cx, cy, c) { this.poly([[ax, ay], [bx, by], [cx, cy]], c); }
  poly(pts, c) {
    const fn = typeof c === 'function';
    const cc = fn ? 0 : col(c);
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) { const v = fn ? c(x, y) : cc; if (v != null) this.set(x, y, v); }
      }
    }
  }
  // Paint pattern rows: rows = array of strings, map = {char: color}
  pattern(x0, y0, rows, map) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== '.' && ch !== ' ' && map[ch]) this.set(x0 + i, y0 + j, map[ch]);
      }
    });
  }
  // 1px exterior outline around all opaque pixels
  outline(c, diag = false) {
    const cc = col(c);
    const src = this.data.slice();
    const { w, h } = this;
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] !== 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] !== 0) continue;
        if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1) ||
          (diag && (op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1))))
          this.data[y * w + x] = cc;
      }
  }
  blit(other, dx, dy, flip = false) {
    for (let y = 0; y < other.h; y++)
      for (let x = 0; x < other.w; x++) {
        const v = other.data[y * other.w + (flip ? other.w - 1 - x : x)];
        if (v !== 0) this.set(dx + x, dy + y, v);
      }
  }
  // Rotate 90deg clockwise into a new PixelArt of same size (content re-anchored by fn)
  mapTo(w, h, fn) {
    const out = new PixelArt(w, h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = this.data[y * this.w + x];
        if (!v) continue;
        const [nx, ny] = fn(x, y);
        out.set(nx, ny, v);
      }
    return out;
  }
  toImageData() {
    const img = new ImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    return img;
  }
  toCanvas(scale = 1) {
    const c = document.createElement('canvas');
    c.width = this.w * scale; c.height = this.h * scale;
    const ctx = c.getContext('2d');
    if (scale === 1) ctx.putImageData(this.toImageData(), 0, 0);
    else {
      const t = this.toCanvas(1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t, 0, 0, c.width, c.height);
    }
    return c;
  }
}

// Sheet: grid of frames packed into one canvas
export class Sheet {
  constructor(fw, fh, frames) {
    this.fw = fw; this.fh = fh;
    this.cols = Math.min(frames.length, 16);
    this.rows = Math.ceil(frames.length / this.cols);
    this.count = frames.length;
    const big = new PixelArt(fw * this.cols, fh * this.rows);
    frames.forEach((f, i) => big.blit(f, (i % this.cols) * fw, Math.floor(i / this.cols) * fh));
    this.canvas = big.toCanvas(1);
  }
  uv(i) {
    const c = i % this.cols, r = Math.floor(i / this.cols);
    const u0 = c / this.cols, u1 = (c + 1) / this.cols;
    const v1 = 1 - r / this.rows, v0 = 1 - (r + 1) / this.rows;
    return [u0, v0, u1, v1];
  }
}

// 3x5 pixel font for tiny in-texture text
const FONT = {
  '!': ['1', '1', '1', '0', '1'], '?': ['111', '001', '011', '000', '010'],
  'Z': ['111', '001', '010', '100', '111'], '+': ['000', '010', '111', '010', '000'],
  '1': ['010', '110', '010', '010', '111'], '#': ['101', '111', '101', '111', '101'],
};
export function glyph(pa, ch, x, y, c, scale = 1) {
  const g = FONT[ch];
  if (!g) return;
  g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') pa.rect(x + i * scale, y + j * scale, scale, scale, c); });
}
