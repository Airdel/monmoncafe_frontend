package com.monmoncafe.app;

import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reads the Material You accent color Android 12+ derives from the wallpaper,
 * used as the seed of the "Mi fondo" theme (src/lib/systemColors.ts).
 */
@CapacitorPlugin(name = "SystemColors")
public class SystemColorsPlugin extends Plugin {

    @PluginMethod
    public void getSeed(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            int color = getContext().getColor(android.R.color.system_accent1_500);
            result.put("seed", String.format("#%06X", 0xFFFFFF & color));
        }
        call.resolve(result);
    }
}
