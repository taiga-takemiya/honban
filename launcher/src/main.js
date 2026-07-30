import * as THREE from '../vendor/three.module.js';
import { DISTRICT_MAP, loadApps, saveApps, resetApps, makeId, openApp } from './apps.js';
import { WORLD, buildWorld } from './world.js';
import { createPlayer, updatePlayer } from './player.js';
import { createControls } from './controls.js';
import { createUI } from './ui.js';
import { createSkyState, sampleSky, currentHour, sunDirection, createStars } from './sky.js';

const TIME_PRESETS = { morning: 7.2, day: 12.5, evening: 18.3, night: 22.5 };
const DPR_CAP = { high: 2, balanced: 1.5, low: 1 };
const NEAR_RADIUS = 11; // この距離まで近づくと「開く」カードが出る
const AUTO_OPEN_RADIUS = 4.5;

const canvas = document.getElementById('scene');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
} catch {
  renderer = null;
}

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
  onMapTap: (x, z) => {
    setWalkTarget(new THREE.Vector3(x, 0, z));
    ui.toast('その方向へ歩きます');
  },
  onSettingsChange: (settings, key) => {
    if (key === 'quality') applyQuality(settings.quality);
    if (key === 'timeMode') updateSky(true);
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

/* ------------------------------------------------------------ シーン構築 */

renderer.setClearColor(0x0a0f1e);
const scene = new THREE.Scene();
const skyState = createSkyState();
scene.fog = new THREE.FogExp2(0x9fc0e0, 0.0062);
scene.background = new THREE.Color(0x9fc0e0);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 900);
camera.position.set(0, 22, 34);

const hemi = new THREE.HemisphereLight(0xffffff, 0x6b7a5f, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(60, 90, 40);
scene.add(sun);

const stars = createStars();
scene.add(stars);

let world = buildWorld(apps);
scene.add(world.group);

const player = createPlayer(world.shadowTexture);
scene.add(player.group);
player.position.set(6.5, 0, WORLD.plazaRadius * 0.72);
player.heading = Math.PI;

let pickables = world.buildings.map((b) => b.body);

function rebuildWorld() {
  const keep = player.position.clone();
  scene.remove(world.group);
  world.dispose();
  world = buildWorld(apps);
  scene.add(world.group);
  pickables = world.buildings.map((b) => b.body);
  player.position.copy(keep);
  nearby = null;
  navTarget = null;
  walkTarget = null;
  world.pathMesh.visible = false;
  ui.setNearby(null);
  ui.setNav(null);
  ui.refresh();
  updateSky(true);
}

/* --------------------------------------------------------------- 操作 */

const controls = createControls({
  layer: document.getElementById('touch-layer'),
  stickBase: document.getElementById('stick-base'),
  stickKnob: document.getElementById('stick-knob'),
  onTap: handleTap,
});

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function handleTap(clientX, clientY) {
  if (ui.isPanelOpen()) {
    ui.closePanels();
    return;
  }
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);

  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length > 0) {
    const building = world.buildings.find((b) => b.body === hits[0].object);
    if (building) {
      navigateTo(building.app, true);
      return;
    }
  }

  const groundHit = raycaster.intersectObject(world.ground, false);
  if (groundHit.length > 0) {
    setWalkTarget(groundHit[0].point.clone());
  }
}

/* ---------------------------------------------------------- ナビゲーション */

let navTarget = null; // { app, building }
let walkTarget = null;
let nearby = null;
let autoOpenGuard = null;

function setWalkTarget(point) {
  walkTarget = point;
  walkTarget.y = 0;
}

function navigateTo(app, walk) {
  const building = world.buildings.find((b) => b.app.id === app.id);
  if (!building) {
    ui.toast('この街に建物が見つかりませんでした');
    return;
  }
  navTarget = { app, building };
  if (walk) setWalkTarget(building.doorPoint.clone());
  world.pathMesh.visible = true;
  ui.toast(`${DISTRICT_MAP.get(app.district)?.name ?? ''}の ${app.name} へ`);
}

function clearNav() {
  navTarget = null;
  walkTarget = null;
  world.pathMesh.visible = false;
  world.pathMat.opacity = 0;
  ui.setNav(null);
}

function goHome() {
  setWalkTarget(new THREE.Vector3(6.5, 0, WORLD.plazaRadius * 0.72));
  ui.toast('中央広場へ戻ります');
}

function launch(app) {
  ui.toast(`${app.name} を開きます…`);
  const ok = openApp(app, (target, failed) => {
    if (failed) ui.toast(`${target.name} を開けませんでした（URLスキームを設定してください）`, 3200);
  });
  if (!ok) ui.toast(`${app.name} には開き先が設定されていません`, 3000);
  if (navTarget && navTarget.app.id === app.id) clearNav();
}

/* --------------------------------------------------------------- 品質 */

function applyQuality(quality) {
  const cap = DPR_CAP[quality] ?? 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  resize();
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => window.setTimeout(resize, 220));
applyQuality(ui.settings.quality);

/* ------------------------------------------------------------- 空の更新 */

const sunDir = new THREE.Vector3();
let skyClock = 0;

function updateSky(force) {
  const mode = ui.settings.timeMode;
  const hour = mode === 'auto' ? currentHour() : TIME_PRESETS[mode] ?? 12;
  sampleSky(hour, skyState);
  scene.background.copy(skyState.sky);
  scene.fog.color.copy(skyState.fog);
  scene.fog.density = 0.0052 + skyState.night * 0.0022;
  hemi.color.copy(skyState.sky);
  hemi.groundColor.copy(skyState.fog).multiplyScalar(0.55);
  hemi.intensity = skyState.amb;
  sun.color.copy(skyState.sun);
  sun.intensity = skyState.dir;
  sunDirection(hour, sunDir);
  sun.position.copy(sunDir).multiplyScalar(140);
  stars.material.opacity = Math.max(0, skyState.night - 0.25) * 1.2;
  world.setNight(skyState.night);
  if (force) skyClock = 0;
}

updateSky(true);

/* ------------------------------------------------- カメラが壁に埋まるのを防ぐ */

function avoidWalls(desired) {
  const px = player.position.x;
  const pz = player.position.z;
  const dx = desired.x - px;
  const dz = desired.z - pz;
  const dy = desired.y - 2.5;

  for (let t = 1; t > 0.3; t -= 0.1) {
    const cx = px + dx * t;
    const cz = pz + dz * t;
    const cy = 2.5 + dy * t;
    let blocked = false;
    for (let i = 0; i < world.colliders.length; i += 1) {
      const c = world.colliders[i];
      if (c.r < 2) continue; // 木や街灯はすり抜けて良い
      if (c.h && cy > c.h + 1.5) continue; // 屋根より高い位置なら問題なし
      const ddx = cx - c.x;
      const ddz = cz - c.z;
      if (ddx * ddx + ddz * ddz < (c.r + 1.8) * (c.r + 1.8)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      desired.set(cx, Math.max(3, cy), cz);
      return;
    }
  }
  desired.set(px + dx * 0.3, Math.max(3, 2.5 + dy * 0.3), pz + dz * 0.3);
}

/* ------------------------------------------------------------ メインループ */

const moveDir = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
const lookAt = new THREE.Vector3();
let last = performance.now();
let uiClock = 0;
let started = false;

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const usingKeys = controls.applyKeyboard(dt);
  const { state } = controls;

  // カメラ基準の移動ベクトル
  const f = { x: Math.sin(state.yaw), z: Math.cos(state.yaw) };
  const r = { x: f.z, z: -f.x };
  const hasInput = Math.abs(state.move.x) > 0.02 || Math.abs(state.move.y) > 0.02;

  if (hasInput) {
    moveDir.set(r.x * state.move.x + f.x * state.move.y, 0, r.z * state.move.x + f.z * state.move.y);
    if (usingKeys || state.stickActive) walkTarget = null;
  } else if (walkTarget) {
    moveDir.set(walkTarget.x - player.position.x, 0, walkTarget.z - player.position.z);
    const d = moveDir.length();
    if (d < 2.6) {
      walkTarget = null;
      moveDir.set(0, 0, 0);
    } else {
      moveDir.multiplyScalar(Math.min(1, d / 8) / d);
    }
  } else {
    moveDir.set(0, 0, 0);
  }

  updatePlayer(player, moveDir, dt, world.colliders);

  // 自動で歩いている間は、進行方向の後ろにカメラを回す
  if (walkTarget && !state.lookActive && moveDir.lengthSq() > 0.0001) {
    const desiredYaw = Math.atan2(moveDir.x, moveDir.z);
    let diff = desiredYaw - state.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.yaw += diff * Math.min(1, dt * 2.4);
    f.x = Math.sin(state.yaw);
    f.z = Math.cos(state.yaw);
  }

  // カメラ追従
  const cos = Math.cos(state.pitch);
  const sin = Math.sin(state.pitch);
  camDesired.set(
    player.position.x - f.x * cos * state.distance,
    2.5 + sin * state.distance,
    player.position.z - f.z * cos * state.distance
  );
  avoidWalls(camDesired);
  camTarget.lerp(camDesired, 1 - Math.pow(0.0016, dt));
  if (!started) {
    camTarget.copy(camDesired);
    started = true;
  }
  camera.position.copy(camTarget);
  lookAt.set(player.position.x, player.position.y + 3.4, player.position.z);
  camera.lookAt(lookAt);
  stars.position.set(camera.position.x, 0, camera.position.z);

  /* 近くの建物を探す */
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < world.buildings.length; i += 1) {
    const b = world.buildings[i];
    const d = Math.hypot(player.position.x - b.doorPoint.x, player.position.z - b.doorPoint.z);
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

  /* ハイライトリング */
  const pulse = 0.35 + Math.sin(now * 0.004) * 0.18;
  for (let i = 0; i < world.buildings.length; i += 1) {
    const b = world.buildings[i];
    let target = 0;
    if (nearby === b) target = 0.75;
    else if (navTarget && navTarget.building === b) target = pulse + 0.25;
    b.ringMat.opacity += (target - b.ringMat.opacity) * Math.min(1, dt * 8);
  }

  /* ナビの矢印パス */
  if (navTarget) {
    const dx = navTarget.building.doorPoint.x - player.position.x;
    const dz = navTarget.building.doorPoint.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    const mesh = world.pathMesh;
    if (dist > 5) {
      mesh.visible = true;
      mesh.position.set(player.position.x + dx / 2, 0.16, player.position.z + dz / 2);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(-Math.PI / 2, Math.atan2(-dx, -dz), 0);
      mesh.scale.set(3.6, dist, 1);
      world.arrowTex.repeat.set(1, Math.max(2, dist / 7));
      world.arrowTex.offset.y -= dt * 0.55;
      world.pathMat.opacity = Math.min(0.85, world.pathMat.opacity + dt * 2);
    } else {
      mesh.visible = false;
    }

    // 画面上の相対角度（HUD の矢印用）
    const camAngle = Math.atan2(f.x, f.z);
    const targetAngle = Math.atan2(dx, dz);
    ui.setNav(navTarget.app, dist, camAngle - targetAngle);

    if (dist < 6 && nearby === navTarget.building) {
      ui.setNav(null);
      mesh.visible = false;
      ui.toast(`${navTarget.app.name} に到着しました`);
      navTarget = null;
    }
  }

  /* HUD（軽い更新は 0.5 秒ごと） */
  uiClock += dt;
  if (uiClock > 0.5) {
    uiClock = 0;
    ui.updateClock();
    const place = world.districtAt(player.position.x, player.position.z);
    ui.setPlace(place ? place.name : '郊外');
  }

  skyClock += dt;
  if (skyClock > 20) {
    skyClock = 0;
    if (ui.settings.timeMode === 'auto') updateSky();
  }

  ui.drawMinimap(world, player, state.yaw, navTarget?.app ?? null);
  renderer.render(scene, camera);
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
    updateSky(true);
  }
});

/* -------------------------------------------------------- Service Worker */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* オフライン対応は任意 */
    });
  });
}
