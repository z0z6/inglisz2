package pl.mnemo.app

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.widget.FrameLayout
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File

class MainActivity : Activity() {

    lateinit var web: WebView
    private lateinit var root: FrameLayout
    lateinit var speech: Speech
    @Volatile var pendingShared: String? = null
    private var pageReady = false
    private var insetTop = 0f
    private var insetBottom = 0f

    // oczekujące wywołania zwrotne (id z JS)
    private var scanCb: String? = null
    private var cameraUri: Uri? = null
    private var exportCb: String? = null
    private var exportContent: String? = null
    private var importCb: String? = null
    private var pendingListen: Pair<String, String>? = null

    companion object {
        const val RC_EXPORT = 11
        const val RC_IMPORT = 12
        const val RC_CAMERA = 13
        const val RC_GALLERY = 14
        const val RC_MIC = 21
        const val RC_NOTIF = 22
        const val EXTRA_OPEN_STUDY = "openStudy"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupEdgeToEdge()

        root = FrameLayout(this)
        web = WebView(this)
        web.setBackgroundColor(Color.TRANSPARENT)
        root.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)

        speech = Speech(this)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
            textZoom = 100
            setSupportZoom(false)
        }
        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true)
        web.addJavascriptInterface(NativeBridge(this), "Android")
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (url.startsWith("file:///android_asset/")) return false
                openExternal(url)
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                pageReady = true
                pushInsets()
                if (pendingShared != null) emit("sharedText", "{}")
                if (intent?.getBooleanExtra(EXTRA_OPEN_STUDY, false) == true) {
                    intent.removeExtra(EXTRA_OPEN_STUDY)
                    emit("openStudy", "{}")
                }
            }
        }

        root.setOnApplyWindowInsetsListener { v, insets -> onInsets(v, insets) }

        handleIntent(intent)
        web.loadUrl("file:///android_asset/www/index.html")
        Reminders.scheduleAll(this)
    }

    // ---------- Okno od krawędzi do krawędzi + wcięcia systemowe ----------
    private fun setupEdgeToEdge() {
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.TRANSPARENT
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= 29) {
            window.isNavigationBarContrastEnforced = false
            window.isStatusBarContrastEnforced = false
        }
        if (Build.VERSION.SDK_INT >= 28) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
    }

    private fun onInsets(v: View, insets: WindowInsets): WindowInsets {
        val d = resources.displayMetrics.density
        val top: Int
        val bottom: Int
        val ime: Int
        if (Build.VERSION.SDK_INT >= 30) {
            val sb = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            top = sb.top
            bottom = sb.bottom
            ime = insets.getInsets(WindowInsets.Type.ime()).bottom
        } else {
            @Suppress("DEPRECATION")
            val t = insets.systemWindowInsetTop
            @Suppress("DEPRECATION")
            val b = insets.systemWindowInsetBottom
            top = t
            // na starszych systemach dolne wcięcie obejmuje klawiaturę
            if (b > resources.displayMetrics.heightPixels / 5) { ime = b; bottom = 0 } else { ime = 0; bottom = b }
        }
        val imeShown = ime > bottom
        v.setPadding(0, 0, 0, if (imeShown) ime else 0)
        insetTop = top / d
        insetBottom = if (imeShown) 0f else bottom / d
        pushInsets()
        return insets
    }

    private fun pushInsets() {
        if (!pageReady) return
        val json = JSONObject().put("top", insetTop.toDouble()).put("bottom", insetBottom.toDouble()).toString()
        emit("insets", json)
    }

    fun setBarsDark(dark: Boolean) {
        if (Build.VERSION.SDK_INT >= 30) {
            val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (dark) 0 else mask, mask)
        } else {
            @Suppress("DEPRECATION")
            var flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            if (!dark) {
                @Suppress("DEPRECATION")
                flags = flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            }
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = flags
        }
        window.decorView.setBackgroundColor(if (dark) Color.rgb(28, 28, 34) else Color.rgb(238, 240, 247))
    }

    fun keepAwake(on: Boolean) {
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    // ---------- Komunikacja z JS ----------
    fun emit(name: String, payload: String) {
        runOnUiThread {
            if (!this::web.isInitialized) return@runOnUiThread
            web.evaluateJavascript("window.NativeCB&&NativeCB.event(${JSONObject.quote(name)},${JSONObject.quote(payload)})", null)
        }
    }

    fun resolve(id: String, payload: String) {
        runOnUiThread {
            web.evaluateJavascript("window.NativeCB&&NativeCB.resolve(${JSONObject.quote(id)},${JSONObject.quote(payload)})", null)
        }
    }

    fun err(msg: String?): String = JSONObject().put("ok", false).put("error", msg ?: "błąd").toString()

    // ---------- Intencje: zaznaczony / udostępniony tekst, powiadomienia ----------
    private fun handleIntent(i: Intent?) {
        if (i == null) return
        val text: String? = when (i.action) {
            Intent.ACTION_PROCESS_TEXT -> i.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            Intent.ACTION_SEND -> i.getStringExtra(Intent.EXTRA_TEXT)
            else -> null
        }
        if (!text.isNullOrBlank()) {
            pendingShared = text.take(20000)
            if (pageReady) emit("sharedText", "{}")
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
        if (intent.getBooleanExtra(EXTRA_OPEN_STUDY, false) && pageReady) {
            intent.removeExtra(EXTRA_OPEN_STUDY)
            emit("openStudy", "{}")
        }
    }

    override fun onResume() {
        super.onResume()
        if (pageReady) emit("resume", "{}")
    }

    override fun onPause() {
        if (pageReady) emit("pause", "{}")
        super.onPause()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (pageReady) emit("resume", "{}")
    }

    override fun onDestroy() {
        speech.shutdown()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (!pageReady) {
            finish(); return
        }
        web.evaluateJavascript("(window.App&&App.onBack())?'yes':'no'") { res ->
            if (res == null || !res.contains("yes")) finish()
        }
    }

    // ---------- Mowa: rozpoznawanie z prośbą o uprawnienie ----------
    fun startListening(lang: String, cb: String) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingListen = Pair(lang, cb)
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), RC_MIC)
            return
        }
        speech.listen(lang) { json -> resolve(cb, json) }
    }

    fun requestNotifPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf("android.permission.POST_NOTIFICATIONS"), RC_NOTIF)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == RC_MIC) {
            val p = pendingListen ?: return
            pendingListen = null
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                speech.listen(p.first) { json -> resolve(p.second, json) }
            } else {
                resolve(p.second, err("permission"))
            }
        }
    }

    // ---------- Skanowanie (aparat / galeria) + OCR ----------
    fun startScan(source: String, cb: String) {
        scanCb = cb
        if (source == "camera") {
            try {
                val dir = File(cacheDir, "scans").apply { mkdirs() }
                dir.listFiles()?.forEach { if (System.currentTimeMillis() - it.lastModified() > 3600_000L) it.delete() }
                val f = File(dir, "scan_${System.currentTimeMillis()}.jpg")
                val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", f)
                cameraUri = uri
                val i = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                    .putExtra(MediaStore.EXTRA_OUTPUT, uri)
                    .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                startActivityForResult(i, RC_CAMERA)
            } catch (e: ActivityNotFoundException) {
                finishScan(err("Brak aplikacji aparatu"))
            } catch (e: Exception) {
                finishScan(err(e.message))
            }
        } else {
            val i = Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE)
            try {
                startActivityForResult(Intent.createChooser(i, "Wybierz zdjęcie"), RC_GALLERY)
            } catch (e: Exception) {
                finishScan(err(e.message))
            }
        }
    }

    private fun finishScan(json: String) {
        val cb = scanCb ?: return
        scanCb = null
        resolve(cb, json)
    }

    // ---------- Eksport / import plików ----------
    fun startExport(name: String, content: String, cb: String) {
        exportCb = cb
        exportContent = content
        val i = Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, name)
        try {
            startActivityForResult(i, RC_EXPORT)
        } catch (e: Exception) {
            exportCb = null; exportContent = null
            resolve(cb, err(e.message))
        }
    }

    fun startImport(cb: String) {
        importCb = cb
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
        try {
            startActivityForResult(i, RC_IMPORT)
        } catch (e: Exception) {
            importCb = null
            resolve(cb, err(e.message))
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            RC_CAMERA -> {
                val uri = cameraUri
                if (resultCode == RESULT_OK && uri != null) MlKit.recognize(this, uri) { finishScan(it) }
                else finishScan(err("cancelled"))
            }
            RC_GALLERY -> {
                val uri = data?.data
                if (resultCode == RESULT_OK && uri != null) MlKit.recognize(this, uri) { finishScan(it) }
                else finishScan(err("cancelled"))
            }
            RC_EXPORT -> {
                val cb = exportCb ?: return
                val content = exportContent ?: ""
                exportCb = null; exportContent = null
                val uri = data?.data
                if (resultCode != RESULT_OK || uri == null) { resolve(cb, err("cancelled")); return }
                Thread {
                    try {
                        contentResolver.openOutputStream(uri, "wt")?.use { it.write(content.toByteArray(Charsets.UTF_8)) }
                        resolve(cb, JSONObject().put("ok", true).toString())
                    } catch (e: Exception) {
                        resolve(cb, err(e.message))
                    }
                }.start()
            }
            RC_IMPORT -> {
                val cb = importCb ?: return
                importCb = null
                val uri = data?.data
                if (resultCode != RESULT_OK || uri == null) { resolve(cb, err("cancelled")); return }
                Thread {
                    try {
                        val text = contentResolver.openInputStream(uri)?.use { it.readBytes().toString(Charsets.UTF_8) } ?: ""
                        resolve(cb, JSONObject().put("ok", true).put("text", text).put("name", displayName(uri)).toString())
                    } catch (e: Exception) {
                        resolve(cb, err(e.message))
                    }
                }.start()
            }
        }
    }

    private fun displayName(uri: Uri): String {
        return try {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) ?: "" else ""
            } ?: ""
        } catch (e: Exception) {
            ""
        }
    }

    fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (e: Exception) { /* brak przeglądarki */ }
    }

    fun shareText(text: String) {
        val i = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
        try {
            startActivity(Intent.createChooser(i, "Udostępnij"))
        } catch (e: Exception) { }
    }
}
