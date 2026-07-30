/**
 * タッチ／キーボード操作。
 * ・画面左側をドラッグ → バーチャルスティックで移動
 * ・画面右側をドラッグ → カメラを回す（上下で少しだけ俯瞰角）
 * ・2本指ピンチ → ズーム
 * ・タップ → その場所（建物 or 地面）へ自動で歩く
 */

const STICK_RADIUS = 62;

export function createControls({ layer, stickBase, stickKnob, onTap }) {
  const state = {
    move: { x: 0, y: 0 },
    yaw: Math.PI,
    pitch: 0.55,
    distance: 28,
    stickActive: false,
    lookActive: false,
    keys: new Set(),
  };

  const pointers = new Map();
  let stickId = null;
  let lookId = null;
  let pinch = null;
  let tapCandidate = null;

  function showStick(x, y) {
    stickBase.style.left = `${x}px`;
    stickBase.style.top = `${y}px`;
    stickBase.classList.add('visible');
    stickKnob.style.transform = 'translate(-50%, -50%)';
  }

  function hideStick() {
    stickBase.classList.remove('visible');
  }

  function onPointerDown(e) {
    layer.setPointerCapture?.(e.pointerId);
    const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    pointers.set(e.pointerId, p);

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), start: state.distance };
      tapCandidate = null;
      return;
    }

    tapCandidate = { id: e.pointerId, x: e.clientX, y: e.clientY, t: p.t };

    const leftZone = e.clientX < window.innerWidth * 0.55;
    if (leftZone && stickId === null) {
      stickId = e.pointerId;
      state.stickActive = true;
      showStick(e.clientX, e.clientY);
    } else if (lookId === null) {
      lookId = e.pointerId;
      state.lookActive = true;
    }
  }

  function onPointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const prevX = p.x;
    const prevY = p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const scale = pinch.dist / Math.max(1, dist);
      state.distance = Math.min(70, Math.max(14, pinch.start * scale));
      return;
    }

    if (e.pointerId === stickId) {
      let dx = p.x - p.sx;
      let dy = p.y - p.sy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      state.move.x = dx / STICK_RADIUS;
      state.move.y = -dy / STICK_RADIUS;
    } else if (e.pointerId === lookId) {
      state.yaw -= (p.x - prevX) * 0.006;
      state.pitch = Math.min(1.15, Math.max(0.12, state.pitch + (p.y - prevY) * 0.004));
    }

    if (tapCandidate && tapCandidate.id === e.pointerId) {
      if (Math.hypot(p.x - tapCandidate.x, p.y - tapCandidate.y) > 14) tapCandidate = null;
    }
  }

  function endPointer(e) {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;

    if (e.pointerId === stickId) {
      stickId = null;
      state.stickActive = false;
      state.move.x = 0;
      state.move.y = 0;
      hideStick();
    }
    if (e.pointerId === lookId) {
      lookId = null;
      state.lookActive = false;
    }

    if (p && tapCandidate && tapCandidate.id === e.pointerId) {
      const dt = performance.now() - tapCandidate.t;
      if (dt < 300 && onTap) onTap(p.x, p.y);
    }
    tapCandidate = null;
  }

  layer.addEventListener('pointerdown', onPointerDown);
  layer.addEventListener('pointermove', onPointerMove);
  layer.addEventListener('pointerup', endPointer);
  layer.addEventListener('pointercancel', endPointer);
  layer.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    state.keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => {
    state.keys.delete(e.key.toLowerCase());
  });
  window.addEventListener('blur', () => state.keys.clear());

  window.addEventListener(
    'wheel',
    (e) => {
      state.distance = Math.min(70, Math.max(14, state.distance + e.deltaY * 0.02));
    },
    { passive: true }
  );

  /** キーボード入力を move に合成する（PC での確認用） */
  function applyKeyboard(dt) {
    const k = state.keys;
    let kx = 0;
    let ky = 0;
    if (k.has('w') || k.has('arrowup')) ky += 1;
    if (k.has('s') || k.has('arrowdown')) ky -= 1;
    if (k.has('a') || k.has('arrowleft')) kx -= 1;
    if (k.has('d') || k.has('arrowright')) kx += 1;
    if (k.has('q')) state.yaw += dt * 1.8;
    if (k.has('e')) state.yaw -= dt * 1.8;
    if (kx || ky) {
      const len = Math.hypot(kx, ky);
      state.move.x = kx / len;
      state.move.y = ky / len;
      return true;
    }
    if (!state.stickActive) {
      state.move.x = 0;
      state.move.y = 0;
    }
    return false;
  }

  return { state, applyKeyboard };
}
