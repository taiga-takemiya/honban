# honban

## launcher/ — 3Dマップ型ホームランチャー

街を歩いてアプリを開くスマホ向けランチャーのプロトタイプ（自前 WebGL・約40KB・PWA）。
詳細と起動方法は [`launcher/README.md`](launcher/README.md) を参照してください。

## android/ — Androidホームアプリ版

`launcher/` を WebView で包み、端末のアプリ一覧・起動をネイティブから渡す**本物のホームアプリ**。
USB接続（adb）でインストールできます。手順は [`android/README.md`](android/README.md) を参照してください。
