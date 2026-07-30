import * as THREE from '../vendor/three.module.js';

/**
 * 実時間に連動した空・光の色を作る。
 * 朝焼け → 昼 → 夕暮れ → 夜 をなめらかに補間する。
 */

const KEYS = [
  { h: 0, sky: '#0a1026', fog: '#141c3c', sun: '#4a5c9e', amb: 0.58, dir: 0.22, night: 1 },
  { h: 5, sky: '#2b2f5c', sun: '#ff9a6a', fog: '#5b4a72', amb: 0.6, dir: 0.4, night: 0.8 },
  { h: 7, sky: '#8fbfe0', fog: '#ffd8b4', sun: '#ffcf9e', amb: 0.72, dir: 0.95, night: 0.12 },
  { h: 11, sky: '#8ecbf2', fog: '#dff0ff', sun: '#ffffff', amb: 0.88, dir: 1.2, night: 0 },
  { h: 16, sky: '#82c2ea', fog: '#ffeed3', sun: '#fff2d8', amb: 0.82, dir: 1.05, night: 0 },
  { h: 18.5, sky: '#e2865c', fog: '#ffc79b', sun: '#ff9755', amb: 0.78, dir: 0.82, night: 0.3 },
  { h: 20.5, sky: '#3a2f5e', fog: '#5d4570', sun: '#8f6cb4', amb: 0.58, dir: 0.3, night: 0.75 },
  { h: 24, sky: '#0a1026', fog: '#141c3c', sun: '#4a5c9e', amb: 0.58, dir: 0.22, night: 1 },
];

const cacheA = new THREE.Color();
const cacheB = new THREE.Color();

function lerpHex(a, b, t, out) {
  cacheA.set(a);
  cacheB.set(b);
  return out.copy(cacheA).lerp(cacheB, t);
}

export function createSkyState() {
  return {
    sky: new THREE.Color(),
    fog: new THREE.Color(),
    sun: new THREE.Color(),
    amb: 0.8,
    dir: 1,
    night: 0,
    hour: 12,
  };
}

/** 0〜24 の時刻から状態を計算して out に書き込む */
export function sampleSky(hour, out) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const span = b.h - a.h || 1;
  const t = Math.min(1, Math.max(0, (h - a.h) / span));
  const e = t * t * (3 - 2 * t); // smoothstep

  lerpHex(a.sky, b.sky, e, out.sky);
  lerpHex(a.fog, b.fog, e, out.fog);
  lerpHex(a.sun, b.sun, e, out.sun);
  out.amb = a.amb + (b.amb - a.amb) * e;
  out.dir = a.dir + (b.dir - a.dir) * e;
  out.night = a.night + (b.night - a.night) * e;
  out.hour = h;
  return out;
}

export function currentHour(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/** 太陽（またはお月さま）の向き */
export function sunDirection(hour, out = new THREE.Vector3()) {
  const t = ((hour - 6) / 24) * Math.PI * 2;
  const elevation = Math.sin(t) * 0.9;
  return out.set(Math.cos(t) * 0.8, Math.max(0.22, Math.abs(elevation) * 0.9 + 0.25), Math.sin(t * 0.5) * 0.6 + 0.4).normalize();
}

export function createStars(radius = 260, count = 420) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.85 + 0.05);
    const r = radius * (0.85 + Math.random() * 0.15);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r * 0.75 + 20;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}
