// Ambient wildlife: sparrows that scatter (noisily!) when approached, butterflies over the flower beds.
import * as THREE from 'three';
import { PX, FX } from './sprites.js';
import { setUV, LEAN, SY } from './actors.js';
import { dist, rand, choice, damp } from './util.js';

const PERCHES = [[-16, 16.5], [-27, 22.4], [-13.8, 19.6], [-22.5, -5.8], [-4.2, -1.8], [-20, -24], [-10.5, -22.5], [10.2, -1.2], [18.6, 0.2], [-6.5, 13.4]];
const FLOWERS = [[-17, -4.4], [-9, -4.4], [-12, -29.6], [10.7, -4.4], [17.3, -4.4], [-28.5, 14.6], [-17.6, 22.4]];

export class Critters {
  constructor(game) {
    this.g = game;
    this.mat = new THREE.MeshBasicMaterial({ map: game.fxMat.map, alphaTest: 0.5, side: THREE.DoubleSide });
    this.birds = []; this.bflies = [];
    PERCHES.forEach(([x, z], i) => { for (let k = 0; k < (i % 3 === 0 ? 2 : 1); k++) this.birds.push(this.make({ x: x + rand(-0.8, 0.8), z: z + rand(-0.6, 0.6), y: 0, vx: 0, vy: 0, vz: 0, state: 'peck', t: rand(0, 2), facing: 1 })); });
    FLOWERS.forEach(([x, z], i) => this.bflies.push(this.make({ hx: x, hz: z, x, z, y: 0.7, phase: rand(0, 6), kind: i % 2, t: 0, facing: 1 }, 0.8)));
  }
  make(o, scale = 1) {
    const s = 16 * PX * scale, geo = new THREE.PlaneGeometry(s, s); geo.translate(0, s / 2, 0);
    o.m = new THREE.Mesh(geo, this.mat); o.m.rotation.x = LEAN; o.frame = -1;
    this.g.scene.add(o.m);
    return o;
  }
  frame(o, f) { if (o.frame !== f) { o.frame = f; setUV(o.m.geometry, this.g.fxSheet, f); } }
  scare(b) {
    const R = this.g.raccoon;
    b.state = 'fly'; b.t = 0;
    const a = Math.atan2(b.z - R.z, b.x - R.x) + rand(-0.6, 0.6);
    b.vx = Math.cos(a) * rand(2.5, 4.5); b.vz = Math.sin(a) * rand(2, 3.5) - 1; b.vy = rand(2.5, 3.8);
    b.facing = b.vx < 0 ? -1 : 1;
  }
  update(dt) {
    const g = this.g, R = g.raccoon;
    let scattered = null;
    for (const b of this.birds) {
      b.t += dt;
      if (b.state === 'peck') {
        if (b.t > 0.7 && Math.random() < dt * 1.2) { b.t = 0; b.facing = Math.random() < 0.5 ? -1 : 1; b.vy = 1.5; b.vx = b.facing * rand(0.2, 0.7); }
        b.vy -= 9 * dt; b.y += b.vy * dt; b.x += b.vx * dt;
        if (b.y <= 0) { b.y = 0; b.vy = 0; b.vx = 0; }
        this.frame(b, b.y > 0.02 ? FX.birdFly1 : (Math.floor(g.time * 2 + b.x) % 5 === 0 ? FX.birdFly2 : FX.bird));
        const d = dist(b.x, b.z, R.x, R.z);
        const near = d < (R.mode === 'sneak' ? 0.9 : R.mode === 'run' ? 3.4 : 2.1) || g.humans.some((h) => dist(h.x, h.z, b.x, b.z) < 1.6) || dist(g.dog.x, g.dog.z, b.x, b.z) < 1.4;
        if (near) { this.scare(b); scattered = b; for (const o of this.birds) if (o.state === 'peck' && dist(o.x, o.z, b.x, b.z) < 2.6) this.scare(o); }
      } else if (b.state === 'fly') {
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vy += 1.2 * dt;
        this.frame(b, Math.floor(b.t * 14) % 2 ? FX.birdFly1 : FX.birdFly2);
        if (b.y > 11) { b.state = 'away'; b.t = 0; b.wait = rand(12, 26); b.m.visible = false; }
      } else if (b.state === 'away') {
        if (b.t > b.wait) {
          const spots = PERCHES.filter(([x, z]) => dist(x, z, R.x, R.z) > 7);
          const [x, z] = choice(spots.length ? spots : PERCHES);
          b.tx = x + rand(-0.8, 0.8); b.tz = z + rand(-0.6, 0.6); b.x = b.tx - 3; b.z = b.tz + 1; b.y = 5; b.state = 'land'; b.m.visible = true; b.facing = 1;
        }
      } else if (b.state === 'land') {
        b.x = damp(b.x, b.tx, 1.5, dt); b.z = damp(b.z, b.tz, 1.5, dt); b.y = Math.max(0, b.y - dt * 2.8);
        this.frame(b, Math.floor(b.t * 12) % 2 ? FX.birdFly1 : FX.birdFly2);
        if (b.y <= 0) { b.state = 'peck'; b.t = 0; }
      }
      if (b.m.visible) { b.m.position.set(b.x, b.y + g.W.groundY(b.x, b.z), b.z); b.m.scale.set(b.facing, SY, 1); }
    }
    if (scattered) { g.audio.flutter(scattered.x, scattered.z); g.noise(scattered.x, scattered.z, 4.5, 'birds', true); }
    for (const f of this.bflies) {
      f.t += dt;
      const flee = dist(f.x, f.z, R.x, R.z) < 1.3;
      f.phase += dt * (flee ? 2.6 : 0.9);
      const tx = f.hx + Math.sin(f.phase * 0.7) * 1.4 + (flee ? (f.x - R.x) * 0.8 : 0);
      const tz = f.hz + Math.cos(f.phase * 0.53) * 0.9 + (flee ? (f.z - R.z) * 0.8 : 0);
      const px = f.x;
      f.x = damp(f.x, tx, 2, dt); f.z = damp(f.z, tz, 2, dt);
      f.y = 0.55 + Math.sin(f.phase * 1.7) * 0.25 + (flee ? 0.5 : 0);
      if (Math.abs(f.x - px) > 0.002) f.facing = f.x > px ? 1 : -1;
      this.frame(f, (f.kind ? FX.bflyB1 : FX.bflyA1) + (Math.floor(f.t * 11) % 2));
      f.m.position.set(f.x, f.y, f.z); f.m.scale.set(f.facing, SY, 1);
    }
  }
}
