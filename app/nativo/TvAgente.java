package com.david.jarvis;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.json.JSONObject;

/** Atiende las ordenes de la TV dentro de la APK (sin Termux): lee la cola de Jarvis y las ejecuta por WiFi. */
public class TvAgente {

    private static TvAgente actual;
    private static TvRemoto remoto;

    private final Context ctx;
    private volatile boolean activo = true;

    private TvAgente(Context c) {
        this.ctx = c;
    }

    static synchronized TvRemoto remoto(Context c) {
        if (remoto == null) {
            remoto = new TvRemoto(c.getApplicationContext().getFilesDir());
        }
        return remoto;
    }

    private static class SinPermiso extends Exception {
    }

    /** Arranca (o reinicia) el ciclo si la TV esta vinculada: hacen falta url, token e IP. */
    static synchronized void iniciar(Context c) {
        detener();
        SharedPreferences p = c.getApplicationContext().getSharedPreferences("manos", Context.MODE_PRIVATE);
        if (p.getString("tv_url", "").isEmpty() || p.getString("tv_token", "").isEmpty()
                || p.getString("tv_ip", "").isEmpty()) {
            return;
        }
        final TvAgente a = new TvAgente(c.getApplicationContext());
        actual = a;
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                a.bucle();
            }
        }, "tv-agente");
        t.setDaemon(true);
        t.start();
    }

    static synchronized void detener() {
        if (actual != null) {
            actual.activo = false;
            actual = null;
        }
        if (remoto != null) {
            remoto.cerrar();
        }
    }

    private boolean vigente() {
        return activo && actual == this;
    }

    private void dormir(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignorada) {
        }
    }

    private SharedPreferences prefs() {
        return ctx.getSharedPreferences("manos", Context.MODE_PRIVATE);
    }

    private void bucle() {
        long ultima = 0;
        while (vigente()) {
            String base = prefs().getString("tv_url", "");
            String token = prefs().getString("tv_token", "");
            if (base.isEmpty() || token.isEmpty()) {
                return;
            }
            try {
                JSONObject r = http("GET", base + "/manos/d/cola", token, null);
                JSONObject orden = r.optJSONObject("orden");
                if (orden != null) {
                    atender(base, token, orden);
                    ultima = System.currentTimeMillis();
                } else {
                    dormir(System.currentTimeMillis() - ultima < 60000 ? 400 : 1500);
                }
            } catch (SinPermiso e) {
                dormir(30000);
            } catch (Exception e) {
                dormir(5000);
            }
        }
    }

    private void atender(String base, String token, JSONObject orden) {
        String tipo = orden.optString("tipo");
        JSONObject args = orden.optJSONObject("args");
        Map<String, Object> a = new HashMap<String, Object>();
        if (args != null) {
            Iterator<String> it = args.keys();
            while (it.hasNext()) {
                String k = it.next();
                a.put(k, args.opt(k));
            }
        }
        boolean ok = false;
        String texto;
        TvRemoto tv = remoto(ctx);
        try {
            texto = TvOrdenes.ejecutar(tv, prefs().getString("tv_ip", ""), tipo, a);
            ok = true;
        } catch (Exception e) {
            tv.cerrar();
            texto = TvRemoto.mensaje(e);
        }
        try {
            JSONObject cuerpo = new JSONObject();
            cuerpo.put("orden_id", orden.optString("id"));
            cuerpo.put("ok", ok);
            cuerpo.put("texto", texto);
            http("POST", base + "/manos/d/resultado", token, cuerpo);
        } catch (Exception ignorada) {
        }
    }

    private JSONObject http(String metodo, String url, String token, JSONObject cuerpo) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setRequestMethod(metodo);
            c.setConnectTimeout(8000);
            c.setReadTimeout(15000);
            c.setRequestProperty("X-Manos-Token", token);
            if (cuerpo != null) {
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                OutputStream o = c.getOutputStream();
                o.write(cuerpo.toString().getBytes(StandardCharsets.UTF_8));
                o.close();
            }
            int cod = c.getResponseCode();
            if (cod == 401) {
                throw new SinPermiso();
            }
            InputStream in = cod >= 400 ? c.getErrorStream() : c.getInputStream();
            BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String linea;
            while ((linea = br.readLine()) != null) {
                sb.append(linea);
            }
            br.close();
            return new JSONObject(sb.toString());
        } finally {
            c.disconnect();
        }
    }

    // ---- Buscar TVs en el WiFi (sin escribir la IP) -------------------------------------

    /** Devuelve {nombre, ip} de cada Android TV que se anuncie en la red. Tarda unos 5 segundos. */
    static List<String[]> buscar(Context c) throws Exception {
        NsdManager nsd = (NsdManager) c.getApplicationContext().getSystemService(Context.NSD_SERVICE);
        final List<NsdServiceInfo> halladas = new ArrayList<NsdServiceInfo>();
        NsdManager.DiscoveryListener dl = new NsdManager.DiscoveryListener() {
            @Override
            public void onStartDiscoveryFailed(String t, int e) {
            }

            @Override
            public void onStopDiscoveryFailed(String t, int e) {
            }

            @Override
            public void onDiscoveryStarted(String t) {
            }

            @Override
            public void onDiscoveryStopped(String t) {
            }

            @Override
            public void onServiceFound(NsdServiceInfo i) {
                synchronized (halladas) {
                    halladas.add(i);
                }
            }

            @Override
            public void onServiceLost(NsdServiceInfo i) {
            }
        };
        nsd.discoverServices("_androidtvremote2._tcp", NsdManager.PROTOCOL_DNS_SD, dl);
        Thread.sleep(4500);
        try {
            nsd.stopServiceDiscovery(dl);
        } catch (Exception ignorada) {
        }
        List<NsdServiceInfo> copia;
        synchronized (halladas) {
            copia = new ArrayList<NsdServiceInfo>(halladas);
        }
        final List<String[]> res = new ArrayList<String[]>();
        for (NsdServiceInfo i : copia) {
            final CountDownLatch fin = new CountDownLatch(1);
            nsd.resolveService(i, new NsdManager.ResolveListener() {
                @Override
                public void onResolveFailed(NsdServiceInfo s, int e) {
                    fin.countDown();
                }

                @Override
                public void onServiceResolved(NsdServiceInfo s) {
                    try {
                        String ip = s.getHost().getHostAddress();
                        if (ip != null && ip.indexOf(':') < 0) {
                            boolean repetida = false;
                            for (String[] x : res) {
                                if (x[1].equals(ip)) {
                                    repetida = true;
                                }
                            }
                            if (!repetida) {
                                res.add(new String[]{s.getServiceName(), ip});
                            }
                        }
                    } catch (Exception ignorada) {
                    }
                    fin.countDown();
                }
            });
            fin.await(3, TimeUnit.SECONDS);
        }
        return res;
    }
}
