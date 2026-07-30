import * as THREE from '../vendor/three.module.js';
import { WORLD } from './world.js';

const MAX_SPEED = 17; // m/s 相当（歩くというよりは軽快に散歩する速度）
const ACCEL = 90;
const DAMPING = 9;

export function createPlayer(shadowTexture) {
  const group = new THREE.Group();

  const skin = new THREE.MeshLambertMaterial({ color: 0xf6d6b8 });
  const cloth = new THREE.MeshLambertMaterial({ color: 0x4f6bd6 });
  const cloth2 = new THREE.MeshLambertMaterial({ color: 0x2f3a5c });
  const hair = new THREE.MeshLambertMaterial({ color: 0x2a2320 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 1.5, 8, 16), cloth);
  body.position.y = 2.1;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 16), skin);
  head.position.y = 3.9;
  group.add(head);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.position.y = 3.95;
  group.add(cap);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  nose.position.set(0, 3.8, 0.98);
  group.add(nose);

  const legGeo = new THREE.CapsuleGeometry(0.34, 0.9, 6, 10);
  const legL = new THREE.Mesh(legGeo, cloth2);
  const legR = new THREE.Mesh(legGeo, cloth2);
  legL.position.set(-0.45, 0.85, 0);
  legR.position.set(0.45, 0.85, 0);
  group.add(legL, legR);

  const armGeo = new THREE.CapsuleGeometry(0.26, 0.85, 6, 10);
  const armL = new THREE.Mesh(armGeo, cloth);
  const armR = new THREE.Mesh(armGeo, cloth);
  armL.position.set(-1.15, 2.4, 0);
  armR.position.set(1.15, 2.4, 0);
  group.add(armL, armR);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.08;
  group.add(shadow);

  const state = {
    group,
    position: group.position,
    velocity: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    walkPhase: 0,
    parts: { body, head, legL, legR, armL, armR },
    materials: [skin, cloth, cloth2, hair],
  };

  return state;
}

const tmpDir = new THREE.Vector3();

/**
 * @param {object} player
 * @param {THREE.Vector3} moveDir 正規化済みの進みたい方向（ワールド座標, y=0）
 * @param {number} dt
 * @param {Array<{x:number,z:number,r:number}>} colliders
 */
export function updatePlayer(player, moveDir, dt, colliders) {
  const wants = moveDir.lengthSq() > 0.0001;
  if (wants) {
    tmpDir.copy(moveDir).normalize();
    player.velocity.x += tmpDir.x * ACCEL * dt;
    player.velocity.z += tmpDir.z * ACCEL * dt;
  }

  // 減衰
  const damp = Math.max(0, 1 - DAMPING * dt);
  player.velocity.x *= wants ? 0.985 : damp;
  player.velocity.z *= wants ? 0.985 : damp;

  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  if (speed > MAX_SPEED) {
    player.velocity.x = (player.velocity.x / speed) * MAX_SPEED;
    player.velocity.z = (player.velocity.z / speed) * MAX_SPEED;
  }
  player.speed = Math.min(speed, MAX_SPEED);

  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;

  // 建物・木との衝突（円で押し戻す）
  const pr = 1.2;
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const dx = player.position.x - c.x;
    const dz = player.position.z - c.z;
    const min = c.r + pr;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = (min - d) / d;
      player.position.x += dx * push;
      player.position.z += dz * push;
      // 壁に沿って滑らせる
      const nx = dx / d;
      const nz = dz / d;
      const dot = player.velocity.x * nx + player.velocity.z * nz;
      if (dot < 0) {
        player.velocity.x -= nx * dot;
        player.velocity.z -= nz * dot;
      }
    }
  }

  // 世界の外には出られない
  const r = Math.hypot(player.position.x, player.position.z);
  const limit = WORLD.radius - 6;
  if (r > limit) {
    player.position.x = (player.position.x / r) * limit;
    player.position.z = (player.position.z / r) * limit;
    player.velocity.multiplyScalar(0.4);
  }

  // 向き
  if (player.speed > 0.6) {
    const target = Math.atan2(player.velocity.x, player.velocity.z);
    let diff = target - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += diff * Math.min(1, dt * 12);
  }
  player.group.rotation.y = player.heading;

  // 歩行アニメーション
  const t = player.speed / MAX_SPEED;
  player.walkPhase += dt * (4 + t * 14);
  const swing = Math.sin(player.walkPhase) * 0.55 * t;
  const { legL, legR, armL, armR, body } = player.parts;
  legL.position.z = swing * 1.4;
  legR.position.z = -swing * 1.4;
  legL.position.y = 0.85 + Math.abs(swing) * 0.35;
  legR.position.y = 0.85 + Math.abs(swing) * 0.35;
  armL.rotation.x = -swing * 1.2;
  armR.rotation.x = swing * 1.2;
  body.position.y = 2.1 + Math.abs(Math.sin(player.walkPhase * 2)) * 0.1 * t;
}
