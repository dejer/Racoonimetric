// Renderer + HD-2D post chain: scene -> half-res blur -> quarter-res blur -> composite
// (tilt-shift depth of field following the player, cheap bloom, grading, vignette, dither).
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BLUR = `
uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 c = texture2D(tDiffuse, vUv) * 0.2270270270;
  c += texture2D(tDiffuse, vUv + dir * 1.3846153846) * 0.3162162162;
  c += texture2D(tDiffuse, vUv - dir * 1.3846153846) * 0.3162162162;
  c += texture2D(tDiffuse, vUv + dir * 3.2307692308) * 0.0702702703;
  c += texture2D(tDiffuse, vUv - dir * 3.2307692308) * 0.0702702703;
  gl_FragColor = c;
}`;
const COMPOSITE = `
uniform sampler2D tSharp; uniform sampler2D tMid; uniform sampler2D tBlur;
uniform float focusY, band, falloff, strength, bloom, vignette, saturation, flash;
uniform vec2 res; uniform vec3 flashColor;
varying vec2 vUv;
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec3 sharp = texture2D(tSharp, vUv).rgb;
  vec3 mid = texture2D(tMid, vUv).rgb;
  vec3 blur = texture2D(tBlur, vUv).rgb;
  float dy = vUv.y - focusY;
  float d = (dy > 0.0 ? dy : -dy * 0.72) - band;
  float m = clamp(d / falloff, 0.0, 1.0) * strength;
  vec3 col = mix(sharp, mid, smoothstep(0.0, 0.55, m));
  col = mix(col, blur, smoothstep(0.45, 1.0, m));
  col += max(blur - vec3(0.55), 0.0) * bloom;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  col = mix(col * vec3(0.90, 0.93, 1.10), col * vec3(1.04, 1.0, 0.95), smoothstep(0.02, 0.35, l));
  vec2 q = vUv - 0.5; q.x *= res.x / res.y * 0.75;
  float v = smoothstep(0.95, 0.30, length(q));
  col *= mix(1.0 - vignette, 1.0, v);
  col = mix(col, flashColor, flash);
  vec3 o = toSRGB(clamp(col, 0.0, 1.0));
  o += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(o, 1.0);
}`;

export const QUALITY = {
  low: { scale: 0.7, maxDpr: 1, shadows: false, shadowSize: 512, quarter: false },
  medium: { scale: 1, maxDpr: 1.5, shadows: true, shadowSize: 1024, quarter: true },
  high: { scale: 1, maxDpr: 2, shadows: true, shadowSize: 2048, quarter: true },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.setClearColor(0xd7eef7, 1);
    this.dof = 1; this.bloom = 0.6; this.flash = 0;
    this.dynScale = 1;
    const rtOpts = { depthBuffer: true, stencilBuffer: false, colorSpace: THREE.SRGBColorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
    this.rtScene = new THREE.WebGLRenderTarget(4, 4, rtOpts);
    const pOpts = { depthBuffer: false, stencilBuffer: false, colorSpace: THREE.SRGBColorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
    this.rtHA = new THREE.WebGLRenderTarget(4, 4, pOpts); this.rtHB = new THREE.WebGLRenderTarget(4, 4, pOpts);
    this.rtQA = new THREE.WebGLRenderTarget(4, 4, pOpts); this.rtQB = new THREE.WebGLRenderTarget(4, 4, pOpts);
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BLUR, uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false,
      uniforms: {
        tSharp: { value: null }, tMid: { value: null }, tBlur: { value: null },
        focusY: { value: 0.45 }, band: { value: 0.09 }, falloff: { value: 0.34 }, strength: { value: 1 },
        bloom: { value: 0.6 }, vignette: { value: 0.36 }, saturation: { value: 1.06 }, res: { value: new THREE.Vector2(1, 1) },
        flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene(); this.postScene.add(this.quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.setQuality('medium');
  }
  setQuality(name) {
    this.qName = name;
    this.q = QUALITY[name] || QUALITY.medium;
    this.gl.shadowMap.enabled = this.q.shadows;
    this.gl.shadowMap.needsUpdate = true;
    this.resize();
  }
  resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.maxDpr) * this.q.scale * this.dynScale;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const W = Math.max(2, Math.floor(w * dpr)), H = Math.max(2, Math.floor(h * dpr));
    this.W = W; this.H = H;
    this.rtScene.setSize(W, H);
    this.rtHA.setSize(W >> 1, H >> 1); this.rtHB.setSize(W >> 1, H >> 1);
    this.rtQA.setSize(W >> 2, H >> 2); this.rtQB.setSize(W >> 2, H >> 2);
    this.compMat.uniforms.res.value.set(W, H);
    this.aspect = w / h;
  }
  pass(mat, target) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.postScene, this.postCam);
  }
  blur(src, dst, tmp, w, h, spread) {
    const u = this.blurMat.uniforms;
    u.tDiffuse.value = src; u.dir.value.set(spread / w, 0); this.pass(this.blurMat, tmp);
    u.tDiffuse.value = tmp.texture; u.dir.value.set(0, spread / h); this.pass(this.blurMat, dst);
  }
  render(scene, camera, focusY = 0.45) {
    const gl = this.gl;
    gl.setRenderTarget(this.rtScene);
    gl.render(scene, camera);
    const cu = this.compMat.uniforms;
    cu.tSharp.value = this.rtScene.texture;
    if (this.dof > 0 || this.bloom > 0) {
      this.blur(this.rtScene.texture, this.rtHB, this.rtHA, this.W >> 1, this.H >> 1, 1.25);
      cu.tMid.value = this.rtHB.texture;
      if (this.q.quarter) {
        this.blur(this.rtHB.texture, this.rtQB, this.rtQA, this.W >> 2, this.H >> 2, 1.6);
        cu.tBlur.value = this.rtQB.texture;
      } else cu.tBlur.value = this.rtHB.texture;
    } else { cu.tMid.value = this.rtScene.texture; cu.tBlur.value = this.rtScene.texture; }
    cu.focusY.value = focusY;
    cu.strength.value = this.dof;
    cu.bloom.value = this.bloom;
    cu.flash.value = this.flash;
    this.pass(this.compMat, null);
  }
}
