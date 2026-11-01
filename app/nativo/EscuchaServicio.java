package com.david.jarvis;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/** Servicio en primer plano (con aviso fijo) para que Android deje al micro escuchar la palabra "Jarvis". */
public class EscuchaServicio extends Service {
    private static final String CANAL = "jarvis_escucha";
    private static final int ID = 7231;
    private PowerManager.WakeLock cpu;

    static void iniciar(Context c) {
        try {
            if (c.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            Intent i = new Intent(c, EscuchaServicio.class);
            if (Build.VERSION.SDK_INT >= 26) {
                c.startForegroundService(i);
            } else {
                c.startService(i);
            }
        } catch (Exception ignorada) {
        }
    }

    static void detener(Context c) {
        try {
            c.stopService(new Intent(c, EscuchaServicio.class));
        } catch (Exception ignorada) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26 && nm != null) {
                nm.createNotificationChannel(new NotificationChannel(CANAL, "Jarvis escuchando",
                        NotificationManager.IMPORTANCE_LOW));
            }
            Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
            PendingIntent pi = abrir == null ? null : PendingIntent.getActivity(this, 0, abrir,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
            b.setContentTitle("Jarvis escuchando")
                    .setContentText("Di \u00abJarvis\u00bb para llamarlo")
                    .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                    .setOngoing(true);
            if (pi != null) {
                b.setContentIntent(pi);
            }
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(ID, b.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(ID, b.build());
            }
            tomarCpu();
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    private void tomarCpu() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && cpu == null) {
                cpu = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "jarvis:escucha");
                cpu.setReferenceCounted(false);
            }
            if (cpu != null && !cpu.isHeld()) {
                cpu.acquire();
            }
        } catch (Exception ignorada) {
        }
    }

    @Override
    public void onDestroy() {
        try {
            if (cpu != null && cpu.isHeld()) {
                cpu.release();
            }
        } catch (Exception ignorada) {
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
