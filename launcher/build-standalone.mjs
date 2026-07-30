/**
 * 1ファイル版をつくるビルドスクリプト。
 *
 *   node build-standalone.mjs
 *
 * CSS と ES モジュール（src/*.js）と PNG アイコンを index.html に埋め込み、
 * standalone.html を出力する。リンクを1つ送るだけで動くようにするためのもの。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(here, p), 'utf8');

// 依存の順に並べる（import を消して1つのモジュールに連結する）
const MODULES = [
  'src/gl.js',
  'src/apps.js',
  'src/world.js',
  'src/sky.js',
  'src/player.js',
  'src/controls.js',
  'src/ui.js',
  'src/main.js',
];

function stripModuleSyntax(code, file) {
  let out = code
    // import { a, b } from './x.js';  /  import * as X from '...'
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    // export { a, b };
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '')
    // export const / function / class → そのまま定義に
    .replace(/^\s*export\s+(const|let|function|class|async)\b/gm, '$1');
  if (/^\s*export\b/m.test(out)) {
    throw new Error(`${file}: 変換できていない export が残っています`);
  }
  return `\n/* ==== ${file} ==== */\n${out.trim()}\n`;
}

const css = read('app.css');
const js = MODULES.map((f) => stripModuleSyntax(read(f), f)).join('\n');

// Service Worker は1ファイル版では使えないので外す
const jsSingle = js.replace(/if \('serviceWorker' in navigator\)[\s\S]*?\n\}\n/, '');

const icon192 = readFileSync(resolve(here, 'icons/icon-192.png')).toString('base64');
const iconUrl = `data:image/png;base64,${icon192}`;

let html = read('index.html');
html = html
  .replace('<link rel="stylesheet" href="app.css" />', `<style>\n${css}\n</style>`)
  .replace('<link rel="manifest" href="manifest.webmanifest" />', '')
  .replace('<link rel="apple-touch-icon" href="icons/icon-192.png" />', `<link rel="apple-touch-icon" href="${iconUrl}" />`)
  .replace('<link rel="icon" href="icons/icon-192.png" />', `<link rel="icon" href="${iconUrl}" />`)
  .replace('<script type="module" src="src/main.js"></script>', `<script type="module">\n${jsSingle}\n</script>`);

writeFileSync(resolve(here, 'standalone.html'), html);

// 共有ページ用に、<html>/<head>/<body> を持たない本文だけの版も出せるようにする
//   ARTIFACT_OUT=/path/to/page.html node build-standalone.mjs
if (process.env.ARTIFACT_OUT) {
  const body = html
    .replace(/^[\s\S]*?<body>/, '')
    .replace(/<\/body>[\s\S]*$/, '')
    .trim();
  const head = [
    '<title>Map Launcher — 街を歩いてアプリを開く</title>',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />',
    '<meta name="theme-color" content="#0f1424" />',
  ].join('\n');
  writeFileSync(process.env.ARTIFACT_OUT, `${head}\n${body}\n`);
  console.log(`artifact: ${process.env.ARTIFACT_OUT}`);
}

console.log(`standalone.html: ${(html.length / 1024).toFixed(1)} KB`);
