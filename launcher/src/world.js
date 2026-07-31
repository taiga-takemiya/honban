import { DISTRICTS } from './apps.js';
import {
  mat4,
  compose,
  createGeometry,
  append,
  box,
  disc,
  ring,
  quadXZ,
  quadXY,
  cylinder,
  sphere,
  hexToRgb,
  mixRgb,
} from './gl.js';

export const WORLD = {
  radius: 165,
  plazaRadius: 22,
  districtDistance: 82,
  roadWidth: 14,
};

/* ------------------------------------------------------------------ 配色 */

const GRASS = hexToRgb('#9fc48f');
const SEA = hexToRgb('#5f86ad');
const PLAZA = hexToRgb('#e9e5d8');
const PLAZA_RING = hexToRgb('#c9c3b2');
const ROAD = hexToRgb('#bdb6a6');
const TRUNK = hexToRgb('#7a5b41');
const LEAF_A = hexToRgb('#4f8f57');
const LEAF_B = hexToRgb('#6aa860');
const POST = hexToRgb('#8f8574');
const LAMP = hexToRgb('#555a68');
const BULB = hexToRgb('#fff2d4');
const DOOR = hexToRgb('#2c3242');
const STONE = hexToRgb('#d9d3c4');
const STONE_LIGHT = hexToRgb('#f2efe6');

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Noto Sans JP",sans-serif';
const TEXT_FONT = '"Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif';

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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------------------------------------------------- テクスチャ */

/** アプリの看板（大きな絵文字＋名前のカード） */
function makeSignCanvas(app) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundRect(ctx, 10, 12, size - 20, size - 40, 34);
  ctx.fill();
  ctx.strokeStyle = app.color;
  ctx.lineWidth = 9;
  ctx.stroke();

  ctx.fillStyle = app.color;
  roundRect(ctx, 10, 12, size - 20, 58, 30);
  ctx.fill();
  ctx.fillRect(10, 54, size - 20, 16);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (app._img) {
    // 端末のアプリアイコン
    ctx.drawImage(app._img, size / 2 - 52, 80, 104, 104);
  } else if (app.emoji) {
    ctx.font = `96px ${EMOJI_FONT}`;
    ctx.fillText(app.emoji, size / 2, 132);
  } else {
    ctx.fillStyle = app.color;
    ctx.beginPath();
    ctx.arc(size / 2, 132, 44, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#1d2233';
  let fontSize = 38;
  ctx.font = `700 ${fontSize}px ${TEXT_FONT}`;
  while (ctx.measureText(app.name).width > size - 44 && fontSize > 16) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px ${TEXT_FONT}`;
  }
  ctx.fillText(app.name, size / 2, 194);
  return canvas;
}

/** 街区ゲートの看板 */
function makeDistrictCanvas(district) {
  const w = 512;
  const h = 176;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20,24,38,0.88)';
  roundRect(ctx, 4, 4, w - 8, h - 8, 26);
  ctx.fill();
  ctx.strokeStyle = district.accent;
  ctx.lineWidth = 7;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 68px ${TEXT_FONT}`;
  ctx.fillText(district.name, w / 2, 68);
  ctx.fillStyle = district.accent;
  ctx.font = `600 34px ${TEXT_FONT}`;
  ctx.fillText(district.sub, w / 2, 128);
  return canvas;
}

/**
 * 窓のテクスチャ。
 * day  : 白地に薄い窓（建物の color に掛けて昼の見た目をつくる）
 * night: 黒地に点いている窓だけ（加算合成で夜に光らせる）
 */
function makeWindowCanvases() {
  const w = 128;
  const h = 128;
  const cols = 3;
  const rows = 3;
  const pad = 13;
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
      dctx.fillStyle = 'rgba(58,74,104,0.5)';
      dctx.fillRect(x, y, cw, ch * 0.78);
      if (rng() > 0.42) {
        const v = 170 + Math.floor(rng() * 85);
        nctx.fillStyle = `rgb(${v},${Math.floor(v * 0.84)},${Math.floor(v * 0.54)})`;
        nctx.fillRect(x, y, cw, ch * 0.78);
      }
    }
  }
  return { day, night };
}

function makeArrowCanvas() {
  const s = 64;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(32, 8);
  ctx.lineTo(56, 44);
  ctx.lineTo(32, 34);
  ctx.lineTo(8, 44);
  ctx.closePath();
  ctx.fill();
  return canvas;
}

function makeShadowCanvas() {
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(20,24,40,0.55)');
  g.addColorStop(0.55, 'rgba(20,24,40,0.22)');
  g.addColorStop(1, 'rgba(20,24,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return canvas;
}

/** 夜空の星（ドーム上に小さな板を並べて1メッシュにする） */
function buildStars(count, radius) {
  const geo = createGeometry();
  const rng = mulberry32(4242);
  const quad = quadXY(1, 1);
  const m = mat4();
  for (let i = 0; i < count; i += 1) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(rng() * 0.9 + 0.05);
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const y = Math.cos(phi) * radius * 0.7 + 30;
    const z = Math.sin(phi) * Math.sin(theta) * radius;
    const s = 1.4 + rng() * 1.6;
    // 中心（＝カメラのだいたいの位置）を向くように回す
    compose(m, x, y, z, Math.atan2(x, z), s, s, s);
    append(geo, quad, m, [1, 1, 1]);
  }
  return geo;
}

/* ------------------------------------------------------------------ build */

export function buildWorld(renderer, apps) {
  const colliders = [];
  const buildings = [];
  const districtSigns = [];
  const textures = [];
  const meshes = [];
  const m = mat4();

  const geo = createGeometry(); // 窓のない部分（地面・道・屋根・木・街灯…）
  const wallGeo = createGeometry(); // 建物の壁（窓テクスチャつき）
  const wallNightGeo = createGeometry(); // 夜に光る窓（加算合成用・白）
  const glowGeo = createGeometry(); // 夜に光るもの

  const add = (target, part, x, y, z, ry, color, uvScale) => {
    compose(m, x, y, z, ry || 0, 1, 1, 1);
    append(target, part, m, color, uvScale);
  };

  /* 地面 ------------------------------------------------------------- */
  add(geo, disc(520, 48), 0, -1.6, 0, 0, SEA);
  add(geo, disc(WORLD.radius, 84), 0, 0, 0, 0, GRASS);
  add(geo, disc(WORLD.plazaRadius, 56), 0, 0.07, 0, 0, PLAZA);
  add(geo, ring(WORLD.plazaRadius * 0.62, WORLD.plazaRadius * 0.72, 56), 0, 0.09, 0, 0, PLAZA_RING);

  // 中央のモニュメント
  add(geo, cylinder(3.4, 4.2, 1.4, 24), 0, 0.08, 0, 0, STONE);
  add(geo, cylinder(0.9, 1.2, 8, 20), 0, 1.4, 0, 0, STONE_LIGHT);
  add(glowGeo, sphere(2.1, 20, 14), 0, 10.4, 0, 0, hexToRgb('#cfe6ff'));
  colliders.push({ x: 0, z: 0, r: 4.6, h: 11 });

  /* 街区 ------------------------------------------------------------- */
  const districts = DISTRICTS.map((d) => {
    const a = (d.angle * Math.PI) / 180;
    const cx = Math.cos(a) * WORLD.districtDistance;
    const cz = -Math.sin(a) * WORLD.districtDistance;
    const appsHere = apps.filter((app) => app.district === d.id);
    const ringRadius = Math.max(17, (appsHere.length * 7.6) / Math.PI + 7);
    return {
      ...d,
      cx,
      cz,
      ringRadius,
      apps: appsHere,
      rgb: hexToRgb(d.accent),
      groundRgb: hexToRgb(`#${d.ground.toString(16).padStart(6, '0')}`),
    };
  });

  districts.forEach((d) => {
    const dist = Math.hypot(d.cx, d.cz);
    const dx = d.cx / dist;
    const dz = d.cz / dist;

    add(geo, disc(d.ringRadius + 13, 48), d.cx, 0.03, d.cz, 0, d.groundRgb);
    add(geo, disc(d.ringRadius * 0.48, 36), d.cx, 0.08, d.cz, 0, mixRgb(PLAZA, d.groundRgb, 0.25));

    const start = WORLD.plazaRadius - 3;
    const len = dist - start;
    compose(m, dx * (start + len / 2), 0.05, dz * (start + len / 2), Math.atan2(dx, dz), 1, 1, 1);
    append(geo, quadXZ(WORLD.roadWidth, len), m, ROAD);

    // 街区ゲート（2本の柱＋梁＋看板）
    const gx = d.cx - dx * (d.ringRadius + 11);
    const gz = d.cz - dz * (d.ringRadius + 11);
    const ry = Math.atan2(dx, dz);
    const sx = -dz;
    const sz = dx;
    [-7.5, 7.5].forEach((o) => {
      add(geo, cylinder(0.5, 0.62, 10, 10), gx + sx * o, 0, gz + sz * o, 0, POST);
    });
    add(geo, box(17, 1.1, 1.2), gx, 10.4, gz, ry, POST);
    const texture = renderer.createTexture(makeDistrictCanvas(d));
    textures.push(texture);
    districtSigns.push({ x: gx, y: 7.2, z: gz, width: 15, height: 5.16, texture });

    colliders.push({ x: gx + sx * 7.5, z: gz + sz * 7.5, r: 0.9 });
    colliders.push({ x: gx - sx * 7.5, z: gz - sz * 7.5, r: 0.9 });
  });

  /* 建物（＝アプリ） ------------------------------------------------- */
  districts.forEach((d, di) => {
    const baseAngle = -Math.atan2(d.cz, d.cx) + Math.PI;
    const count = d.apps.length;

    d.apps.forEach((app, i) => {
      const rng = mulberry32(di * 977 + i * 131 + 11);
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const angle = baseAngle + t * Math.PI * 1.45;
      const radius = d.ringRadius + rng() * 3;
      const x = d.cx + Math.cos(angle) * radius;
      const z = d.cz - Math.sin(angle) * radius;

      const w = 8.6 + rng() * 2.2;
      const dp = 8.2 + rng() * 1.8;
      const h = app.height;
      const accent = hexToRgb(app.color);
      const ry = Math.atan2(d.cx - x, d.cz - z);

      // 壁（窓テクスチャの繰り返し数を建物の大きさに合わせる）
      const cols = Math.max(2, Math.round(w / 4.4));
      const rows = Math.max(2, Math.round(h / 4.6));
      const wall = box(w, h, dp);
      add(wallGeo, wall, x, h / 2, z, ry, accent, [cols, rows]);
      add(wallNightGeo, wall, x, h / 2, z, ry, [1, 1, 1], [cols, rows]);
      add(geo, box(w + 1.2, 1.1, dp + 1.2), x, h + 0.55, z, ry, mixRgb(accent, [0, 0, 0], 0.28));

      const fx = Math.sin(ry) * (dp / 2 + 0.2);
      const fz = Math.cos(ry) * (dp / 2 + 0.2);
      add(geo, box(3.4, 4.4, 0.4), x + fx, 2.2, z + fz, ry, DOOR);

      const r = Math.max(w, dp) * 0.62;
      colliders.push({ x, z, r, h });

      const ox = (x - d.cx) / radius;
      const oz = (z - d.cz) / radius;
      const texture = renderer.createTexture(makeSignCanvas(app));
      textures.push(texture);

      buildings.push({
        app,
        district: d,
        x,
        z,
        radius: r,
        height: h,
        doorX: x - ox * (r + 4.2),
        doorZ: z - oz * (r + 4.2),
        sign: { x, y: h + 4.2 + (i % 2) * 1.6, z, width: 10.5, height: 10.5, texture },
        ringAlpha: 0,
        rgb: accent,
      });
    });
  });

  /* 木・街灯 --------------------------------------------------------- */
  const trunk = cylinder(0.5, 0.7, 3.4, 8);
  const leaves = cylinder(0, 2.9, 6.4, 9);

  const onPath = (x, z) => {
    if (Math.hypot(x, z) < WORLD.plazaRadius + 2) return true;
    for (let i = 0; i < districts.length; i += 1) {
      const d = districts[i];
      const dist = Math.hypot(d.cx, d.cz);
      const dx = d.cx / dist;
      const dz = d.cz / dist;
      const along = x * dx + z * dz;
      const across = Math.abs(x * -dz + z * dx);
      if (along > 0 && along < dist && across < WORLD.roadWidth * 0.8) return true;
    }
    return false;
  };

  const clear = (x, z, pad) => {
    for (let i = 0; i < colliders.length; i += 1) {
      const c = colliders[i];
      if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
    }
    return true;
  };

  const rng = mulberry32(20260730);
  let placed = 0;
  let guard = 0;
  while (placed < 120 && guard < 3000) {
    guard += 1;
    const a = rng() * Math.PI * 2;
    const rad = 26 + Math.sqrt(rng()) * (WORLD.radius - 36);
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (onPath(x, z) || !clear(x, z, 5)) continue;
    const scale = 0.85 + rng() * 0.6;
    compose(m, x, 0, z, rng() * Math.PI, scale, scale, scale);
    append(geo, trunk, m, TRUNK);
    compose(m, x, 3.2 * scale, z, rng() * Math.PI, scale, scale, scale);
    append(geo, leaves, m, rng() > 0.5 ? LEAF_A : LEAF_B);
    colliders.push({ x, z, r: 1.7 * scale });
    placed += 1;
  }

  // 街灯（道沿いと広場）
  const lampSpots = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    lampSpots.push([Math.cos(a) * (WORLD.plazaRadius - 2.5), Math.sin(a) * (WORLD.plazaRadius - 2.5)]);
  }
  districts.forEach((d) => {
    const dist = Math.hypot(d.cx, d.cz);
    const dx = d.cx / dist;
    const dz = d.cz / dist;
    for (let t = WORLD.plazaRadius + 8; t < dist - 8; t += 20) {
      [-1, 1].forEach((s) => {
        lampSpots.push([dx * t - dz * s * (WORLD.roadWidth / 2 + 2.4), dz * t + dx * s * (WORLD.roadWidth / 2 + 2.4)]);
      });
    }
  });
  lampSpots.forEach(([x, z]) => {
    add(geo, cylinder(0.22, 0.3, 6.4, 8), x, 0, z, 0, LAMP);
    add(glowGeo, sphere(0.7, 12, 8), x, 6.6, z, 0, BULB);
    colliders.push({ x, z, r: 0.9 });
  });

  /* GPU へ ----------------------------------------------------------- */
  const windows = makeWindowCanvases();
  const dayTexture = renderer.createRepeatTexture(windows.day);
  const nightTexture = renderer.createRepeatTexture(windows.night);
  const arrowTexture = renderer.createRepeatTexture(makeArrowCanvas());
  const shadowTexture = renderer.createTexture(makeShadowCanvas());
  textures.push(dayTexture, nightTexture, arrowTexture, shadowTexture);

  const staticMesh = renderer.createMesh(geo);
  const wallMesh = renderer.createMesh(wallGeo);
  const wallNightMesh = renderer.createMesh(wallNightGeo);
  const glowMesh = renderer.createMesh(glowGeo);
  const starMesh = renderer.createMesh(buildStars(200, 300));
  const signQuad = renderer.createMeshFromPart(quadXY(1, 1), [1, 1, 1]);
  const ringQuad = renderer.createMeshFromPart(ring(0.82, 1, 32), [1, 1, 1]);
  const pathQuad = renderer.createMeshFromPart(quadXZ(1, 1), [1, 1, 1]);
  const shadowQuad = renderer.createMeshFromPart(quadXZ(1, 1), [1, 1, 1]);
  meshes.push(staticMesh, wallMesh, wallNightMesh, glowMesh, starMesh, signQuad, ringQuad, pathQuad, shadowQuad);

  /* 現在いる場所 ------------------------------------------------------ */
  function districtAt(x, z) {
    let best = null;
    let bestDist = Infinity;
    districts.forEach((d) => {
      const dist = Math.hypot(x - d.cx, z - d.cz);
      if (dist < d.ringRadius + 15 && dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    });
    if (best) return best;
    if (Math.hypot(x, z) < WORLD.plazaRadius + 8) return { name: '中央広場' };
    for (let i = 0; i < districts.length; i += 1) {
      const d = districts[i];
      const dist = Math.hypot(d.cx, d.cz);
      const dx = d.cx / dist;
      const dz = d.cz / dist;
      const along = x * dx + z * dz;
      const across = Math.abs(x * -dz + z * dx);
      if (along > 0 && along < dist && across < WORLD.roadWidth * 0.85) return { name: `${d.name}への道` };
    }
    return { name: '郊外' };
  }

  const pathModel = mat4();
  const signModel = mat4();
  const flatModel = mat4();

  /** 空と地面（不透明） */
  function drawGround(ctx) {
    if (ctx.night > 0.05) {
      renderer.draw(starMesh, { tint: [1, 1, 1, ctx.night], unlit: true, blend: 'add', depthWrite: false });
    }
    renderer.draw(staticMesh, {});
    renderer.draw(wallMesh, { texture: dayTexture });
    // 夜は窓と街灯を光らせる
    if (ctx.night > 0.02) {
      renderer.draw(wallNightMesh, {
        texture: nightTexture,
        tint: [1, 1, 1, ctx.night],
        unlit: true,
        blend: 'add',
        depthWrite: false,
      });
    }
    renderer.draw(glowMesh, { emissive: 0.1 + ctx.night * 1.1 });
  }

  /** 半透明の要素（輪・ナビの道・看板） */
  function drawOverlay(ctx) {
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (b.ringAlpha < 0.02) continue;
      const s = b.radius + 3;
      compose(flatModel, b.x, 0.13, b.z, 0, s, 1, s);
      renderer.draw(ringQuad, {
        model: flatModel,
        tint: [b.rgb[0], b.rgb[1], b.rgb[2], b.ringAlpha],
        unlit: true,
        blend: true,
        depthWrite: false,
        cull: false,
      });
    }

    if (ctx.path) {
      const { x, z, angle, length, alpha } = ctx.path;
      compose(pathModel, x, 0.16, z, angle, 3.6, 1, length);
      renderer.draw(pathQuad, {
        model: pathModel,
        tint: [1, 1, 1, alpha],
        texture: arrowTexture,
        uv: [1, Math.max(2, length / 7), 0, ctx.pathOffset],
        unlit: true,
        blend: true,
        depthWrite: false,
      });
    }

    const drawSign = (s) => {
      const d = Math.hypot(s.x - ctx.eye[0], s.z - ctx.eye[2]);
      const alpha = Math.min(1, Math.max(0, (d - 8) / 6), Math.max(0, (135 - d) / 20));
      if (alpha < 0.03) return;
      compose(signModel, s.x, s.y, s.z, 0, s.width, s.height, 1);
      renderer.draw(signQuad, {
        model: signModel,
        tint: [1, 1, 1, alpha],
        texture: s.texture,
        unlit: true,
        billboard: true,
        blend: true,
        depthWrite: false,
      });
    };
    for (let i = 0; i < buildings.length; i += 1) drawSign(buildings[i].sign);
    for (let i = 0; i < districtSigns.length; i += 1) drawSign(districtSigns[i]);
  }

  function drawShadow(x, z, size, alpha) {
    compose(flatModel, x, 0.1, z, 0, size, 1, size);
    renderer.draw(shadowQuad, {
      model: flatModel,
      tint: [1, 1, 1, alpha],
      texture: shadowTexture,
      unlit: true,
      blend: true,
      depthWrite: false,
    });
  }

  function dispose() {
    meshes.forEach((mesh) => renderer.disposeMesh(mesh));
    textures.forEach((t) => renderer.deleteTexture(t));
  }

  return {
    buildings,
    districts,
    colliders,
    drawGround,
    drawOverlay,
    drawShadow,
    districtAt,
    dispose,
    shadowTexture,
  };
}

/* --------------------------------------------------------------- 部屋の中 */

const ROOM = {
  half: 8, // 部屋の内側の半径（正方形の半分）
  wall: 7, // 壁の高さ
  entranceZ: 6.8, // 入口（ここより奥に行くと外に出る）
  panelZ: -7.5, // 奥の壁のパネル
  counterZ: -5,
};

/**
 * どのアプリでも共通で使う「部屋」。
 * 建物のドアをくぐるとこの部屋に入り、奥のパネルまで歩くとアプリが起動する。
 */
export function buildRoom(renderer) {
  const FLOOR = hexToRgb('#d9c9ad');
  const RUG = hexToRgb('#c2a882');
  const WALL_A = hexToRgb('#f4efe4');
  const WALL_B = hexToRgb('#e7e0d1');
  const COUNTER = hexToRgb('#9d8a6d');
  const TRIM = hexToRgb('#c9bda4');

  const geo = createGeometry();
  const m = mat4();
  const add = (part, x, y, z, ry, color) => {
    compose(m, x, y, z, ry || 0, 1, 1, 1);
    append(geo, part, m, color);
  };

  const h = ROOM.half;
  add(quadXZ(h * 2, h * 2), 0, 0, 0, 0, FLOOR);
  add(quadXZ(8, 8), 0, 0.02, -1.5, 0, RUG);

  // 壁（奥・左右・手前は入口を空ける）
  add(box(h * 2, ROOM.wall, 0.6), 0, ROOM.wall / 2, -h, 0, WALL_A);
  add(box(0.6, ROOM.wall, h * 2), -h, ROOM.wall / 2, 0, 0, WALL_B);
  add(box(0.6, ROOM.wall, h * 2), h, ROOM.wall / 2, 0, 0, WALL_B);
  [-1, 1].forEach((s) => {
    add(box(5.6, ROOM.wall, 0.6), s * 5.2, ROOM.wall / 2, h, 0, WALL_B);
  });
  // 入口の上のまぐさ
  add(box(4.8, 1.4, 0.6), 0, ROOM.wall - 0.7, h, 0, WALL_B);
  // 幅木
  add(box(h * 2, 0.3, 0.7), 0, 0.15, -h, 0, TRIM);

  // カウンター
  add(box(7, 1.2, 1.6), 0, 0.6, ROOM.counterZ, 0, COUNTER);
  add(box(7.4, 0.16, 1.9), 0, 1.28, ROOM.counterZ, 0, TRIM);

  const mesh = renderer.createMesh(geo);
  const panelQuad = renderer.createMeshFromPart(quadXY(1, 1), [1, 1, 1]);
  const bandQuad = renderer.createMeshFromPart(quadXY(1, 1), [1, 1, 1]);
  const model = mat4();

  /** 部屋を描く。app の看板テクスチャを奥のパネルに出す */
  function draw(building) {
    renderer.draw(mesh, {});
    // アクセントの帯
    compose(model, 0, 6, ROOM.panelZ + 0.02, 0, 14, 0.45, 1);
    renderer.draw(bandQuad, { model, tint: [...building.rgb, 1], unlit: true });
    // アプリのパネル
    compose(model, 0, 3.7, ROOM.panelZ + 0.05, 0, 7.2, 7.2, 1);
    renderer.draw(panelQuad, {
      model,
      texture: building.sign.texture,
      unlit: true,
      blend: true,
      depthWrite: false,
    });
  }

  function dispose() {
    renderer.disposeMesh(mesh);
    renderer.disposeMesh(panelQuad);
    renderer.disposeMesh(bandQuad);
  }

  return {
    draw,
    dispose,
    entrance: { x: 0, z: ROOM.entranceZ - 0.6 },
    panel: { x: 0, z: ROOM.counterZ + 1.6 },
    exitZ: ROOM.entranceZ,
    half: ROOM.half - 1.2,
    counter: { x: 0, z: ROOM.counterZ, r: 3.2 },
  };
}
