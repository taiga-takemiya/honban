import * as THREE from '../vendor/three.module.js';
import { DISTRICTS, DISTRICT_MAP } from './apps.js';

export const WORLD = {
  radius: 150,
  plazaRadius: 20,
  districtDistance: 74,
  roadWidth: 13,
};

/* ------------------------------------------------------------------ utils */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Noto Sans JP",sans-serif';
const TEXT_FONT = '"Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** アプリの看板（絵文字＋名前）テクスチャ */
function makeSignTexture(app) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  roundRect(ctx, 12, 16, size - 24, size - 60, 34);
  ctx.fill();
  ctx.strokeStyle = app.color;
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.fillStyle = app.color;
  roundRect(ctx, 12, 16, size - 24, 60, 30);
  ctx.fill();
  ctx.fillRect(12, 60, size - 24, 14);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `88px ${EMOJI_FONT}`;
  ctx.fillText(app.emoji, size / 2, 128);

  ctx.fillStyle = '#1d2233';
  let fontSize = 34;
  ctx.font = `600 ${fontSize}px ${TEXT_FONT}`;
  while (ctx.measureText(app.name).width > size - 48 && fontSize > 16) {
    fontSize -= 2;
    ctx.font = `600 ${fontSize}px ${TEXT_FONT}`;
  }
  ctx.fillText(app.name, size / 2, 182);

  // 支柱
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(size / 2 - 6, size - 46, 12, 46);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** 街区の名前看板テクスチャ */
function makeDistrictTexture(district) {
  const w = 512;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20,24,38,0.82)';
  roundRect(ctx, 4, 4, w - 8, h - 8, 26);
  ctx.fill();
  ctx.strokeStyle = district.accent;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 60px ${TEXT_FONT}`;
  ctx.fillText(district.name, w / 2, 62);
  ctx.fillStyle = district.accent;
  ctx.font = `500 30px ${TEXT_FONT}`;
  ctx.fillText(district.sub, w / 2, 116);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * 窓のテクスチャを2枚つくる（全建物で共有し、建物ごとに UV の繰り返しだけ変える）
 * day  : 壁を白、窓をグレーにして map として使う（昼の見た目）
 * night: 消えている窓を黒、点いている窓を暖色にして emissiveMap として使う（夜の見た目）
 */
function makeWindowTextures() {
  const w = 128;
  const h = 128;
  const cols = 3;
  const rows = 3;
  const pad = 12;
  const cw = (w - pad * (cols + 1)) / cols;
  const ch = (h - pad * (rows + 1)) / rows;

  const day = document.createElement('canvas');
  day.width = w;
  day.height = h;
  const dctx = day.getContext('2d');
  dctx.fillStyle = '#ffffff';
  dctx.fillRect(0, 0, w, h);

  const night = document.createElement('canvas');
  night.width = w;
  night.height = h;
  const nctx = night.getContext('2d');
  nctx.fillStyle = '#000000';
  nctx.fillRect(0, 0, w, h);

  const rng = mulberry32(9182);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = pad + c * (cw + pad);
      const y = pad + r * (ch + pad);
      dctx.fillStyle = 'rgba(96,116,152,0.4)';
      dctx.fillRect(x, y, cw, ch * 0.78);
      if (rng() > 0.45) {
        const v = 160 + Math.floor(rng() * 95);
        nctx.fillStyle = `rgb(${v},${Math.floor(v * 0.86)},${Math.floor(v * 0.58)})`;
        nctx.fillRect(x, y, cw, ch * 0.78);
      }
    }
  }

  const make = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { day: make(day), night: make(night) };
}

/** ふんわりした影（円形グラデーション） */
function makeShadowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(20,24,40,0.55)');
  g.addColorStop(0.55, 'rgba(20,24,40,0.22)');
  g.addColorStop(1, 'rgba(20,24,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** 進行方向を示す矢印テクスチャ（ナビ用） */
function makeArrowTexture() {
  const w = 64;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(32, 8);
  ctx.lineTo(56, 44);
  ctx.lineTo(32, 34);
  ctx.lineTo(8, 44);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/* ------------------------------------------------------------------ build */

function districtCenter(district) {
  const a = (district.angle * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(a) * WORLD.districtDistance, 0, -Math.sin(a) * WORLD.districtDistance);
}

export function buildWorld(apps) {
  const group = new THREE.Group();
  const colliders = [];
  const buildings = [];
  const nightMaterials = [];
  const disposables = [];

  const shadowTex = makeShadowTexture();
  const windowTex = makeWindowTextures();
  disposables.push(shadowTex, windowTex.day, windowTex.night);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  disposables.push(boxGeo, shadowGeo);

  /* 地面 ------------------------------------------------------------- */
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9fc48f });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(WORLD.radius, 96), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'ground';
  group.add(ground);
  disposables.push(ground.geometry, groundMat);

  const seaMat = new THREE.MeshLambertMaterial({ color: 0x5f86ad });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(520, 64), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.6;
  group.add(sea);
  disposables.push(sea.geometry, seaMat);

  /* 中央広場 --------------------------------------------------------- */
  const plazaMat = new THREE.MeshLambertMaterial({ color: 0xe6e2d6 });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(WORLD.plazaRadius, 64), plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.07;
  group.add(plaza);
  disposables.push(plaza.geometry, plazaMat);

  const plazaRingMat = new THREE.MeshLambertMaterial({ color: 0xc9c3b2 });
  const plazaRing = new THREE.Mesh(new THREE.RingGeometry(WORLD.plazaRadius * 0.62, WORLD.plazaRadius * 0.72, 64), plazaRingMat);
  plazaRing.rotation.x = -Math.PI / 2;
  plazaRing.position.y = 0.09;
  group.add(plazaRing);
  disposables.push(plazaRing.geometry, plazaRingMat);

  // 中央のモニュメント（ホームの目印）
  const monument = new THREE.Group();
  const baseMat = new THREE.MeshLambertMaterial({ color: 0xd9d3c4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.1, 1.1, 24), baseMat);
  base.position.y = 0.55;
  monument.add(base);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0xf2efe6 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 5.4, 16), pillarMat);
  pillar.position.y = 3.6;
  monument.add(pillar);
  const orbMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0x9fd0ff),
    emissiveIntensity: 0.3,
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 16), orbMat);
  orb.position.y = 7.1;
  monument.add(orb);
  group.add(monument);
  nightMaterials.push({ material: orbMat, base: 0.25, night: 0.9 });
  disposables.push(base.geometry, baseMat, pillar.geometry, pillarMat, orb.geometry, orbMat);
  colliders.push({ x: 0, z: 0, r: 3.4 });

  /* 街区・道路 ------------------------------------------------------- */
  const districts = DISTRICTS.map((d) => {
    const center = districtCenter(d);
    const appsHere = apps.filter((a) => a.district === d.id);
    const ringRadius = Math.max(15, (appsHere.length * 6.4) / Math.PI + 6);
    return { ...d, center, ringRadius, apps: appsHere };
  });

  districts.forEach((d) => {
    const dist = d.center.length();
    const dir = d.center.clone().normalize();

    // 道路（広場の縁から街区まで）
    const roadStart = WORLD.plazaRadius - 3;
    const roadLength = dist - roadStart;
    const roadMat = new THREE.MeshLambertMaterial({ color: 0xbdb6a6 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, roadLength), roadMat);
    road.rotation.order = 'YXZ';
    road.rotation.set(-Math.PI / 2, Math.atan2(-dir.x, -dir.z), 0);
    const mid = roadStart + roadLength / 2;
    road.position.set(dir.x * mid, 0.05, dir.z * mid);
    group.add(road);
    disposables.push(road.geometry, roadMat);

    // 街区の地面
    const discMat = new THREE.MeshLambertMaterial({ color: d.ground });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(d.ringRadius + 12, 56), discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(d.center.x, 0.06, d.center.z);
    group.add(disc);
    disposables.push(disc.geometry, discMat);

    // 街区中央の小広場
    const innerMat = new THREE.MeshLambertMaterial({ color: 0xefece1 });
    const inner = new THREE.Mesh(new THREE.CircleGeometry(d.ringRadius * 0.45, 40), innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(d.center.x, 0.08, d.center.z);
    group.add(inner);
    disposables.push(inner.geometry, innerMat);

    // 街区ゲート（広場側に立つ看板）
    const gate = new THREE.Group();
    const gatePos = d.center.clone().sub(dir.clone().multiplyScalar(d.ringRadius + 11));
    gate.position.copy(gatePos);
    gate.lookAt(0, 0, 0);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x8f8574 });
    [-6.5, 6.5].forEach((x) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 9, 12), postMat);
      post.position.set(x, 4.5, 0);
      gate.add(post);
    });
    const beam = new THREE.Mesh(boxGeo, postMat);
    beam.scale.set(15, 0.9, 1);
    beam.position.set(0, 9.2, 0);
    gate.add(beam);
    const signTex = makeDistrictTexture(d);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.1), signMat);
    sign.position.set(0, 6.6, 0.35);
    gate.add(sign);
    group.add(gate);
    disposables.push(postMat, signTex, signMat, sign.geometry);
    d.gatePosition = gatePos;
  });

  /* 建物（＝アプリ） ------------------------------------------------- */
  districts.forEach((d, di) => {
    const dir = d.center.clone().normalize();
    const baseAngle = Math.atan2(-dir.z, dir.x) + Math.PI; // 広場側を空ける
    const count = d.apps.length;

    d.apps.forEach((app, i) => {
      const spread = Math.PI * 1.5;
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const angle = baseAngle + t * spread;
      const rng = mulberry32(di * 977 + i * 131 + 7);
      const radius = d.ringRadius + rng() * 3.5;
      const pos = new THREE.Vector3(d.center.x + Math.cos(angle) * radius, 0, d.center.z - Math.sin(angle) * radius);

      const width = 8.4 + rng() * 2.2;
      const depth = 8 + rng() * 2;
      const height = app.height;

      const bGroup = new THREE.Group();
      bGroup.position.copy(pos);
      // 街区中心を向く
      bGroup.lookAt(d.center.x, 0, d.center.z);

      // 建物のサイズに合わせて窓の数を変える（テクスチャ本体は共有）
      const cols = Math.max(2, Math.round(width / 4.4));
      const rows = Math.max(2, Math.round(height / 4.6));
      const dayMap = windowTex.day.clone();
      dayMap.needsUpdate = true;
      dayMap.repeat.set(cols, rows);
      const nightMap = windowTex.night.clone();
      nightMap.needsUpdate = true;
      nightMap.repeat.set(cols, rows);

      const bodyMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(app.color),
        map: dayMap,
        emissive: new THREE.Color(0xffcf8a),
        emissiveMap: nightMap,
        emissiveIntensity: 0,
      });
      const body = new THREE.Mesh(boxGeo, bodyMat);
      body.scale.set(width, height, depth);
      body.position.y = height / 2;
      bGroup.add(body);
      nightMaterials.push({ material: bodyMat, base: 0, night: 1.05 });

      // 屋根
      const roofMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(app.color).multiplyScalar(0.72) });
      const roof = new THREE.Mesh(boxGeo, roofMat);
      roof.scale.set(width + 1.2, 1.1, depth + 1.2);
      roof.position.y = height + 0.5;
      bGroup.add(roof);

      // 入口
      const doorMat = new THREE.MeshLambertMaterial({
        color: 0x2c3242,
        emissive: new THREE.Color(0xffd9a0),
        emissiveIntensity: 0,
      });
      const door = new THREE.Mesh(boxGeo, doorMat);
      door.scale.set(3.4, 4.4, 0.4);
      door.position.set(0, 2.2, depth / 2 + 0.15);
      bGroup.add(door);
      nightMaterials.push({ material: doorMat, base: 0.05, night: 0.9 });

      // 看板：屋根の上に浮かぶもの（遠くから探す用・常にカメラを向く）
      const signTex = makeSignTexture(app);
      const spriteMat = new THREE.SpriteMaterial({ map: signTex, transparent: true, depthTest: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(6.6, 6.6, 1);
      sprite.position.y = height + 4.6;
      bGroup.add(sprite);

      // 看板：入口の上に取り付けたもの（近づいた時に読む用）
      const boardSize = Math.min(5.6, Math.max(3.4, height - 4.9));
      const boardMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(boardSize, boardSize), boardMat);
      board.position.set(0, 4.9 + boardSize / 2, depth / 2 + 0.28);
      bGroup.add(board);
      disposables.push(boardMat, board.geometry);

      // 足元の影
      const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.09;
      shadow.scale.set(width * 2.1, depth * 2.1, 1);
      bGroup.add(shadow);

      // ハイライトリング（近づいた時／ナビ中に光る）
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(app.color),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(7.4, 9.2, 40), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.12;
      bGroup.add(ring);

      group.add(bGroup);
      disposables.push(bodyMat, roofMat, doorMat, signTex, spriteMat, shadow.material, ringMat, ring.geometry, dayMap, nightMap);

      const collider = { x: pos.x, z: pos.z, r: Math.max(width, depth) * 0.62, h: height };
      colliders.push(collider);

      const outward = new THREE.Vector3(pos.x - d.center.x, 0, pos.z - d.center.z).normalize();
      const doorPoint = pos.clone().sub(outward.multiplyScalar(collider.r + 4.2));

      buildings.push({
        app,
        district: d,
        group: bGroup,
        body,
        ring,
        ringMat,
        sprite,
        position: pos,
        doorPoint,
        radius: collider.r,
        height,
      });
    });
  });

  /* 木・街灯・ベンチ ------------------------------------------------- */
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5b41 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x4f8f57 });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x6aa860 });
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 3.4, 8);
  const leafGeo = new THREE.ConeGeometry(2.9, 6.4, 9);
  disposables.push(trunkMat, leafMat, leafMat2, trunkGeo, leafGeo);

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x555a68 });
  const bulbMat = new THREE.MeshLambertMaterial({
    color: 0xfff2d4,
    emissive: new THREE.Color(0xffd9a0),
    emissiveIntensity: 0,
  });
  nightMaterials.push({ material: bulbMat, base: 0.1, night: 2.6 });
  const lampGeo = new THREE.CylinderGeometry(0.22, 0.3, 6.4, 8);
  const bulbGeo = new THREE.SphereGeometry(0.7, 12, 10);
  disposables.push(lampMat, bulbMat, lampGeo, bulbGeo);

  function farEnough(x, z, pad) {
    for (let i = 0; i < colliders.length; i += 1) {
      const c = colliders[i];
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + pad) * (c.r + pad)) return false;
    }
    return true;
  }

  function onRoadOrPlaza(x, z) {
    const r = Math.hypot(x, z);
    if (r < WORLD.plazaRadius + 2) return true;
    for (let i = 0; i < districts.length; i += 1) {
      const dir = districts[i].center.clone().normalize();
      const along = x * dir.x + z * dir.z;
      const across = Math.abs(x * -dir.z + z * dir.x);
      if (along > 0 && along < districts[i].center.length() && across < WORLD.roadWidth * 0.75) return true;
    }
    return false;
  }

  const rng = mulberry32(20260730);
  let placed = 0;
  let guard = 0;
  while (placed < 130 && guard < 3000) {
    guard += 1;
    const a = rng() * Math.PI * 2;
    const r = 16 + Math.sqrt(rng()) * (WORLD.radius - 22);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!farEnough(x, z, 5) || onRoadOrPlaza(x, z)) continue;

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.7;
    tree.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, rng() > 0.5 ? leafMat : leafMat2);
    leaves.position.y = 6;
    tree.add(leaves);
    const s = 0.75 + rng() * 0.7;
    tree.scale.setScalar(s);
    tree.position.set(x, 0, z);
    tree.rotation.y = rng() * Math.PI;
    group.add(tree);
    colliders.push({ x, z, r: 1.6 * s });
    placed += 1;
  }

  // 街灯を道路沿いに
  districts.forEach((d) => {
    const dir = d.center.clone().normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const len = d.center.length();
    for (let t = WORLD.plazaRadius + 6; t < len - 6; t += 18) {
      [-1, 1].forEach((s) => {
        const p = dir.clone().multiplyScalar(t).add(side.clone().multiplyScalar(s * (WORLD.roadWidth / 2 + 2.2)));
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(lampGeo, lampMat);
        pole.position.y = 3.2;
        lamp.add(pole);
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.y = 6.6;
        lamp.add(bulb);
        lamp.position.set(p.x, 0, p.z);
        group.add(lamp);
        colliders.push({ x: p.x, z: p.z, r: 0.9 });
      });
    }
  });

  /* ナビ用の矢印パス --------------------------------------------------- */
  const arrowTex = makeArrowTexture();
  arrowTex.repeat.set(1, 6);
  const pathMat = new THREE.MeshBasicMaterial({
    map: arrowTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const pathMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pathMat);
  pathMesh.rotation.x = -Math.PI / 2;
  pathMesh.position.y = 0.16;
  pathMesh.visible = false;
  group.add(pathMesh);
  disposables.push(arrowTex, pathMat, pathMesh.geometry);

  function districtAt(x, z) {
    let best = null;
    let bestDist = Infinity;
    districts.forEach((d) => {
      const dist = Math.hypot(x - d.center.x, z - d.center.z);
      if (dist < d.ringRadius + 14 && dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    });
    if (best) return best;
    if (Math.hypot(x, z) < WORLD.plazaRadius + 8) return { id: 'plaza', name: '中央広場', sub: 'ホーム', accent: '#ffd9a0' };

    // 道の上なら「〇〇へ続く道」と表示する
    for (let i = 0; i < districts.length; i += 1) {
      const d = districts[i];
      const len = d.center.length();
      const dirX = d.center.x / len;
      const dirZ = d.center.z / len;
      const along = x * dirX + z * dirZ;
      const across = Math.abs(x * -dirZ + z * dirX);
      if (along > 0 && along < len && across < WORLD.roadWidth * 0.8) {
        return { id: `road-${d.id}`, name: `${d.name}へ続く道`, sub: d.sub, accent: d.accent };
      }
    }
    return null;
  }

  function setNight(night) {
    nightMaterials.forEach((entry) => {
      entry.material.emissiveIntensity = entry.base + entry.night * night;
    });
    const g = 1 - night * 0.2;
    groundMat.color.setHex(0x9fc48f).multiplyScalar(g);
    seaMat.color.setHex(0x5f86ad).multiplyScalar(1 - night * 0.55);
  }

  function dispose() {
    disposables.forEach((d) => d && typeof d.dispose === 'function' && d.dispose());
  }

  return {
    group,
    ground,
    buildings,
    districts,
    colliders,
    pathMesh,
    pathMat,
    arrowTex,
    districtAt,
    setNight,
    dispose,
    shadowTexture: shadowTex,
  };
}
