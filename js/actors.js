// Sprite actors (HD-2D billboards), particles, emotes, vision cones, items, raccoon, humans (AI) and the dog.
import * as THREE from 'three';
import { PX, FX, ITEM_FRAMES, buildRaccoonSheet, buildHumanSheet, buildDogSheet } from './sprites.js';
import { F } from './world.js';
import { ITEMS } from './data.js';
import { clamp, damp, dist, wrapAngle, rand, choice } from './util.js';

export const LEAN = -0.36, SY = 1.08;
export function spriteTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}
export function setUV(geo, sheet, i) {
  const [u0, v0, u1, v1] = sheet.uv(i);
  const eu = 0.02 / (sheet.cols * sheet.fw), ev = 0.02 / (sheet.rows * sheet.fh);
  const uv = geo.attributes.uv;
  uv.setXY(0, u0 + eu, v1 - ev); uv.setXY(1, u1 - eu, v1 - ev); uv.setXY(2, u0 + eu, v0 + ev); uv.setXY(3, u1 - eu, v0 + ev);
  uv.needsUpdate = true;
}
function flatSilhouette(mat) {
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = diffuse;'); };
  return mat;
}
const V = new THREE.Vector3();

// ------------------------------------------------------------------ base billboard
export class SpriteActor {
  constructor(game, sheet, opts = {}) {
    this.game = game; this.sheet = sheet;
    const w = sheet.fw * PX, h = sheet.fh * PX;
    this.geo = new THREE.PlaneGeometry(w, h); this.geo.translate(0, h / 2, 0);
    this.tex = spriteTex(sheet.canvas);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.rotation.x = LEAN;
    game.scene.add(this.mesh);
    if (opts.sil) {
      this.silMat = flatSilhouette(new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide, color: opts.sil, transparent: true, opacity: 0.62, depthFunc: THREE.GreaterDepth, depthWrite: false }));
      this.sil = new THREE.Mesh(this.geo, this.silMat); this.sil.rotation.x = LEAN; this.sil.renderOrder = 10; game.scene.add(this.sil);
    }
    this.shadow = new THREE.Mesh(game.shadowGeo, game.shadowMat); this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.setScalar(opts.shadowR || 0.5); this.shadow.renderOrder = 1; game.scene.add(this.shadow);
    this.x = 0; this.z = 0; this.y = 0; this.facing = 1; this.flip = 1; this.squash = 1;
    this.anim = 'idle'; this.animT = 0; this.fps = 6; this.frame = -1;
    this.setFrame(0);
  }
  setSheet(sheet) {
    this.sheet = sheet; this.tex.dispose(); this.tex = spriteTex(sheet.canvas);
    this.mat.map = this.tex; this.mat.needsUpdate = true;
    if (this.silMat) { this.silMat.map = this.tex; this.silMat.needsUpdate = true; }
    const f = this.frame; this.frame = -1; this.setFrame(Math.max(0, f));
  }
  setFrame(i) { if (i === this.frame) return; this.frame = i; setUV(this.geo, this.sheet, i); }
  play(name, fps) { if (this.anim !== name) { this.anim = name; this.animT = 0; } if (fps !== undefined) this.fps = fps; }
  updateSprite(dt) {
    this.animT += dt;
    const frames = this.sheet.anims[this.anim] || this.sheet.anims.idle;
    this.setFrame(frames[Math.floor(this.animT * this.fps) % frames.length]);
    this.flip = damp(this.flip, this.facing, 16, dt);
    this.squash = damp(this.squash, 1, 10, dt);
    const gy = this.game.W.groundY(this.x, this.z);
    let sx = this.flip; if (Math.abs(sx) < 0.08) sx = 0.08 * (sx < 0 ? -1 : 1);
    this.mesh.position.set(this.x, this.y + gy, this.z);
    this.mesh.scale.set(sx * (2 - this.squash), SY * this.squash, 1);
    if (this.sil) { this.sil.position.copy(this.mesh.position); this.sil.scale.copy(this.mesh.scale); this.sil.visible = this.mesh.visible; }
    this.shadow.position.set(this.x, gy + 0.035, this.z);
  }
  localPoint(px, py, lift = 0) {
    this.mesh.updateMatrixWorld();
    return V.set((px - this.sheet.fw / 2) * PX, (this.sheet.fh - py) * PX + lift, 0.035).applyMatrix4(this.mesh.matrixWorld).clone();
  }
}

// ------------------------------------------------------------------ particles (square pixel points)
export class Particles {
  constructor(scene, max = 700) {
    this.max = max; this.cursor = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.size0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol); g.setAttribute('size', this.aSize);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; if (size <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`,
      fragmentShader: `varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 3;
    scene.add(this.points);
    this.c = new THREE.Color();
  }
  spawn(x, y, z, vx, vy, vz, color, size, life, grav = 9) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.c.set(color); this.col.set([this.c.r, this.c.g, this.c.b], i * 3);
    this.size0[i] = size; this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
  }
  burst(kind, x, y, z, n = 10) {
    const P = {
      dust: [['#efe6d6', '#d8cbb4', '#ffffff'], 1.6, [0.8, 1.8], 3, [0.35, 0.7], [0.07, 0.12]],
      water: [['#7fd8f5', '#c9f2ff', '#ffffff'], 1.5, [1, 3], 9, [0.4, 0.8], [0.05, 0.09]],
      sparkle: [['#fff6b0', '#ffffff', '#ffd23f'], 1.2, [0.8, 2.2], -0.6, [0.6, 1.1], [0.05, 0.09]],
      leaves: [['#5cae4a', '#85d468', '#3f8a35'], 1.4, [1, 2.5], 3, [0.6, 1.1], [0.06, 0.1]],
      dirt: [['#8e5a36', '#a26a43', '#6b4428'], 1.8, [1.5, 3.5], 10, [0.4, 0.8], [0.06, 0.11]],
      confetti: [['#ff5fa2', '#ffd23f', '#5ec8ff', '#9dff7a', '#ffffff', '#b388eb'], 3, [3, 6], 4, [1.2, 2.2], [0.07, 0.12]],
      trash: [['#e8413c', '#ffe14d', '#cfd6e0', '#d99a4e', '#ffffff'], 2.2, [2, 4], 9, [0.5, 1], [0.06, 0.1]],
      stars: [['#ffd23f', '#fff6b0'], 1.5, [1.5, 2.5], 2, [0.5, 0.8], [0.07, 0.1]],
      smoke: [['#e6e6e6', '#cfcfcf', '#bdbdbd'], 0.25, [0.4, 0.8], -0.5, [1.2, 2], [0.1, 0.18]],
      notes: [['#5b4bd6', '#ff5fa2', '#3aa6a0'], 0.8, [1, 1.6], -0.3, [0.8, 1.2], [0.08, 0.12]],
      hearts: [['#ff5f8f', '#ffb3cb'], 0.6, [1, 1.8], -0.3, [0.8, 1.2], [0.08, 0.12]],
    }[kind];
    if (!P) return;
    const [cols, spread, vyR, grav, lifeR, sizeR] = P;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * spread;
      this.spawn(x + rand(-0.1, 0.1), y + rand(0, 0.15), z + rand(-0.1, 0.1), Math.cos(a) * s, rand(...vyR), Math.sin(a) * s, choice(cols), rand(...sizeR), rand(...lifeR), grav);
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.03 && this.grav[i] > 0) { this.pos[k + 1] = 0.03; this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6; this.vel[k + 1] = 0; }
      this.size[i] = this.life[i] <= 0 ? 0 : this.size0[i] * Math.min(1, (this.life[i] / this.maxLife[i]) * 3);
    }
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ speech-bubble emotes
export class Emote {
  constructor(game) {
    this.game = game;
    const s = 16 * PX * 1.7;
    this.geo = new THREE.PlaneGeometry(s, s); this.geo.translate(0, s / 2, 0);
    this.mesh = new THREE.Mesh(this.geo, game.fxMat); this.mesh.visible = false; this.mesh.renderOrder = 20; this.mesh.rotation.x = LEAN;
    game.scene.add(this.mesh);
    this.kind = null; this.t = 0; this.dur = 0;
  }
  show(kind, dur = 1.4) {
    if (this.kind === kind && this.t < this.dur) { this.dur = Math.max(this.dur, this.t + dur); return; }
    this.kind = kind; this.t = 0; this.dur = dur; setUV(this.geo, this.game.fxSheet, FX[kind]); this.mesh.visible = true;
  }
  hide() { this.dur = 0; }
  update(dt, x, y, z) {
    this.t += dt;
    if (!this.kind || this.t > this.dur) { this.mesh.visible = false; this.kind = null; return; }
    const t = this.t, s = t < 0.1 ? (t / 0.1) * 1.35 : t < 0.2 ? 1.35 - ((t - 0.1) / 0.1) * 0.35 : 1;
    this.mesh.position.set(x, y + Math.sin(t * 5) * 0.04, z + 0.05);
    this.mesh.scale.set(s, s * SY, 1);
  }
}

// ------------------------------------------------------------------ vision cone decal (clipped by walls)
export class VisionCone {
  constructor(game, N = 18) {
    this.game = game; this.N = N;
    this.pos = new Float32Array((N + 2) * 3);
    const idx = []; for (let i = 0; i <= N; i++) idx.push(0, i + 2, i + 1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setIndex(idx.slice(0, N * 3));
    this.mat = new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    game.scene.add(this.mesh);
  }
  update(x, z, look, fov, range, color, opacity) {
    const nav = this.game.nav, y = 0.05 + this.game.W.groundY(x, z);
    this.pos[0] = x; this.pos[1] = y; this.pos[2] = z;
    for (let i = 0; i <= this.N; i++) {
      const a = look - fov / 2 + (fov * i) / this.N, dx = Math.cos(a), dz = Math.sin(a);
      const d = nav.raycast(x, z, dx, dz, range, F.S);
      this.pos.set([x + dx * d, y, z + dz * d], (i + 1) * 3);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mat.color.set(color); this.mat.opacity = opacity; this.mesh.visible = opacity > 0.01;
  }
}

// ------------------------------------------------------------------ items
let UID = 0;
export class Item {
  constructor(game, id, sp) {
    this.game = game; this.id = id; this.uid = UID++; this.def = ITEMS[id]; this.owner = this.def.owner || null;
    const sheet = game.itemSheet, w = sheet.fw * PX;
    this.geo = new THREE.PlaneGeometry(w, w); this.geo.translate(0, w / 2, 0);
    setUV(this.geo, sheet, ITEM_FRAMES[id]);
    this.mesh = new THREE.Mesh(this.geo, game.itemMat); this.mesh.rotation.x = LEAN;
    game.scene.add(this.mesh);
    this.shadow = new THREE.Mesh(game.shadowGeo, game.shadowMat); this.shadow.rotation.x = -Math.PI / 2; this.shadow.scale.setScalar(0.28); game.scene.add(this.shadow);
    this.x = sp.x; this.z = sp.z; this.y = sp.y || 0; this.restY = this.y; this.vy = 0; this.vx = 0; this.vz = 0;
    this.home = { x: sp.x, z: sp.z, y: sp.y || 0 };
    this.holder = null; this.inDen = false; this.consumed = false; this.facing = 1; this.sparkT = Math.random() * 2;
    this.spawnHome = !!sp.home;
  }
  get atHome() { return !this.holder && dist(this.x, this.z, this.home.x, this.home.z) < 0.7; }
  get onGround() { return !this.holder && this.y < 0.15; }
  update(dt) {
    if (this.consumed) { this.mesh.visible = false; this.shadow.visible = false; return; }
    this.mesh.visible = true;
    const gy = this.game.W.groundY(this.x, this.z);
    if (this.holder) {
      const p = this.holder.holdPoint();
      this.x = p.x; this.z = p.z; this.y = p.y - gy; this.facing = this.holder.facing;
      this.mesh.position.copy(p);
    } else {
      if (this.y > this.restY || this.vy > 0) {
        this.vy -= 22 * dt; this.y += this.vy * dt; this.x += this.vx * dt; this.z += this.vz * dt;
        if (this.y <= this.restY) { this.y = this.restY; this.vy = Math.abs(this.vy) > 2 ? -this.vy * 0.3 : 0; this.vx *= 0.5; this.vz *= 0.5; if (!this.vy) { this.vx = this.vz = 0; } }
        this.game.nav.resolve(this, 0.15, F.R);
      }
      this.mesh.position.set(this.x, this.y + gy, this.z);
    }
    this.mesh.scale.set(this.facing, SY, 1);
    this.shadow.visible = !this.holder;
    this.shadow.position.set(this.x, gy + (this.restY > 0.3 ? this.restY + 0.01 : 0.04), this.z);
    if (this.inDen) { this.sparkT -= dt; if (this.sparkT < 0) { this.sparkT = 1.5 + Math.random() * 2; this.game.particles.burst('sparkle', this.x, this.y + 0.4, this.z, 2); } }
  }
}

// ------------------------------------------------------------------ the raccoon
export class Raccoon extends SpriteActor {
  constructor(game, loadout) {
    super(game, buildRaccoonSheet(loadout), { sil: '#ffd84a', shadowR: 0.5 });
    this.r = 0.28; this.vx = 0; this.vz = 0; this.carry = null; this.stun = 0; this.kx = 0; this.kz = 0;
    this.mode = 'idle'; this.hidden = false; this.hide = null; this.stepDist = 0; this.busy = 0; this.busyAnim = 'idle';
    this.inDen = false; this.wet = 0; this.sitting = false; this.emote = new Emote(game); this.rustleCD = 0;
  }
  setLoadout(lo) { this.setSheet(buildRaccoonSheet(lo)); }
  holdPoint() {
    const a = this.sheet.anchors[this.frame] || this.sheet.anchors[0];
    return this.localPoint(a.mouth[0], a.mouth[1], -0.34);
  }
  update(dt, input) {
    const g = this.game;
    this.rustleCD -= dt;
    if (this.sitting) { this.play('sit', 1); this.y = 0.5; this.updateSprite(dt); this.emote.update(dt, this.x, this.y + 1.3, this.z); return; }
    this.y = 0;
    if (this.stun > 0) {
      this.stun -= dt;
      this.x += this.kx * dt; this.z += this.kz * dt;
      this.kx *= Math.exp(-5 * dt); this.kz *= Math.exp(-5 * dt);
      g.nav.resolve(this, this.r, F.R);
      this.play('stun', 6); this.vx = this.vz = 0; this.mode = 'idle';
    } else if (this.busy > 0) {
      this.busy -= dt; this.play(this.busyAnim, 8); this.vx = this.vz = 0;
    } else {
      let spd = 0, mode = 'idle';
      if (input.mag > 0) {
        if (input.run) { mode = 'run'; spd = 5.6; }
        else if (input.sneaking) { mode = 'sneak'; spd = 1.9; }
        else { mode = 'walk'; spd = 3.4; }
        if (this.carry) spd *= 0.9;
      }
      this.vx = damp(this.vx, input.mx * spd, 12, dt); this.vz = damp(this.vz, input.mz * spd, 12, dt);
      this.x += this.vx * dt; this.z += this.vz * dt;
      g.nav.resolve(this, this.r, F.R);
      if (Math.abs(this.vx) > 0.2) this.facing = Math.sign(this.vx);
      const sp = Math.hypot(this.vx, this.vz);
      this.mode = sp < 0.25 ? (input.sneaking ? 'sneak' : 'idle') : mode === 'idle' ? 'walk' : mode;
      if (sp < 0.25) this.play(input.sneaking ? 'sneak' : 'idle', input.sneaking ? 0.001 : 3);
      else this.play(this.mode, { walk: 10, run: 14, sneak: 6 }[this.mode] || 8);
      this.stepDist += sp * dt;
      const stride = this.mode === 'run' ? 0.95 : this.mode === 'sneak' ? 0.55 : 0.7;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        const hard = g.W.groundY(this.x, this.z) > 0 || (this.z > 4.5 && this.z < 10.5) || (this.x > -11 && this.x < 2.6 && this.z > 12.5) || (this.x > -19.5 && this.x < -6.5 && this.z > -19.5 && this.z < -14);
        g.audio.play(hard ? 'stepHard' : 'step', null, null, this.mode === 'run' ? 1 : this.mode === 'sneak' ? 0.25 : 0.55);
        if (this.mode === 'run') { g.noise(this.x, this.z, 4.5, 'step', true); g.particles.burst('dust', this.x - this.facing * 0.2, 0.05, this.z, 3); }
      }
    }
    // hiding spots
    let hide = null;
    for (const h of g.W.hides) {
      if (h.type === 'circle' ? dist(this.x, this.z, h.x, h.z) < h.r : this.x > h.x0 && this.x < h.x1 && this.z > h.z0 && this.z < h.z1) { hide = h; break; }
    }
    if (hide && hide !== this.hide && this.rustleCD <= 0) { g.rustle(hide, this.x, this.z); this.rustleCD = 0.6; }
    if (hide && Math.hypot(this.vx, this.vz) > 0.8) { const b = g.W.bushes.find((b) => b.x === hide.x && b.z === hide.z); if (b) b.shake = Math.max(b.shake, 0.5); }
    this.hide = hide; this.hidden = !!hide;
    this.mat.opacity = 1;
    this.updateSprite(dt);
    this.emote.update(dt, this.x, this.y + 1.25, this.z);
    if (this.wet > 0) { this.wet -= dt; if (Math.random() < dt * 8) g.particles.spawn(this.x + rand(-0.3, 0.3), 0.6, this.z, 0, -0.5, 0, '#7fd8f5', 0.06, 0.4); }
  }
}

// ------------------------------------------------------------------ humans
const FOV = 1.55;
const BLIND = ['slip', 'getup', 'dance', 'wet'];
export class Human extends SpriteActor {
  constructor(game, kind) {
    const sheet = buildHumanSheet(kind, true);
    super(game, sheet, { sil: '#ff8a65', shadowR: 0.55 });
    this.kind = kind; this.sheetHat = sheet; this.sheetNoHat = kind === 'gardener' ? buildHumanSheet(kind, false) : null;
    const W = game.W;
    this.name = kind === 'gardener' ? 'the Gardener' : 'Grill Dad';
    this.r = 0.34; this.route = W.routes[kind]; this.terr = W.territory[kind];
    [this.x, this.z] = W.starts[kind];
    this.task = 0; this.state = 'route'; this.st = 0; this.data = {};
    this.look = -Math.PI / 2; this.aware = 0; this.hold = null; this.hatOn = true; this.hatT = 0; this.hatItem = null;
    this.path = null; this.pathTarget = null; this.repath = 0; this.stuckT = 0; this.stuck = 0; this.lastPos = [this.x, this.z];
    this.emote = new Emote(game); this.cone = new VisionCone(game);
    this.watchT = 0; this.slipCD = 0; this.wet = 0; this.speed = 0; this.vis = 0; this.lastSeen = [this.x, this.z]; this.shooCD = 0;
  }
  inTerr(x, z, m = 0) { return this.terr.some((r) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m); }
  setState(s, data = {}) { this.state = s; this.st = 0; this.data = data; this.path = null; this.stuck = 0; }
  holdPoint() { return this.localPoint(31, 28, -0.25); }
  pickUp(it) { if (it.holder && it.holder.carry === it) it.holder.carry = null; it.holder = this; this.hold = it; it.inDen = false; this.game.audio.play('grab', this.x, this.z, 0.6); }
  putDown(it, atHome) {
    it.holder = null; this.hold = null;
    if (atHome) { it.x = it.home.x; it.z = it.home.z; it.y = it.restY = it.home.y; }
    else { it.x = this.x + this.facing * 0.4; it.z = this.z + 0.1; it.restY = 0; it.y = 0.4; }
    it.vy = 0; it.vx = it.vz = 0;
  }
  canSee(R) {
    const d = dist(this.x, this.z, R.x, R.z);
    if (R.hidden && d > 1.1) return 0;
    const range = R.mode === 'sneak' ? 5 : 7.5;
    if (d > range) return 0;
    const a = Math.atan2(R.z - this.z, R.x - this.x);
    if (Math.abs(wrapAngle(a - this.look)) > FOV / 2 && d > (R.mode === 'sneak' ? 0.7 : 1.6)) return 0;
    if (!this.game.nav.losClear(this.x, this.z, R.x, R.z)) return 0;
    return clamp(1.3 - d / range, 0.3, 1);
  }
  canSeePoint(x, z, range = 8) {
    const d = dist(this.x, this.z, x, z);
    if (d > range) return false;
    if (Math.abs(wrapAngle(Math.atan2(z - this.z, x - this.x) - this.look)) > FOV / 2 && d > 1.5) return false;
    return this.game.nav.losClear(this.x, this.z, x, z);
  }
  goTo(tx, tz, spd, dt) {
    const d = dist(this.x, this.z, tx, tz);
    if (d < 0.3) { this.speed = 0; return true; }
    this.repath -= dt;
    if (!this.path || !this.path.length || !this.pathTarget || dist(tx, tz, this.pathTarget[0], this.pathTarget[1]) > 0.8 || this.repath <= 0) {
      this.path = this.game.nav.findPath(this.x, this.z, tx, tz) || [[tx, tz]];
      this.pathTarget = [tx, tz]; this.repath = this.state === 'chase' ? 0.4 : 3;
    }
    let [wx, wz] = this.path[0];
    while (this.path.length > 1 && dist(this.x, this.z, wx, wz) < 0.35) { this.path.shift(); [wx, wz] = this.path[0]; }
    const dx = wx - this.x, dz = wz - this.z, l = Math.hypot(dx, dz) || 1;
    const step = Math.min(spd * dt, l);
    this.x += (dx / l) * step; this.z += (dz / l) * step;
    this.game.nav.resolve(this, this.r, F.H);
    this.look = Math.atan2(dz, dx);
    if (Math.abs(dx) > 0.05) this.facing = Math.sign(dx);
    this.speed = spd;
    this.stuckT += dt;
    if (this.stuckT > 1) {
      if (dist(this.x, this.z, this.lastPos[0], this.lastPos[1]) < 0.25) { this.path = null; this.stuck++; } else this.stuck = 0;
      this.stuckT = 0; this.lastPos = [this.x, this.z];
    }
    if (this.stuck > 4) { this.stuck = 0; this.x = tx; this.z = tz; return true; } // failsafe: never soft-lock
    return false;
  }
  lookAt(x, z) { this.look = Math.atan2(z - this.z, x - this.x); const c = Math.cos(this.look); if (Math.abs(c) > 0.25) this.facing = Math.sign(c); }
  hear(x, z, type) {
    const g = this.game;
    if (['slip', 'getup', 'chase', 'react', 'dance', 'wet', 'fume', 'return', 'hatoff', 'rewear'].includes(this.state)) return;
    if (type === 'radio' && this.kind === 'dad') { this.setState('dance'); this.emote.show('note', 5); return; }
    if (type === 'sprinkler' && this.kind === 'gardener') { this.setState('turnoff', { dev: 'tap', after: this.hatOn ? 'hatoff' : null }); this.emote.show('anger', 1.5); g.audio.play('grumble', this.x, this.z); return; }
    if (this.state === 'turnoff') return;
    if (!this.inTerr(x, z, 1.5)) { if (this.state === 'route') { this.lookAt(x, z); this.emote.show('question', 1); } return; }
    if (['route', 'investigate', 'search', 'retrieve'].includes(this.state)) {
      this.setState('investigate', { x, z }); this.emote.show('question', 1.6); g.audio.voice(this.kind, 'hm', this.x, this.z);
    }
  }
  slip(it) {
    const g = this.game;
    if (this.hold) this.putDown(this.hold, false);
    this.setState('slip'); this.slipCD = 5; this.aware = 0;
    it.vy = 4; it.vx = this.facing * 2.5; it.restY = 0;
    g.audio.play('slip', this.x, this.z); g.audio.voice(this.kind, 'whoa', this.x, this.z); g.particles.burst('stars', this.x, 1.0, this.z, 10); this.emote.show('star', 2.4);
    g.complete('slip_banana'); g.stats.slips = (g.stats.slips || 0) + 1;
  }
  update(dt) {
    const g = this.game, R = g.raccoon;
    this.st += dt; this.slipCD -= dt;
    const blind = BLIND.includes(this.state);
    this.vis = blind ? 0 : this.canSee(R);
    const guilty = !!(R.carry && R.carry.owner === this.kind);
    const intrude = this.inTerr(R.x, R.z);
    if (this.vis > 0 && (guilty || intrude) && !R.inDen && !R.sitting) {
      const rate = (guilty ? 2.4 : 1.0) * this.vis * (R.mode === 'run' ? 1.6 : R.mode === 'sneak' ? 0.55 : 1);
      this.aware = Math.min(1.2, this.aware + rate * dt);
    } else this.aware = Math.max(0, this.aware - dt * 0.45);
    this.shooCD -= dt;
    const interruptible = ['route', 'investigate', 'search', 'turnoff', 'retrieve', 'rewear', 'hatoff'].includes(this.state);
    if (interruptible && this.aware >= 1) {
      if (guilty) { this.setState('react'); this.emote.show('alert', 1.4); g.audio.play('alert', this.x, this.z); g.audio.voice(this.kind, 'hey', this.x, this.z); }
      else if (intrude && this.shooCD <= 0 && ['route', 'investigate', 'search'].includes(this.state)) { this.setState('shoo'); this.shooCD = 7; this.emote.show('anger', 2.5); g.audio.voice(this.kind, 'grr', this.x, this.z); }
    }
    // running devices are a persistent annoyance: go deal with them when free
    const calm = ['route', 'investigate', 'search'].includes(this.state);
    if (calm && this.kind === 'gardener' && g.W.tap.on) { this.setState('turnoff', { dev: 'tap', after: this.hatOn ? 'hatoff' : null }); this.emote.show('anger', 1.5); g.audio.play('grumble', this.x, this.z); }
    else if (calm && this.kind === 'dad' && g.W.radio.on && dist(this.x, this.z, g.W.radio.x, g.W.radio.z) < 20) { this.setState('dance'); this.emote.show('note', 5); }
    // spot misplaced belongings
    this.watchT -= dt;
    if (this.watchT <= 0 && ['route', 'investigate', 'search'].includes(this.state)) {
      this.watchT = 0.4;
      for (const it of g.items) {
        if (it.owner !== this.kind || it.holder || it.inDen || it.consumed || it.atHome) continue;
        if (it.id === 'sunhat' && this.hatOn) continue;
        if (this.canSeePoint(it.x, it.z, 8)) { this.setState('retrieve', { item: it }); this.emote.show('question', 1.2); break; }
      }
    }
    // hazards: banana peels + sprinkler spray
    if (this.speed > 0 && this.slipCD <= 0) {
      for (const it of g.items) if (it.def.slippery && it.onGround && !it.consumed && dist(this.x, this.z, it.x, it.z) < 0.45) { this.slip(it); break; }
    }
    const S = g.W.sprinkler;
    if (g.W.tap.on && dist(this.x, this.z, S.x, S.z) < S.r) {
      if (this.wet <= 0 && !['slip', 'getup'].includes(this.state)) {
        this.wet = 10; if (this.kind === 'gardener') g.complete('soak_gardener');
        const d = this.state === 'turnoff' ? this.data : null;
        this.setState('wet', { next: d }); this.emote.show('drop', 1.6); g.audio.play('splash', this.x, this.z); g.audio.voice(this.kind, 'bleh', this.x, this.z);
      }
    }
    if (this.wet > 0) { this.wet -= dt; if (Math.random() < dt * 10) g.particles.spawn(this.x + rand(-0.3, 0.3), 1.2 + rand(0, 0.5), this.z, 0, -1, 0, '#7fd8f5', 0.06, 0.5); }
    this.speed = 0;
    this.runState(dt, R);
    // animation
    const moving = this.speed > 0.1;
    let anim = 'idle', fps = 3;
    switch (this.state) {
      case 'slip': anim = 'slip'; break;
      case 'getup': anim = 'surprised'; break;
      case 'dance': anim = 'dance'; fps = 5; break;
      case 'wet': anim = 'wet'; fps = 6; break;
      case 'react': anim = 'surprised'; break;
      case 'fume': anim = 'angry'; fps = 6; break;
      default:
        if (moving) { anim = this.hold ? 'holdwalk' : this.speed > 3 ? 'run' : 'walk'; fps = this.speed > 3 ? 12 : 7; if (this.state === 'shoo') anim = 'angry'; }
        else if (this.hold) anim = 'hold';
        else if (this.state === 'route' && this.data.arrived) { anim = this.route[this.task].anim; fps = 3; }
        else if (this.aware > 0.35) anim = 'surprised';
    }
    this.play(anim, fps);
    this.updateSprite(dt);
    this.emote.update(dt, this.x, this.y + 2.05, this.z);
    // vision cone
    const col = this.state === 'chase' || this.state === 'react' || this.state === 'shoo' ? '#ff4a3a' : this.aware > 0.3 || this.state === 'investigate' || this.state === 'search' ? '#ffb13a' : '#fff3a0';
    const show = !blind && dist(this.x, this.z, R.x, R.z) < 22;
    this.cone.update(this.x, this.z, this.look, FOV, R.mode === 'sneak' ? 5 : 7.5, col, show ? (g.showCones ? 0.2 + this.aware * 0.12 : 0) : 0);
    if (this.aware > 0.35 && this.aware < 1 && this.vis > 0 && interruptible) { this.lookAt(R.x, R.z); this.emote.show('question', 0.3); }
  }
  runState(dt, R) {
    const g = this.game, d = this.data;
    switch (this.state) {
      case 'route': {
        if (this.aware > 0.35 && this.vis > 0) break; // freeze and stare
        if (this.kind === 'gardener' && !this.hatOn && this.hatItem && this.hatItem.atHome && !this.hatItem.inDen && !this.hatItem.consumed && g.time - this.hatT > 25) { this.setState('rewear'); break; }
        const t = this.route[this.task];
        if (!d.arrived) { if (this.goTo(t.at[0], t.at[1], 1.9, dt)) { d.arrived = true; this.st = 0; } }
        else {
          this.look = t.look; const c = Math.cos(t.look); if (Math.abs(c) > 0.25) this.facing = Math.sign(c);
          if (t.label === 'gnome' && !g.items.find((i) => i.id === 'gnome' && i.atHome)) { if (this.st < 0.1) this.emote.show('question', 2); }
          if (this.st > t.dur) { this.task = (this.task + 1) % this.route.length; this.data = {}; this.path = null; }
        }
        break;
      }
      case 'investigate':
      case 'search': {
        if (!d.arrived) { if (this.goTo(d.x, d.z, this.state === 'search' ? 3 : 2.5, dt) || this.st > 7) { d.arrived = true; this.st = 0; } }
        else { this.look += Math.sin(this.st * 2.6) * dt * 3; const c = Math.cos(this.look); if (Math.abs(c) > 0.3) this.facing = Math.sign(c); if (this.st > 2.8) this.setState('route'); }
        break;
      }
      case 'react': this.lookAt(R.x, R.z); if (this.st > 0.4) this.setState('chase', { lost: 0 }); break;
      case 'chase': {
        if (this.vis > 0) { d.lost = 0; this.lastSeen = [R.x, R.z]; } else d.lost += dt;
        if (R.inDen || !this.inTerr(R.x, R.z, 4) || this.st > 14) { this.setState('fume'); this.emote.show('anger', 1.5); g.audio.voice(this.kind, 'grr', this.x, this.z); break; }
        if (d.lost > 1.8) { this.setState('search', { x: this.lastSeen[0], z: this.lastSeen[1] }); this.emote.show('question', 1.5); break; }
        const [tx, tz] = this.vis > 0 ? [R.x, R.z] : this.lastSeen;
        this.goTo(tx, tz, 4.5, dt);
        if (this.vis > 0 && dist(this.x, this.z, R.x, R.z) < 0.85 && R.stun <= 0) g.catchRaccoon(this);
        break;
      }
      case 'shoo': {
        if (R.inDen || !this.inTerr(R.x, R.z, 1) || this.st > 3.5 || R.hidden) { this.setState('route'); break; }
        this.goTo(R.x, R.z, 3.4, dt);
        if (dist(this.x, this.z, R.x, R.z) < 0.85 && R.stun <= 0) { g.catchRaccoon(this); this.setState('fume'); }
        break;
      }
      case 'fume': this.lookAt(R.x, R.z); if (this.st > 1.3) { if (this.hold) this.setState('return', { item: this.hold }); else this.setState('route'); } break;
      case 'retrieve': {
        const it = d.item;
        if (it.inDen || it.consumed) { this.setState('fume'); break; }
        if (it.holder && it.holder !== this) { if (it.holder === R && this.vis > 0) { this.setState('react'); this.emote.show('alert', 1.2); } else this.setState('route'); break; }
        if (this.goTo(it.x, it.z, 2.8, dt)) { this.pickUp(it); this.setState('return', { item: it }); }
        else if (this.st > 16) this.setState('route');
        break;
      }
      case 'return': {
        const it = d.item;
        if (it.holder !== this) { this.hold = null; this.setState('route'); break; }
        if (this.goTo(it.home.x, it.home.z, 2.2, dt)) { this.putDown(it, true); this.setState('route'); }
        break;
      }
      case 'slip': if (this.st > 2.4) this.setState('getup'); break;
      case 'getup': if (this.st > 0.6) this.setState('route'); break;
      case 'turnoff': {
        const dev = d.dev === 'tap' ? g.W.sprinkler : g.W.radio;
        const on = d.dev === 'tap' ? g.W.tap.on : g.W.radio.on;
        if (!on) { this.setState(d.after || 'route'); break; }
        const ax = dev.x + (d.dev === 'radio' ? 0.2 : 0.3), az = dev.z + (d.dev === 'radio' ? 0.9 : 0.4);
        if (this.goTo(ax, az, 3, dt)) { this.lookAt(dev.x, dev.z); if (d.dev === 'tap') g.setTap(false); else g.setRadio(false); this.setState(d.after || 'route'); }
        break;
      }
      case 'dance': {
        this.facing = Math.sin(this.st * 5) > 0 ? 1 : -1;
        if (this.st < 0.1) { g.complete('make_dance'); g.audio.voice(this.kind, 'yay', this.x, this.z); }
        if (Math.random() < dt * 3) g.particles.burst('notes', this.x, 2, this.z, 1);
        if (!g.W.radio.on) this.setState('route');
        else if (this.st > 6) this.setState('turnoff', { dev: 'radio' });
        break;
      }
      case 'wet': {
        this.facing = Math.sin(this.st * 14) > 0 ? 1 : -1;
        if (this.st > 1.6) {
          if (d.next && g.W.tap.on) this.setState('turnoff', d.next);
          else if (g.W.tap.on) this.setState('turnoff', { dev: 'tap', after: this.kind === 'gardener' && this.hatOn ? 'hatoff' : null });
          else if (this.kind === 'gardener' && this.hatOn) this.setState('hatoff');
          else this.setState('route');
        }
        break;
      }
      case 'hatoff': {
        if (!this.hatOn) { this.setState('route'); break; }
        const B = g.W.bench;
        if (this.goTo(B.x + 0.3, B.z + 0.6, 2, dt)) {
          this.hatOn = false; this.setSheet(this.sheetNoHat); this.hatT = g.time;
          this.hatItem = g.spawnItem('sunhat', { x: B.x + 0.45, z: B.z + 0.05, y: B.y });
          g.particles.burst('water', B.x + 0.45, 0.9, B.z, 8); this.emote.show('drop', 1.2);
          g.toast('The gardener left their sun hat on the bench to dry…', 'hint');
          this.setState('route');
        }
        break;
      }
      case 'rewear': {
        const it = this.hatItem;
        if (!it || it.holder || it.inDen || it.consumed || !it.atHome) { this.setState('route'); break; }
        if (this.goTo(it.x, it.z + 0.5, 2, dt)) { it.consumed = true; this.hatItem = null; this.hatOn = true; this.setSheet(this.sheetHat); this.setState('route'); }
        break;
      }
    }
  }
}

// ------------------------------------------------------------------ the dog (on a chain)
export class Dog extends SpriteActor {
  constructor(game) {
    super(game, buildDogSheet(), { sil: '#ffc46b', shadowR: 0.45 });
    const k = game.W.kennel; this.home = k; this.x = k.x; this.z = k.z; this.chainR = 4.3; this.facing = -1;
    this.state = 'sleep'; this.st = 0; this.friend = false; this.r = 0.3; this.barkT = 0; this.lost = 0; this.target = null;
    this.emote = new Emote(game); this.zzT = 0;
    const lg = new THREE.BufferGeometry(); this.chainPos = new Float32Array(12 * 3); lg.setAttribute('position', new THREE.BufferAttribute(this.chainPos, 3));
    this.chain = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#6d6d7a' })); this.chain.frustumCulled = false; game.scene.add(this.chain);
  }
  holdPoint() { return this.localPoint(29, 20, -0.3); }
  setState(s) { this.state = s; this.st = 0; }
  canSee(R) {
    const d = dist(this.x, this.z, R.x, R.z);
    if (R.hidden && d > 0.9) return false;
    if (d > 6.5) return false;
    return this.game.nav.losClear(this.x, this.z, R.x, R.z);
  }
  hear(x, z, radius, type) {
    if (this.friend || type === 'bark') return;
    if (dist(this.x, this.z, x, z) < Math.min(radius, 8) && (this.state === 'sleep' || this.state === 'idle')) { this.setState('alert'); }
  }
  bark() { const g = this.game; g.audio.play('bark', this.x, this.z); g.noise(this.x, this.z, 11, 'bark'); this.emote.show('alert', 0.8); }
  moveToward(tx, tz, spd, dt) {
    const dx = tx - this.x, dz = tz - this.z, l = Math.hypot(dx, dz);
    if (l < 0.05) return true;
    const s = Math.min(spd * dt, l); this.x += (dx / l) * s; this.z += (dz / l) * s;
    if (Math.abs(dx) > 0.05) this.facing = Math.sign(dx);
    const k = this.home, cd = dist(this.x, this.z, k.x, k.z);
    if (cd > this.chainR) { this.x = k.x + ((this.x - k.x) / cd) * this.chainR; this.z = k.z + ((this.z - k.z) / cd) * this.chainR; }
    this.game.nav.resolve(this, this.r, F.H);
    return l < 0.4;
  }
  update(dt) {
    const g = this.game, R = g.raccoon, k = this.home;
    this.st += dt; this.barkT -= dt;
    const dR = dist(this.x, this.z, R.x, R.z);
    // food within reach?
    if (this.state !== 'eat' && this.state !== 'fetch') {
      const food = g.items.find((it) => it.def.food && it.id !== 'tomato' && !it.holder && !it.consumed && !it.inDen && it.onGround && dist(it.x, it.z, k.x, k.z) < this.chainR + 0.6);
      if (food && (this.state !== 'sleep' || dist(food.x, food.z, this.x, this.z) < 2.5)) { this.target = food; this.setState('fetch'); this.emote.show('heart', 1); }
    }
    let anim = 'idle', fps = 3;
    switch (this.state) {
      case 'sleep':
        anim = 'sleep'; fps = 1.5;
        this.zzT -= dt; if (this.zzT < 0) { this.zzT = 2.2; this.emote.show('zzz', 1.6); }
        if (!R.hidden && (dR < (R.mode === 'sneak' ? 1.1 : R.mode === 'run' ? 3.2 : 2.3))) this.setState('alert');
        break;
      case 'alert':
        anim = 'bark'; fps = 6;
        if (this.st < dt * 1.5 && !this.friend) this.bark();
        if (this.st > 0.6) this.setState(this.friend ? 'friend' : this.canSee(R) && dist(R.x, R.z, k.x, k.z) < this.chainR + 2.5 ? 'chase' : 'idle');
        break;
      case 'idle':
        anim = 'idle';
        if (this.friend) { this.setState('friend'); break; }
        if (this.canSee(R) && dist(R.x, R.z, k.x, k.z) < this.chainR + 1.5) { this.setState('alert'); break; }
        if (dR < 7) this.facing = Math.sign(R.x - this.x) || this.facing;
        this.moveToward(k.x, k.z, 1.5, dt); if (dist(this.x, this.z, k.x, k.z) > 0.3) { anim = 'run'; fps = 8; }
        if (this.st > 8) this.setState('sleep');
        break;
      case 'chase': {
        anim = 'run'; fps = 14;
        if (this.barkT <= 0) { this.barkT = 1.3; this.bark(); }
        if (this.canSee(R)) this.lost = 0; else this.lost += dt;
        if (R.inDen || this.lost > 1.5 || dist(R.x, R.z, k.x, k.z) > this.chainR + 3.5) { this.setState('idle'); break; }
        this.moveToward(R.x, R.z, 6.2, dt);
        if (dR < 0.75 && R.stun <= 0) {
          const it = R.carry;
          if (it && it.def.food && it.id !== 'tomato') { g.dropItem(); this.target = it; this.setState('fetch'); }
          else g.catchRaccoon(this);
          if (this.state === 'chase') this.setState('idle');
        }
        break;
      }
      case 'fetch': {
        const it = this.target; anim = 'run'; fps = 10;
        if (!it || it.holder || it.consumed || it.inDen) { this.setState(this.friend ? 'friend' : 'idle'); break; }
        if (dist(it.x, it.z, k.x, k.z) > this.chainR + 0.8) { this.setState('idle'); break; }
        if (this.moveToward(it.x, it.z, 4, dt) || dist(this.x, this.z, it.x, it.z) < 0.5) { it.consumed = true; this.setState('eat'); g.audio.play('munch', this.x, this.z); }
        break;
      }
      case 'eat':
        anim = 'eat'; fps = 5;
        if (Math.random() < dt * 2) g.particles.burst('hearts', this.x, 0.9, this.z, 1);
        if (this.st > 3.5) {
          if (!this.friend) { this.friend = true; g.complete('befriend_dog'); g.save.dogFriend = true; g.writeSave(); }
          this.emote.show('heart', 2); this.setState('friend');
        }
        break;
      case 'friend': {
        anim = 'wag'; fps = 5;
        const rk = dist(R.x, R.z, k.x, k.z);
        if (rk < this.chainR + 3 && dR > 1.2) { this.moveToward(R.x, R.z, 3.5, dt); anim = 'run'; fps = 10; }
        else if (dR < 4) this.facing = Math.sign(R.x - this.x) || this.facing;
        if (Math.random() < dt * 0.3 && dR < 5) this.emote.show('heart', 1.2);
        if (rk > 12 && this.st > 10) { this.moveToward(k.x, k.z, 1.5, dt); if (dist(this.x, this.z, k.x, k.z) < 0.3) { anim = 'sleep'; fps = 1.5; } }
        break;
      }
    }
    this.play(anim, fps);
    this.updateSprite(dt);
    this.emote.update(dt, this.x, this.y + 1.05, this.z);
    // sagging chain
    const ax = k.x + 0.4, az = k.z, bx = this.x + this.facing * 0.25, bz = this.z + 0.02, len = dist(ax, az, bx, bz);
    const sag = Math.max(0, this.chainR - len) * 0.08;
    for (let i = 0; i < 12; i++) { const t = i / 11; this.chainPos.set([ax + (bx - ax) * t, 0.35 - Math.sin(t * Math.PI) * (0.2 + sag) + t * 0.05, az + (bz - az) * t], i * 3); }
    this.chain.geometry.attributes.position.needsUpdate = true;
  }
}
