import { hexToRgb, mixRgb } from './gl.js';

/**
 * 時刻に応じた光の設定。
 * ミニマルに保つため、4つのパレット（夜／朝／昼／夕）を補間するだけ。
 * 街の色は昼向けに作ってあるので、暗い時間帯は tint で全体を落とす。
 */

const PALETTES = {
  night: {
    clear: '#151a26',
    fog: '#151a26',
    sky: '#4a5570',
    ground: '#2b3242',
    sun: '#3b4763',
    tint: '#aab0c0',
    night: 1,
  },
  dawn: {
    clear: '#e6d5cd',
    fog: '#e8d8cd',
    sky: '#8e93a6',
    ground: '#5b5450',
    sun: '#6b5a4c',
    tint: '#e8e4de',
    night: 0.25,
  },
  day: {
    clear: '#eaeef2',
    fog: '#eaeef2',
    sky: '#a2aab8',
    ground: '#6a6a68',
    sun: '#6e6c66',
    tint: '#ffffff',
    night: 0,
  },
  dusk: {
    clear: '#e2c9bd',
    fog: '#e4cdc2',
    sky: '#9b93a2',
    ground: '#6a5c5a',
    sun: '#966a52',
    tint: '#efe6e0',
    night: 0.28,
  },
};

const KEYS = [
  { h: 0, p: 'night' },
  { h: 5, p: 'night' },
  { h: 6.5, p: 'dawn' },
  { h: 9, p: 'day' },
  { h: 16.5, p: 'day' },
  { h: 18.5, p: 'dusk' },
  { h: 20, p: 'night' },
  { h: 24, p: 'night' },
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
    fogDensity: 0.0042,
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
  const a = PALETTES[KEYS[i].p];
  const b = PALETTES[KEYS[i + 1].p];
  const span = KEYS[i + 1].h - KEYS[i].h || 1;
  const raw = Math.min(1, Math.max(0, (h - KEYS[i].h) / span));
  const t = raw * raw * (3 - 2 * raw);

  const set = (target, key) => {
    const v = mixRgb(rgb(a[key]), rgb(b[key]), t);
    target[0] = v[0];
    target[1] = v[1];
    target[2] = v[2];
  };
  set(out.clear, 'clear');
  set(out.fogColor, 'fog');
  set(out.skyColor, 'sky');
  set(out.groundColor, 'ground');
  set(out.sunColor, 'sun');
  set(out.tint, 'tint');
  out.tint[3] = 1;
  out.night = a.night + (b.night - a.night) * t;
  out.hour = h;

  // 太陽（夜は月）の向き
  const angle = ((h - 6) / 24) * Math.PI * 2;
  const x = Math.cos(angle) * 0.75;
  const y = Math.max(0.32, Math.abs(Math.sin(angle)) * 0.8 + 0.22);
  const z = Math.sin(angle * 0.5) * 0.5 + 0.35;
  const len = Math.hypot(x, y, z) || 1;
  out.sun[0] = x / len;
  out.sun[1] = y / len;
  out.sun[2] = z / len;
  return out;
}
