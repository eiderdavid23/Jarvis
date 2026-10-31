package com.david.jarvis;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.net.Uri;
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
        r.put("burbuja", prefs().getBoolean("burbuja", true));
        r.put("palabra", prefs().getBoolean("palabra", false));
        r.put("mic", getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void abrirAjustes(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Abre directo "Informacion de la app" de Jarvis (ahi esta el menu con "Permitir ajustes restringidos"). */
    @PluginMethod
    public void abrirInfoApp(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName()));
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
        refrescarBurbuja();
        call.resolve();
    }

    @PluginMethod
    public void desvincular(PluginCall call) {
        prefs().edit().remove("token").apply();
        refrescarBurbuja();
        call.resolve();
    }

    private void refrescarBurbuja() {
        ManosServicio s = ManosServicio.instancia;
        if (s != null && s.burbuja != null) {
            s.burbuja.actualizar();
        }
    }

    /** La app le pasa la sesion (y el chat actual) para que la burbuja pueda hablar con Jarvis. */
    @PluginMethod
    public void sesion(PluginCall call) {
        String acceso = call.getString("acceso", "");
        String chat = call.getString("chat_id", "");
        SharedPreferences.Editor e = prefs().edit();
        if (acceso == null || acceso.isEmpty()) {
            e.remove("acceso").remove("chat_id");
        } else {
            e.putString("acceso", acceso);
            if (chat != null && !chat.isEmpty()) {
                e.putString("chat_id", chat);
            }
        }
        e.apply();
        refrescarBurbuja();
        call.resolve();
    }

    @PluginMethod
    public void burbuja(PluginCall call) {
        prefs().edit().putBoolean("burbuja", Boolean.TRUE.equals(call.getBoolean("activa", true))).apply();
        refrescarBurbuja();
        call.resolve();
    }

    /** Activa o apaga la escucha de la palabra "Jarvis" (servicio con aviso fijo + burbuja). */
    @PluginMethod
    public void palabra(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("activa", false));
        prefs().edit().putBoolean("palabra", on).apply();
        if (on) {
            EscuchaServicio.iniciar(getContext());
        } else {
            EscuchaServicio.detener(getContext());
        }
        refrescarBurbuja();
        call.resolve();
    }

    @PluginMethod
    public void pedirMicrofono(PluginCall call) {
        if (getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED && getActivity() != null) {
            getActivity().requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 7231);
        }
        call.resolve();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (prefs().getBoolean("palabra", false)) {
            EscuchaServicio.iniciar(getContext());
        }
        ManosServicio.alCambiarPrimerPlano(true);
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        ManosServicio.alCambiarPrimerPlano(false);
    }
}
