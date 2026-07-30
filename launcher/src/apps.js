/**
 * アプリレジストリ / 街区（ディストリクト）定義
 * ユーザーが編集した内容は localStorage に保存される。
 */

const STORAGE_KEY = 'map-launcher.apps.v1';

export const DISTRICTS = [
  {
    id: 'social',
    name: 'つながり区',
    sub: 'SNS・メッセージ',
    angle: 90,
    color: 0x5b8def,
    ground: 0x9fb8e4,
    accent: '#5b8def',
  },
  {
    id: 'work',
    name: 'しごと区',
    sub: '仕事・学び',
    angle: 162,
    color: 0x4f7f78,
    ground: 0x9dc2b4,
    accent: '#3f9c8b',
  },
  {
    id: 'play',
    name: 'たのしみ公園',
    sub: '動画・音楽・ゲーム',
    angle: 234,
    color: 0xff8f5a,
    ground: 0xe6b98d,
    accent: '#ff8f5a',
  },
  {
    id: 'life',
    name: 'くらし通り',
    sub: '買い物・お金・生活',
    angle: 306,
    color: 0xe4708f,
    ground: 0xe2adb7,
    accent: '#e4708f',
  },
  {
    id: 'tools',
    name: 'どうぐ横丁',
    sub: 'ツール・ユーティリティ',
    angle: 18,
    color: 0x7d7fd6,
    ground: 0xb0aed8,
    accent: '#7d7fd6',
  },
];

export const DISTRICT_MAP = new Map(DISTRICTS.map((d) => [d.id, d]));

/** height: 建物の高さ（8〜22 くらいが見栄えが良い） */
export const DEFAULT_APPS = [
  // つながり区
  { id: 'line', name: 'LINE', emoji: '💬', district: 'social', color: '#06c755', scheme: 'line://', web: 'https://line.me/', height: 18 },
  { id: 'x', name: 'X', emoji: '🐦', district: 'social', color: '#1d1d1f', scheme: 'twitter://', web: 'https://x.com/', height: 21 },
  { id: 'instagram', name: 'Instagram', emoji: '📷', district: 'social', color: '#d6249f', scheme: 'instagram://', web: 'https://www.instagram.com/', height: 16 },
  { id: 'gmail', name: 'Gmail', emoji: '✉️', district: 'social', color: '#ea4335', scheme: 'googlegmail://', web: 'https://mail.google.com/', height: 13 },
  { id: 'discord', name: 'Discord', emoji: '🎧', district: 'social', color: '#5865f2', scheme: 'discord://', web: 'https://discord.com/app', height: 11 },

  // しごと区
  { id: 'slack', name: 'Slack', emoji: '💼', district: 'work', color: '#4a154b', scheme: 'slack://open', web: 'https://app.slack.com/', height: 19 },
  { id: 'notion', name: 'Notion', emoji: '📝', district: 'work', color: '#2f3437', scheme: 'notion://', web: 'https://www.notion.so/', height: 15 },
  { id: 'calendar', name: 'カレンダー', emoji: '📅', district: 'work', color: '#1a73e8', scheme: '', web: 'https://calendar.google.com/', height: 12 },
  { id: 'github', name: 'GitHub', emoji: '🐙', district: 'work', color: '#24292f', scheme: 'github://', web: 'https://github.com/', height: 17 },
  { id: 'chatgpt', name: 'ChatGPT', emoji: '🤖', district: 'work', color: '#10a37f', scheme: '', web: 'https://chatgpt.com/', height: 14 },

  // たのしみ公園
  { id: 'youtube', name: 'YouTube', emoji: '▶️', district: 'play', color: '#ff0033', scheme: 'youtube://', web: 'https://www.youtube.com/', height: 22 },
  { id: 'netflix', name: 'Netflix', emoji: '🎬', district: 'play', color: '#e50914', scheme: 'nflx://', web: 'https://www.netflix.com/', height: 16 },
  { id: 'spotify', name: 'Spotify', emoji: '🎵', district: 'play', color: '#1db954', scheme: 'spotify://', web: 'https://open.spotify.com/', height: 13 },
  { id: 'tiktok', name: 'TikTok', emoji: '🎶', district: 'play', color: '#25f4ee', scheme: 'tiktok://', web: 'https://www.tiktok.com/', height: 15 },
  { id: 'prime', name: 'Prime Video', emoji: '🍿', district: 'play', color: '#00a8e1', scheme: '', web: 'https://www.primevideo.com/', height: 11 },

  // くらし通り
  { id: 'amazon', name: 'Amazon', emoji: '📦', district: 'life', color: '#ff9900', scheme: '', web: 'https://www.amazon.co.jp/', height: 18 },
  { id: 'rakuten', name: '楽天市場', emoji: '🛒', district: 'life', color: '#bf0000', scheme: '', web: 'https://www.rakuten.co.jp/', height: 14 },
  { id: 'paypay', name: 'PayPay', emoji: '💳', district: 'life', color: '#ff0033', scheme: 'paypay://', web: 'https://paypay.ne.jp/', height: 12 },
  { id: 'ubereats', name: 'Uber Eats', emoji: '🍜', district: 'life', color: '#06c167', scheme: 'ubereats://', web: 'https://www.ubereats.com/jp', height: 10 },
  { id: 'weather', name: '天気', emoji: '⛅', district: 'life', color: '#3aa5dc', scheme: '', web: 'https://tenki.jp/', height: 9 },

  // どうぐ横丁
  { id: 'maps', name: 'マップ', emoji: '🗺️', district: 'tools', color: '#34a853', scheme: 'comgooglemaps://', web: 'https://maps.google.com/', height: 16 },
  { id: 'browser', name: 'ブラウザ', emoji: '🌐', district: 'tools', color: '#4285f4', scheme: '', web: 'https://www.google.com/', height: 13 },
  { id: 'phone', name: '電話', emoji: '📞', district: 'tools', color: '#0f9d58', scheme: 'tel:', web: '', height: 10 },
  { id: 'keep', name: 'メモ', emoji: '🗒️', district: 'tools', color: '#fbbc04', scheme: '', web: 'https://keep.google.com/', height: 11 },
  { id: 'translate', name: '翻訳', emoji: '🈳', district: 'tools', color: '#4285f4', scheme: '', web: 'https://translate.google.com/', height: 12 },
];

function sanitize(app, index) {
  const district = DISTRICT_MAP.has(app.district) ? app.district : DISTRICTS[index % DISTRICTS.length].id;
  const height = Number(app.height);
  return {
    id: String(app.id || `app-${index}`),
    name: String(app.name || 'アプリ'),
    emoji: String(app.emoji || '📱').slice(0, 4),
    district,
    color: /^#[0-9a-f]{3,8}$/i.test(app.color || '') ? app.color : '#6b7cff',
    scheme: typeof app.scheme === 'string' ? app.scheme.trim() : '',
    web: typeof app.web === 'string' ? app.web.trim() : '',
    height: Number.isFinite(height) ? Math.min(26, Math.max(7, height)) : 12,
  };
}

export function loadApps() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPS.map(sanitize);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_APPS.map(sanitize);
    return parsed.map(sanitize);
  } catch {
    return DEFAULT_APPS.map(sanitize);
  }
}

export function saveApps(apps) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
    return true;
  } catch {
    return false;
  }
}

export function resetApps() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  return DEFAULT_APPS.map(sanitize);
}

export function makeId(name, existing) {
  const base =
    (name || 'app')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'app';
  let id = base;
  let i = 2;
  const taken = new Set(existing.map((a) => a.id));
  while (taken.has(id)) id = `${base}-${i++}`;
  return id;
}

/**
 * アプリを起動する。
 * カスタムスキーム（line:// など）を試し、開けなければ Web 版にフォールバックする。
 */
export function openApp(app, onFallback) {
  const scheme = app.scheme;
  const web = app.web;

  if (!scheme && !web) return false;

  if (!scheme) {
    window.open(web, '_blank', 'noopener');
    return true;
  }

  let settled = false;
  const cancel = () => {
    settled = true;
  };
  window.addEventListener('pagehide', cancel, { once: true });
  window.addEventListener('blur', cancel, { once: true });
  const onVisibility = () => {
    if (document.hidden) cancel();
  };
  document.addEventListener('visibilitychange', onVisibility, { once: true });

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibility);
    if (settled) return;
    if (web) {
      if (onFallback) onFallback(app);
      window.open(web, '_blank', 'noopener');
    } else if (onFallback) {
      onFallback(app, true);
    }
  }, 1200);

  try {
    window.location.href = scheme;
  } catch {
    if (web) window.open(web, '_blank', 'noopener');
  }
  return true;
}
