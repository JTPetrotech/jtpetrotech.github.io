'use strict';
/* Core: renderer, cameras, lights, small helpers, saved settings, sound. */

const $ = id => document.getElementById(id);
const canvas = $('game');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('menu').hidden = true; $('nogl').hidden = false; return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const store = {
  get(k, d) { try { const v = localStorage.getItem('oz_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('oz_' + k, JSON.stringify(v)); } catch (e) {} },
};
if (window.matchMedia && !matchMedia('(pointer:fine)').matches) $('touchnote').hidden = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8c6d4);
scene.fog = new THREE.Fog(0xa8c6d4, 80, 320);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 900);
camera.rotation.order = 'YXZ';
const wScene = new THREE.Scene();
const wCam = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
const hemi = new THREE.HemisphereLight(0xdcefff, 0x5d6b3c, 0.78);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d4, 0.85);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 320 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);
wScene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f44, 0.95));
{ const wl = new THREE.DirectionalLight(0xffffff, 0.55); wl.position.set(1, 2, 1.5); wScene.add(wl); }

const matCache = {};
const pm = (c) => matCache[c] || (matCache[c] = new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 4, specular: 0x111111 }));

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rnd = Math.random;
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
};
function sndShot(type, dist = 0) {
  if (!AC) return;
  const [freq, vol, dur, thump] = SND[type] || SND.rifle, t = AC.currentTime, att = 1 / (1 + dist / 35);
  if (att < 0.02) return;
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * (0.35 + 0.65 * att);
  const g = AC.createGain(); g.gain.setValueAtTime(vol * att, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t, Math.random() * 0.2); src.stop(t + dur + 0.05);
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
