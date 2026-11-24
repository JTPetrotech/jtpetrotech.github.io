'use strict';
/* Core: renderer, cameras, lights, sky, small helpers, saved settings, sound. */

const $ = id => document.getElementById(id);
const canvas = $('game');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('menu').hidden = true; $('nogl').hidden = false; return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const store = {
  get(k, d) { try { const v = localStorage.getItem('oz_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('oz_' + k, JSON.stringify(v)); } catch (e) {} },
};
if (window.matchMedia && !matchMedia('(pointer:fine)').matches) $('touchnote').hidden = false;

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(0xa8c6d4, 80, 320);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 900);
camera.rotation.order = 'YXZ';
const wScene = new THREE.Scene();
const wCam = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
const hemi = new THREE.HemisphereLight(0xdcefff, 0x5d6b3c, 0.78);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d4, 0.85);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 320 });
sun.shadow.bias = -0.0005; sun.shadow.radius = 2.5;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(60, 110, 35);
wScene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f44, 0.95));
{ const wl = new THREE.DirectionalLight(0xffffff, 0.6); wl.position.set(1, 2, 1.5); wScene.add(wl); }

/* sky: a gradient dome with a sun disc, drawn behind everything */
const skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color(0x4f7fb0) }, hor: { value: new THREE.Color(0xa8c6d4) }, sunDir: { value: SUN_OFF.clone().normalize() }, sunCol: { value: new THREE.Color(0xfff2d0) } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunCol; uniform vec3 sunDir; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(hor, top, pow(h, 0.6)); if (d.y < 0.0) c = hor;
      float s = max(dot(d, sunDir), 0.0); c += sunCol * (pow(s, 900.0) * 1.4 + pow(s, 14.0) * 0.16);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMat);
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

/* surface detail: world-space noise on top of flat colours, so walls and ground
   read as concrete, dirt and paint rather than plastic */
const NOISE_GLSL = `
float ozH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ozN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ozH(i), ozH(i + vec3(1,0,0)), f.x), mix(ozH(i + vec3(0,1,0)), ozH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ozH(i + vec3(0,0,1)), ozH(i + vec3(1,0,1)), f.x), mix(ozH(i + vec3(0,1,1)), ozH(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
function detail(mat, amt = 0.24, scale = 1) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vOzW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 ozw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      ozw = instanceMatrix * ozw;
      #endif
      vOzW = (modelMatrix * ozw).xyz;`);
    sh.fragmentShader = 'varying vec3 vOzW;\n' + NOISE_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 q = vOzW * ${scale.toFixed(3)};
        float n = ozN(q * 0.33) * 0.42 + ozN(q * 2.3) * 0.36 + ozN(q * 11.0) * 0.22;
        diffuseColor.rgb *= ${(1 - amt / 2).toFixed(3)} + ${amt.toFixed(3)} * n; }`);
  };
  mat.customProgramCacheKey = () => 'ozd' + amt + '_' + scale;
  return mat;
}

const matCache = {};
const pm = (c) => matCache[c] || (matCache[c] = new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 4, specular: 0x111111 }));

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const R = (a, b) => a + (b - a) * Math.random();
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

/* ---------- sound: everything is synthesised, nothing to download ---------- */
let AC = null, master = null, noiseBuf = null, volume = store.get('vol', 0.6);
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = volume; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.8, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
// [lowpass Hz, volume, decay s, thump Hz]
const SND = {
  rifle: [2600, .5, .22, 150], sniper: [1500, 1, .7, 85], smg: [3400, .38, .14, 170], lmg: [2200, .55, .26, 120],
  sg: [1300, .9, .42, 80], pistol: [2900, .42, .16, 160], bot: [1900, .3, .25, 130], sup: [900, .17, .11, 0],
  br: [2000, .65, .3, 110], rev: [1700, .75, .36, 95], mp: [3800, .32, .12, 180],
};
function noiseHit(t, freq, vol, dur, type = 'lowpass', off) {
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t, off == null ? Math.random() * 0.3 : off); src.stop(t + dur + 0.05);
}
function sndShot(type, dist = 0) {
  if (!AC) return;
  const [freq, vol, dur, thump] = SND[type] || SND.rifle, t = AC.currentTime, att = 1 / (1 + dist / 35);
  if (att < 0.015) return;
  noiseHit(t, freq * (0.35 + 0.65 * att), vol * att, dur);
  // a low rolling tail, louder the further away the shot is - that is what distant gunfire sounds like
  if (type !== 'sup') noiseHit(t + 0.03, 380 + 300 * att, vol * 0.22 * Math.min(1, att * 2.5), dur * 3.2 + 0.25);
  if (thump && dist < 40) {
    const o = AC.createOscillator(), og = AC.createGain();
    o.frequency.setValueAtTime(thump, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    og.gain.setValueAtTime(vol * 0.7 * att, t); og.gain.exponentialRampToValueAtTime(0.0008, t + 0.14);
    o.connect(og).connect(master); o.start(t); o.stop(t + 0.16);
  }
}
function beep(freq, dur, vol, type = 'square', delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function sndStep(wet) { if (AC) noiseHit(AC.currentTime, wet ? 1400 : 520 + Math.random() * 160, wet ? .12 : .1, wet ? .16 : .08); }
function sndWhiz() { if (AC) noiseHit(AC.currentTime, 2600 + Math.random() * 1500, .14, .12, 'bandpass'); }
function sndClick(f = 900, delay = 0) { if (AC) { noiseHit(AC.currentTime + delay, f, .16, .05, 'highpass'); beep(f * 0.4, .03, .05, 'square', delay); } }
function sndCrate() { if (!AC) return; noiseHit(AC.currentTime, 700, .25, .25); beep(520, .12, .08, 'triangle', .05); beep(780, .16, .07, 'triangle', .14); }
