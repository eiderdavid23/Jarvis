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
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
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

    /** Busca por mDNS y, a la vez, probando las direcciones del WiFi. Junta los resultados sin repetir. */
    static List<String[]> buscar(final Context c) throws Exception {
        final List<String[]> nsd = Collections.synchronizedList(new ArrayList<String[]>());
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    nsd.addAll(buscarNsd(c));
                } catch (Exception ignorada) {
                }
            }
        }, "tv-nsd");
        t.setDaemon(true);
        t.start();
        List<String[]> red = escanearRed();
        t.join(9000);
        List<String[]> res = new ArrayList<String[]>();
        synchronized (nsd) {
            res.addAll(nsd);
        }
        for (String[] x : red) {
            boolean ya = false;
            for (String[] y : res) {
                if (y[1].equals(x[1])) {
                    ya = true;
                }
            }
            if (!ya) {
                res.add(x);
            }
        }
        return res;
    }

    /** Prueba las 254 direcciones del WiFi del celular: una Android TV encendida tiene abierto el puerto 6466. */
    static List<String[]> escanearRed() {
        final List<String[]> res = Collections.synchronizedList(new ArrayList<String[]>());
        String propia = null;
        String otra = null;
        try {
            Enumeration<NetworkInterface> todas = NetworkInterface.getNetworkInterfaces();
            while (todas != null && todas.hasMoreElements()) {
                NetworkInterface n = todas.nextElement();
                if (!n.isUp() || n.isLoopback()) {
                    continue;
                }
                Enumeration<InetAddress> dirs = n.getInetAddresses();
                while (dirs.hasMoreElements()) {
                    InetAddress d = dirs.nextElement();
                    if (d instanceof Inet4Address && d.isSiteLocalAddress()) {
                        if (n.getName().startsWith("wlan") || n.getName().startsWith("eth")) {
                            if (propia == null) {
                                propia = d.getHostAddress();
                            }
                        } else if (otra == null) {
                            otra = d.getHostAddress();
                        }
                    }
                }
            }
        } catch (Exception ignorada) {
        }
        if (propia == null) {
            propia = otra;
        }
        if (propia == null) {
            return res;
        }
        final String base = propia.substring(0, propia.lastIndexOf('.') + 1);
        final String yo = propia;
        ExecutorService ex = Executors.newFixedThreadPool(48);
        for (int i = 1; i < 255; i++) {
            final String ip = base + i;
            if (ip.equals(yo)) {
                continue;
            }
            ex.execute(new Runnable() {
                @Override
                public void run() {
                    Socket s = new Socket();
                    try {
                        s.connect(new InetSocketAddress(ip, 6466), 700);
                        res.add(new String[]{"Android TV", ip});
                    } catch (Exception ignorada) {
                    } finally {
                        try {
                            s.close();
                        } catch (Exception ignorada) {
                        }
                    }
                }
            });
        }
        ex.shutdown();
        try {
            ex.awaitTermination(8, TimeUnit.SECONDS);
        } catch (InterruptedException ignorada) {
        }
        synchronized (res) {
            return new ArrayList<String[]>(res);
        }
    }

    /** Devuelve {nombre, ip} de cada Android TV que se anuncie en la red. Tarda unos 5 segundos. */
    static List<String[]> buscarNsd(Context c) throws Exception {
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
