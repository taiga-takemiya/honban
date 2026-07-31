import { DISTRICTS, DISTRICT_MAP, HOST } from './apps.js';
import { WORLD } from './world.js';

const SETTINGS_KEY = 'map-launcher.settings.v1';

const DEFAULT_SETTINGS = {
  timeMode: 'auto',
  autoOpen: false,
  quality: 'balanced',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* noop */
  }
}

const $ = (id) => document.getElementById(id);

export function createUI(handlers) {
  const el = {
    clockTime: $('clock-time'),
    clockDate: $('clock-date'),
    placeChip: $('place-chip'),
    navBanner: $('nav-banner'),
    navEmoji: $('nav-emoji'),
    navName: $('nav-name'),
    navDist: $('nav-dist'),
    navArrow: $('nav-arrow'),
    navCancel: $('nav-cancel'),
    minimap: $('minimap'),
    nearbyCard: $('nearby-card'),
    nearbyEmoji: $('nearby-emoji'),
    nearbyName: $('nearby-name'),
    nearbySub: $('nearby-sub'),
    nearbyOpen: $('nearby-open'),
    btnHome: $('btn-home'),
    btnSearch: $('btn-search'),
    btnSettings: $('btn-settings'),
    panelList: $('panel-list'),
    panelSettings: $('panel-settings'),
    panelEdit: $('panel-edit'),
    appGrid: $('app-grid'),
    appSearch: $('app-search'),
    panelClose: $('panel-close'),
    settingsClose: $('settings-close'),
    editClose: $('edit-close'),
    btnAdd: $('btn-add'),
    btnEditMode: $('btn-edit-mode'),
    editForm: $('edit-form'),
    editTitle: $('edit-title'),
    fName: $('f-name'),
    fEmoji: $('f-emoji'),
    fColor: $('f-color'),
    fDistrict: $('f-district'),
    fScheme: $('f-scheme'),
    fWeb: $('f-web'),
    fHeight: $('f-height'),
    fHeightValue: $('f-height-value'),
    btnDelete: $('btn-delete'),
    timeMode: $('time-mode'),
    autoOpen: $('auto-open'),
    quality: $('quality'),
    btnExport: $('btn-export'),
    btnImport: $('btn-import'),
    btnReset: $('btn-reset'),
    ioArea: $('io-area'),
    toast: $('toast'),
    boot: $('boot'),
    fade: $('fade'),
    btnExitRoom: $('btn-exit-room'),
  };

  const settings = loadSettings();
  let editing = false;
  let editTarget = null; // 編集中のアプリ（null は新規追加）
  let apps = handlers.getApps();

  /* ---------------------------------------------------------- トースト */
  let toastTimer = 0;
  function toast(message, ms = 2200) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  /* ------------------------------------------------------------ パネル */
  function openPanel(panel) {
    [el.panelList, el.panelSettings, el.panelEdit].forEach((p) => {
      const on = p === panel;
      p.classList.toggle('hidden', !on);
      p.setAttribute('aria-hidden', String(!on));
    });
  }

  function closePanels() {
    openPanel(null);
  }

  /* -------------------------------------------------------- アプリ一覧 */
  function renderList(filter = '') {
    const q = filter.trim().toLowerCase();
    el.appGrid.innerHTML = '';
    el.appGrid.classList.toggle('editing', editing);
    const list = apps.filter((a) => !q || a.name.toLowerCase().includes(q) || a.id.includes(q));

    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-hint';
      empty.textContent = '見つかりませんでした。';
      el.appGrid.appendChild(empty);
      return;
    }

    list.forEach((app) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'app-cell';
      cell.innerHTML = `
        <span class="pencil">✏️</span>
        <span class="emoji"></span>
        <span class="name"></span>
        <span class="zone"></span>`;
      if (app.icon) {
        const img = document.createElement('img');
        img.src = app.icon;
        img.alt = '';
        img.className = 'app-icon';
        cell.querySelector('.emoji').replaceWith(img);
      } else {
        cell.querySelector('.emoji').textContent = app.emoji;
      }
      cell.querySelector('.name').textContent = app.name;
      cell.querySelector('.zone').textContent = DISTRICT_MAP.get(app.district)?.name ?? '';
      cell.style.borderColor = `${app.color}66`;
      cell.addEventListener('click', () => {
        if (editing) {
          showEditor(app);
        } else {
          closePanels();
          handlers.onNavigate(app);
        }
      });
      el.appGrid.appendChild(cell);
    });
  }

  /* ------------------------------------------------------------ 編集 */
  function fillDistrictOptions() {
    el.fDistrict.innerHTML = '';
    DISTRICTS.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.name}（${d.sub}）`;
      el.fDistrict.appendChild(opt);
    });
  }

  function showEditor(app) {
    editTarget = app;
    el.editTitle.textContent = app ? `${app.name} を編集` : 'アプリを追加';
    el.fName.value = app?.name ?? '';
    el.fEmoji.value = app?.emoji ?? '📱';
    el.fColor.value = /^#[0-9a-f]{6}$/i.test(app?.color ?? '') ? app.color : '#6b7cff';
    el.fDistrict.value = app?.district ?? DISTRICTS[0].id;
    el.fScheme.value = app?.scheme ?? '';
    el.fWeb.value = app?.web ?? '';
    el.fHeight.value = String(app?.height ?? 14);
    el.fHeightValue.textContent = el.fHeight.value;
    el.btnDelete.classList.toggle('hidden', !app);
    openPanel(el.panelEdit);
  }

  el.fHeight.addEventListener('input', () => {
    el.fHeightValue.textContent = el.fHeight.value;
  });

  el.editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const draft = {
      name: el.fName.value.trim() || 'アプリ',
      emoji: el.fEmoji.value.trim() || '📱',
      color: el.fColor.value,
      district: el.fDistrict.value,
      scheme: el.fScheme.value.trim(),
      web: el.fWeb.value.trim(),
      height: Number(el.fHeight.value),
    };
    if (editTarget) {
      handlers.onUpdateApp(editTarget.id, draft);
      toast(`${draft.name} を更新しました`);
    } else {
      handlers.onAddApp(draft);
      toast(`${draft.name} を追加しました`);
    }
    apps = handlers.getApps();
    editTarget = null;
    openPanel(el.panelList);
    renderList(el.appSearch.value);
  });

  el.btnDelete.addEventListener('click', () => {
    if (!editTarget) return;
    const name = editTarget.name;
    handlers.onDeleteApp(editTarget.id);
    apps = handlers.getApps();
    editTarget = null;
    openPanel(el.panelList);
    renderList(el.appSearch.value);
    toast(`${name} を削除しました`);
  });

  /* ------------------------------------------------------------ 設定 */
  function syncSettingsUI() {
    el.timeMode.value = settings.timeMode;
    el.autoOpen.checked = settings.autoOpen;
    el.quality.value = settings.quality;
  }

  function changeSetting(key, value) {
    settings[key] = value;
    saveSettings(settings);
    handlers.onSettingsChange(settings, key);
  }

  el.timeMode.addEventListener('change', () => changeSetting('timeMode', el.timeMode.value));
  el.autoOpen.addEventListener('change', () => changeSetting('autoOpen', el.autoOpen.checked));
  el.quality.addEventListener('change', () => changeSetting('quality', el.quality.value));

  el.btnExport.addEventListener('click', () => {
    el.ioArea.value = JSON.stringify(handlers.getApps(), null, 2);
    el.ioArea.select?.();
    toast('JSON を書き出しました。コピーして保管できます。');
  });

  el.btnImport.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(el.ioArea.value);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('empty');
      handlers.onReplaceApps(parsed);
      apps = handlers.getApps();
      renderList();
      toast('読み込みました');
    } catch {
      toast('JSON を読み込めませんでした');
    }
  });

  el.btnReset.addEventListener('click', () => {
    handlers.onResetApps();
    apps = handlers.getApps();
    renderList();
    toast('初期状態に戻しました');
  });

  /* ------------------------------------------------------- ボタン配線 */
  el.btnSearch.addEventListener('click', () => {
    apps = handlers.getApps();
    editing = false;
    el.appSearch.value = '';
    renderList();
    openPanel(el.panelList);
    // モバイルでキーボードが出続けるのを避けるため自動フォーカスはしない
  });

  el.btnSettings.addEventListener('click', () => {
    syncSettingsUI();
    openPanel(el.panelSettings);
  });

  el.btnHome.addEventListener('click', () => handlers.onHome());
  el.panelClose.addEventListener('click', closePanels);
  el.settingsClose.addEventListener('click', closePanels);
  el.editClose.addEventListener('click', () => openPanel(el.panelList));
  el.appSearch.addEventListener('input', () => renderList(el.appSearch.value));
  el.btnAdd.addEventListener('click', () => showEditor(null));
  el.btnEditMode.addEventListener('click', () => {
    editing = !editing;
    el.btnEditMode.textContent = editing ? '✅ 完了' : '✏️ 編集';
    renderList(el.appSearch.value);
    if (editing) toast('編集したいアプリをタップしてください');
  });

  el.nearbyOpen.addEventListener('click', () => handlers.onOpenNearby());
  el.btnExitRoom.addEventListener('click', () => handlers.onExitRoom());
  el.navCancel.addEventListener('click', () => handlers.onCancelNav());

  /* ------------------------------------------------------------ 時計 */
  function updateClock(date = new Date()) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    el.clockTime.textContent = `${hh}:${mm}`;
    el.clockDate.textContent = date.toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }

  /* -------------------------------------------------------- 近くの表示 */
  let nearbyId = null;
  let mode = 'town';

  /**
   * @param {object|null} app
   * @param {number} distance
   * @param {boolean} canOpen 「開く」を押せる状態か（部屋の中でパネルの前にいる時だけ true）
   */
  function setNearby(app, distance, canOpen) {
    if (!app) {
      if (nearbyId !== null) {
        nearbyId = null;
        el.nearbyCard.classList.add('hidden');
      }
      return;
    }
    if (app.id !== nearbyId) {
      nearbyId = app.id;
      if (app.icon) {
        el.nearbyEmoji.innerHTML = '';
        const img = document.createElement('img');
        img.src = app.icon;
        img.alt = '';
        img.className = 'app-icon';
        el.nearbyEmoji.appendChild(img);
      } else {
        el.nearbyEmoji.textContent = app.emoji;
      }
      el.nearbyName.textContent = app.name;
      el.nearbyCard.classList.remove('hidden');
    }
    el.nearbyCard.classList.toggle('no-open', !canOpen);
    if (mode === 'room') {
      el.nearbySub.textContent = canOpen ? 'パネルの前です' : `奥のパネルまで あと ${Math.round(distance)} m`;
    } else {
      el.nearbySub.textContent = distance < 7 ? 'ドアから中へ入れます' : `${Math.round(distance)} m先の入口`;
    }
  }

  /** 'town' か 'room' */
  function setMode(next) {
    mode = next;
    nearbyId = null;
    document.body.classList.toggle('in-room', next === 'room');
    el.btnExitRoom.classList.toggle('hidden', next !== 'room');
    if (next === 'room') el.nearbyCard.classList.add('no-open');
  }

  /** 出入りの白フラッシュ（1 → 0 で消える） */
  function setFade(value) {
    el.fade.style.opacity = String(Math.max(0, Math.min(1, value)));
  }

  /* -------------------------------------------------------------- ナビ */
  function setNav(app, distance, relativeAngle) {
    if (!app) {
      el.navBanner.classList.add('hidden');
      return;
    }
    el.navBanner.classList.remove('hidden');
    el.navEmoji.textContent = app.emoji;
    el.navName.textContent = `${app.name} へ案内中`;
    el.navDist.textContent = `${DISTRICT_MAP.get(app.district)?.name ?? ''} ・ あと ${Math.round(distance)} m`;
    el.navArrow.style.transform = `rotate(${relativeAngle}rad)`;
  }

  function setPlace(name) {
    if (el.placeChip.textContent !== name) el.placeChip.textContent = name;
  }

  /* --------------------------------------------------------- ミニマップ */
  const map = el.minimap;
  const mctx = map.getContext('2d');
  const MAP_R = map.width / 2;
  const scale = (MAP_R - 12) / WORLD.radius;

  function mapRotation(camYaw) {
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    return Math.atan2(-fx, -fz);
  }

  function drawMinimap(world, player, camYaw, navApp) {
    const theta = mapRotation(camYaw);
    mctx.clearRect(0, 0, map.width, map.height);
    mctx.save();
    mctx.beginPath();
    mctx.arc(MAP_R, MAP_R, MAP_R - 2, 0, Math.PI * 2);
    mctx.clip();
    mctx.fillStyle = 'rgba(12,18,32,0.72)';
    mctx.fillRect(0, 0, map.width, map.height);

    mctx.translate(MAP_R, MAP_R);
    mctx.rotate(theta);

    // 陸地
    mctx.beginPath();
    mctx.arc(0, 0, WORLD.radius * scale, 0, Math.PI * 2);
    mctx.fillStyle = 'rgba(120,168,116,0.4)';
    mctx.fill();

    // 道
    mctx.strokeStyle = 'rgba(255,255,255,0.3)';
    mctx.lineWidth = 6;
    mctx.lineCap = 'round';
    world.districts.forEach((d) => {
      mctx.beginPath();
      mctx.moveTo(0, 0);
      mctx.lineTo(d.cx * scale, d.cz * scale);
      mctx.stroke();
    });

    // 街区
    world.districts.forEach((d) => {
      mctx.beginPath();
      mctx.arc(d.cx * scale, d.cz * scale, (d.ringRadius + 9) * scale, 0, Math.PI * 2);
      mctx.fillStyle = `${d.accent}44`;
      mctx.fill();
    });

    // 広場
    mctx.beginPath();
    mctx.arc(0, 0, WORLD.plazaRadius * scale, 0, Math.PI * 2);
    mctx.fillStyle = 'rgba(255,240,214,0.55)';
    mctx.fill();

    // 建物
    world.buildings.forEach((b) => {
      const isTarget = navApp && b.app.id === navApp.id;
      mctx.beginPath();
      mctx.arc(b.x * scale, b.z * scale, isTarget ? 5 : 3, 0, Math.PI * 2);
      mctx.fillStyle = b.app.color;
      mctx.fill();
      if (isTarget) {
        mctx.strokeStyle = '#ffffff';
        mctx.lineWidth = 1.6;
        mctx.beginPath();
        mctx.arc(b.x * scale, b.z * scale, 10, 0, Math.PI * 2);
        mctx.stroke();
      }
    });

    // 自分
    mctx.save();
    mctx.translate(player.x * scale, player.z * scale);
    mctx.rotate(Math.atan2(Math.sin(player.heading), -Math.cos(player.heading)));
    mctx.beginPath();
    mctx.moveTo(0, -10);
    mctx.lineTo(6.5, 7);
    mctx.lineTo(0, 3.5);
    mctx.lineTo(-6.5, 7);
    mctx.closePath();
    mctx.fillStyle = '#ffffff';
    mctx.fill();
    mctx.restore();

    mctx.restore();
  }

  /** ミニマップのタップ位置をワールド座標に変換 */
  function minimapToWorld(clientX, clientY, camYaw) {
    const rect = map.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * map.width - MAP_R;
    const ny = ((clientY - rect.top) / rect.height) * map.height - MAP_R;
    if (Math.hypot(nx, ny) > MAP_R - 2) return null;
    const theta = -mapRotation(camYaw);
    const x = (nx * Math.cos(theta) - ny * Math.sin(theta)) / scale;
    const z = (nx * Math.sin(theta) + ny * Math.cos(theta)) / scale;
    return { x, z };
  }

  map.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = minimapToWorld(e.clientX, e.clientY, handlers.getCameraYaw());
    if (p) handlers.onMapTap(p.x, p.z);
  });

  function isPanelOpen() {
    return [el.panelList, el.panelSettings, el.panelEdit].some((p) => !p.classList.contains('hidden'));
  }

  function bootDone() {
    el.boot.classList.add('done');
    window.setTimeout(() => el.boot.classList.add('hidden'), 500);
  }

  function showFallback() {
    el.boot.classList.add('hidden');
    const fb = $('fallback');
    const grid = $('fallback-grid');
    fb.classList.remove('hidden');
    grid.innerHTML = '';
    handlers.getApps().forEach((app) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'app-cell';
      cell.innerHTML = '<span class="emoji"></span><span class="name"></span>';
      if (app.icon) {
        const img = document.createElement('img');
        img.src = app.icon;
        img.alt = '';
        img.className = 'app-icon';
        cell.querySelector('.emoji').replaceWith(img);
      } else {
        cell.querySelector('.emoji').textContent = app.emoji;
      }
      cell.querySelector('.name').textContent = app.name;
      cell.addEventListener('click', () => handlers.onOpenApp(app));
      grid.appendChild(cell);
    });
  }

  if (HOST) {
    // 端末のアプリを並べているので、追加・削除・バックアップは使わない
    el.btnAdd.classList.add('hidden');
    document.querySelectorAll('.row.stack').forEach((row) => row.classList.add('hidden'));
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'ghost';
    hint.textContent = 'ホームアプリの設定を開く';
    hint.addEventListener('click', () => HOST.chooseHomeApp && HOST.chooseHomeApp());
    document.querySelector('#panel-settings .settings-body').appendChild(hint);
  }

  fillDistrictOptions();
  syncSettingsUI();
  updateClock();
  renderList();

  return {
    settings,
    toast,
    setNearby,
    setMode,
    setFade,
    setNav,
    setPlace,
    updateClock,
    drawMinimap,
    closePanels,
    isPanelOpen,
    bootDone,
    showFallback,
    refresh() {
      apps = handlers.getApps();
      renderList(el.appSearch.value);
    },
  };
}
