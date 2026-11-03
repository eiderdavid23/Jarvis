package com.david.jarvis;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSArray;
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
        r.put("vozBurbuja", prefs().getBoolean("vozBurbuja", true));
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        r.put("bateriaLibre", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        r.put("mic", getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED);
        r.put("llamadas", getContext().checkSelfPermission(Manifest.permission.CALL_PHONE)
                == PackageManager.PERMISSION_GRANTED
                && getContext().checkSelfPermission(Manifest.permission.READ_CONTACTS)
                == PackageManager.PERMISSION_GRANTED);
        r.put("brillo", Settings.System.canWrite(getContext()));
        android.app.NotificationManager nm = (android.app.NotificationManager)
                getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        r.put("noMolestar", nm != null && nm.isNotificationPolicyAccessGranted());
        call.resolve(r);
    }

    /** Pide a Android que Jarvis no tenga limite de bateria (para seguir despierto con la pantalla apagada). */
    @PluginMethod
    public void pedirBateria(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
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
        String refresco = call.getString("refresco", "");
        String chat = call.getString("chat_id", "");
        long ts = call.getData().optLong("ts", 0L);
        SharedPreferences p = prefs();
        SharedPreferences.Editor e = p.edit();
        if (acceso == null || acceso.isEmpty()) {
            e.remove("acceso").remove("chat_id").remove("refresco").remove("ts_sesion");
        } else {
            // si la parte nativa ya renovo la sesion con la app cerrada, no se pisa con una mas vieja
            if (ts >= p.getLong("ts_sesion", 0L)) {
                e.putString("acceso", acceso);
                if (refresco != null && !refresco.isEmpty()) {
                    e.putString("refresco", refresco);
                }
                e.putLong("ts_sesion", ts);
            }
            if (chat != null && !chat.isEmpty()) {
                e.putString("chat_id", chat);
            }
        }
        e.apply();
        refrescarBurbuja();
        call.resolve();
    }

    /** La app manda la lista de tareas automaticas pendientes y se programan sus alarmas. */
    @PluginMethod
    public void tareas(PluginCall call) {
        TareasAuto.guardar(getContext(), call.getString("lista", "[]"));
        call.resolve();
    }

    /** La sesion mas reciente de la parte nativa (la renueva al ejecutar tareas con la app cerrada). */
    @PluginMethod
    public void sesionLeer(PluginCall call) {
        SharedPreferences p = prefs();
        JSObject r = new JSObject();
        r.put("acceso", p.getString("acceso", ""));
        r.put("refresco", p.getString("refresco", ""));
        r.put("ts", p.getLong("ts_sesion", 0L));
        call.resolve(r);
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

    /** Voz de la burbuja: la enciende o la apaga. */
    @PluginMethod
    public void vozBurbuja(PluginCall call) {
        prefs().edit().putBoolean("vozBurbuja", Boolean.TRUE.equals(call.getBoolean("activa", true))).apply();
        call.resolve();
    }

    /** Sincroniza con la pagina los interruptores de herramientas apagadas: gana el cambio mas reciente. */
    @PluginMethod
    public void herramientas(PluginCall call) {
        String off = call.getString("off", "");
        long ts = 0L;
        try {
            ts = Long.parseLong(call.getString("ts", "0"));
        } catch (Exception ignorada) {
        }
        SharedPreferences p = prefs();
        if (off != null && ts > p.getLong("herr_ts", 0L)) {
            p.edit().putString("herr_off", off).putLong("herr_ts", ts).apply();
        }
        JSObject r = new JSObject();
        r.put("off", p.getString("herr_off", ""));
        r.put("ts", String.valueOf(p.getLong("herr_ts", 0L)));
        call.resolve(r);
    }

    @PluginMethod
    public void pedirMicrofono(PluginCall call) {
        if (getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED && getActivity() != null) {
            getActivity().requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 7231);
        }
        call.resolve();
    }

    @PluginMethod
    public void pedirLlamadas(PluginCall call) {
        if ((getContext().checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED
                || getContext().checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED)
                && getActivity() != null) {
            getActivity().requestPermissions(new String[]{Manifest.permission.CALL_PHONE,
                    Manifest.permission.READ_CONTACTS}, 7232);
        }
        call.resolve();
    }

    /** Abre la pantalla donde se permite a Jarvis cambiar el brillo. */
    @PluginMethod
    public void pedirBrillo(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Abre la pantalla donde se permite a Jarvis usar No molestar. */
    @PluginMethod
    public void pedirNoMolestar(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    // ---- Control de la TV desde la app (sin Termux) ----------------------------------

    /** Busca Android TV en el WiFi. Devuelve {tvs: [{nombre, ip}]}. */
    @PluginMethod
    public void tvBuscar(final PluginCall call) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    JSArray lista = new JSArray();
                    for (String[] t : TvAgente.buscar(getContext())) {
                        JSObject o = new JSObject();
                        o.put("nombre", t[0]);
                        o.put("ip", t[1]);
                        lista.put(o);
                    }
                    JSObject r = new JSObject();
                    r.put("tvs", lista);
                    r.put("rango", TvAgente.ultimoRango);
                    call.resolve(r);
                } catch (Exception e) {
                    call.reject(TvRemoto.mensaje(e));
                }
            }
        }, "tv-buscar").start();
    }

    /** Paso 1 del emparejamiento: la TV muestra un codigo en pantalla. */
    @PluginMethod
    public void tvEmparejarIniciar(final PluginCall call) {
        final String ip = call.getString("ip", "");
        if (ip == null || !ip.matches("\\d{1,3}(\\.\\d{1,3}){3}")) {
            call.reject("Esa IP no parece valida.");
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    TvAgente.remoto(getContext()).emparejarIniciar(ip);
                    call.resolve();
                } catch (Exception e) {
                    call.reject(TvRemoto.mensaje(e));
                }
            }
        }, "tv-emparejar").start();
    }

    /** Paso 2: el codigo que salio en la TV. */
    @PluginMethod
    public void tvEmparejarCodigo(final PluginCall call) {
        final String codigo = call.getString("codigo", "");
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    TvAgente.remoto(getContext()).emparejarTerminar(codigo);
                    call.resolve();
                } catch (Exception e) {
                    call.reject(TvRemoto.mensaje(e));
                }
            }
        }, "tv-codigo").start();
    }

    /** Guarda el token de la TV (creado en el servidor) y arranca el agente. */
    @PluginMethod
    public void tvVincular(PluginCall call) {
        String url = call.getString("url", "");
        String token = call.getString("token", "");
        String ip = call.getString("ip", "");
        String nombre = call.getString("nombre", "TV");
        if (url == null || url.isEmpty() || token == null || token.isEmpty() || ip == null || ip.isEmpty()) {
            call.reject("Faltan url, token o IP de la TV.");
            return;
        }
        prefs().edit().putString("tv_url", url.replaceAll("/+$", "")).putString("tv_token", token)
                .putString("tv_ip", ip).putString("tv_nombre", nombre == null ? "TV" : nombre).apply();
        TvAgente.iniciar(getContext());
        call.resolve();
    }

    @PluginMethod
    public void tvEstado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("vinculada", !prefs().getString("tv_token", "").isEmpty());
        r.put("ip", prefs().getString("tv_ip", ""));
        r.put("nombre", prefs().getString("tv_nombre", ""));
        r.put("conectada", TvAgente.remoto(getContext()).conectada());
        r.put("credencial", TvAgente.remoto(getContext()).hayCredencial());
        call.resolve(r);
    }

    @PluginMethod
    public void tvDesvincular(PluginCall call) {
        prefs().edit().remove("tv_token").remove("tv_url").remove("tv_ip").remove("tv_nombre").apply();
        TvAgente.detener();
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
