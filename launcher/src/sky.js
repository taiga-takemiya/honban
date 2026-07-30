import { hexToRgb } from './gl.js';

/**
 * 実時間に連動した空と光。
 * 朝焼け → 昼 → 夕暮れ → 夜 をなめらかに補間する。
 * sky / fog / sun の色と、環境光(amb)・直射光(dir)・夜の度合い(night) を持つ。
 */

// sky/fog は背景の色、ambient は環境光の色（夜は空より明るめにして街を見えるようにする）
const KEYS = [
  { h: 0, sky: '#0e1430', fog: '#1a2346', sun: '#4a5c9e', ambient: '#5b6c9c', amb: 0.62, dir: 0.25, night: 1 },
  { h: 5, sky: '#2b2f5c', fog: '#5b4a72', sun: '#ff9a6a', ambient: '#6d6a96', amb: 0.6, dir: 0.45, night: 0.8 },
  { h: 7, sky: '#8fbfe0', fog: '#ffd8b4', sun: '#ffcf9e', ambient: '#a9c6de', amb: 0.5, dir: 0.95, night: 0.12 },
  { h: 11, sky: '#8ecbf2', fog: '#dff0ff', sun: '#ffffff', ambient: '#8ecbf2', amb: 0.45, dir: 1.2, night: 0 },
  { h: 16, sky: '#82c2ea', fog: '#ffeed3', sun: '#fff2d8', ambient: '#8ec4e8', amb: 0.46, dir: 1.05, night: 0 },
  { h: 18.5, sky: '#e2865c', fog: '#ffc79b', sun: '#ff9755', ambient: '#c99a8c', amb: 0.52, dir: 0.8, night: 0.3 },
  { h: 20.5, sky: '#3a2f5e', fog: '#5d4570', sun: '#8f6cb4', ambient: '#6a5f8c', amb: 0.58, dir: 0.3, night: 0.75 },
  { h: 24, sky: '#0e1430', fog: '#1a2346', sun: '#4a5c9e', ambient: '#5b6c9c', amb: 0.62, dir: 0.25, night: 1 },
];

const CACHE = {};
function rgb(hex) {
  if (!CACHE[hex]) CACHE[hex] = hexToRgb(hex);
  return CACHE[hex];
}

export function createSkyState() {
  return {
    clear: [0, 0, 0],
    fogColor: [0, 0, 0],
    skyColor: [0, 0, 0],
    groundColor: [0, 0, 0],
    sunColor: [0, 0, 0],
    tint: [1, 1, 1, 1],
    sun: [0.4, 0.8, 0.3],
    night: 0,
    hour: 12,
  };
}

export function currentHour(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60;
}

export function sampleSky(hour, out) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const span = b.h - a.h || 1;
  const raw = Math.min(1, Math.max(0, (h - a.h) / span));
  const t = raw * raw * (3 - 2 * raw);

  const skyA = rgb(a.sky);
  const skyB = rgb(b.sky);
  const fogA = rgb(a.fog);
  const fogB = rgb(b.fog);
  const sunA = rgb(a.sun);
  const sunB = rgb(b.sun);
  const ambA = rgb(a.ambient);
  const ambB = rgb(b.ambient);
  const amb = a.amb + (b.amb - a.amb) * t;
  const dir = a.dir + (b.dir - a.dir) * t;

  for (let c = 0; c < 3; c += 1) {
    const sky = skyA[c] + (skyB[c] - skyA[c]) * t;
    const fog = fogA[c] + (fogB[c] - fogA[c]) * t;
    const sun = sunA[c] + (sunB[c] - sunA[c]) * t;
    const ambient = ambA[c] + (ambB[c] - ambA[c]) * t;
    out.clear[c] = sky;
    out.fogColor[c] = fog;
    // 係数は「上向きの面がちょうど 1.0 前後になる」ように調整したもの
    out.skyColor[c] = ambient * amb; // 上からの環境光
    out.groundColor[c] = fog * amb * 0.45; // 地面からの照り返し
    out.sunColor[c] = sun * dir * 0.55; // 直射光
  }
  out.night = a.night + (b.night - a.night) * t;
  out.hour = h;

  // 太陽（夜は月）の向き
  const angle = ((h - 6) / 24) * Math.PI * 2;
  const x = Math.cos(angle) * 0.8;
  const y = Math.max(0.3, Math.abs(Math.sin(angle)) * 0.85 + 0.22);
  const z = Math.sin(angle * 0.5) * 0.55 + 0.35;
  const len = Math.hypot(x, y, z) || 1;
  out.sun[0] = x / len;
  out.sun[1] = y / len;
  out.sun[2] = z / len;
  return out;
}
