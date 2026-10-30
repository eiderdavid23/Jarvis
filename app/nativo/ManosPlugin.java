package com.david.jarvis;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Puente entre la pagina de Jarvis y el servicio de accesibilidad (las "manos"). */
@CapacitorPlugin(name = "Manos")
public class ManosPlugin extends Plugin {

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("manos", Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("servicio", ManosServicio.instancia != null);
        r.put("vinculado", !prefs().getString("token", "").isEmpty());
        r.put("auto", prefs().getBoolean("auto", false));
        call.resolve(r);
    }

    @PluginMethod
    public void abrirAjustes(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void configurar(PluginCall call) {
        String url = call.getString("url", "");
        String token = call.getString("token", "");
        if (url == null || url.isEmpty() || token == null || token.isEmpty()) {
            call.reject("Faltan url o token");
            return;
        }
        boolean auto = Boolean.TRUE.equals(call.getBoolean("auto", false));
        prefs().edit().putString("url", url.replaceAll("/+$", "")).putString("token", token)
                .putBoolean("auto", auto).apply();
        if (ManosServicio.instancia != null) {
            ManosServicio.instancia.arrancar();
        }
        call.resolve();
    }

    @PluginMethod
    public void desvincular(PluginCall call) {
        prefs().edit().remove("token").apply();
        call.resolve();
    }
}
