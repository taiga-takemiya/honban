import { mat4, compose, createGeometry, append, box, cylinder, sphere, hexToRgb } from './gl.js';
import { WORLD } from './world.js';

const MAX_SPEED = 16;
const ACCEL = 85;
const DAMPING = 9;
const RADIUS = 1.2;

const SKIN = hexToRgb('#f6d6b8');
const CLOTH = hexToRgb('#4f6bd6');
const PANTS = hexToRgb('#2f3a5c');
const HAIR = hexToRgb('#2a2320');

/** 頭と胴（動かない部分）／脚／腕 をそれぞれメッシュにして歩かせる */
export function createPlayer(renderer) {
  const m = mat4();

  const bodyGeo = createGeometry();
  // 胴
  compose(m, 0, 1.15, 0, 0, 1, 1, 1);
  append(bodyGeo, cylinder(0.92, 1.02, 1.9, 14), m, CLOTH);
  compose(m, 0, 3.05, 0, 0, 1, 1, 1);
  append(bodyGeo, sphere(0.92, 14, 8, 0, Math.PI / 2), m, CLOTH);
  // 頭・髪・鼻
  compose(m, 0, 3.9, 0, 0, 1, 1, 1);
  append(bodyGeo, sphere(1.05, 18, 12), m, SKIN);
  compose(m, 0, 3.95, 0, 0, 1, 1, 1);
  append(bodyGeo, sphere(1.12, 18, 8, 0, Math.PI * 0.55), m, HAIR);
  compose(m, 0, 3.8, 0.98, 0, 1, 1, 1);
  append(bodyGeo, sphere(0.22, 8, 6), m, SKIN);

  const legGeo = createGeometry();
  compose(m, 0, 0, 0, 0, 1, 1, 1);
  append(legGeo, cylinder(0.34, 0.34, 1.4, 10), m, PANTS);
  compose(m, 0, 0.1, 0, 0, 1, 1, 1);
  append(legGeo, sphere(0.34, 10, 6), m, PANTS);

  const armGeo = createGeometry();
  compose(m, 0, 0, 0, 0, 1, 1, 1);
  append(armGeo, cylinder(0.27, 0.27, 1.5, 10), m, CLOTH);
  compose(m, 0, 0.1, 0, 0, 1, 1, 1);
  append(armGeo, sphere(0.27, 10, 6), m, CLOTH);

  return {
    body: renderer.createMesh(bodyGeo),
    leg: renderer.createMesh(legGeo),
    arm: renderer.createMesh(armGeo),
    model: mat4(),
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    heading: Math.PI,
    speed: 0,
    walk: 0,
  };
}

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

  p.walk += dt * (4 + (speed / MAX_SPEED) * 14);
}

/** ローカル座標（アバターから見た位置）をワールドに変換して描く */
function drawPart(renderer, p, mesh, lx, ly, lz) {
  const c = Math.cos(p.heading);
  const s = Math.sin(p.heading);
  compose(p.model, p.x + lx * c + lz * s, ly, p.z - lx * s + lz * c, p.heading, 1, 1, 1);
  renderer.draw(mesh, { model: p.model });
}

export function drawPlayer(renderer, p) {
  const t = p.speed / MAX_SPEED;
  const swing = Math.sin(p.walk) * 0.8 * t;
  const bob = Math.abs(Math.sin(p.walk * 2)) * 0.12 * t;

  drawPart(renderer, p, p.body, 0, bob, 0);
  drawPart(renderer, p, p.leg, -0.48, 0.05 + Math.abs(swing) * 0.2, swing);
  drawPart(renderer, p, p.leg, 0.48, 0.05 + Math.abs(swing) * 0.2, -swing);
  drawPart(renderer, p, p.arm, -1.16, 1.6 + bob, -swing * 0.8);
  drawPart(renderer, p, p.arm, 1.16, 1.6 + bob, swing * 0.8);
}

export { MAX_SPEED };
