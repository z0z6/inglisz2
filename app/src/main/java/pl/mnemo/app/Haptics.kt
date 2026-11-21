package pl.mnemo.app

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

object Haptics {
    fun vibrate(ctx: Context, kind: String) {
        try {
            val v: Vibrator = if (Build.VERSION.SDK_INT >= 31) {
                (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (!v.hasVibrator()) return
            val effect: VibrationEffect = when (kind) {
                "tick" -> if (Build.VERSION.SDK_INT >= 29) VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
                          else VibrationEffect.createOneShot(10, 90)
                "light" -> VibrationEffect.createOneShot(14, 110)
                "heavy" -> if (Build.VERSION.SDK_INT >= 29) VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                           else VibrationEffect.createOneShot(30, 255)
                "success" -> VibrationEffect.createWaveform(longArrayOf(0, 14, 70, 22), intArrayOf(0, 140, 0, 220), -1)
                "error" -> VibrationEffect.createWaveform(longArrayOf(0, 45, 60, 45), intArrayOf(0, 255, 0, 255), -1)
                "celebrate" -> VibrationEffect.createWaveform(longArrayOf(0, 16, 50, 16, 50, 45), intArrayOf(0, 150, 0, 200, 0, 255), -1)
                else -> VibrationEffect.createOneShot(10, VibrationEffect.DEFAULT_AMPLITUDE)
            }
            v.vibrate(effect)
        } catch (e: Exception) { }
    }
}
