package com.david.jarvis;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.PowerManager;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.TimeZone;

/** Tareas automaticas con la app cerrada o el celular bloqueado: una alarma exacta por tarea.
 *  A su hora despierta, renueva la sesion, la reclama en el servidor (solo una vez), le pide a Jarvis
 *  que la haga por /chat y guarda el resultado. Las acciones en pantalla (WhatsApp) las hacen las Manos. */
public class TareasAuto extends BroadcastReceiver {
    static final String ACCION = "com.david.jarvis.TAREA_AUTO";
    private static final long MAX_TARDE_MS = 30L * 60L * 1000L;
    private static final int MAX_ALARMAS = 30;
    private static final String CANAL = "jarvis_tareas";

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("manos", Context.MODE_PRIVATE);
    }

    private static PendingIntent intencion(Context c, String id) {
        Intent i = new Intent(c, TareasAuto.class).setAction(ACCION).putExtra("id", id);
        return PendingIntent.getBroadcast(c, id.hashCode() & 0x7fffffff, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** La app manda la lista de tareas pendientes ([{id, cuando(ms), titulo}]) y se reprograman las alarmas. */
    static void guardar(Context c, String json) {
        try {
            new JSONArray(json);
        } catch (Exception e) {
            return;
        }
        prefs(c).edit().putString("tareas", json).apply();
        programar(c);
    }

    /** Pone una alarma por tarea segun la lista guardada. Tambien se llama al arrancar el servicio. */
    static synchronized void programar(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am == null) {
                return;
            }
            SharedPreferences p = prefs(c);
            for (String id : p.getString("tareas_ids", "").split(",")) {
                if (!id.isEmpty()) {
                    am.cancel(intencion(c, id));
                }
            }
            JSONArray lista = new JSONArray(p.getString("tareas", "[]"));
            long ahora = System.currentTimeMillis();
            StringBuilder ids = new StringBuilder();
            int n = 0;
            for (int k = 0; k < lista.length() && n < MAX_ALARMAS; k++) {
                JSONObject t = lista.optJSONObject(k);
                if (t == null) {
                    continue;
                }
                String id = t.optString("id", "");
                long cuando = t.optLong("cuando", 0L);
                if (id.isEmpty() || cuando <= 0 || ahora - cuando > MAX_TARDE_MS) {
                    continue;
                }
                poner(am, Math.max(cuando, ahora + 3000L), intencion(c, id));
                ids.append(id).append(',');
                n++;
            }
            p.edit().putString("tareas_ids", ids.toString()).apply();
        } catch (Exception e) {
            // sin alarmas: la app abierta las sigue ejecutando por su cuenta
        }
    }

    private static void poner(AlarmManager am, long cuando, PendingIntent pi) {
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
        }
    }

    @Override
    public void onReceive(Context c, Intent i) {
        final String id = i == null ? null : i.getStringExtra("id");
        if (id == null || id.isEmpty()) {
            return;
        }
        final Context app = c.getApplicationContext();
        PowerManager pm = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
        final PowerManager.WakeLock lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "jarvis:tarea");
        lock.acquire(4L * 60L * 1000L);
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    ejecutar(app, id);
                } catch (Exception e) {
                    // ya se aviso donde se pudo
                } finally {
                    try {
                        if (lock.isHeld()) {
                            lock.release();
                        }
                    } catch (Exception e) {
                        // nada
                    }
                }
            }
        }, "tarea-auto").start();
    }

    private static void ejecutar(Context c, String id) throws Exception {
        SharedPreferences p = prefs(c);
        long cuando = 0L;
        String titulo = "Tarea";
        JSONArray lista = new JSONArray(p.getString("tareas", "[]"));
        JSONArray resto = new JSONArray();
        for (int k = 0; k < lista.length(); k++) {
            JSONObject t = lista.optJSONObject(k);
            if (t != null && id.equals(t.optString("id", ""))) {
                cuando = t.optLong("cuando", 0L);
                titulo = t.optString("titulo", "Tarea");
            } else if (t != null) {
                resto.put(t);
            }
        }
        // se saca de la lista ya: si algo falla NO se reintenta sola (evita mandar dos veces un mensaje)
        p.edit().putString("tareas", resto.toString()).apply();

        String base = p.getString("url", "");
        if (base.isEmpty()) {
            return;
        }
        String acceso = sesionValida(p, base);
        if (acceso.isEmpty()) {
            avisar(c, titulo, "No pude ejecutarla: abre Jarvis un momento para renovar tu sesi\u00f3n.");
            return;
        }
        String[] rec = pedir(base + "/tareas/" + id + "/reclamar", acceso, "{}", "", 20000, 30000);
        if ("409".equals(rec[0])) {
            return; // otro dispositivo (o la app abierta) ya la tomo
        }
        if (!"200".equals(rec[0])) {
            avisar(c, titulo, "No pude ejecutarla (error " + rec[0] + ").");
            return;
        }
        if (cuando > 0 && System.currentTimeMillis() - cuando > MAX_TARDE_MS) {
            String m = "Se pas\u00f3 la hora por m\u00e1s de 30 minutos (el celular estaba apagado o sin conexi\u00f3n); no se ejecut\u00f3.";
            pedir(base + "/tareas/" + id + "/resultado", acceso,
                    new JSONObject().put("ok", false).put("resultado", m).toString(), "", 20000, 30000);
            avisar(c, titulo, m);
            return;
        }
        String mensaje = new JSONObject(rec[1]).optString("mensaje", "");
        if (mensaje.isEmpty()) {
            return;
        }
        String cuerpo = new JSONObject().put("mensaje", mensaje).put("zona_horaria", TimeZone.getDefault().getID()).toString();
        boolean ok = false;
        String texto;
        try {
            String[] r = pedir(base + "/chat?tarea=1", acceso, cuerpo, p.getString("herr_off", ""), 20000, 170000);
            JSONObject j = new JSONObject(r[1].isEmpty() ? "{}" : r[1]);
            ok = r[0].startsWith("2");
            texto = j.optString("respuesta", j.optString("error", ""));
        } catch (Exception e) {
            texto = "No pude hablar con Jarvis.";
        }
        if (texto.isEmpty()) {
            texto = ok ? "Hecha." : "Fall\u00f3.";
        }
        try {
            pedir(base + "/tareas/" + id + "/resultado", acceso,
                    new JSONObject().put("ok", ok).put("resultado", texto).toString(), "", 20000, 30000);
        } catch (Exception e) {
            // el servidor la marca como fallida si se queda "en curso" mucho rato
        }
        avisar(c, titulo, texto);
    }

    /** Devuelve un token de acceso que sirva; si esta por caducar, lo renueva con el refresh token guardado. */
    private static String sesionValida(SharedPreferences p, String base) {
        String acceso = p.getString("acceso", "");
        if (!acceso.isEmpty() && expira(acceso) - System.currentTimeMillis() > 120000L) {
            return acceso;
        }
        String refresco = p.getString("refresco", "");
        if (refresco.isEmpty()) {
            return "";
        }
        try {
            String[] r = pedir(base + "/auth/refresh", "",
                    new JSONObject().put("refresh_token", refresco).toString(), "", 20000, 30000);
            if (!"200".equals(r[0])) {
                return "";
            }
            JSONObject j = new JSONObject(r[1]);
            String nuevo = j.optString("access_token", "");
            String nuevoRef = j.optString("refresh_token", "");
            if (nuevo.isEmpty()) {
                return "";
            }
            SharedPreferences.Editor e = p.edit().putString("acceso", nuevo)
                    .putLong("ts_sesion", System.currentTimeMillis());
            if (!nuevoRef.isEmpty()) {
                e.putString("refresco", nuevoRef);
            }
            e.apply();
            return nuevo;
        } catch (Exception e) {
            return "";
        }
    }

    private static long expira(String jwt) {
        try {
            String cuerpo = jwt.split("\\.")[1];
            byte[] b = Base64.decode(cuerpo, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
            return new JSONObject(new String(b, StandardCharsets.UTF_8)).optLong("exp", 0L) * 1000L;
        } catch (Exception e) {
            return 0L;
        }
    }

    private static String[] pedir(String url, String token, String cuerpo, String herrOff,
                                  int conexionMs, int lecturaMs) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        try {
            con.setRequestMethod("POST");
            con.setConnectTimeout(conexionMs);
            con.setReadTimeout(lecturaMs);
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/json");
            if (!token.isEmpty()) {
                con.setRequestProperty("Authorization", "Bearer " + token);
            }
            if (herrOff != null && !herrOff.isEmpty()) {
                con.setRequestProperty("X-Herramientas-Off", herrOff);
            }
            OutputStream os = con.getOutputStream();
            os.write(cuerpo.getBytes(StandardCharsets.UTF_8));
            os.close();
            int cod = con.getResponseCode();
            InputStream in = cod >= 400 ? con.getErrorStream() : con.getInputStream();
            return new String[]{String.valueOf(cod), leer(in)};
        } finally {
            con.disconnect();
        }
    }

    private static String leer(InputStream in) throws Exception {
        if (in == null) {
            return "";
        }
        BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String linea;
        while ((linea = br.readLine()) != null) {
            sb.append(linea).append('\n');
        }
        br.close();
        return sb.toString();
    }

    private static void avisar(Context c, String titulo, String texto) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                return;
            }
            Notification.Builder b;
            if (Build.VERSION.SDK_INT >= 26) {
                nm.createNotificationChannel(new NotificationChannel(CANAL, "Tareas autom\u00e1ticas",
                        NotificationManager.IMPORTANCE_DEFAULT));
                b = new Notification.Builder(c, CANAL);
            } else {
                b = new Notification.Builder(c);
            }
            b.setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle("Jarvis \u00b7 " + titulo)
                    .setContentText(texto)
                    .setStyle(new Notification.BigTextStyle().bigText(texto))
                    .setAutoCancel(true);
            nm.notify((int) (System.currentTimeMillis() & 0x7fffffffL), b.build());
        } catch (Exception e) {
            // sin permiso de notificaciones: no pasa nada
        }
    }
}
