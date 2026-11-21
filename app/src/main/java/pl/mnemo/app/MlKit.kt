package pl.mnemo.app

import android.content.Context
import android.net.Uri
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONObject

/** Google ML Kit na urządzeniu: rozpoznawanie tekstu (OCR) i tłumaczenie offline. */
object MlKit {
    private val translators = HashMap<String, Translator>()

    private fun err(msg: String?) = JSONObject().put("ok", false).put("error", msg ?: "błąd").toString()

    fun translate(text: String, from: String, to: String, cb: (String) -> Unit) {
        try {
            val src = TranslateLanguage.fromLanguageTag(from)
            val dst = TranslateLanguage.fromLanguageTag(to)
            if (src == null || dst == null) {
                cb(err("Ten język nie jest obsługiwany przez tłumacza offline")); return
            }
            val key = "$src>$dst"
            val tr = synchronized(translators) {
                translators.getOrPut(key) {
                    Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(src).setTargetLanguage(dst).build())
                }
            }
            tr.downloadModelIfNeeded(DownloadConditions.Builder().build())
                .addOnSuccessListener {
                    tr.translate(text)
                        .addOnSuccessListener { out -> cb(JSONObject().put("ok", true).put("text", out).toString()) }
                        .addOnFailureListener { e -> cb(err(e.message)) }
                }
                .addOnFailureListener { e -> cb(err("Nie udało się pobrać modelu językowego (potrzebny internet za pierwszym razem): ${e.message}")) }
        } catch (e: Exception) {
            cb(err(e.message))
        }
    }

    fun recognize(ctx: Context, uri: Uri, cb: (String) -> Unit) {
        try {
            val image = InputImage.fromFilePath(ctx, uri)
            TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                .process(image)
                .addOnSuccessListener { vt -> cb(JSONObject().put("ok", true).put("text", vt.text).toString()) }
                .addOnFailureListener { e -> cb(err(e.message)) }
        } catch (e: Exception) {
            cb(err(e.message))
        }
    }
}
