package pl.mnemo.app

import android.speech.SpeechRecognizer
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Interfejs wywoływany z JavaScriptu jako window.Android (wątek JavaBridge). */
class NativeBridge(private val act: MainActivity) {

    @JavascriptInterface
    fun loadFile(name: String): String? = Store.read(act, name)

    @JavascriptInterface
    fun saveFile(name: String, content: String) = Store.write(act, name, content)

    @JavascriptInterface
    fun speak(text: String, lang: String, rate: String, id: String) =
        act.speech.speak(text, lang, rate.toFloatOrNull() ?: 1f, id)

    @JavascriptInterface
    fun stopSpeak() = act.speech.stop()

    @JavascriptInterface
    fun canListen(): Boolean = try { SpeechRecognizer.isRecognitionAvailable(act) } catch (e: Exception) { false }

    @JavascriptInterface
    fun listen(lang: String, cb: String) = act.runOnUiThread { act.startListening(lang, cb) }

    @JavascriptInterface
    fun stopListen() = act.runOnUiThread { act.speech.cancelListening() }

    @JavascriptInterface
    fun vibrate(kind: String) = Haptics.vibrate(act, kind)

    @JavascriptInterface
    fun httpGet(url: String, cb: String) {
        Thread {
            val out = JSONObject()
            var conn: HttpURLConnection? = null
            try {
                val u = URL(url)
                if (u.protocol != "https") throw IllegalArgumentException("tylko https")
                conn = (u.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 8000
                    readTimeout = 10000
                    setRequestProperty("User-Agent", "Mnemo-Android")
                    setRequestProperty("Accept", "application/json")
                }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.use { it.readBytes().toString(Charsets.UTF_8) } ?: ""
                out.put("status", code).put("body", if (body.length > 400_000) body.take(400_000) else body)
            } catch (e: Exception) {
                out.put("status", 0).put("error", e.message ?: "network")
            } finally {
                conn?.disconnect()
            }
            act.resolve(cb, out.toString())
        }.start()
    }

    @JavascriptInterface
    fun translate(text: String, from: String, to: String, cb: String) =
        MlKit.translate(text, from, to) { act.resolve(cb, it) }

    @JavascriptInterface
    fun scanText(source: String, cb: String) = act.runOnUiThread { act.startScan(source, cb) }

    @JavascriptInterface
    fun exportFile(name: String, content: String, cb: String) = act.runOnUiThread { act.startExport(name, content, cb) }

    @JavascriptInterface
    fun importFile(cb: String) = act.runOnUiThread { act.startImport(cb) }

    @JavascriptInterface
    fun setReminders(json: String) {
        Store.prefs(act).edit().putString(Reminders.KEY_CONFIG, json).apply()
        Reminders.scheduleAll(act)
    }

    @JavascriptInterface
    fun scheduleOnce(ts: String, title: String, body: String) {
        val t = ts.toLongOrNull() ?: return
        Reminders.scheduleOnce(act, t, title, body)
    }

    @JavascriptInterface
    fun updateSummary(json: String) {
        Store.prefs(act).edit().putString(Reminders.KEY_SUMMARY, json).putLong(Reminders.KEY_SUMMARY_AT, System.currentTimeMillis()).apply()
        WordWidgetProvider.refresh(act)
    }

    @JavascriptInterface
    fun requestNotifications() = act.runOnUiThread { act.requestNotifPermission() }

    @JavascriptInterface
    fun keepAwake(on: String) = act.runOnUiThread { act.keepAwake(on == "true") }

    @JavascriptInterface
    fun setBars(dark: String) = act.runOnUiThread { act.setBarsDark(dark == "true") }

    @JavascriptInterface
    fun takeSharedText(): String {
        val t = act.pendingShared ?: ""
        act.pendingShared = null
        return t
    }

    @JavascriptInterface
    fun share(text: String) = act.runOnUiThread { act.shareText(text) }

    @JavascriptInterface
    fun openUrl(url: String) = act.runOnUiThread { act.openExternal(url) }

    @JavascriptInterface
    fun version(): String = try {
        act.packageManager.getPackageInfo(act.packageName, 0).versionName ?: "1.0"
    } catch (e: Exception) {
        "1.0"
    }

    @JavascriptInterface
    fun exit() = act.runOnUiThread { act.finish() }
}
