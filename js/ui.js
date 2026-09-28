// DOM UI: HUD, toasts, to-do list, wardrobe, pause/settings, title and ending screens.
import * as THREE from 'three';
import { OBJECTIVES, ACCESSORIES, FUR_LIST, SLOTS, unlockHint, THRONE_GOAL } from './data.js';
import { accessoryIcon, raccoonPortrait } from './sprites.js';
import { isTouchDevice } from './util.js';

const $ = (id) => document.getElementById(id);
const iconCache = new Map();
const accIcon = (id) => { if (!iconCache.has(id)) iconCache.set(id, accessoryIcon(id, 3).toDataURL()); return iconCache.get(id); };
const V = new THREE.Vector3();

export class UI {
  constructor(game) {
    this.g = game; game.ui = this;
    this.panel = null; this.lastLabel = ''; this.floats = []; this.wTab = 'head'; this.pvT = 0; this.pvFrame = -1; this.titleT = 0;
    this.touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (isTouchDevice() && !(window.matchMedia && matchMedia('(pointer: fine)').matches));
    if (!this.touch) document.body.classList.add('no-touch');
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !this.touch) { this.touch = true; document.body.classList.remove('no-touch'); } }, { capture: true });
    game.input.bind({ touchLayer: $('touch-layer'), joy: $('joy'), knob: $('joy-knob'), joyMode: $('joy-mode'), buttons: [...document.querySelectorAll('[data-btn]')] });
    const tap = (el, fn) => el.addEventListener('click', (e) => { e.stopPropagation(); game.audio.play('click'); fn(); });
    tap($('b-todo'), () => this.toggleTodo());
    tap($('b-wardrobe'), () => this.openWardrobe());
    tap($('b-pause'), () => this.openPause());
    document.querySelectorAll('[data-close]').forEach((b) => tap(b, () => this.close()));
    for (const p of document.querySelectorAll('.panel')) p.addEventListener('pointerdown', (e) => { if (e.target === p && p.id !== 'p-title') { this.close(); } });
    // title
    if (game.save.started) { $('b-play').textContent = 'Continue'; $('b-new').classList.remove('hidden'); }
    $('b-play').addEventListener('click', () => this.start());
    let confirmNew = false;
    $('b-new').addEventListener('click', () => { if (!confirmNew) { confirmNew = true; $('b-new').textContent = 'Tap again to erase save'; return; } game.resetSave(); });
    // settings
    const S = game.save.settings;
    const music = $('s-music'), sfx = $('s-sfx');
    music.value = S.music; sfx.value = S.sfx;
    music.addEventListener('input', () => { S.music = +music.value; game.audio.setMusic(S.music); game.writeSave(); });
    sfx.addEventListener('input', () => { S.sfx = +sfx.value; game.audio.setSfx(S.sfx); game.writeSave(); });
    const qb = $('s-quality');
    const markQ = () => qb.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.q === game.save.settings.quality));
    qb.querySelectorAll('button').forEach((b) => tap(b, () => { game.setQuality(b.dataset.q); markQ(); game.writeSave(); }));
    markQ();
    const dof = $('s-dof'), cones = $('s-cones');
    dof.classList.toggle('on', S.dof); cones.classList.toggle('on', S.cones);
    tap(dof, () => { S.dof = !S.dof; dof.classList.toggle('on', S.dof); game.renderer.dof = S.dof ? 1 : 0; game.writeSave(); });
    tap(cones, () => { S.cones = !S.cones; cones.classList.toggle('on', S.cones); game.showCones = S.cones; game.writeSave(); });
    const fsOK = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    if (!fsOK) $('b-fs').classList.add('hidden');
    tap($('b-fs'), () => this.fullscreen());
    let confirmReset = false;
    tap($('b-reset'), () => { if (!confirmReset) { confirmReset = true; $('b-reset').textContent = 'Tap again to confirm'; return; } game.resetSave(); });
    this.setHoard(game.hoardValue);
    this.renderTodoMini();
    $('loading').remove();
  }
  get blocking() { return this.panel !== null; }
  fullscreen() {
    const d = document.documentElement;
    const req = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!document.fullscreenElement && req) {
      Promise.resolve(req.call(d)).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    } else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
  start() {
    const g = this.g;
    g.audio.init();
    if (this.touch && !document.fullscreenElement && (document.documentElement.requestFullscreen)) this.fullscreen();
    $('p-title').classList.remove('show');
    $('hud').classList.remove('hidden');
    g.mode = 'play';
    const first = !g.save.started;
    g.save.started = true; g.writeSave();
    const touch = this.touch;
    if (first) {
      this.toast(touch ? 'Drag on the left to move — a gentle push sneaks quietly. Hold RUN to dash.' : 'WASD / arrows to move · hold Shift to run · C toggles sneak', 'hint');
      g.after(6, () => this.toast('Your <b>Trash-to-Treasure List</b> (top-left) has mischief to get up to.', 'hint'));
      g.after(13, () => this.toast('Tip: people can’t see you in bushes, and a Chitter lures them over.', 'hint'));
    } else this.toast('Welcome back, bandit.', 'info');
  }
  open(name) {
    if (this.panel) $('p-' + this.panel).classList.remove('show');
    this.panel = name; $('p-' + name).classList.add('show');
    this.g.mode = 'paused'; this.g.input.blocked = true; this.g.input.clear();
  }
  close() {
    if (!this.panel) return;
    $('p-' + this.panel).classList.remove('show');
    this.panel = null; this.g.mode = 'play'; this.g.input.blocked = false; this.g.input.clear();
  }
  toggleTodo() { if (this.panel === 'todo') this.close(); else { this.renderTodo(); this.open('todo'); } }
  openPause() { if (this.panel === 'pause') { this.close(); return; } this.open('pause'); }
  openWardrobe() {
    if (this.panel === 'wardrobe') { this.close(); return; }
    $('b-wardrobe').classList.remove('ping');
    this.renderWardrobe(); this.open('wardrobe');
  }
  // ------------------------------------------------------------------ toasts
  toast(html, kind = 'info', icon = null) {
    const box = $('toasts');
    while (box.children.length >= 2) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = (icon ? `<img src="${icon}" alt="">` : '') + `<span>${html}</span>`;
    box.appendChild(el);
    const life = kind === 'hint' ? 5600 : 3800;
    setTimeout(() => el.classList.add('out'), life);
    setTimeout(() => el.remove(), life + 520);
  }
  objectiveDone(o) { this.toast(`<s>${o.text}</s>`, 'obj'); this.renderTodoMini(); }
  unlocked(accId) {
    const a = ACCESSORIES.find((x) => x.id === accId);
    if (!a) return;
    this.toast(`Unlocked <b>${a.name}</b>! Try it on in <b>Style</b>.`, 'unlock', accIcon(accId));
    $('b-wardrobe').classList.add('ping');
  }
  furUnlocked(f) {
    this.toast(`New fur colour: <b>${f.name}</b>!`, 'unlock', raccoonPortrait({ ...this.g.save.loadout, fur: f.id }, 2).toDataURL());
    $('b-wardrobe').classList.add('ping');
  }
  setHoard(v) {
    const el = $('hoard-val');
    if (!el) return;
    el.textContent = v;
    const h = $('hoard'); h.classList.remove('bump'); void h.offsetWidth; h.classList.add('bump');
  }
  floatText(text, x, y, z) {
    const el = document.createElement('div'); el.textContent = text; $('floats').appendChild(el);
    this.floats.push({ el, x, y, z, t: 0 });
  }
  renderTodoMini() { $('todo-mini').textContent = `${this.g.save.done.length}/${OBJECTIVES.length}`; }
  renderTodo() {
    const done = this.g.save.done;
    let html = '', sec = '';
    for (const o of OBJECTIVES) {
      if (o.sec !== sec) { sec = o.sec; html += `<h3>${sec}</h3>`; }
      const d = done.includes(o.id);
      html += `<li class="${d ? 'done' : ''}"><span class="box">${d ? '✔' : ''}</span><span class="txt">${o.text}</span>${o.unlock ? `<img class="rw" src="${accIcon(o.unlock)}" alt="">` : ''}</li>`;
    }
    $('todo-list').innerHTML = html;
    $('todo-count').textContent = `${done.length}/${OBJECTIVES.length}`;
  }
  // ------------------------------------------------------------------ wardrobe
  renderWardrobe() {
    const g = this.g, lo = g.save.loadout;
    const tabs = $('w-tabs'); tabs.innerHTML = '';
    for (const s of SLOTS) {
      const b = document.createElement('button'); b.textContent = s[0].toUpperCase() + s.slice(1); b.classList.toggle('sel', s === this.wTab);
      b.addEventListener('click', () => { g.audio.play('click'); this.wTab = s; this.renderWardrobe(); });
      tabs.appendChild(b);
    }
    const grid = $('w-grid'); grid.innerHTML = '';
    const info = $('w-info');
    const add = (content, sel, locked, onPick, title) => {
      const b = document.createElement('button');
      b.classList.toggle('sel', sel); b.classList.toggle('locked', locked); b.title = title;
      if (typeof content === 'string') b.innerHTML = content; else b.appendChild(content);
      b.addEventListener('click', () => { g.audio.play(locked ? 'question' : 'click'); if (locked) info.innerHTML = `<b>Locked</b><br>${title}`; else onPick(); });
      grid.appendChild(b);
    };
    if (this.wTab === 'fur') {
      for (const f of FUR_LIST) {
        const ok = g.furUnlocked(f.id);
        const c = raccoonPortrait({ fur: f.id }, 2);
        add(c, lo.fur === f.id, !ok, () => { g.setLoadout('fur', f.id); info.innerHTML = `<b>${f.name}</b>`; this.renderWardrobe(); }, ok ? f.name : `Complete ${f.need} list items`);
      }
    } else {
      add('<span class="none">∅</span>', !lo[this.wTab], false, () => { g.setLoadout(this.wTab, null); info.textContent = 'Au naturel.'; this.renderWardrobe(); }, 'None');
      for (const a of ACCESSORIES.filter((x) => x.slot === this.wTab)) {
        const ok = g.isUnlocked(a.id);
        const img = document.createElement('img'); img.src = accIcon(a.id); img.alt = a.name;
        add(img, lo[this.wTab] === a.id, !ok, () => { g.setLoadout(this.wTab, a.id); info.innerHTML = `<b>${a.name}</b>`; g.audio.play('pop'); this.renderWardrobe(); }, ok ? a.name : unlockHint(a.id));
      }
    }
    this.pvFrame = -1;
  }
  drawPreview(canvasId, anim = 'idle', frames = 4) {
    const cv = $(canvasId);
    const f = Math.floor(this.pvT * 4) % frames;
    if (f === this.pvFrame && canvasId === 'w-preview') return;
    if (canvasId === 'w-preview') this.pvFrame = f;
    const img = raccoonPortrait(this.g.save.loadout, 1, anim, f);
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
  }
  showEnding() {
    const g = this.g, s = g.stats;
    const mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
    $('end-stats').innerHTML = `Treasure hoarded: <b>✦${g.hoardValue}</b><br>List items done: <b>${g.save.done.length}/${OBJECTIVES.length}</b><br>Time: <b>${mins}m ${secs}s</b> · Times caught: <b>${s.caught}</b><br>` +
      (g.save.done.length >= OBJECTIVES.length ? '✨ Golden fur unlocked! ✨' : 'Finish the whole list to unlock <b>Golden</b> fur!');
    this.open('end');
  }
  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g, t = g.target;
    this.pvT += dt;
    if (g.mode === 'title') { this.titleT += dt; if (Math.floor(this.titleT * 4) !== this.tF) { this.tF = Math.floor(this.titleT * 4); this.drawPreview('title-racc', 'idle', 4); } }
    if (this.panel === 'wardrobe') this.drawPreview('w-preview');
    if (this.panel === 'end' && Math.floor(this.pvT * 4) !== this.eF) { this.eF = Math.floor(this.pvT * 4); this.drawPreview('end-racc', 'chitter', 2); }
    const label = t ? t.label : 'Grab';
    if (label !== this.lastLabel) { $('grab-label').textContent = label; this.lastLabel = label; }
    $('b-grab').classList.toggle('dim', !t);
    const tl = $('target-label');
    if (t && t.name && g.mode === 'play') {
      V.set(t.x, 1.25, t.z).project(g.camera);
      tl.style.display = 'block';
      tl.style.left = ((V.x + 1) / 2) * innerWidth + 'px'; tl.style.top = ((1 - V.y) / 2) * innerHeight + 'px';
      const html = t.name + (t.value ? ` <b>✦${t.value}</b>` : '');
      if (tl.innerHTML !== html) tl.innerHTML = html;
    } else tl.style.display = 'none';
    $('hidden-badge').classList.toggle('show', g.raccoon.hidden && g.mode === 'play');
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]; f.t += dt;
      if (f.t > 1.3) { f.el.remove(); this.floats.splice(i, 1); continue; }
      V.set(f.x, f.y + f.t * 0.8, f.z).project(g.camera);
      f.el.style.left = ((V.x + 1) / 2) * innerWidth + 'px'; f.el.style.top = ((1 - V.y) / 2) * innerHeight + 'px';
      f.el.style.opacity = f.t > 0.9 ? (1.3 - f.t) / 0.4 : 1;
    }
  }
}
