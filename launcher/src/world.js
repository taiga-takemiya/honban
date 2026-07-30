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
  radius: 118,
  plazaRadius: 15,
  districtDistance: 58,
  roadWidth: 10,
};

/** ミニマルな配色（昼の基準色。夜は全体に暗いティントをかける） */
const PAPER = hexToRgb('#dbd8ce');
const PATH = hexToRgb('#f3f1ea');
const PLAZA = hexToRgb('#fbfaf6');
const WALL = hexToRgb('#fcfbf8');
const DOOR = hexToRgb('#cdc9be');
const LEAF_A = hexToRgb('#c3cfb4');
const LEAF_B = hexToRgb('#b3c2a6');
const POST = hexToRgb('#d5d2c8');
const BULB = hexToRgb('#fff4dd');
const PIN = hexToRgb('#8c8f98');

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

/** アプリ名の看板（白いピル＋色の点＋名前） */
function makeLabelCanvas(app) {
  const w = 256;
  const h = 80;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 4, 4, w - 8, h - 8, (h - 8) / 2);
  ctx.fill();

  ctx.fillStyle = app.color;
  ctx.beginPath();
  ctx.arc(38, h / 2, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#22262f';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let size = 34;
  ctx.font = `600 ${size}px ${TEXT_FONT}`;
  while (ctx.measureText(app.name).width > w - 96 && size > 15) {
    size -= 2;
    ctx.font = `600 ${size}px ${TEXT_FONT}`;
  }
  ctx.fillText(app.name, 62, h / 2 + 1);
  return canvas;
}

/** 街区の看板 */
function makeDistrictCanvas(district) {
  const w = 320;
  const h = 84;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  roundRect(ctx, 4, 4, w - 8, h - 8, 18);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#22262f';
  ctx.font = `600 38px ${TEXT_FONT}`;
  ctx.fillText(district.name, w / 2, 34);
  ctx.fillStyle = district.accent;
  ctx.font = `500 22px ${TEXT_FONT}`;
  ctx.fillText(district.sub, w / 2, 64);
  return canvas;
}

/** ナビ用のシェブロン（矢印） */
function makeArrowCanvas() {
  const s = 32;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(7, 20);
  ctx.lineTo(16, 11);
  ctx.lineTo(25, 20);
  ctx.stroke();
  return canvas;
}

/** 足元の影（やわらかい円） */
function makeShadowCanvas() {
  const s = 64;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(40,44,56,0.45)');
  g.addColorStop(1, 'rgba(40,44,56,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return canvas;
}

/* ------------------------------------------------------------------ build */

export function buildWorld(renderer, apps) {
  const colliders = [];
  const buildings = [];
  const districtSigns = [];
  const textures = [];
  const meshes = [];
  const m = mat4();

  const geo = createGeometry();
  const glow = createGeometry(); // 夜に光るもの（街灯・中央の目印）

  const add = (target, part, x, y, z, ry, color) => {
    compose(m, x, y, z, ry || 0, 1, 1, 1);
    append(target, part, m, color);
  };

  /* 地面と広場 ------------------------------------------------------- */
  add(geo, disc(WORLD.radius, 72), 0, 0, 0, 0, PAPER);
  add(geo, disc(WORLD.plazaRadius, 48), 0, 0.05, 0, 0, PLAZA);
  add(geo, ring(WORLD.plazaRadius - 0.4, WORLD.plazaRadius, 48), 0, 0.07, 0, 0, mixRgb(PAPER, [0.3, 0.32, 0.36], 0.4));

  // 中央の目印（細い白い柱）
  add(geo, cylinder(1.4, 1.8, 0.4, 24), 0, 0.06, 0, 0, mixRgb(PLAZA, POST, 0.6));
  add(geo, cylinder(0.16, 0.24, 5.2, 10), 0, 0.4, 0, 0, PIN);
  add(glow, sphere(0.72, 14, 10), 0, 5.7, 0, 0, WALL);
  colliders.push({ x: 0, z: 0, r: 2.4 });

  /* 街区 ------------------------------------------------------------- */
  const districts = DISTRICTS.map((d) => {
    const a = (d.angle * Math.PI) / 180;
    const cx = Math.cos(a) * WORLD.districtDistance;
    const cz = -Math.sin(a) * WORLD.districtDistance;
    const appsHere = apps.filter((app) => app.district === d.id);
    const ringRadius = Math.max(16, (appsHere.length * 7.4) / Math.PI + 6);
    return { ...d, cx, cz, ringRadius, apps: appsHere, rgb: hexToRgb(d.accent) };
  });

  districts.forEach((d) => {
    const dist = Math.hypot(d.cx, d.cz);
    const dx = d.cx / dist;
    const dz = d.cz / dist;

    // 街区の地面（紙色にアクセントをほんのり混ぜる）
    add(geo, disc(d.ringRadius + 11, 44), d.cx, 0.03, d.cz, 0, mixRgb(PAPER, d.rgb, 0.2));
    add(geo, disc(d.ringRadius * 0.5, 32), d.cx, 0.06, d.cz, 0, PATH);

    // 広場から街区へ伸びる道
    const start = WORLD.plazaRadius - 2;
    const len = dist - start;
    compose(m, dx * (start + len / 2), 0.04, dz * (start + len / 2), Math.atan2(dx, dz), 1, 1, 1);
    append(geo, quadXZ(WORLD.roadWidth, len), m, PATH);

    // 街区の看板（細い支柱＋ピル）
    const signX = d.cx - dx * (d.ringRadius + 8);
    const signZ = d.cz - dz * (d.ringRadius + 8);
    add(geo, cylinder(0.16, 0.2, 5.2, 8), signX, 0, signZ, 0, POST);
    const texture = renderer.createTexture(makeDistrictCanvas(d));
    textures.push(texture);
    districtSigns.push({ x: signX, y: 6.7, z: signZ, width: 8.2, height: 2.15, texture });
  });

  /* 建物（＝アプリ） ------------------------------------------------- */
  districts.forEach((d, di) => {
    const baseAngle = -Math.atan2(d.cz, d.cx) + Math.PI; // 広場側をあける
    const count = d.apps.length;

    d.apps.forEach((app, i) => {
      const rng = mulberry32(di * 977 + i * 131 + 11);
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const angle = baseAngle + t * Math.PI * 1.45;
      const radius = d.ringRadius + rng() * 2.5;
      const x = d.cx + Math.cos(angle) * radius;
      const z = d.cz - Math.sin(angle) * radius;

      const w = 7.6 + rng() * 1.6;
      const dp = 7.4 + rng() * 1.4;
      const h = app.height;
      const accent = hexToRgb(app.color);
      const ry = Math.atan2(d.cx - x, d.cz - z); // 街区の中心を向く

      add(geo, box(w, h, dp), x, h / 2, z, ry, mixRgb(WALL, accent, 0.16));
      add(geo, box(w + 0.7, 0.9, dp + 0.7), x, h + 0.45, z, ry, accent);
      const fx = Math.sin(ry) * (dp / 2 + 0.16);
      const fz = Math.cos(ry) * (dp / 2 + 0.16);
      add(geo, box(2.8, 3.6, 0.3), x + fx, 1.8, z + fz, ry, DOOR);

      const r = Math.max(w, dp) * 0.62;
      colliders.push({ x, z, r, h });

      const ox = (x - d.cx) / radius;
      const oz = (z - d.cz) / radius;
      const texture = renderer.createTexture(makeLabelCanvas(app));
      textures.push(texture);

      buildings.push({
        app,
        district: d,
        x,
        z,
        radius: r,
        height: h,
        doorX: x - ox * (r + 4),
        doorZ: z - oz * (r + 4),
        // 看板は屋上の少し上（どの方向から来ても読める高さ）
        sign: {
          x,
          y: h + 2.4 + (i % 2) * 1.3,
          z,
          width: 6.6,
          height: 2.06,
          texture,
        },
        ringAlpha: 0,
        rgb: accent,
      });
    });
  });

  /* 木と街灯 --------------------------------------------------------- */
  const coneA = cylinder(0, 2.6, 6.2, 7);
  const coneB = cylinder(0, 2.2, 5.2, 7);

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
  while (placed < 46 && guard < 1600) {
    guard += 1;
    const a = rng() * Math.PI * 2;
    const rad = 21 + Math.sqrt(rng()) * (WORLD.radius - 30);
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (onPath(x, z) || !clear(x, z, 6)) continue;
    add(geo, rng() > 0.5 ? coneA : coneB, x, 0, z, rng() * Math.PI, rng() > 0.5 ? LEAF_A : LEAF_B);
    colliders.push({ x, z, r: 1.8 });
    placed += 1;
  }

  // 街灯は広場と街区の入口だけ（数を絞る）
  const lampSpots = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    lampSpots.push([Math.cos(a) * (WORLD.plazaRadius - 0.8), Math.sin(a) * (WORLD.plazaRadius - 0.8)]);
  }
  districts.forEach((d) => {
    const dist = Math.hypot(d.cx, d.cz);
    const dx = d.cx / dist;
    const dz = d.cz / dist;
    const px = d.cx - dx * (d.ringRadius + 8);
    const pz = d.cz - dz * (d.ringRadius + 8);
    lampSpots.push([px - dz * 6, pz + dx * 6], [px + dz * 6, pz - dx * 6]);
  });
  lampSpots.forEach(([x, z]) => {
    add(geo, cylinder(0.08, 0.11, 4, 6), x, 0, z, 0, POST);
    add(glow, cylinder(0.26, 0.26, 0.3, 8), x, 4, z, 0, BULB);
    colliders.push({ x, z, r: 0.8 });
  });

  /* GPU へ ----------------------------------------------------------- */
  const staticMesh = renderer.createMesh(geo);
  const glowMesh = renderer.createMesh(glow);
  const signQuad = renderer.createMeshFromPart(quadXY(1, 1), [1, 1, 1]);
  const ringQuad = renderer.createMeshFromPart(ring(0.86, 1, 28), [1, 1, 1]);
  const pathQuad = renderer.createMeshFromPart(quadXZ(1, 1), [1, 1, 1]);
  const shadowQuad = renderer.createMeshFromPart(quadXZ(1, 1), [1, 1, 1]);
  meshes.push(staticMesh, glowMesh, signQuad, ringQuad, pathQuad, shadowQuad);

  const arrowTexture = renderer.createRepeatTexture(makeArrowCanvas());
  const shadowTexture = renderer.createTexture(makeShadowCanvas());
  textures.push(arrowTexture, shadowTexture);

  /* 現在いる場所の名前 ------------------------------------------------ */
  function districtAt(x, z) {
    let best = null;
    let bestDist = Infinity;
    districts.forEach((d) => {
      const dist = Math.hypot(x - d.cx, z - d.cz);
      if (dist < d.ringRadius + 13 && dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    });
    if (best) return best;
    if (Math.hypot(x, z) < WORLD.plazaRadius + 7) return { name: '中央広場' };
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

  /** 不透明な街本体。ctx: { night, tint } */
  function drawGround(ctx) {
    const { tint } = ctx;
    renderer.draw(staticMesh, { tint });
    renderer.draw(glowMesh, { tint, emissive: 0.05 + ctx.night * 2.6 });
  }

  /** 半透明の要素（輪・ナビの道・看板）。ctx: { eye, path, pathOffset } */
  function drawOverlay(ctx) {
    // 目的地・近くの建物を示す輪
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (b.ringAlpha < 0.02) continue;
      const s = b.radius + 2.2;
      compose(flatModel, b.x, 0.12, b.z, 0, s, 1, s);
      renderer.draw(ringQuad, {
        model: flatModel,
        tint: [b.rgb[0], b.rgb[1], b.rgb[2], b.ringAlpha],
        unlit: true,
        blend: true,
        depthWrite: false,
        cull: false,
      });
    }

    // 目的地までの矢印の道
    if (ctx.path) {
      const { x, z, angle, length, alpha } = ctx.path;
      compose(pathModel, x, 0.14, z, angle, 3, 1, length);
      renderer.draw(pathQuad, {
        model: pathModel,
        tint: [0.45, 0.5, 0.62, alpha],
        texture: arrowTexture,
        uv: [1, Math.max(2, length / 6), 0, ctx.pathOffset],
        unlit: true,
        blend: true,
        depthWrite: false,
      });
    }

    // 看板（近すぎ・遠すぎるものは薄くして画面を邪魔しない）
    const drawSign = (s) => {
      const d = Math.hypot(s.x - ctx.eye[0], s.z - ctx.eye[2]);
      const alpha = Math.min(1, Math.max(0, (d - 7) / 5), Math.max(0, (100 - d) / 16));
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

  /** 足元の影 */
  function drawShadow(x, z, size, alpha) {
    compose(flatModel, x, 0.09, z, 0, size, 1, size);
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
    vertexCount: geo.pos.length / 3,
  };
}
