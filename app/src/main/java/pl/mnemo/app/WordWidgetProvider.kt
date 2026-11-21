package pl.mnemo.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

/** Widżet: rotujące słówka na ekranie głównym – częste, krótkie ekspozycje między sesjami. */
class WordWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val p = Store.prefs(context)
        p.edit().putInt(KEY_IDX, p.getInt(KEY_IDX, 0) + 1).apply()
        appWidgetIds.forEach { update(context, appWidgetManager, it) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_NEXT) {
            val p = Store.prefs(context)
            p.edit().putInt(KEY_IDX, p.getInt(KEY_IDX, 0) + 1).apply()
            refresh(context)
        }
    }

    companion object {
        const val ACTION_NEXT = "pl.mnemo.app.WIDGET_NEXT"
        private const val KEY_IDX = "widgetIdx"

        fun refresh(ctx: Context) {
            try {
                val mgr = AppWidgetManager.getInstance(ctx) ?: return
                val ids = mgr.getAppWidgetIds(ComponentName(ctx, WordWidgetProvider::class.java))
                ids.forEach { update(ctx, mgr, it) }
            } catch (e: Exception) { }
        }

        fun update(ctx: Context, mgr: AppWidgetManager, id: Int) {
            val p = Store.prefs(ctx)
            val views = RemoteViews(ctx.packageName, R.layout.widget_word)
            val sum = try { JSONObject(p.getString(Reminders.KEY_SUMMARY, "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
            val words = sum.optJSONArray("words")
            if (words != null && words.length() > 0) {
                val idx = Math.floorMod(p.getInt(KEY_IDX, 0), words.length())
                val w = words.optJSONObject(idx)
                views.setTextViewText(R.id.w_word, w?.optString("w") ?: "")
                views.setTextViewText(R.id.w_trans, w?.optString("t") ?: "")
            }
            val c = Reminders.counts(ctx)
            val meta = StringBuilder()
            meta.append(if (c[0] > 0) "Do powtórki: ${c[0]}" else "Mnemo")
            if (c[2] > 0) meta.append(" · 🔥 ${c[2]}")
            views.setTextViewText(R.id.w_meta, meta.toString())

            val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            views.setOnClickPendingIntent(R.id.widget_root,
                PendingIntent.getActivity(ctx, 300, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            val next = Intent(ctx, WordWidgetProvider::class.java).setAction(ACTION_NEXT)
            views.setOnClickPendingIntent(R.id.w_next,
                PendingIntent.getBroadcast(ctx, 301, next, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            mgr.updateAppWidget(id, views)
        }
    }
}
