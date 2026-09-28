// Unified input: floating touch joystick + touch buttons, keyboard, and gamepad.
import { clamp } from './util.js';

const JOY_R = 58;
export class Input {
  constructor() {
    this.mx = 0; this.mz = 0; this.mag = 0;
    this.run = false; this.sneakToggle = false; this.touchSneak = false;
    this.keys = new Set();
    this.queue = new Set();
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.btnHeld = {};
    this.usingTouch = false;
    this.padPrev = [];
    this.blocked = false;
  }
  bind(ui) {
    const layer = ui.touchLayer, joyEl = ui.joy, knob = ui.knob;
    this.joyEl = joyEl; this.knob = knob; this.joyMode = ui.joyMode;
    const start = (e) => {
      if (this.blocked || this.joy.id !== null) return;
      if (e.clientX > window.innerWidth * 0.6 && e.pointerType !== 'mouse') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.usingTouch = e.pointerType !== 'mouse';
      this.joy.id = e.pointerId; this.joy.ox = e.clientX; this.joy.oy = e.clientY; this.joy.dx = this.joy.dy = 0;
      joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
      joyEl.classList.add('active');
      try { layer.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      e.preventDefault();
    };
    const move = (e) => {
      if (e.pointerId !== this.joy.id) return;
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > JOY_R * 1.6) { // drag the base along so the stick never "runs out"
        const k = (d - JOY_R * 1.6) / d; this.joy.ox += dx * k; this.joy.oy += dy * k;
        joyEl.style.left = this.joy.ox + 'px'; joyEl.style.top = this.joy.oy + 'px';
        dx = e.clientX - this.joy.ox; dy = e.clientY - this.joy.oy;
      }
      this.joy.dx = dx; this.joy.dy = dy;
      e.preventDefault();
    };
    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.id = null; this.joy.dx = this.joy.dy = 0;
      joyEl.classList.remove('active');
      knob.style.transform = 'translate(-50%,-50%)';
    };
    layer.addEventListener('pointerdown', start);
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', end);
    layer.addEventListener('lostpointercapture', end);
    // action buttons
    for (const b of ui.buttons) {
      const name = b.dataset.btn;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.usingTouch = e.pointerType !== 'mouse';
        try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        b.classList.add('down');
        if (name === 'run') this.btnHeld.run = true;
        else if (name === 'sneak') { this.sneakToggle = !this.sneakToggle; b.classList.toggle('on', this.sneakToggle); }
        else this.queue.add(name);
      });
      const up = () => { b.classList.remove('down'); if (name === 'run') this.btnHeld.run = false; };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    this.sneakBtn = ui.buttons.find((b) => b.dataset.btn === 'sneak');
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      const map = { Space: 'grab', KeyE: 'grab', Enter: 'grab', KeyQ: 'chitter', KeyF: 'chitter', Tab: 'todo', KeyT: 'todo', KeyG: 'wardrobe', Escape: 'pause', KeyP: 'pause' };
      if (map[k]) { this.queue.add(map[k]); e.preventDefault(); }
      if (k === 'KeyC' || k === 'ControlLeft') { this.sneakToggle = !this.sneakToggle; this.sneakBtn?.classList.toggle('on', this.sneakToggle); }
      if (k.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.btnHeld = {}; });
  }
  pressed(name) { if (this.queue.has(name)) { this.queue.delete(name); return true; } return false; }
  clear() { this.queue.clear(); }
  update() {
    let x = 0, z = 0, mag = 0, fromStick = false;
    const K = this.keys;
    if (K.has('KeyA') || K.has('ArrowLeft')) x -= 1;
    if (K.has('KeyD') || K.has('ArrowRight')) x += 1;
    if (K.has('KeyW') || K.has('ArrowUp')) z -= 1;
    if (K.has('KeyS') || K.has('ArrowDown')) z += 1;
    if (x || z) { const l = Math.hypot(x, z); x /= l; z /= l; mag = 1; }
    if (this.joy.id !== null) {
      const d = Math.hypot(this.joy.dx, this.joy.dy);
      const m = clamp(d / JOY_R, 0, 1);
      if (m > 0.12) { x = this.joy.dx / d; z = this.joy.dy / d; mag = m; fromStick = true; }
      const kx = clamp(this.joy.dx, -JOY_R, JOY_R) * (d > JOY_R ? JOY_R / d : 1), ky = this.joy.dy * (d > JOY_R ? JOY_R / d : 1);
      this.knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    }
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find((g) => g && g.connected);
    let padRun = false;
    if (p) {
      const ax = p.axes[0] || 0, az = p.axes[1] || 0, m = Math.hypot(ax, az);
      if (m > 0.2) { x = ax / m; z = az / m; mag = clamp(m, 0, 1); fromStick = true; }
      const btn = (i) => p.buttons[i] && p.buttons[i].pressed;
      const edge = (i, name) => { if (btn(i) && !this.padPrev[i]) this.queue.add(name); this.padPrev[i] = btn(i); };
      edge(0, 'grab'); edge(1, 'chitter'); edge(9, 'pause'); edge(8, 'todo'); edge(3, 'wardrobe');
      if (btn(2) && !this.padPrev[2]) { this.sneakToggle = !this.sneakToggle; this.sneakBtn?.classList.toggle('on', this.sneakToggle); }
      this.padPrev[2] = btn(2);
      padRun = btn(7) || btn(5) || btn(6);
    }
    this.mx = x; this.mz = z; this.mag = mag;
    this.run = K.has('ShiftLeft') || K.has('ShiftRight') || !!this.btnHeld.run || padRun;
    // a gentle push on the stick = sneak
    this.touchSneak = fromStick && mag > 0 && mag < 0.6;
    const mode = mag === 0 ? '' : this.run ? 'run' : (this.sneakToggle || this.touchSneak) ? 'sneak' : 'walk';
    if (this.joyMode && this.joyMode.textContent !== mode) this.joyMode.textContent = mode;
  }
  get sneaking() { return this.sneakToggle || this.touchSneak; }
}
