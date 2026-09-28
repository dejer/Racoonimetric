// Game orchestration: world, actors, camera, interactions, objectives, saving.
import * as THREE from 'three';
import { Renderer } from './render.js';
import { makeTextures } from './textures.js';
import { buildWorld, F } from './world.js';
import { Nav } from './nav.js';
import { buildItemSheet, buildFxSheet } from './sprites.js';
import { Raccoon, Human, Dog, Item, Particles, spriteTex } from './actors.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { OBJECTIVES, ACCESSORIES, FUR_LIST, THRONE_GOAL } from './data.js';
import { clamp, damp, dist, rand, isTouchDevice } from './util.js';

const SAVE_KEY = 'racoonimetric-save-v1';
const PITCH = 0.84, FOVD = 34;
const NULL_INPUT = { mx: 0, mz: 0, mag: 0, run: false, sneaking: false };
const TRASH_IDS = ['banana', 'soda', 'hambone', 'pizza', 'apple', 'boot'];

export class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.scene = new THREE.Scene();
    const sky = new THREE.Color('#d9eef6');
    this.scene.background = sky; this.scene.fog = new THREE.Fog(sky, 30, 72);
    this.camera = new THREE.PerspectiveCamera(FOVD, 1, 0.5, 160);
    this.scene.add(new THREE.HemisphereLight('#e4f3ff', '#a3d47f', 1.45));
    const sun = (this.sun = new THREE.DirectionalLight('#fff0d4', 2.4));
    sun.castShadow = true; sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
    this.scene.add(sun, sun.target);
    this.T = makeTextures();
    this.W = buildWorld(this.scene, this.T);
    this.nav = new Nav(this.W);
    this.shadowGeo = new THREE.CircleGeometry(1, 20);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: this.T.shadow, transparent: true, depthWrite: false });
    this.itemSheet = buildItemSheet();
    this.itemMat = new THREE.MeshBasicMaterial({ map: spriteTex(this.itemSheet.canvas), alphaTest: 0.5, side: THREE.DoubleSide });
    this.fxSheet = buildFxSheet();
    this.fxMat = new THREE.MeshBasicMaterial({ map: spriteTex(this.fxSheet.canvas), alphaTest: 0.5, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    this.particles = new Particles(this.scene);
    this.save = this.loadSave();
    this.stats = this.save.stats;
    this.audio = new AudioEngine(); this.input = new Input();
    this.raccoon = new Raccoon(this, this.save.loadout);
    [this.raccoon.x, this.raccoon.z] = this.W.starts.raccoon;
    this.humans = [new Human(this, 'gardener'), new Human(this, 'dad')];
    this.dog = new Dog(this);
    this.items = this.W.spawns.map((sp) => new Item(this, sp.id, sp));
    this.rings = []; this.timers = []; this.time = 0; this.shake = 0; this.tunnelCD = 0; this.hoardValue = 0;
    this.showCones = this.save.settings.cones; this.target = null; this.mode = 'title';
    this.focusY = 0.45; this.camT = new THREE.Vector3(this.raccoon.x, 0, this.raccoon.z - 1);
    this.frameTimes = []; this.perfT = 0;
    this.applySave();
    const q = this.save.settings.quality || (isTouchDevice() ? 'medium' : 'high');
    this.setQuality(q);
    this.renderer.dof = this.save.settings.dof ? 1 : 0;
    this.audio.setMusic(this.save.settings.music); this.audio.setSfx(this.save.settings.sfx);
  }
  // ------------------------------------------------------------------ save
  loadSave() {
    const def = {
      v: 1, done: [], knocked: [], loadout: { head: null, face: null, neck: 'red_bandana', back: null, fur: 'classic' }, hoard: [],
      dug: false, dogFriend: false, throne: false, settings: { music: 0.7, sfx: 0.85, quality: null, dof: true, cones: true },
      stats: { time: 0, caught: 0, slips: 0 }, started: false,
    };
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (_) { s = null; }
    if (!s || s.v !== 1) return def;
    return { ...def, ...s, loadout: { ...def.loadout, ...s.loadout }, settings: { ...def.settings, ...s.settings }, stats: { ...def.stats, ...s.stats } };
  }
  writeSave() {
    const s = this.save;
    s.hoard = this.items.filter((it) => it.inDen && !it.consumed).map((it) => ({ id: it.id, x: +it.x.toFixed(2), z: +it.z.toFixed(2) }));
    s.dug = this.W.dig.dug; s.throne = this.W.throne.built; s.stats = this.stats;
    s.knocked = this.W.trashCans.filter((c) => c.knocked).map((c) => c.i);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (_) { /* private mode */ }
  }
  resetSave() { try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ } location.reload(); }
  applySave() {
    const s = this.save;
    const hoardIds = new Set();
    for (const h of s.hoard) {
      let it = this.items.find((i) => i.id === h.id && !i.inDen && !i.fromSave);
      if (!it) it = this.spawnItem(h.id, { x: h.x, z: h.z });
      it.x = h.x; it.z = h.z; it.y = it.restY = 0; it.inDen = true; it.fromSave = true; hoardIds.add(h.id);
      if (h.id === 'sunhat') { const gd = this.humans[0]; gd.hatOn = false; gd.setSheet(gd.sheetNoHat); it.home = { x: this.W.bench.x + 0.45, z: this.W.bench.z + 0.05, y: this.W.bench.y }; gd.hatItem = it; }
    }
    for (const i of s.knocked || []) { const c = this.W.trashCans[i]; if (c) this.knockCan(c, true, hoardIds); }
    if (s.dug) this.openTunnel(true);
    if (s.dogFriend) { this.dog.friend = true; this.dog.setState('friend'); }
    if (s.throne) this.buildThrone(true);
    this.checkDen(true);
  }
  isUnlocked(accId) {
    const a = ACCESSORIES.find((x) => x.id === accId);
    if (!a) return false;
    if (a.start) return true;
    const o = OBJECTIVES.find((ob) => ob.unlock === accId);
    return !!o && this.save.done.includes(o.id);
  }
  furUnlocked(id) { const f = FUR_LIST.find((x) => x.id === id); return !!f && this.save.done.length >= f.need; }
  setLoadout(slot, id) {
    this.save.loadout[slot] = id;
    this.raccoon.setLoadout(this.save.loadout);
    this.writeSave();
  }
  setQuality(q) {
    this.save.settings.quality = q;
    this.renderer.setQuality(q);
    const size = this.renderer.q.shadowSize;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.mapSize.set(size, size); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.sun.castShadow = this.renderer.q.shadows;
  }
  // ------------------------------------------------------------------ helpers
  after(t, fn) { this.timers.push({ t, fn }); }
  toast(text, kind = 'info', icon = null) { this.ui?.toast(text, kind, icon); }
  spawnItem(id, sp) { const it = new Item(this, id, sp); this.items.push(it); return it; }
  complete(id) {
    if (this.save.done.includes(id)) return;
    this.save.done.push(id);
    const o = OBJECTIVES.find((x) => x.id === id);
    this.audio.play('objective');
    this.ui?.objectiveDone(o);
    if (o.unlock) this.after(1.4, () => { this.audio.play('unlock'); this.ui?.unlocked(o.unlock); });
    const fur = FUR_LIST.find((f) => f.need === this.save.done.length && f.need > 0);
    if (fur) this.after(2.8, () => this.ui?.furUnlocked(fur));
    this.particles.burst('sparkle', this.raccoon.x, 1, this.raccoon.z, 14);
    this.writeSave();
  }
  noise(x, z, radius, type, quiet = false) {
    for (const h of this.humans) if (dist(h.x, h.z, x, z) < radius) h.hear(x, z, type);
    this.dog.hear(x, z, radius, type);
    if (!quiet) this.ring(x, z, radius);
  }
  ring(x, z, r) {
    let m = this.rings.find((q) => !q.visible);
    if (!m) {
      m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 4; this.scene.add(m); this.rings.push(m);
    }
    m.visible = true; m.userData = { t: 0, r }; m.position.set(x, 0.07, z);
  }
  rustle(hide, x, z) {
    const b = this.W.bushes.find((q) => q.x === hide.x && q.z === hide.z);
    if (b) { b.shake = 1; this.particles.burst('leaves', b.x, 0.8, b.z, 6); this.audio.play('rustle', x, z, 0.8); }
  }
  // ------------------------------------------------------------------ interactions
  findTarget() {
    const R = this.raccoon, W = this.W;
    if (R.sitting) return { type: 'stand', label: 'Stand' };
    if (R.carry) {
      if (R.carry.def.tool === 'dig' && !W.dig.dug && dist(R.x, R.z, W.dig.front.x, W.dig.front.z) < 1.4) return { type: 'dig', label: 'Dig!', x: W.dig.front.x, z: W.dig.front.z };
      return { type: 'drop', label: 'Drop' };
    }
    let best = null, bd = 1e9;
    const consider = (d, t) => { if (d < bd) { bd = d; best = t; } };
    for (const it of this.items) {
      if (it.holder || it.consumed) continue;
      const d = dist(R.x, R.z, it.x, it.z);
      if (d < (it.restY > 0.5 ? 1.15 : 0.95)) consider(d - 0.1, { type: 'grab', item: it, label: 'Grab', x: it.x, z: it.z, name: it.def.name, value: it.def.value });
    }
    for (const c of W.trashCans) if (!c.knocked) { const d = dist(R.x, R.z, c.x, c.z) - 0.4; if (d < 0.75) consider(d, { type: 'knock', can: c, label: 'Knock', x: c.x, z: c.z, name: 'Trash Can' }); }
    const near = (p, r, t) => { const d = dist(R.x, R.z, p.x, p.z); if (d < r) consider(d, { ...t, x: p.x, z: p.z }); };
    near(W.tap, 1.1, { type: 'tap', label: W.tap.on ? 'Tap Off' : 'Tap On', name: 'Garden Tap' });
    near(W.radio, 1.3, { type: 'radio', label: W.radio.on ? 'Radio Off' : 'Radio On', name: 'Radio' });
    near(W.mirror, 1.4, { type: 'mirror', label: 'Dress Up', name: 'Mirror Shard' });
    if (W.throne.built) near(W.throne, 1.4, { type: 'throne', label: 'Sit', name: 'Trash Throne' });
    near(W.birdbath, 1.2, { type: 'splash', label: 'Splash', name: 'Birdbath' });
    near(W.pond, 2.4, { type: 'splash', label: 'Splash', name: 'Pond' });
    near(W.pool, 1.9, { type: 'splash', label: 'Splash', name: 'Paddling Pool' });
    if (!W.dig.dug) near(W.dig.front, 1.1, { type: 'digHint', label: 'Sniff', name: 'Soft Dirt' });
    return best;
  }
  doAction() {
    const t = this.target, R = this.raccoon;
    if (!t || R.stun > 0 || (R.busy > 0 && t.type !== 'stand')) return;
    switch (t.type) {
      case 'grab': this.pickUp(t.item); break;
      case 'drop': this.dropItem(); break;
      case 'knock': this.knockCan(t.can); break;
      case 'tap': this.setTap(!this.W.tap.on); break;
      case 'radio': this.setRadio(!this.W.radio.on); break;
      case 'mirror': this.ui.openWardrobe(); break;
      case 'throne': this.sitThrone(); break;
      case 'stand': R.sitting = false; R.y = 0; R.z += 0.8; break;
      case 'splash': this.audio.play('splash', t.x, t.z); this.particles.burst('water', t.x, 0.8, t.z, 16); this.noise(t.x, t.z, 3, 'splash', true); R.wet = 3; break;
      case 'dig': this.dig(); break;
      case 'digHint': this.toast('The dirt under this fence is soft… if only you had a digging tool.', 'hint'); this.audio.play('question'); R.busy = 0.4; R.busyAnim = 'dig'; break;
    }
  }
  pickUp(it) {
    const R = this.raccoon;
    if (it.holder) return;
    R.carry = it; it.holder = R; it.inDen = false; R.squash = 0.8;
    this.audio.play('grab');
    if (it.id === 'sausage') this.complete('steal_sausage');
    if (it.id === 'sock' || it.id === 'sock2') this.complete('steal_sock');
    if (!this.save.firstGrab) { this.save.firstGrab = true; this.toast('Bring loot back to your den (the glowing ring) to hoard it!', 'hint'); }
  }
  dropItem() {
    const R = this.raccoon, it = R.carry;
    if (!it) return;
    R.carry = null; it.holder = null;
    it.x = R.x + R.facing * 0.42; it.z = R.z + 0.05; it.y = 0.35; it.restY = 0; it.vy = 1.5; it.vx = it.vz = 0;
    this.nav.resolve(it, 0.15, F.R);
    this.audio.play('drop'); R.squash = 1.15;
    this.noise(it.x, it.z, 2.2, 'drop', true);
  }
  catchRaccoon(by) {
    const R = this.raccoon;
    if (R.stun > 0 || R.sitting) return;
    const it = R.carry;
    if (it) { this.dropItem(); if (by.kind && it.owner === by.kind) { by.pickUp(it); by.setState('return', { item: it }); } }
    const a = Math.atan2(R.z - by.z, R.x - by.x);
    R.kx = Math.cos(a) * 7.5; R.kz = Math.sin(a) * 7.5; R.stun = 0.9; R.busy = 0;
    this.audio.play('bonk'); this.particles.burst('stars', R.x, 0.9, R.z, 8); R.emote.show('star', 1);
    this.shake = 0.35; this.stats.caught++;
    if (by.kind) { by.aware = 0.2; by.shooCD = 8; }
    if (!this.save.caughtTip) { this.save.caughtTip = true; this.toast('Caught! Sneak (gentle push), hide in bushes, or lure people away with noise.', 'hint'); }
  }
  knockCan(c, silent = false, skip = null) {
    c.knocked = true; c.t = silent ? 1 : 0; c.col.f = 0;
    for (const id of c.spill) {
      if (skip && skip.has(id)) continue;
      const it = this.spawnItem(id, { x: c.x + rand(-0.6, 0.6), z: c.z - rand(0.7, 1.4) });
      if (!silent) { it.y = 0.7; it.vy = 4; it.vx = rand(-1.5, 1.5); it.vz = -rand(0.5, 1.5); }
    }
    if (silent) return;
    this.audio.play('crash', c.x, c.z); this.noise(c.x, c.z, 11, 'crash');
    this.particles.burst('trash', c.x, 0.7, c.z - 0.3, 18); this.particles.burst('dust', c.x, 0.2, c.z - 0.5, 8);
    this.shake = 0.25;
    this.complete('knock_trash');
    this.writeSave();
  }
  setTap(on) {
    const W = this.W;
    if (W.tap.on === on) return;
    W.tap.on = on; this.audio.sprinkler = { on, x: W.sprinkler.x, z: W.sprinkler.z };
    this.audio.play('tap', W.tap.x, W.tap.z);
    if (on) this.noise(W.sprinkler.x, W.sprinkler.z, 15, 'sprinkler');
  }
  setRadio(on) {
    const r = this.W.radio;
    if (r.on === on) return;
    r.on = on; this.audio.radio = r;
    this.audio.play('click', r.x, r.z);
    if (on) this.noise(r.x, r.z, 17, 'radio');
  }
  dig() {
    const R = this.raccoon, D = this.W.dig;
    R.busy = 1.6; R.busyAnim = 'dig'; R.facing = 1;
    this.audio.play('dig', R.x, R.z); this.noise(R.x, R.z, 6.5, 'dig');
    const tick = (n) => { this.particles.burst('dirt', D.front.x, 0.1, D.front.z, 6); if (n > 0) this.after(0.3, () => tick(n - 1)); };
    tick(4);
    this.after(1.6, () => { this.openTunnel(); this.dropItem(); this.complete('dig_tunnel'); this.toast('Tunnel dug! Walk into the hole to scurry under the fence.', 'hint'); });
  }
  openTunnel(silent) { const D = this.W.dig; D.dug = true; D.meshes.forEach((m) => (m.visible = true)); D.soft.visible = false; if (!silent) this.writeSave(); }
  tunnel(x, z) {
    const R = this.raccoon;
    this.particles.burst('dirt', R.x, 0.1, R.z, 8); R.x = x; R.z = z; R.squash = 0.6; this.tunnelCD = 0.9;
    this.particles.burst('dirt', x, 0.1, z, 8); this.audio.play('pop');
  }
  chitter() {
    const R = this.raccoon;
    if (R.stun > 0 || R.busy > 0 || R.sitting) return;
    R.busy = 0.45; R.busyAnim = 'chitter';
    this.audio.play('chitter'); this.noise(R.x, R.z, 7.5, 'chitter'); this.particles.burst('notes', R.x, 1.0, R.z, 3);
  }
  buildThrone(silent) {
    const T = this.W.throne;
    if (T.built && !silent) return;
    T.built = true; T.g.visible = true;
    if (silent) { T.appear = 1; return; }
    T.appear = 0; this.audio.play('fanfare'); this.particles.burst('confetti', T.x, 1, T.z, 50); this.shake = 0.3;
    this.complete('trash_throne');
    this.toast('Your hoard became a TRASH THRONE! Go take your seat.', 'hint');
    this.writeSave();
  }
  sitThrone() {
    const R = this.raccoon, T = this.W.throne;
    if (R.carry) this.dropItem();
    R.sitting = true; R.x = T.x; R.z = T.z - 0.1; R.facing = 1;
    this.audio.play('fanfare'); this.particles.burst('confetti', T.x, 1.5, T.z, 60);
    const first = !this.save.done.includes('crown_self');
    this.complete('crown_self');
    if (first) this.after(3, () => this.ui.showEnding());
  }
  checkDen(silent = false) {
    const D = this.W.den, R = this.raccoon;
    R.inDen = dist(R.x, R.z, D.x, D.z) < D.r;
    let value = 0;
    for (const it of this.items) {
      if (it.consumed) continue;
      const inside = !it.holder && it.y < 0.25 && dist(it.x, it.z, D.x, D.z) < D.r;
      if (inside && !it.inDen) { it.inDen = true; if (!silent) this.onHoard(it); }
      else if (!inside && it.inDen && !it.holder && it.y < 0.25) it.inDen = false;
      if (it.inDen) value += it.def.value;
    }
    if (value !== this.hoardValue) {
      this.hoardValue = value; this.ui?.setHoard(value);
      if (value >= THRONE_GOAL && !this.W.throne.built && !silent) this.after(0.8, () => this.buildThrone());
    }
  }
  onHoard(it) {
    this.particles.burst('sparkle', it.x, 0.4, it.z, 12); this.audio.play('sparkle');
    this.ui?.floatText(`+${it.def.value}✦`, it.x, 1.0, it.z);
    const map = { gnome: 'steal_gnome', sunhat: 'steal_sunhat', tomato: 'steal_tomato', trophy: 'steal_trophy' };
    if (it.def.trash) this.complete('hoard_trash');
    if (map[it.id]) this.complete(map[it.id]);
    this.writeSave();
  }
  // ------------------------------------------------------------------ frame
  update(dt, live) {
    const R = this.raccoon, inp = this.input, W = this.W;
    this.time += dt; if (live) this.stats.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    inp.update();
    if (live) {
      if (inp.pressed('pause')) this.ui.openPause();
      if (inp.pressed('todo')) this.ui.toggleTodo();
      if (inp.pressed('wardrobe')) this.ui.openWardrobe();
      this.target = this.findTarget();
      if (inp.pressed('grab')) this.doAction();
      if (inp.pressed('chitter')) this.chitter();
      if (R.sitting && inp.mag > 0.4) { R.sitting = false; R.y = 0; }
    } else { inp.clear(); this.target = null; }
    R.update(dt, live ? inp : NULL_INPUT);
    // tunnel under the fence
    this.tunnelCD -= dt;
    if (W.dig.dug && this.tunnelCD <= 0 && R.stun <= 0) {
      const Df = W.dig.front, Db = W.dig.back;
      if (dist(R.x, R.z, Df.x, Df.z) < 0.5 && R.vz < -0.3) this.tunnel(Db.x, Db.z - 0.4);
      else if (dist(R.x, R.z, Db.x, Db.z) < 0.5 && R.vz > 0.3) this.tunnel(Df.x, Df.z + 0.4);
    }
    for (const h of this.humans) h.update(dt);
    this.dog.update(dt);
    for (const it of this.items) it.update(dt);
    this.checkDen();
    if (R.hidden && R.hide && R.hide.type === 'circle' && (this.humans.some((h) => ['chase', 'search', 'investigate', 'shoo'].includes(h.state) && dist(h.x, h.z, R.x, R.z) < 9) || this.dog.state === 'chase')) this.complete('hide_bush');
    this.updateWorld(dt);
    this.particles.update(dt);
    // music reacts to danger
    let level = 0;
    if (this.humans.some((h) => ['chase', 'react', 'shoo'].includes(h.state)) || this.dog.state === 'chase') level = 2;
    else if (R.mode === 'sneak' || this.humans.some((h) => h.aware > 0.15 || dist(h.x, h.z, R.x, R.z) < 8)) level = 1;
    this.audio.setIntensity(level);
    this.audio.listener = { x: R.x, z: R.z };
  }
  updateWorld(dt) {
    const W = this.W, R = this.raccoon, t = this.time;
    W.sway.value = t; W.player.value.set(R.x, 0, R.z);
    this.T.water.offset.set((t * 0.03) % 1, (t * 0.02) % 1);
    for (const b of W.bushes) {
      if (b.shake > 0) { b.shake = Math.max(0, b.shake - dt * 1.6); b.g.rotation.z = Math.sin(t * 38) * 0.07 * b.shake; b.g.scale.y = 1 + Math.sin(t * 29) * 0.05 * b.shake; }
      else if (b.g.rotation.z) { b.g.rotation.z = 0; b.g.scale.y = 1; }
    }
    for (const f of W.faders) {
      const inside = R.x > f.x0 && R.x < f.x1 && R.z > f.z0 && R.z < f.z1;
      f.cur = damp(f.cur, inside ? 0.25 : 1, 8, dt);
      const tr = f.cur < 0.985;
      for (const m of f.mats) { m.opacity = f.cur; if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; } }
    }
    const G = W.gate;
    if (this.humans.some((h) => dist(h.x, h.z, G.x, G.z) < 1.7)) { if (G.timer <= 0) this.audio.play('creak', G.x, G.z); G.timer = 1.1; }
    G.timer -= dt; G.open = damp(G.open, G.timer > 0 ? 1 : 0, 7, dt);
    G.g.rotation.y = G.open * 1.45; W.gateCollider.f = G.open > 0.4 ? 0 : F.R | F.S;
    for (const c of W.trashCans) {
      if (!c.knocked || c.t >= 1) { if (c.knocked && !c.settled) { c.settled = true; c.pivot.rotation.z = -c.dir * 1.5; c.pivot.position.y = 0.36; c.lid.position.set(c.x + c.dir * 1.6, 0.05, c.z - 0.9); c.lid.rotation.z = 1.4; } continue; }
      c.t = Math.min(1, c.t + dt * 3.5);
      const k = c.t * c.t;
      c.pivot.rotation.z = -c.dir * 1.5 * k; c.pivot.position.y = 0.36 * k;
      c.lid.position.set(c.x + c.dir * 1.6 * c.t, 0.99 + Math.sin(c.t * Math.PI) * 1.2 - 0.94 * c.t, c.z - 0.9 * c.t); c.lid.rotation.z = 1.4 * c.t;
    }
    W.tap.handle.rotation.z = damp(W.tap.handle.rotation.z, W.tap.on ? Math.PI / 2 : 0, 10, dt);
    if (W.tap.on) {
      const S = W.sprinkler;
      for (let i = 0; i < 3; i++) {
        const a = t * 2.4 + i * 2.1 + rand(-0.2, 0.2);
        this.particles.spawn(S.x, 0.3, S.z, Math.cos(a) * rand(2, 3.2), rand(3, 4.2), Math.sin(a) * rand(2, 3.2), i ? '#8fdcf5' : '#e3f8ff', rand(0.05, 0.08), 0.9);
      }
      if (dist(R.x, R.z, S.x, S.z) < S.r && R.wet < 1) R.wet = 3;
    }
    const rad = W.radio;
    rad.g.scale.y = rad.on ? 1 + Math.abs(Math.sin(t * 10)) * 0.12 : 1;
    if (rad.on && Math.random() < dt * 2.5) this.particles.burst('notes', rad.x, 1.2, rad.z, 1);
    if (Math.random() < dt * 3) this.particles.spawn(W.grill.x + rand(-0.4, 0.4), 1.0, W.grill.z, rand(-0.1, 0.1), rand(0.4, 0.8), rand(-0.1, 0.1), '#dadada', rand(0.1, 0.16), rand(1.2, 2), -0.3);
    const T = W.throne;
    if (T.built && T.appear < 1) { T.appear = Math.min(1, T.appear + dt * 1.4); const k = T.appear, s = 1 + Math.sin(k * Math.PI) * 0.25; T.g.scale.set(k * s, k * s, k * s); }
    W.denRing.material.opacity = 0.35 + Math.sin(t * 2.5) * 0.15 + (R.carry ? 0.25 : 0);
    for (const m of this.rings) {
      if (!m.visible) continue;
      const u = m.userData; u.t += dt; const k = u.t / 0.65;
      if (k >= 1) { m.visible = false; continue; }
      const s = u.r * (0.25 + 0.75 * (1 - (1 - k) * (1 - k)));
      m.scale.set(s, s, s); m.material.opacity = 0.45 * (1 - k);
    }
  }
  updateCamera(dt, live) {
    const R = this.raccoon, W = this.W, cam = this.camera, rd = this.renderer;
    const aspect = rd.aspect, tanH = Math.tan(THREE.MathUtils.degToRad(FOVD) / 2);
    const d = clamp(Math.max(15.5, 12 / (2 * tanH * aspect)), 15.5, 36);
    let tx, tz;
    if (live) { tx = R.x + R.vx * 0.35; tz = R.z - 1.2 + R.vz * 0.3; }
    else { tx = W.den.x + Math.sin(this.time * 0.12) * 4; tz = W.den.z - 3 + Math.cos(this.time * 0.09) * 1.5; }
    const b = W.bounds;
    tx = clamp(tx, b.x0 + 5, b.x1 - 5); tz = clamp(tz, b.z0 + 2.5, b.z1 - 4.5);
    this.camT.x = damp(this.camT.x, tx, 4, dt); this.camT.z = damp(this.camT.z, tz, 4, dt);
    this.shake = Math.max(0, this.shake - dt);
    const sx = (Math.random() - 0.5) * this.shake * 0.6, sz = (Math.random() - 0.5) * this.shake * 0.6;
    cam.fov = FOVD; cam.aspect = aspect; cam.updateProjectionMatrix();
    cam.position.set(this.camT.x + sx, d * Math.sin(PITCH), this.camT.z + d * Math.cos(PITCH) + sz);
    cam.lookAt(this.camT.x + sx, 0, this.camT.z + sz);
    // shadows follow the camera focus (snapped to texels to avoid shimmer)
    const ext = d * 0.95, sun = this.sun, texel = (ext * 2) / sun.shadow.mapSize.x;
    const fx = Math.round(this.camT.x / texel) * texel, fz = Math.round(this.camT.z / texel) * texel;
    sun.position.set(fx - 10, 24, fz + 12); sun.target.position.set(fx, 0, fz);
    const sc = sun.shadow.camera;
    if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
    const v = new THREE.Vector3(R.x, 0.4, R.z).project(cam);
    this.focusY = damp(this.focusY, clamp((v.y + 1) / 2, 0.15, 0.85), 6, dt);
    this.particles.mat.uniforms.scale.value = rd.H / (2 * tanH);
  }
  frame(dt) {
    const live = this.mode === 'play';
    if (this.mode !== 'paused') this.update(dt, live);
    this.updateCamera(dt, live);
    this.ui?.update(dt);
    this.renderer.render(this.scene, this.camera, this.focusY);
    // adaptive resolution for weaker phones
    this.frameTimes.push(dt); if (this.frameTimes.length > 90) this.frameTimes.shift();
    this.perfT += dt;
    if (this.perfT > 3 && this.frameTimes.length >= 90) {
      this.perfT = 0;
      const avg = this.frameTimes.reduce((a, c) => a + c, 0) / this.frameTimes.length, rd = this.renderer;
      if (avg > 1 / 38 && rd.dynScale > 0.55) { rd.dynScale = Math.max(0.55, rd.dynScale - 0.15); rd.resize(); }
      else if (avg < 1 / 58 && rd.dynScale < 1) { rd.dynScale = Math.min(1, rd.dynScale + 0.1); rd.resize(); }
    }
  }
}
