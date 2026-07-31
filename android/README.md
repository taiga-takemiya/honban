# Map Launcher（Android ホームアプリ版）

`launcher/` の3Dマップを、**Android の本物のホームアプリ**として動かすためのプロジェクトです。
USB ケーブルでつなげば、Play ストアを通さずにそのままインストールできます。

- 画面は WebView（`assets/launcher.html` = `launcher/` のビルド結果）
- アプリ一覧は `PackageManager` から取得（**端末に入っている実際のアプリ・実際のアイコン**）
- 起動は `startActivity()`（URL スキーム不要。どのアプリでも開けます）
- ホームボタンで中央広場に戻り、戻るキーで部屋から出ます

## USB でインストールする（有線）

### 1. 端末側の準備

1. 設定 → デバイス情報 → **ビルド番号を7回タップ**して開発者オプションを有効化
2. 設定 → システム → 開発者向けオプション → **USBデバッグ** をON
3. USB ケーブルで PC に接続し、端末に出る「USBデバッグを許可しますか？」で **許可**

### 2. APK を入れる

```bash
adb devices          # 端末が「device」と表示されればOK
adb install -r app-debug.apk
```

`adb` は Android SDK の platform-tools に入っています（Android Studio を入れると付いてきます）。

### 3. ホームアプリにする

ホームボタンを押すと「ホームアプリの選択」が出るので **Map Launcher** を選びます。
出てこない場合は 設定 → アプリ → 標準のアプリ → ホームアプリ から選べます
（アプリ内の 設定 →「ホームアプリの設定を開く」からも飛べます）。

### 元に戻す

設定 → アプリ → 標準のアプリ → ホームアプリ で元のランチャーを選び直してください。
アンインストールは `adb uninstall com.hakki.maplauncher` です。

## ビルドする

```bash
# 事前に Android SDK（platform 34 / build-tools 34.0.0）が必要
cd launcher && node build-standalone.mjs   # WebView 用の HTML を assets に出力
cd ../android
echo "sdk.dir=/path/to/Android/sdk" > local.properties
gradle assembleDebug                        # または Android Studio で Run
# → app/build/outputs/apk/debug/app-debug.apk
```

`build-standalone.mjs` は `launcher/` の CSS・JS・アイコンを1枚の HTML にまとめ、
`android/app/src/main/assets/launcher.html` にも書き出します。**画面を直したら必ず実行**してください。

## 仕組み

| ネイティブ側（`MainActivity.kt`） | JavaScript 側 |
| --- | --- |
| `AndroidHost.listApps()` | 端末のアプリを街の建物にする（`apps.js`） |
| `AndroidHost.launch(pkg)` | 部屋のパネルで「開く」→ アプリ起動（`main.js`） |
| `AndroidHost.chooseHomeApp()` | 設定パネルの「ホームアプリの設定を開く」 |
| `window.__onHomePressed()` | ホームボタン → 中央広場へ戻る |
| `window.__onBackPressed()` | 戻るキー → 部屋から出る／パネルを閉じる |

アプリの街区は `ApplicationInfo.category`（SNS・仕事・動画/音楽/ゲーム・ニュース/地図…）から割り当て、
カテゴリ未設定のアプリはパッケージ名から推測します。建物の色はアイコンの平均色です。

街区・色・建物の高さは、アプリ内の「編集」から変更できます（端末のアプリ名とアイコンは変更しません）。
変更内容は `localStorage` に保存されます。

## 制限

- Android 8.0（API 26）以上
- デバッグ署名の APK なので、Play ストア配布はできません（手元で使う分には問題ありません）
- 作業用プロフィール／仕事用アプリは一覧に出ないことがあります
- ウィジェット・通知バッジ・フォルダ整理などの一般的なランチャー機能はまだありません
