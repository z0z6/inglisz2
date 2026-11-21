package pl.mnemo.app

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import org.json.JSONObject
import java.util.Calendar

/**
 * Przypomnienia: dwie pory dziennie (rano / wieczorem) powiązane z „kotwicą” (intencja implementacyjna)
 * oraz jednorazowe przypomnienie o krótkim kroku nauki (~10 min po sesji).
 */
object Reminders {
    const val KEY_CONFIG = "reminders"
    const val KEY_SUMMARY = "summary"
    const val KEY_SUMMARY_AT = "summaryAt"
    private const val CH_DAILY = "daily"
    private const val CH_STEP = "step"
    private const val SLOT_ONCE = 9

    private fun pi(ctx: Context, slot: Int, title: String? = null, body: String? = null): PendingIntent {
        val i = Intent(ctx, ReminderReceiver::class.java)
            .setAction("pl.mnemo.app.REMIND_$slot")
            .putExtra("slot", slot)
        if (title != null) i.putExtra("title", title)
        if (body != null) i.putExtra("body", body)
        return PendingIntent.getBroadcast(ctx, 100 + slot, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun scheduleAll(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        for (s in 0..1) am.cancel(pi(ctx, s))
        val raw = Store.prefs(ctx).getString(KEY_CONFIG, null) ?: return
        val cfg = try { JSONObject(raw) } catch (e: Exception) { return }
        if (!cfg.optBoolean("on", false)) return
        val times = cfg.optJSONArray("times") ?: return
        for (s in 0 until minOf(2, times.length())) {
            val parts = times.optString(s).split(":")
            if (parts.size < 2) continue
            val h = parts[0].trim().toIntOrNull() ?: continue
            val m = parts[1].trim().toIntOrNull() ?: continue
            val cal = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, m); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
                if (timeInMillis <= System.currentTimeMillis() + 30_000L) add(Calendar.DAY_OF_YEAR, 1)
            }
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pi(ctx, s))
        }
    }

    fun scheduleOnce(ctx: Context, ts: Long, title: String, body: String) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val t = maxOf(ts, System.currentTimeMillis() + 60_000L)
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi(ctx, SLOT_ONCE, title, body))
    }

    private fun ensureChannels(nm: NotificationManager) {
        if (nm.getNotificationChannel(CH_DAILY) == null) {
            nm.createNotificationChannel(NotificationChannel(CH_DAILY, "Codzienna nauka", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Przypomnienia o porannej i wieczornej sesji"
            })
        }
        if (nm.getNotificationChannel(CH_STEP) == null) {
            nm.createNotificationChannel(NotificationChannel(CH_STEP, "Krótkie powtórki", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Drugi krok nauki nowych słów kilka minut po sesji"
            })
        }
    }

    private fun plural(n: Int, one: String, few: String, many: String): String {
        val n10 = n % 10
        val n100 = n % 100
        return when {
            n == 1 -> one
            n10 in 2..4 && (n100 < 12 || n100 > 14) -> few
            else -> many
        }
    }

    private fun logicalDay(ts: Long): Int {
        val c = Calendar.getInstance().apply { timeInMillis = ts - 4 * 3600_000L }
        return c.get(Calendar.YEAR) * 1000 + c.get(Calendar.DAY_OF_YEAR)
    }

    /** Zwraca [liczba do powtórki, nowe dostępne, seria, zaliczone dziś(0/1)] na podstawie podsumowania z JS. */
    fun counts(ctx: Context): IntArray {
        val p = Store.prefs(ctx)
        val raw = p.getString(KEY_SUMMARY, null) ?: return intArrayOf(0, 0, 0, 0)
        val s = try { JSONObject(raw) } catch (e: Exception) { return intArrayOf(0, 0, 0, 0) }
        val now = System.currentTimeMillis()
        var due = 0
        s.optJSONArray("dueTimes")?.let { arr -> for (i in 0 until arr.length()) if (arr.optLong(i) <= now) due++ }
        val sameDay = logicalDay(p.getLong(KEY_SUMMARY_AT, 0L)) == logicalDay(now)
        val newAvail = if (sameDay) s.optInt("newAvail") else s.optInt("newTotal", s.optInt("newAvail"))
        val doneToday = sameDay && s.optBoolean("doneToday")
        return intArrayOf(due, newAvail, s.optInt("streak"), if (doneToday) 1 else 0)
    }

    fun show(ctx: Context, slot: Int, title0: String?, body0: String?) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        ensureChannels(nm)
        val (due, newAvail, streak, doneToday) = counts(ctx).let { listOf(it[0], it[1], it[2], it[3]) }
        var title: String
        var body: String
        val channel: String
        if (slot == SLOT_ONCE) {
            if (due == 0) return
            channel = CH_STEP
            title = title0 ?: "Szybka powtórka"
            body = body0 ?: "Kilka słów czeka na drugie przypomnienie."
        } else {
            channel = CH_DAILY
            if (due == 0 && newAvail == 0 && doneToday == 1) return
            val anchors = try {
                JSONObject(Store.prefs(ctx).getString(KEY_CONFIG, "{}") ?: "{}").optJSONArray("anchors")
            } catch (e: Exception) { null }
            val anchor = anchors?.optString(slot)?.trim().orEmpty()
            title = if (anchor.isNotEmpty()) anchor.replaceFirstChar { it.uppercase() } + " – czas na Mnemo" else "Czas na Mnemo"
            val parts = ArrayList<String>()
            if (due > 0) parts.add("$due ${plural(due, "powtórka", "powtórki", "powtórek")}")
            if (newAvail > 0) parts.add("$newAvail ${plural(newAvail, "nowe słowo", "nowe słowa", "nowych słów")}")
            val minutes = maxOf(1, (due * 9 + newAvail * 28) / 60)
            body = if (parts.isEmpty()) "Krótka sesja utrwali to, czego się nauczyłeś." else parts.joinToString(" · ") + " · ok. $minutes min"
            if (slot == 1 && streak > 0 && doneToday == 0) body += "\nNie przerywaj serii: $streak ${plural(streak, "dzień", "dni", "dni")} 🔥"
            if (slot == 1) body += "\nPowtórka przed snem pomaga w konsolidacji pamięci."
        }
        val open = Intent(ctx, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(MainActivity.EXTRA_OPEN_STUDY, true)
        val contentPi = PendingIntent.getActivity(ctx, 200 + slot, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(ctx, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(Color.rgb(94, 92, 230))
            .setContentTitle(title)
            .setContentText(body.lineSequence().first())
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(contentPi)
            .setAutoCancel(true)
            .addAction(Notification.Action.Builder(null, "Zacznij", contentPi).build())
            .build()
        try { nm.notify(1000 + slot, n) } catch (e: SecurityException) { }
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val slot = intent.getIntExtra("slot", -1)
        if (slot < 0) return
        Reminders.show(context, slot, intent.getStringExtra("title"), intent.getStringExtra("body"))
        if (slot in 0..1) Reminders.scheduleAll(context)
        WordWidgetProvider.refresh(context)
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Reminders.scheduleAll(context)
    }
}
