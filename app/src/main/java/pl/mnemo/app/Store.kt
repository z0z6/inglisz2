package pl.mnemo.app

import android.content.Context
import android.content.SharedPreferences
import java.io.File

/** Dane aplikacji w plikach wewnętrznych (objęte Auto Backup Androida). */
object Store {
    private val lock = Any()

    private fun safe(name: String) = name.replace(Regex("[^A-Za-z0-9._-]"), "_")

    fun read(ctx: Context, name: String): String? = synchronized(lock) {
        val f = File(ctx.filesDir, safe(name))
        if (f.exists()) f.readText(Charsets.UTF_8) else null
    }

    fun write(ctx: Context, name: String, content: String) = synchronized(lock) {
        val f = File(ctx.filesDir, safe(name))
        val tmp = File(ctx.filesDir, safe(name) + ".tmp")
        tmp.writeText(content, Charsets.UTF_8)
        if (!tmp.renameTo(f)) {
            f.writeText(content, Charsets.UTF_8)
            tmp.delete()
        }
    }

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences("mnemo", Context.MODE_PRIVATE)
}
