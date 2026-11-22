package com.david.jarvis;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Descarga de modelos en segundo plano, estilo Play Store: servicio en primer plano con
 * notificacion de progreso (porcentaje, MB y velocidad) y boton Cancelar. Sigue bajando aunque
 * se cierre la pantalla o se salga de la app, reintenta solo si se cae el internet y retoma
 * desde el archivo .part.
 */
public class DescargaServicio extends Service {
    interface Oyente {
        void alEvento(String id, long bytes, long total, boolean listo, String error);
    }

    private static final String CANAL = "jarvis_descargas";
    private static final String CANAL_FIN = "jarvis_descargas_fin";
    private static final int ID_NOTI = 7232;
    private static final int ID_FIN = 7233;
    private static final String ACC_CANCELAR = "com.david.jarvis.DESCARGA_CANCELAR";
    private static final int REINTENTOS = 40;

    static volatile boolean activo = false;
    static volatile boolean cancelar = false;
    static volatile String idActual = "";
    static volatile long bytesActual = 0;
    static volatile long totalActual = 0;
    static volatile Oyente oyente;

    private static class Fatal extends Exception {
        Fatal(String m) { super(m); }
    }

    private PowerManager.WakeLock cpu;
    private NotificationManager nm;
    private String nombre = "";

    /** Devuelve null si arranco, o el texto del error. */
    static synchronized String pedir(Context c, String id, String nombre, String url, String destino) {
        if (activo) return "Ya hay una descarga en curso";
        activo = true;
        cancelar = false;
        idActual = id;
        bytesActual = 0;
        totalActual = 0;
        try {
            Intent i = new Intent(c, DescargaServicio.class);
            i.putExtra("id", id);
            i.putExtra("nombre", nombre);
            i.putExtra("url", url);
            i.putExtra("destino", destino);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
            return null;
        } catch (Exception e) {
            activo = false;
            idActual = "";
            return "No pude iniciar la descarga: " + e.getMessage();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACC_CANCELAR.equals(intent.getAction())) {
            cancelar = true;
            if (!activo) stopSelf();
            return START_NOT_STICKY;
        }
        if (intent == null || intent.getStringExtra("url") == null) {
            activo = false;
            stopSelf();
            return START_NOT_STICKY;
        }
        final String id = intent.getStringExtra("id");
        nombre = intent.getStringExtra("nombre");
        final String url = intent.getStringExtra("url");
        final String destino = intent.getStringExtra("destino");
        nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        crearCanales();
        try {
            Notification n = construir("Preparando la descarga...", 0, true);
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(ID_NOTI, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(ID_NOTI, n);
            }
        } catch (Exception e) {
            activo = false;
            idActual = "";
            avisar(id, 0, 0, false, "No pude mostrar la notificacion de descarga: " + e.getMessage());
            stopSelf();
            return START_NOT_STICKY;
        }
        tomarCpu();
        new Thread(() -> trabajo(id, url, new File(destino))).start();
        return START_NOT_STICKY;
    }

    // ---------------------------------------------------------------- descarga

    private void trabajo(String id, String url, File fin) {
        String error = null;
        boolean listo = false;
        try {
            File carpeta = fin.getParentFile();
            if (carpeta != null) carpeta.mkdirs();
            File part = new File(fin.getPath() + ".part");
            int fallos = 0;
            while (true) {
                long antes = part.exists() ? part.length() : 0;
                try {
                    intento(id, url, fin, part);
                    listo = true;
                    break;
                } catch (Fatal e) {
                    error = e.getMessage();
                    break;
                } catch (IOException e) {
                    if (cancelar) { error = "Descarga cancelada"; break; }
                    long ahora = part.exists() ? part.length() : 0;
                    if (ahora > antes) fallos = 0;
                    fallos++;
                    if (fallos > REINTENTOS) {
                        error = "Se perdio la conexion. Toca Descargar para continuar donde quedo.";
                        break;
                    }
                    ponerEstado(ahora, totalActual, "Esperando conexion...");
                    for (int k = 0; k < 20 && !cancelar; k++) {
                        try { Thread.sleep(250); } catch (InterruptedException ie) { break; }
                    }
                    if (cancelar) { error = "Descarga cancelada"; break; }
                }
            }
        } catch (Exception e) {
            error = String.valueOf(e.getMessage());
        }
        // El estado se libera ANTES del evento final para que la pantalla ya vea que no hay descarga.
        final long total = totalActual;
        activo = false;
        idActual = "";
        stopForeground(Service.STOP_FOREGROUND_REMOVE);
        if (listo) {
            avisar(id, total, total, true, null);
            notificarFin(true, null);
        } else {
            avisar(id, 0, 0, false, error == null ? "Descarga fallida" : error);
            if (!"Descarga cancelada".equals(error)) notificarFin(false, error);
        }
        soltarCpu();
        stopSelf();
    }

    /** Un intento de descarga (retoma desde .part). Termina bien si el archivo queda completo. */
    private void intento(String id, String url, File fin, File part) throws Fatal, IOException {
        long ya = part.exists() ? part.length() : 0;
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(20000);
            c.setReadTimeout(30000);
            c.setInstanceFollowRedirects(true);
            if (ya > 0) c.setRequestProperty("Range", "bytes=" + ya + "-");
            int code = c.getResponseCode();
            if (code == 416 && ya > 0) {
                if (!part.renameTo(fin)) throw new Fatal("No pude guardar el modelo");
                totalActual = ya;
                bytesActual = ya;
                return;
            }
            if (code == 429 || code >= 500) throw new IOException("Servidor ocupado (" + code + ")");
            if (code != 200 && code != 206) throw new Fatal("Descarga rechazada (codigo " + code + ")");
            boolean sigue = code == 206 && ya > 0;
            if (!sigue) ya = 0;
            long largo = c.getContentLengthLong();
            long total = largo > 0 ? ya + largo : 0;
            File dir = fin.getParentFile();
            if (largo > 0 && dir != null && dir.getUsableSpace() < largo + 300L * 1048576L) {
                throw new Fatal("No hay espacio suficiente en el celular");
            }
            totalActual = total;
            long hecho = ya;
            bytesActual = hecho;
            long ultimo = 0, marca = System.currentTimeMillis(), bytesMarca = hecho;
            String vel = "";
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(part, sigue)) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) {
                    if (cancelar) throw new Fatal("Descarga cancelada");
                    out.write(buf, 0, n);
                    hecho += n;
                    bytesActual = hecho;
                    long ahora = System.currentTimeMillis();
                    if (ahora - ultimo > 900) {
                        ultimo = ahora;
                        long dt = ahora - marca;
                        if (dt >= 2000) {
                            vel = " \u00b7 " + String.format(java.util.Locale.US, "%.1f", (hecho - bytesMarca) / 1048576.0 / (dt / 1000.0)) + " MB/s";
                            marca = ahora;
                            bytesMarca = hecho;
                        }
                        ponerNoti(hecho, total, vel);
                        avisar(id, hecho, total, false, null);
                    }
                }
            }
            if (total > 0 && part.length() > total) {
                part.delete();
                throw new IOException("Archivo corrupto, empiezo de nuevo");
            }
            if (total > 0 && part.length() != total) throw new IOException("La descarga quedo incompleta");
            if (fin.exists()) fin.delete();
            if (!part.renameTo(fin)) throw new Fatal("No pude guardar el modelo");
            bytesActual = total;
        } finally {
            c.disconnect();
        }
    }

    private void avisar(String id, long bytes, long total, boolean listo, String error) {
        Oyente o = oyente;
        if (o != null) {
            try { o.alEvento(id, bytes, total, listo, error); } catch (Exception ignorada) { }
        }
    }

    // ------------------------------------------------------------ notificaciones

    private void crearCanales() {
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            nm.createNotificationChannel(new NotificationChannel(CANAL, "Descargas de modelos",
                    NotificationManager.IMPORTANCE_LOW));
            nm.createNotificationChannel(new NotificationChannel(CANAL_FIN, "Descargas terminadas",
                    NotificationManager.IMPORTANCE_DEFAULT));
        }
    }

    private PendingIntent abrirApp() {
        Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (abrir == null) return null;
        return PendingIntent.getActivity(this, 0, abrir,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static String tam(long bytes) {
        double mb = bytes / 1048576.0;
        if (mb >= 1024) return String.format(java.util.Locale.US, "%.2f GB", mb / 1024.0);
        return Math.round(mb) + " MB";
    }

    private static String textoProgreso(long bytes, long total, String vel) {
        if (total <= 0) return tam(bytes) + vel;
        int pct = (int) (bytes * 100L / total);
        return pct + "% \u00b7 " + tam(bytes) + " de " + tam(total) + vel;
    }

    private Notification construir(String texto, int pct, boolean indeterminada) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        b.setContentTitle("Descargando " + nombre)
                .setContentText(texto)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setProgress(100, pct, indeterminada);
        PendingIntent pi = abrirApp();
        if (pi != null) b.setContentIntent(pi);
        Intent can = new Intent(this, DescargaServicio.class).setAction(ACC_CANCELAR);
        PendingIntent pc = PendingIntent.getService(this, 1, can,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        b.addAction(new Notification.Action.Builder(
                Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel), "Cancelar", pc).build());
        if (Build.VERSION.SDK_INT >= 31) {
            b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }
        return b.build();
    }

    private void ponerNoti(long bytes, long total, String vel) {
        try {
            int pct = total > 0 ? (int) (bytes * 100L / total) : 0;
            if (nm != null) nm.notify(ID_NOTI, construir(textoProgreso(bytes, total, vel), pct, total <= 0));
        } catch (Exception ignorada) { }
    }

    private void ponerEstado(long bytes, long total, String texto) {
        try {
            int pct = total > 0 ? (int) (bytes * 100L / total) : 0;
            if (nm != null) nm.notify(ID_NOTI, construir(texto, pct, true));
        } catch (Exception ignorada) { }
    }

    private void notificarFin(boolean ok, String error) {
        try {
            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(this, CANAL_FIN) : new Notification.Builder(this);
            b.setContentTitle(ok ? "Modelo descargado" : "Descarga interrumpida")
                    .setContentText(ok ? nombre + " listo. Abre Jarvis para encenderlo." : (error == null ? "" : error))
                    .setSmallIcon(ok ? android.R.drawable.stat_sys_download_done : android.R.drawable.stat_notify_error)
                    .setAutoCancel(true);
            PendingIntent pi = abrirApp();
            if (pi != null) b.setContentIntent(pi);
            if (nm != null) nm.notify(ID_FIN, b.build());
        } catch (Exception ignorada) { }
    }

    // ------------------------------------------------------------------ CPU

    private void tomarCpu() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && cpu == null) {
                cpu = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "jarvis:descarga");
                cpu.setReferenceCounted(false);
            }
            if (cpu != null && !cpu.isHeld()) cpu.acquire(3 * 60 * 60 * 1000L);
        } catch (Exception ignorada) { }
    }

    private void soltarCpu() {
        try {
            if (cpu != null && cpu.isHeld()) cpu.release();
        } catch (Exception ignorada) { }
    }

    @Override
    public void onDestroy() {
        soltarCpu();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
