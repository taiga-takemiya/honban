package com.hakki.maplauncher

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.os.Bundle
import android.util.Base64
import android.view.KeyEvent
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/**
 * 3Dマップ・ランチャー本体。
 * 画面は WebView（assets/launcher.html）で、インストール済みアプリの一覧と起動だけを
 * ネイティブ側から JavaScript に渡す。
 */
class MainActivity : AppCompatActivity() {

  private lateinit var web: WebView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    WebView.setWebContentsDebuggingEnabled(true)
    web = WebView(this).apply {
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.mediaPlaybackRequiresUserGesture = false
      settings.allowFileAccess = false
      settings.allowContentAccess = false
      setBackgroundColor(Color.parseColor("#0f1424"))
      isVerticalScrollBarEnabled = false
      isHorizontalScrollBarEnabled = false
      addJavascriptInterface(Bridge(), "AndroidHost")
      loadUrl("file:///android_asset/launcher.html")
    }
    setContentView(web)
    hideSystemBars()
  }

  /** ホームボタンを押された（＝すでにホームにいる状態で HOME が来た）ら広場へ戻す */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    web.evaluateJavascript("window.__onHomePressed && window.__onHomePressed()", null)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) hideSystemBars()
  }

  /** 戻るキー：部屋にいる時だけ部屋を出る。ホームなのでアプリは終了しない */
  override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
    if (keyCode == KeyEvent.KEYCODE_BACK) {
      web.evaluateJavascript("window.__onBackPressed && window.__onBackPressed()", null)
      return true
    }
    return super.onKeyDown(keyCode, event)
  }

  private fun hideSystemBars() {
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility = (
      View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_FULLSCREEN
        or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      )
  }

  /* ------------------------------------------------------------ JS ブリッジ */

  inner class Bridge {

    /** インストール済みアプリを JSON で返す（名前・パッケージ・色・街区・アイコン） */
    @JavascriptInterface
    fun listApps(): String {
      val pm = packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolved = pm.queryIntentActivities(intent, 0)
      val seen = HashSet<String>()
      val array = JSONArray()

      resolved
        .sortedBy { it.loadLabel(pm).toString() }
        .forEach { info ->
          val pkg = info.activityInfo.packageName
          if (pkg == packageName || !seen.add(pkg)) return@forEach

          val icon = runCatching { info.loadIcon(pm) }.getOrNull()
          val bitmap = icon?.let { toBitmap(it, 96) }
          val item = JSONObject()
          item.put("pkg", pkg)
          item.put("name", info.loadLabel(pm).toString())
          item.put("district", districtOf(pkg, pm))
          item.put("color", bitmap?.let { dominantColor(it) } ?: "#6b7cff")
          item.put("icon", bitmap?.let { "data:image/png;base64," + toBase64(it) } ?: "")
          array.put(item)
        }
      return array.toString()
    }

    /** アプリを起動する */
    @JavascriptInterface
    fun launch(pkg: String): Boolean {
      val launchIntent = packageManager.getLaunchIntentForPackage(pkg) ?: return false
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      return runCatching { startActivity(launchIntent); true }.getOrDefault(false)
    }

    /** アプリ情報の画面を開く（アンインストールや詳細確認用） */
    @JavascriptInterface
    fun openSettingsFor(pkg: String) {
      val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      intent.data = android.net.Uri.parse("package:$pkg")
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { startActivity(intent) }
    }

    /** ホームアプリの選択画面を開く */
    @JavascriptInterface
    fun chooseHomeApp() {
      val intent = Intent(android.provider.Settings.ACTION_HOME_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { startActivity(intent) }
    }
  }

  /* --------------------------------------------------------------- ユーティリティ */

  private fun toBitmap(drawable: Drawable, size: Int): Bitmap {
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, size, size)
    drawable.draw(canvas)
    return bitmap
  }

  private fun toBase64(bitmap: Bitmap): String {
    val out = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
    return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  }

  /** アイコンの平均色（透明部分は除く）を建物の色にする */
  private fun dominantColor(bitmap: Bitmap): String {
    var r = 0L
    var g = 0L
    var b = 0L
    var n = 0L
    val step = 4
    for (y in 0 until bitmap.height step step) {
      for (x in 0 until bitmap.width step step) {
        val c = bitmap.getPixel(x, y)
        if (Color.alpha(c) < 128) continue
        r += Color.red(c)
        g += Color.green(c)
        b += Color.blue(c)
        n += 1
      }
    }
    if (n == 0L) return "#6b7cff"
    // 少し彩度を上げて建物らしい色にする
    val avg = intArrayOf((r / n).toInt(), (g / n).toInt(), (b / n).toInt())
    val mean = (avg[0] + avg[1] + avg[2]) / 3
    val boosted = avg.map { ((it - mean) * 1.35 + mean).toInt().coerceIn(0, 255) }
    return String.format("#%02x%02x%02x", boosted[0], boosted[1], boosted[2])
  }

  /** アプリのカテゴリを街区に割り当てる */
  private fun districtOf(pkg: String, pm: PackageManager): String {
    val info = runCatching { pm.getApplicationInfo(pkg, 0) }.getOrNull()
    return when (info?.category) {
      ApplicationInfo.CATEGORY_SOCIAL -> "social"
      ApplicationInfo.CATEGORY_PRODUCTIVITY -> "work"
      ApplicationInfo.CATEGORY_VIDEO,
      ApplicationInfo.CATEGORY_AUDIO,
      ApplicationInfo.CATEGORY_GAME -> "play"
      ApplicationInfo.CATEGORY_NEWS,
      ApplicationInfo.CATEGORY_MAPS -> "life"
      ApplicationInfo.CATEGORY_IMAGE -> "tools"
      else -> guessDistrict(pkg)
    }
  }

  /** カテゴリ未設定のアプリはパッケージ名から推測する */
  private fun guessDistrict(pkg: String): String {
    val p = pkg.lowercase()
    val social = listOf("line", "twitter", "instagram", "facebook", "discord", "slack", "messag", "mail", "gm")
    val work = listOf("docs", "sheets", "drive", "notion", "calendar", "office", "keep", "github")
    val play = listOf("youtube", "netflix", "spotify", "music", "video", "game", "tiktok", "prime")
    val life = listOf("amazon", "rakuten", "paypay", "pay", "bank", "eats", "shop", "weather", "tenki")
    return when {
      social.any { p.contains(it) } -> "social"
      work.any { p.contains(it) } -> "work"
      play.any { p.contains(it) } -> "play"
      life.any { p.contains(it) } -> "life"
      else -> "tools"
    }
  }
}
