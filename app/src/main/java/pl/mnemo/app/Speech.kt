package pl.mnemo.app

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/** Lektor (TextToSpeech) i rozpoznawanie mowy (SpeechRecognizer). */
class Speech(private val act: MainActivity) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = TextToSpeech(act.applicationContext, this)
    @Volatile private var ready = false
    private var failed = false
    private val pending = ArrayList<Array<String>>()
    private var currentLang = ""
    private var recognizer: SpeechRecognizer? = null
    private var finishCurrent: ((String) -> Unit)? = null

    override fun onInit(status: Int) {
        val t = tts
        if (status == TextToSpeech.SUCCESS && t != null) {
            t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) { utteranceId?.let { act.emit("ttsDone", it) } }
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) { utteranceId?.let { act.emit("ttsDone", it) } }
                override fun onError(utteranceId: String?, errorCode: Int) { utteranceId?.let { act.emit("ttsDone", it) } }
                override fun onStop(utteranceId: String?, interrupted: Boolean) { utteranceId?.let { act.emit("ttsDone", it) } }
            })
            val queued: List<Array<String>>
            synchronized(this) {
                ready = true
                queued = ArrayList(pending)
                pending.clear()
            }
            queued.forEach { speak(it[0], it[1], it[2].toFloatOrNull() ?: 1f, it[3]) }
        } else {
            val queued: List<Array<String>>
            synchronized(this) {
                failed = true
                queued = ArrayList(pending)
                pending.clear()
            }
            queued.forEach { act.emit("ttsDone", it[3]) }
        }
    }

    fun speak(text: String, lang: String, rate: Float, id: String) {
        synchronized(this) {
            if (failed) { act.emit("ttsDone", id); return }
            if (!ready) {
                pending.add(arrayOf(text, lang, rate.toString(), id))
                return
            }
        }
        val t = tts ?: run { act.emit("ttsDone", id); return }
        try {
            if (lang != currentLang) {
                val loc = Locale.forLanguageTag(lang)
                val r = t.setLanguage(loc)
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                    t.setLanguage(Locale(loc.language))
                }
                currentLang = lang
            }
            t.setSpeechRate(rate.coerceIn(0.3f, 2f))
            val res = t.speak(text, TextToSpeech.QUEUE_FLUSH, Bundle(), id)
            if (res != TextToSpeech.SUCCESS) act.emit("ttsDone", id)
        } catch (e: Exception) {
            act.emit("ttsDone", id)
        }
    }

    fun stop() {
        try { tts?.stop() } catch (e: Exception) { }
    }

    /** Musi być wywołane w wątku UI. */
    fun listen(lang: String, cb: (String) -> Unit) {
        cancelListening()
        if (!SpeechRecognizer.isRecognitionAvailable(act)) {
            cb(JSONObject().put("ok", false).put("error", "unsupported").toString())
            return
        }
        stop()
        val sr = try {
            SpeechRecognizer.createSpeechRecognizer(act)
        } catch (e: Exception) {
            cb(JSONObject().put("ok", false).put("error", "unsupported").toString()); return
        }
        recognizer = sr
        var done = false
        val finish: (String) -> Unit = { json ->
            if (!done) {
                done = true
                if (finishCurrent != null && recognizer === sr) finishCurrent = null
                cb(json)
                try { sr.destroy() } catch (e: Exception) { }
                if (recognizer === sr) recognizer = null
            }
        }
        finishCurrent = finish
        sr.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { act.emit("listenReady", "{}") }
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
            override fun onResults(results: Bundle?) {
                val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: arrayListOf<String>()
                finish(JSONObject().put("ok", true).put("results", JSONArray(list)).toString())
            }
            override fun onError(error: Int) {
                finish(JSONObject().put("ok", false).put("error", errorName(error)).toString())
            }
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, act.packageName)
        }
        try {
            sr.startListening(intent)
        } catch (e: Exception) {
            finish(JSONObject().put("ok", false).put("error", "client").toString())
        }
    }

    fun cancelListening() {
        val f = finishCurrent
        finishCurrent = null
        recognizer?.let {
            try { it.cancel() } catch (e: Exception) { }
        }
        f?.invoke(JSONObject().put("ok", false).put("error", "cancelled").toString())
        recognizer?.let { try { it.destroy() } catch (e: Exception) { } }
        recognizer = null
    }

    private fun errorName(code: Int): String = when (code) {
        1, 2 -> "network"
        3 -> "audio"
        4 -> "server"
        5 -> "client"
        6, 7 -> "no-match"
        8 -> "busy"
        9 -> "permission"
        12, 13 -> "language"
        else -> "error-$code"
    }

    fun shutdown() {
        cancelListening()
        try { tts?.shutdown() } catch (e: Exception) { }
        tts = null
    }
}
