import { createRenderer } from './gl.js';
import { DISTRICT_MAP, loadApps, saveApps, resetApps, makeId, openApp } from './apps.js';
import { WORLD, buildWorld } from './world.js';
import { createPlayer, updatePlayer, drawPlayer } from './player.js';
import { createControls } from './controls.js';
import { createUI } from './ui.js';
import { createSkyState, sampleSky, currentHour } from './sky.js';

const TIME_PRESETS = { morning: 7.2, day: 12.5, evening: 18.6, night: 22.5 };
const DPR_CAP = { high: 2, balanced: 1.5, low: 1 };
const NEAR_RADIUS = 11;
const AUTO_OPEN_RADIUS = 4.5;
const START = { x: 6, z: WORLD.plazaRadius * 0.7 };

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);

let apps = loadApps();

/* --------------------------------------------------------------- UI 準備 */

const ui = createUI({
  getApps: () => apps,
  getCameraYaw: () => controls?.state.yaw ?? 0,
  onNavigate: (app) => navigateTo(app, true),
  onCancelNav: () => clearNav(),
  onHome: () => goHome(),
  onOpenNearby: () => {
    if (nearby) launch(nearby.app);
  },
  onOpenApp: (app) => launch(app),
  onMapTap: (x, z) => setWalkTarget(x, z),
  onSettingsChange: (settings, key) => {
    if (key === 'quality') applyQuality(settings.quality);
    if (key === 'timeMode') updateSky();
  },
  onAddApp: (draft) => {
    apps = [...apps, { ...draft, id: makeId(draft.name, apps) }];
    saveApps(apps);
    rebuildWorld();
  },
  onUpdateApp: (id, draft) => {
    apps = apps.map((a) => (a.id === id ? { ...a, ...draft } : a));
    saveApps(apps);
    rebuildWorld();
  },
  onDeleteApp: (id) => {
    apps = apps.filter((a) => a.id !== id);
    if (apps.length === 0) apps = resetApps();
    saveApps(apps);
    rebuildWorld();
  },
  onReplaceApps: (list) => {
    saveApps(list);
    apps = loadApps();
    rebuildWorld();
  },
  onResetApps: () => {
    apps = resetApps();
    rebuildWorld();
  },
});

if (!renderer) {
  ui.showFallback();
  throw new Error('WebGL is unavailable');
}

/* ------------------------------------------------------------ 街と登場人物 */

const sky = createSkyState();
let world = buildWorld(renderer, apps);
const player = createPlayer(renderer);
player.x = START.x;
player.z = START.z;

function rebuildWorld() {
  world.dispose();
  world = buildWorld(renderer, apps);
  nearby = null;
  navTarget = null;
  walkTarget = null;
  ui.setNearby(null);
  ui.setNav(null);
  ui.refresh();
}

/* --------------------------------------------------------------- 操作 */

const controls = createControls({
  layer: document.getElementById('touch-layer'),
  stickBase: document.getElementById('stick-base'),
  stickKnob: document.getElementById('stick-knob'),
  onTap: handleTap,
});

/** 画面タップ → 建物 or 地面 */
function handleTap(clientX, clientY) {
  if (ui.isPanelOpen()) {
    ui.closePanels();
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ray = renderer.screenRay((clientX / w) * 2 - 1, -((clientY / h) * 2 - 1), w / h);
  const o = ray.origin;
  const d = ray.dir;

  // 建物を縦の円柱として当たり判定する
  let hit = null;
  let hitT = Infinity;
  for (let i = 0; i < world.buildings.length; i += 1) {
    const b = world.buildings[i];
    const ox = o[0] - b.x;
    const oz = o[2] - b.z;
    const a = d[0] * d[0] + d[2] * d[2];
    if (a < 1e-6) continue;
    const bq = 2 * (ox * d[0] + oz * d[2]);
    const c = ox * ox + oz * oz - b.radius * b.radius;
    const disc = bq * bq - 4 * a * c;
    if (disc < 0) continue;
    const t = (-bq - Math.sqrt(disc)) / (2 * a);
    if (t <= 0 || t >= hitT) continue;
    const y = o[1] + d[1] * t;
    if (y < 0 || y > b.height + 1) continue;
    hitT = t;
    hit = b;
  }

  // 地面（y = 0）
  const groundT = d[1] < -1e-6 ? -o[1] / d[1] : Infinity;
  if (hit && hitT < groundT) {
    navigateTo(hit.app, true);
    return;
  }
  if (groundT < Infinity) {
    setWalkTarget(o[0] + d[0] * groundT, o[2] + d[2] * groundT);
  }
}

/* ---------------------------------------------------------- ナビゲーション */

let navTarget = null;
let walkTarget = null;
let nearby = null;
let autoOpenGuard = null;
let pathAlpha = 0;
let pathOffset = 0;
let yawEase = null; // 到着時にカメラを建物の方へ向ける

function setWalkTarget(x, z) {
  walkTarget = { x, z };
}

function navigateTo(app, walk) {
  const building = world.buildings.find((b) => b.app.id === app.id);
  if (!building) return;
  navTarget = building;
  if (walk) setWalkTarget(building.doorX, building.doorZ);
  ui.toast(`${DISTRICT_MAP.get(app.district)?.name ?? ''}の ${app.name} へ`);
}

function clearNav() {
  navTarget = null;
  walkTarget = null;
  pathAlpha = 0;
  ui.setNav(null);
}

function goHome() {
  setWalkTarget(START.x, START.z);
  ui.toast('中央広場へ');
}

function launch(app) {
  const ok = openApp(app, (target, failed) => {
    if (failed) ui.toast(`${target.name} を開けませんでした（URLスキームを設定してください）`, 3200);
  });
  if (!ok) ui.toast(`${app.name} には開き先が設定されていません`, 3000);
  else ui.toast(`${app.name} を開きます…`);
  if (navTarget && navTarget.app.id === app.id) clearNav();
}

/* --------------------------------------------------------------- 描画設定 */

function applyQuality(quality) {
  const cap = DPR_CAP[quality] ?? 1.5;
  const dpr = Math.min(window.devicePixelRatio || 1, cap);
  renderer.setSize(window.innerWidth, window.innerHeight, dpr);
}

function resize() {
  applyQuality(ui.settings.quality);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => window.setTimeout(resize, 220));
resize();

function updateSky() {
  const mode = ui.settings.timeMode;
  sampleSky(mode === 'auto' ? currentHour() : TIME_PRESETS[mode] ?? 12, sky);
}

updateSky();

/* ------------------------------------------------- カメラが壁に埋まるのを防ぐ */

/**
 * カメラが建物に埋まらない位置を決める。
 * 寄せるのではなく「屋根の上まで持ち上げる」ことで、街を見下ろす画にする。
 */
function solveCamera(fx, fz, wanted, baseY, out) {
  let tallest = 0;
  let hitT = 1;
  for (let t = 1; t >= 0.5; t -= 0.15) {
    const cx = player.x - fx * wanted * t;
    const cz = player.z - fz * wanted * t;
    let blocked = 0;
    for (let i = 0; i < world.colliders.length; i += 1) {
      const c = world.colliders[i];
      if (c.r < 2) continue;
      const dx = cx - c.x;
      const dz = cz - c.z;
      if (dx * dx + dz * dz < (c.r + 2.2) * (c.r + 2.2)) blocked = Math.max(blocked, c.h || 6);
    }
    if (blocked === 0) {
      hitT = t;
      break;
    }
    tallest = Math.max(tallest, blocked);
    hitT = t;
  }
  out.dist = wanted * hitT;
  // 建物にぶつかるときは屋根の上まで持ち上げて見下ろす
  out.y = tallest === 0 ? baseY : Math.min(40, Math.max(baseY, tallest + 7));
  return out;
}

/* ------------------------------------------------------------ メインループ */

const env = {
  sun: sky.sun,
  sunColor: sky.sunColor,
  skyColor: sky.skyColor,
  groundColor: sky.groundColor,
  fogColor: sky.fogColor,
  fogDensity: 0.0042,
  clear: sky.clear,
};

const cam = { x: 0, y: 20, z: 40 };
const camSolve = { dist: 28, y: 18 };
const drawCtx = { night: 0, tint: sky.tint, eye: renderer.camera.eye, path: null, pathOffset: 0 };
const moveDir = { x: 0, z: 0 };
let last = performance.now();
let uiClock = 0;
let skyClock = 0;
let started = false;

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const usingKeys = controls.applyKeyboard(dt);
  const { state } = controls;
  let fx = Math.sin(state.yaw);
  let fz = Math.cos(state.yaw);
  const hasInput = Math.abs(state.move.x) > 0.02 || Math.abs(state.move.y) > 0.02;

  if (hasInput) {
    moveDir.x = fz * state.move.x + fx * state.move.y;
    moveDir.z = -fx * state.move.x + fz * state.move.y;
    if (usingKeys || state.stickActive) walkTarget = null;
  } else if (walkTarget) {
    const dx = walkTarget.x - player.x;
    const dz = walkTarget.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.4) {
      walkTarget = null;
      moveDir.x = 0;
      moveDir.z = 0;
    } else {
      const scale = Math.min(1, d / 8) / d;
      moveDir.x = dx * scale;
      moveDir.z = dz * scale;
    }
  } else {
    moveDir.x = 0;
    moveDir.z = 0;
  }

  updatePlayer(player, moveDir, dt, world.colliders);

  // 到着したら建物の方を向く
  if (yawEase !== null) {
    if (state.lookActive || hasInput) {
      yawEase = null;
    } else {
      let diff = yawEase - state.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.02) yawEase = null;
      else {
        state.yaw += diff * Math.min(1, dt * 3);
        fx = Math.sin(state.yaw);
        fz = Math.cos(state.yaw);
      }
    }
  }

  // 自動で歩いている間はカメラを進行方向の後ろへ
  if (walkTarget && !state.lookActive && (moveDir.x || moveDir.z)) {
    const desired = Math.atan2(moveDir.x, moveDir.z);
    let diff = desired - state.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.yaw += diff * Math.min(1, dt * 2.4);
    fx = Math.sin(state.yaw);
    fz = Math.cos(state.yaw);
  }

  const cos = Math.cos(state.pitch);
  const sin = Math.sin(state.pitch);
  solveCamera(fx * cos, fz * cos, state.distance, 2.4 + sin * state.distance, camSolve);
  const dist = camSolve.dist;
  const wantX = player.x - fx * cos * dist;
  const wantZ = player.z - fz * cos * dist;
  const wantY = camSolve.y;
  const k = started ? 1 - Math.pow(0.002, dt) : 1;
  cam.x += (wantX - cam.x) * k;
  cam.y += (wantY - cam.y) * k;
  cam.z += (wantZ - cam.z) * k;
  started = true;

  const eye = renderer.camera.eye;
  eye[0] = cam.x;
  eye[1] = Math.max(2.5, cam.y);
  eye[2] = cam.z;
  const target = renderer.camera.target;
  target[0] = player.x;
  target[1] = 7.5;
  target[2] = player.z;

  /* 近くの建物 */
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < world.buildings.length; i += 1) {
    const b = world.buildings[i];
    const d = Math.hypot(player.x - b.doorX, player.z - b.doorZ);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }

  if (best && bestDist < NEAR_RADIUS) {
    nearby = best;
    ui.setNearby(best.app, bestDist);
    if (ui.settings.autoOpen && bestDist < AUTO_OPEN_RADIUS && autoOpenGuard !== best.app.id) {
      autoOpenGuard = best.app.id;
      launch(best.app);
    }
  } else {
    nearby = null;
    ui.setNearby(null);
    if (bestDist > NEAR_RADIUS + 6) autoOpenGuard = null;
  }

  /* 建物の輪 */
  const pulse = 0.4 + Math.sin(now * 0.0035) * 0.18;
  for (let i = 0; i < world.buildings.length; i += 1) {
    const b = world.buildings[i];
    let want = 0;
    if (nearby === b) want = 0.8;
    else if (navTarget === b) want = pulse;
    b.ringAlpha += (want - b.ringAlpha) * Math.min(1, dt * 8);
  }

  /* ナビ */
  drawCtx.path = null;
  if (navTarget) {
    const dx = navTarget.doorX - player.x;
    const dz = navTarget.doorZ - player.z;
    const d = Math.hypot(dx, dz);
    if (d > 5) {
      pathAlpha = Math.min(0.85, pathAlpha + dt * 2);
      pathOffset -= dt * 0.5;
      drawCtx.path = {
        x: player.x + dx / 2,
        z: player.z + dz / 2,
        angle: Math.atan2(dx, dz),
        length: d,
        alpha: pathAlpha,
      };
    }
    ui.setNav(navTarget.app, d, Math.atan2(fx, fz) - Math.atan2(dx, dz));
    if (d < 6 && nearby === navTarget) {
      ui.setNav(null);
      ui.toast(`${navTarget.app.name} に到着`);
      yawEase = Math.atan2(navTarget.x - player.x, navTarget.z - player.z);
      navTarget = null;
      pathAlpha = 0;
    }
  }
  drawCtx.pathOffset = pathOffset;
  drawCtx.night = sky.night;

  /* HUD */
  uiClock += dt;
  if (uiClock > 0.5) {
    uiClock = 0;
    ui.updateClock();
    ui.setPlace(world.districtAt(player.x, player.z).name);
  }
  skyClock += dt;
  if (skyClock > 30) {
    skyClock = 0;
    if (ui.settings.timeMode === 'auto') updateSky();
  }

  /* 描画 */
  env.fogDensity = 0.0034 + sky.night * 0.0016;
  renderer.beginFrame(env);
  world.drawGround(drawCtx);
  drawPlayer(renderer, player, sky.tint);
  world.drawShadow(player.x, player.z, 4.4, 0.75 - sky.night * 0.4);
  world.drawOverlay(drawCtx);

  ui.drawMinimap(world, player, state.yaw, navTarget?.app ?? null);
  requestAnimationFrame(tick);
}

requestAnimationFrame((t) => {
  last = t;
  ui.bootDone();
  tick(t);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    last = performance.now();
    ui.updateClock();
    updateSky();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
