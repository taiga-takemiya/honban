import { mat4, compose, createGeometry, append, box, cylinder, sphere, hexToRgb } from './gl.js';
import { WORLD } from './world.js';

const MAX_SPEED = 13;
const ACCEL = 70;
const DAMPING = 9;
const RADIUS = 1.1;

const INK = hexToRgb('#3b4250');
const SKIN = hexToRgb('#f2ece1');

/** ミニマルなアバター（胴＋頭のみ・1メッシュ1ドローコール） */
export function createPlayer(renderer) {
  const geo = createGeometry();
  const m = mat4();

  compose(m, 0, 0.1, 0, 0, 1, 1, 1);
  append(geo, cylinder(0.78, 0.92, 2.3, 14), m, INK);

  compose(m, 0, 3.15, 0, 0, 1, 1, 1);
  append(geo, sphere(0.86, 14, 10), m, SKIN);

  // 向きが分かるように小さな鼻
  compose(m, 0, 3.1, 0.82, 0, 1, 1, 1);
  append(geo, box(0.3, 0.3, 0.3), m, INK);

  return {
    mesh: renderer.createMesh(geo),
    model: mat4(),
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    heading: Math.PI,
    speed: 0,
    bob: 0,
  };
}

/**
 * @param {object} p プレイヤー
 * @param {{x:number,z:number}} dir 進みたい方向（正規化前でも可）
 */
export function updatePlayer(p, dir, dt, colliders) {
  const wants = Math.abs(dir.x) > 0.0001 || Math.abs(dir.z) > 0.0001;
  if (wants) {
    const len = Math.hypot(dir.x, dir.z) || 1;
    p.vx += (dir.x / len) * ACCEL * dt;
    p.vz += (dir.z / len) * ACCEL * dt;
  }

  const damp = wants ? 0.985 : Math.max(0, 1 - DAMPING * dt);
  p.vx *= damp;
  p.vz *= damp;

  let speed = Math.hypot(p.vx, p.vz);
  if (speed > MAX_SPEED) {
    p.vx = (p.vx / speed) * MAX_SPEED;
    p.vz = (p.vz / speed) * MAX_SPEED;
    speed = MAX_SPEED;
  }
  p.speed = speed;

  p.x += p.vx * dt;
  p.z += p.vz * dt;

  // 建物・木との衝突（円で押し戻して壁沿いに滑らせる）
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const min = c.r + RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = (min - d) / d;
      p.x += dx * push;
      p.z += dz * push;
      const nx = dx / d;
      const nz = dz / d;
      const dot = p.vx * nx + p.vz * nz;
      if (dot < 0) {
        p.vx -= nx * dot;
        p.vz -= nz * dot;
      }
    }
  }

  // 世界の外に出ない
  const r = Math.hypot(p.x, p.z);
  const limit = WORLD.radius - 6;
  if (r > limit) {
    p.x = (p.x / r) * limit;
    p.z = (p.z / r) * limit;
    p.vx *= 0.4;
    p.vz *= 0.4;
  }

  if (speed > 0.5) {
    const target = Math.atan2(p.vx, p.vz);
    let diff = target - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.heading += diff * Math.min(1, dt * 12);
  }

  p.bob += dt * (2 + (speed / MAX_SPEED) * 12);
}

export function drawPlayer(renderer, p, tint) {
  const lift = Math.abs(Math.sin(p.bob)) * 0.16 * (p.speed / MAX_SPEED);
  compose(p.model, p.x, lift, p.z, p.heading, 1, 1, 1);
  renderer.draw(p.mesh, { model: p.model, tint });
}
