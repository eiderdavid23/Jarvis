package com.david.jarvis;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import android.graphics.Bitmap;
import android.hardware.HardwareBuffer;
import android.util.Base64;
import android.view.Display;
import android.view.accessibility.AccessibilityWindowInfo;
import java.io.ByteArrayOutputStream;

/**
 * Manos de Jarvis: servicio de accesibilidad. Pregunta al servidor por ordenes
 * (ver pantalla, tocar, escribir...), pide confirmacion al usuario y las ejecuta.
 */
public class ManosServicio extends AccessibilityService {
    static volatile ManosServicio instancia;
    /** true mientras la pantalla de Jarvis esta delante (lo avisa ManosPlugin). */
    static volatile boolean jarvisAdelante = false;
    volatile BurbujaManos burbuja;
    private static final int MAX_NODOS = 110;
    private volatile long ultimaOrden = 0;
    private final Handler principal = new Handler(Looper.getMainLooper());
    private volatile int generacion = 0;
    private volatile long ultimoEvento = 0;
    private static final String[] WA_PAQ = {"com.whatsapp", "com.whatsapp.w4b"};
    private volatile long juegoHasta = 0;
    private volatile boolean cancelada = false;
    private volatile String ordenActual = "";
    private volatile String fotoB64 = null;
    private volatile int fotoAncho = 0;
    private volatile int fotoAlto = 0;

    private static class SinPermiso extends Exception {
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        ultimoEvento = System.currentTimeMillis();
    }

    private TextView pastilla;
    private final Runnable quitarPastilla = new Runnable() {
        @Override
        public void run() {
            try {
                if (pastilla != null) {
                    ((WindowManager) getSystemService(Context.WINDOW_SERVICE)).removeView(pastilla);
                }
            } catch (Exception ignorada) {
            }
            pastilla = null;
        }
    };

    /** Aviso encima de todo (no tapa toques) de que Jarvis esta usando el celular. */
    private void mostrarAviso(final String texto) {
        principal.post(new Runnable() {
            @Override
            public void run() {
                try {
                    principal.removeCallbacks(quitarPastilla);
                    if (pastilla == null) {
                        float d = getResources().getDisplayMetrics().density;
                        TextView t = new TextView(ManosServicio.this);
                        t.setTextColor(Color.parseColor("#E6F7FF"));
                        t.setTextSize(14);
                        t.setPadding((int) (16 * d), (int) (8 * d), (int) (16 * d), (int) (8 * d));
                        GradientDrawable f = new GradientDrawable();
                        f.setColor(Color.parseColor("#E6061018"));
                        f.setCornerRadius(30 * d);
                        f.setStroke((int) (1.5f * d), Color.parseColor("#00E5FF"));
                        t.setBackground(f);
                        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                                PixelFormat.TRANSLUCENT);
                        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                        lp.y = (int) (48 * d);
                        ((WindowManager) getSystemService(Context.WINDOW_SERVICE)).addView(t, lp);
                        pastilla = t;
                    }
                    pastilla.setText(texto);
                    principal.postDelayed(quitarPastilla, 1800);
                } catch (Exception ignorada) {
                }
            }
        });
    }

    /** Espera a que la pantalla deje de cambiar (en vez de una pausa fija): rapido si ya esta lista. */
    private void asentar(long max) {
        long ini = System.currentTimeMillis();
        dormir(80);
        while (System.currentTimeMillis() - ini < max) {
            if (System.currentTimeMillis() - ultimoEvento >= 120) {
                return;
            }
            dormir(30);
        }
    }

    @Override
    public void onInterrupt() {
    }

    /** Jarvis paso al frente (true) o a segundo plano (false): la burbuja sale solo cuando esta fuera. */
    static void alCambiarPrimerPlano(boolean adelante) {
        jarvisAdelante = adelante;
        ManosServicio s = instancia;
        if (s != null && s.burbuja != null) {
            s.burbuja.actualizar();
        }
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instancia = this;
        burbuja = new BurbujaManos(this);
        burbuja.actualizar();
        arrancar();
    }

    @Override
    public boolean onUnbind(Intent intent) {
        if (burbuja != null) {
            burbuja.quitar();
            burbuja = null;
        }
        instancia = null;
        generacion++;
        return super.onUnbind(intent);
    }

    /** Lanza (o relanza) el hilo que pregunta por ordenes. El hilo anterior se detiene solo. */
    void arrancar() {
        final int mia = ++generacion;
        new Thread(new Runnable() {
            @Override
            public void run() {
                bucle(mia);
            }
        }, "manos-cola").start();
    }

    private boolean vigente(int mia) {
        return mia == generacion && instancia == this;
    }

    private void dormir(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignorada) {
        }
    }

    private void bucle(int mia) {
        while (vigente(mia)) {
            SharedPreferences p = getSharedPreferences("manos", Context.MODE_PRIVATE);
            String base = p.getString("url", "");
            String token = p.getString("token", "");
            if (base.isEmpty() || token.isEmpty()) {
                dormir(3000);
                continue;
            }
            try {
                JSONObject r = http("GET", base + "/manos/d/cola", token, null);
                JSONObject orden = r.optJSONObject("orden");
                if (orden != null) {
                    atender(base, token, orden);
                    ultimaOrden = System.currentTimeMillis();
                } else {
                    dormir(System.currentTimeMillis() - ultimaOrden < 90000 ? 150 : 1000);
                }
            } catch (SinPermiso e) {
                dormir(30000);
            } catch (Exception e) {
                dormir(5000);
            }
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

    // ---- Atender una orden ----------------------------------------------------

    private void atender(String base, String token, JSONObject orden) {
        String id = orden.optString("id");
        String tipo = orden.optString("tipo");
        JSONObject args = orden.optJSONObject("args");
        if (args == null) {
            args = new JSONObject();
        }
        cancelada = false;
        ordenActual = id;
        vigilar(base, token, id);
        boolean ok = false;
        boolean rechazada = false;
        String texto = "";
        try {
            boolean pide = !tipo.equals("capturar") && !tipo.equals("esperar") && !sinPreguntar(tipo, args);
            if (pide && !confirmar(describir(tipo, args))) {
                rechazada = true;
                texto = "El usuario rechazo la accion.";
            } else {
                if (!tipo.equals("capturar") && !tipo.equals("esperar")) {
                    mostrarAviso("Jarvis est\u00e1 usando tu celular...");
                }
                String[] r = ejecutar(tipo, args);
                ok = r[0].equals("1");
                texto = r[1];
                boolean verificada = tipo.equals("whatsapp_enviar") && ok;
                if (cancelada) {
                    texto = texto + "\nCancelado por el usuario.";
                } else if (args.optBoolean("imagen") && !tipo.equals("capturar") && !tipo.equals("esperar")) {
                    asentar(500);
                    String[] f = foto();
                    texto = texto + "\n" + f[1];
                } else if (!tipo.equals("capturar") && !tipo.equals("esperar") && !verificada) {
                    asentar(700);
                    texto = texto + "\nPANTALLA AHORA:\n" + arbol();
                }
            }
        } catch (Exception e) {
            texto = "fallo: " + e.getMessage();
        }
        try {
            JSONObject cuerpo = new JSONObject();
            cuerpo.put("orden_id", id);
            cuerpo.put("ok", ok);
            cuerpo.put("rechazada", rechazada);
            cuerpo.put("texto", texto);
            String fb = fotoB64;
            if (fb != null) {
                cuerpo.put("pantalla", fb);
                cuerpo.put("ancho", fotoAncho);
                cuerpo.put("alto", fotoAlto);
                fotoB64 = null;
            }
            http("POST", base + "/manos/d/resultado", token, cuerpo);
        } catch (Exception ignorada) {
        }
        ordenActual = "";
    }

    /** Mientras dura una orden, pregunta al servidor si el usuario la cancelo (boton Detener). */
    private void vigilar(final String base, final String token, final String id) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                while (id.equals(ordenActual)) {
                    dormir(600);
                    if (!id.equals(ordenActual)) {
                        return;
                    }
                    try {
                        JSONObject r = http("GET", base + "/manos/d/orden/" + id, token, null);
                        if ("vencida".equals(r.optString("estado"))) {
                            cancelada = true;
                            return;
                        }
                    } catch (Exception ignorada) {
                    }
                }
            }
        }, "manos-cancelar").start();
    }

    /** Deja el dedo quieto en (x,y) durante ms, a partir de un trazo que sigue apoyado, en trozos de 1 s:
     *  si el usuario cancela, lo suelta. Devuelve null si todo fue bien. */
    private String[] sostener(GestureDescription.StrokeDescription previo, int x, int y, long ms) throws Exception {
        GestureDescription.StrokeDescription s = previo;
        long resto = ms;
        while (resto > 0) {
            long t = cancelada ? 50L : Math.min(1000L, resto);
            boolean sigue = !cancelada && resto - t > 0;
            Path fijo = new Path();
            fijo.moveTo(x, y);
            s = s.continueStroke(fijo, 0, t, sigue);
            GestureDescription.Builder b = new GestureDescription.Builder();
            b.addStroke(s);
            if (!gesto(b.build(), t + 4000)) {
                return err("el sistema corto el dedo antes de tiempo");
            }
            if (!sigue) {
                break;
            }
            resto -= t;
        }
        if (cancelada) {
            return err("cancelado por el usuario: solte el dedo");
        }
        return null;
    }

    private String[] ok(String t) {
        return new String[]{"1", t};
    }

    private String[] err(String t) {
        return new String[]{"0", t};
    }

    private int[] tam() {
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                Rect b = ((WindowManager) getSystemService(Context.WINDOW_SERVICE))
                        .getMaximumWindowMetrics().getBounds();
                if (b.width() > 0 && b.height() > 0) {
                    return new int[]{b.width(), b.height()};
                }
            } catch (Exception ignorada) {
            }
        }
        DisplayMetrics m = getResources().getDisplayMetrics();
        return new int[]{m.widthPixels, m.heightPixels};
    }

    private void avisar(final String t) {
        principal.post(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(ManosServicio.this, t, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private String limpiar(CharSequence cs) {
        if (cs == null) {
            return "";
        }
        String s = cs.toString().replace('\n', ' ').trim();
        return s.length() > 60 ? s.substring(0, 60) : s;
    }

    private String describir(String tipo, JSONObject a) {
        switch (tipo) {
            case "clic":
            case "doble_clic":
            case "clic_derecho": {
                int x = a.optBoolean("norm") ? Math.round(a.optInt("x") * tam()[0] / 1000f) : a.optInt("x");
                int y = a.optBoolean("norm") ? Math.round(a.optInt("y") * tam()[1] / 1000f) : a.optInt("y");
                String el = elementoEn(x, y);
                String verbo = tipo.equals("doble_clic") ? "Tocar dos veces" : (tipo.equals("clic") ? "Tocar" : "Mantener pulsado");
                return verbo + (el.isEmpty() ? " la pantalla" : " \"" + el + "\"") + " (" + x + ", " + y + ")";
            }
            case "tocar_texto":
                return "Tocar el elemento \"" + limpiar(a.optString("texto")) + "\"";
            case "abrir_ajustes":
                return "Abrir los ajustes: " + limpiar(a.optString("texto"));
            case "abrir_url":
                return "Abrir el enlace " + limpiar(a.optString("texto"));
            case "secuencia": {
                org.json.JSONArray ps = a.optJSONArray("pasos");
                StringBuilder sb = new StringBuilder("Hacer " + (ps == null ? 0 : ps.length()) + " pasos:");
                for (int i = 0; ps != null && i < ps.length() && i < 6; i++) {
                    JSONObject p = ps.optJSONObject(i);
                    if (p != null) {
                        sb.append("\n").append(i + 1).append(". ").append(describir(p.optString("accion"), p));
                    }
                }
                if (ps != null && ps.length() > 6) {
                    sb.append("\n...");
                }
                return sb.toString();
            }
            case "abrir_app":
                return "Abrir la app \"" + limpiar(a.optString("texto")) + "\"";
            case "whatsapp_enviar":
                return "Enviar por WhatsApp a \"" + limpiar(a.optString("contacto")) + "\":\n\""
                        + limpiar(a.optString("mensaje")) + "\"";
            case "escribir":
                return "Escribir: \"" + limpiar(a.optString("texto")) + "\"";
            case "mantener":
                return "Mantener el dedo pulsado " + a.optInt("segundos", 2) + " s";
            case "arrastrar":
                return "Deslizar el dedo por la pantalla"
                        + (a.optInt("segundos", 0) > 0 ? " y mantenerlo " + a.optInt("segundos") + " s" : "");
            case "modo_juego":
                return "Dejar que Jarvis toque Minecraft sin preguntar durante " + a.optInt("minutos", 10)
                        + " min (solo en la ventana del juego)";
            case "tecla":
                return "Pulsar: " + a.optString("tecla");
            case "scroll":
                return "Hacer scroll hacia " + a.optString("direccion");
            default:
                return "Accion: " + tipo;
        }
    }

    private void buscar(AccessibilityNodeInfo n, int x, int y, String[] mejor, long[] area, int prof) {
        if (n == null || prof > 40) {
            return;
        }
        Rect r = new Rect();
        n.getBoundsInScreen(r);
        if (r.contains(x, y)) {
            String t = n.isPassword() ? "" : limpiar(n.getText());
            if (t.isEmpty()) {
                t = limpiar(n.getContentDescription());
            }
            long a = (long) r.width() * r.height();
            if (!t.isEmpty() && a < area[0]) {
                area[0] = a;
                mejor[0] = t;
            }
        }
        for (int i = 0; i < n.getChildCount(); i++) {
            buscar(n.getChild(i), x, y, mejor, area, prof + 1);
        }
    }

    private String elementoEn(int x, int y) {
        AccessibilityNodeInfo raiz = getRootInActiveWindow();
        String[] mejor = {""};
        long[] area = {Long.MAX_VALUE};
        buscar(raiz, x, y, mejor, area, 0);
        return mejor[0];
    }

    /** Muestra una tarjeta encima de todo con Permitir / Rechazar. Sin respuesta en 30 s = rechazo. */
    private boolean confirmar(final String texto) throws InterruptedException {
        if (burbuja != null) {
            burbuja.plegar();
        }
        if (getSharedPreferences("manos", Context.MODE_PRIVATE).getBoolean("auto", false)) {
            return true;
        }
        final CountDownLatch respuesta = new CountDownLatch(1);
        final boolean[] si = {false};
        final View[] caja = {null};
        final float d = getResources().getDisplayMetrics().density;
        principal.post(new Runnable() {
            @Override
            public void run() {
                try {
                    WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
                    LinearLayout c = new LinearLayout(ManosServicio.this);
                    c.setOrientation(LinearLayout.VERTICAL);
                    int pad = (int) (16 * d);
                    c.setPadding(pad, pad, pad, pad);
                    GradientDrawable fondo = new GradientDrawable();
                    fondo.setColor(Color.parseColor("#F2061018"));
                    fondo.setCornerRadius(20 * d);
                    fondo.setStroke((int) (1.5f * d), Color.parseColor("#00E5FF"));
                    c.setBackground(fondo);
                    TextView t = new TextView(ManosServicio.this);
                    t.setText("Jarvis quiere:\n" + texto);
                    t.setTextColor(Color.parseColor("#E6F7FF"));
                    t.setTextSize(16);
                    c.addView(t);
                    LinearLayout fila = new LinearLayout(ManosServicio.this);
                    fila.setOrientation(LinearLayout.HORIZONTAL);
                    fila.setPadding(0, (int) (12 * d), 0, 0);
                    Button no = new Button(ManosServicio.this);
                    no.setText("Rechazar");
                    no.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            respuesta.countDown();
                        }
                    });
                    Button yes = new Button(ManosServicio.this);
                    yes.setText("Permitir");
                    yes.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            si[0] = true;
                            respuesta.countDown();
                        }
                    });
                    fila.addView(no);
                    fila.addView(yes);
                    c.addView(fila);
                    WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                            (int) (tam()[0] * 0.92f), WindowManager.LayoutParams.WRAP_CONTENT,
                            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
                    lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                    lp.y = (int) (80 * d);
                    wm.addView(c, lp);
                    caja[0] = c;
                } catch (Exception e) {
                    respuesta.countDown();
                }
            }
        });
        respuesta.await(30, TimeUnit.SECONDS);
        final CountDownLatch quitada = new CountDownLatch(1);
        principal.post(new Runnable() {
            @Override
            public void run() {
                try {
                    if (caja[0] != null) {
                        ((WindowManager) getSystemService(Context.WINDOW_SERVICE)).removeView(caja[0]);
                    }
                } catch (Exception ignorada) {
                }
                quitada.countDown();
            }
        });
        quitada.await(2, TimeUnit.SECONDS);
        return si[0];
    }

    // ---- Acciones ---------------------------------------------------------------

    private String[] ejecutar(String tipo, JSONObject a) throws Exception {
        switch (tipo) {
            case "capturar": {
                String t = arbol();
                if (a.optBoolean("imagen")) {
                    String[] f = foto();
                    t = t + "\n" + f[1];
                }
                return ok(t);
            }
            case "mantener":
                return mantener(a);
            case "arrastrar":
                return arrastrar(a);
            case "modo_juego":
                return modoJuego(a.optInt("minutos", 10));
            case "clic":
                return toque(px(a, "x"), py(a, "y"), 50, false);
            case "doble_clic":
                return toque(px(a, "x"), py(a, "y"), 50, true);
            case "clic_derecho":
                return toque(px(a, "x"), py(a, "y"), 700, false);
            case "escribir":
                return escribir(a.optString("texto"));
            case "tecla":
                return tecla(a.optString("tecla"));
            case "scroll":
                return scroll(a.optString("direccion"), a.optInt("cantidad", 3));
            case "tocar_texto":
                return tocarTexto(a.optString("texto"));
            case "abrir_ajustes":
                return abrirAjustes(a.optString("texto"));
            case "abrir_url":
                return abrirUrl(a.optString("texto"));
            case "secuencia":
                return secuencia(a.optJSONArray("pasos"));
            case "abrir_app":
                return abrirApp(a.optString("texto"));
            case "whatsapp_enviar":
                return whatsappEnviar(a.optString("contacto"), a.optString("mensaje"));
            case "esperar":
                dormir(Math.max(1, Math.min(10, a.optInt("segundos", 2))) * 1000L);
                return ok("espera lista");
            default:
                return err("esa accion no existe en el celular: " + tipo);
        }
    }

    private boolean gesto(final GestureDescription g) throws InterruptedException {
        return gesto(g, 5000);
    }

    private boolean gesto(final GestureDescription g, long espera) throws InterruptedException {
        final CountDownLatch l = new CountDownLatch(1);
        final boolean[] fin = {false};
        principal.post(new Runnable() {
            @Override
            public void run() {
                boolean enviado = dispatchGesture(g, new GestureResultCallback() {
                    @Override
                    public void onCompleted(GestureDescription d) {
                        fin[0] = true;
                        l.countDown();
                    }

                    @Override
                    public void onCancelled(GestureDescription d) {
                        l.countDown();
                    }
                }, null);
                if (!enviado) {
                    l.countDown();
                }
            }
        });
        l.await(espera, TimeUnit.MILLISECONDS);
        return fin[0];
    }

    private boolean global(final int accion) throws InterruptedException {
        final CountDownLatch l = new CountDownLatch(1);
        final boolean[] r = {false};
        principal.post(new Runnable() {
            @Override
            public void run() {
                r[0] = performGlobalAction(accion);
                l.countDown();
            }
        });
        l.await(3, TimeUnit.SECONDS);
        return r[0];
    }

    private String[] toque(int x, int y, long dur, boolean doble) throws Exception {
        int[] t = tam();
        if (x < 0 || y < 0 || x > t[0] || y > t[1]) {
            return err("coordenadas fuera de la pantalla (" + t[0] + "x" + t[1] + ")");
        }
        Path p = new Path();
        p.moveTo(x, y);
        GestureDescription.Builder b = new GestureDescription.Builder();
        b.addStroke(new GestureDescription.StrokeDescription(p, 0, dur));
        if (doble) {
            b.addStroke(new GestureDescription.StrokeDescription(p, 200, dur));
        }
        if (!gesto(b.build())) {
            return err("el sistema no completo el toque");
        }
        asentar(450);
        return ok("toque hecho en (" + x + "," + y + ")");
    }

    // ---- Juegos (Minecraft): vista, pulsacion larga, arrastre y modo juego ----------

    /** Convierte una coordenada: si viene normalizada (cuadricula 0-1000) la pasa a pixeles reales. */
    private int px(JSONObject a, String k) throws Exception {
        int v = a.getInt(k);
        return a.optBoolean("norm") ? Math.round(v * tam()[0] / 1000f) : v;
    }

    private int py(JSONObject a, String k) throws Exception {
        int v = a.getInt(k);
        return a.optBoolean("norm") ? Math.round(v * tam()[1] / 1000f) : v;
    }

    /** true si el punto cae dentro de una ventana de Minecraft (sirve tambien en pantalla dividida). */
    private boolean enMinecraft(int x, int y) {
        try {
            for (AccessibilityWindowInfo w : getWindows()) {
                AccessibilityNodeInfo r = w.getRoot();
                if (r == null || r.getPackageName() == null) {
                    continue;
                }
                if (!r.getPackageName().toString().startsWith("com.mojang.")) {
                    continue;
                }
                Rect b = new Rect();
                w.getBoundsInScreen(b);
                if (b.contains(x, y)) {
                    return true;
                }
            }
        } catch (Exception ignorada) {
        }
        return false;
    }

    /** Con el modo juego activo, los gestos sobre la ventana de Minecraft no piden confirmacion. */
    private boolean sinPreguntar(String tipo, JSONObject a) {
        if (tipo.equals("modo_juego") && a.optInt("minutos", 10) <= 0) {
            return true;
        }
        if (System.currentTimeMillis() >= juegoHasta) {
            return false;
        }
        try {
            if (tipo.equals("clic") || tipo.equals("doble_clic") || tipo.equals("clic_derecho")
                    || tipo.equals("mantener")) {
                return enMinecraft(px(a, "x"), py(a, "y"));
            }
            if (tipo.equals("arrastrar")) {
                return enMinecraft(px(a, "x1"), py(a, "y1")) && enMinecraft(px(a, "x2"), py(a, "y2"));
            }
        } catch (Exception ignorada) {
        }
        return false;
    }

    private String[] modoJuego(int minutos) {
        if (minutos <= 0) {
            juegoHasta = 0;
            return ok("modo juego desactivado");
        }
        int m = Math.min(30, minutos);
        juegoHasta = System.currentTimeMillis() + m * 60000L;
        return ok("modo juego activo " + m + " min: toques, pulsaciones largas y arrastres sobre Minecraft "
                + "sin preguntar (lo demas sigue pidiendo permiso)");
    }

    private String[] mantener(JSONObject a) throws Exception {
        int x = px(a, "x");
        int y = py(a, "y");
        int[] t = tam();
        if (x < 0 || y < 0 || x > t[0] || y > t[1]) {
            return err("coordenadas fuera de la pantalla (" + t[0] + "x" + t[1] + ")");
        }
        long ms = Math.max(1, Math.min(10, a.optInt("segundos", 2))) * 1000L;
        Path p = new Path();
        p.moveTo(x, y);
        long trozo = Math.min(1000L, ms);
        GestureDescription.StrokeDescription s0 = new GestureDescription.StrokeDescription(p, 0, trozo, ms > trozo);
        GestureDescription.Builder b = new GestureDescription.Builder();
        b.addStroke(s0);
        if (!gesto(b.build(), trozo + 4000)) {
            return err("el sistema no completo la pulsacion larga");
        }
        if (ms > trozo) {
            String[] r = sostener(s0, x, y, ms - trozo);
            if (r != null) {
                return r;
            }
        }
        return ok("mantuve pulsado (" + x + "," + y + ") " + (ms / 1000) + " s");
    }

    /** Desliza el dedo de (x1,y1) a (x2,y2) y, si segundos > 0, lo deja quieto ahi (joystick: caminar). */
    private String[] arrastrar(JSONObject a) throws Exception {
        int x1 = px(a, "x1");
        int y1 = py(a, "y1");
        int x2 = px(a, "x2");
        int y2 = py(a, "y2");
        int[] t = tam();
        if (x1 < 0 || y1 < 0 || x2 < 0 || y2 < 0 || x1 > t[0] || x2 > t[0] || y1 > t[1] || y2 > t[1]) {
            return err("coordenadas fuera de la pantalla (" + t[0] + "x" + t[1] + ")");
        }
        long quieto = Math.max(0, Math.min(10, a.optInt("segundos", 0))) * 1000L;
        Path ida = new Path();
        ida.moveTo(x1, y1);
        if (x1 != x2 || y1 != y2) {
            ida.lineTo(x2, y2);
        }
        if (quieto == 0) {
            GestureDescription.Builder b = new GestureDescription.Builder();
            b.addStroke(new GestureDescription.StrokeDescription(ida, 0, 300));
            if (!gesto(b.build(), 4000)) {
                return err("el sistema no completo el arrastre");
            }
            return ok("arrastre hecho de (" + x1 + "," + y1 + ") a (" + x2 + "," + y2 + ")");
        }
        GestureDescription.StrokeDescription s1 = new GestureDescription.StrokeDescription(ida, 0, 250, true);
        GestureDescription.Builder b1 = new GestureDescription.Builder();
        b1.addStroke(s1);
        if (!gesto(b1.build(), 4000)) {
            return err("el sistema no completo el arrastre");
        }
        String[] r = sostener(s1, x2, y2, quieto);
        if (r != null) {
            return r;
        }
        return ok("arrastre de (" + x1 + "," + y1 + ") a (" + x2 + "," + y2 + ") y dedo mantenido " + (quieto / 1000) + " s");
    }

    /** Captura la pantalla (Android 11+), la reduce y la deja lista para enviarla con el resultado. */
    private String[] foto() throws Exception {
        if (Build.VERSION.SDK_INT < 30) {
            return err("captura de pantalla no disponible: requiere Android 11 o superior");
        }
        mostrarAviso("Jarvis está mirando tu pantalla...");
        String motivo = "no pude capturar la pantalla";
        for (int intento = 0; intento < 3; intento++) {
            final CountDownLatch l = new CountDownLatch(1);
            final Bitmap[] res = {null};
            final int[] codigo = {0};
            principal.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
                            @Override
                            public void onSuccess(ScreenshotResult r) {
                                try {
                                    HardwareBuffer hb = r.getHardwareBuffer();
                                    Bitmap hw = Bitmap.wrapHardwareBuffer(hb, r.getColorSpace());
                                    if (hw != null) {
                                        res[0] = hw.copy(Bitmap.Config.ARGB_8888, false);
                                        hw.recycle();
                                    }
                                    hb.close();
                                } catch (Exception e) {
                                    codigo[0] = -1;
                                }
                                l.countDown();
                            }

                            @Override
                            public void onFailure(int errorCode) {
                                codigo[0] = errorCode;
                                l.countDown();
                            }
                        });
                    } catch (Exception e) {
                        codigo[0] = -1;
                        l.countDown();
                    }
                }
            });
            l.await(6, TimeUnit.SECONDS);
            Bitmap bm = res[0];
            if (bm != null) {
                int an = bm.getWidth();
                int al = bm.getHeight();
                float esc = Math.min(1f, 1280f / Math.max(an, al));
                Bitmap peq = esc < 1f
                        ? Bitmap.createScaledBitmap(bm, Math.round(an * esc), Math.round(al * esc), true) : bm;
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                peq.compress(Bitmap.CompressFormat.JPEG, 55, bos);
                fotoB64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
                fotoAncho = an;
                fotoAlto = al;
                return ok("captura lista (pantalla real " + an + "x" + al + ")");
            }
            if (codigo[0] == ERROR_TAKE_SCREENSHOT_INTERVAL_TIME_SHORT) {
                dormir(1100);
                continue;
            }
            motivo = codigo[0] == ERROR_TAKE_SCREENSHOT_NO_ACCESSIBILITY_ACCESS
                    ? "falta el permiso de captura: desactiva y vuelve a activar el servicio de accesibilidad de Jarvis"
                    : "no pude capturar la pantalla (codigo " + codigo[0] + ")";
            break;
        }
        return err(motivo);
    }

    private String[] escribir(String texto) {
        AccessibilityNodeInfo n = findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (n == null || !n.isEditable()) {
            // Sin foco: si hay un unico campo de texto visible se usa ese (ahorra un paso)
            AccessibilityNodeInfo unico = null;
            int campos = 0;
            for (AccessibilityNodeInfo c : nodosVisibles()) {
                if (c.isEditable()) {
                    unico = c;
                    campos++;
                }
            }
            if (campos != 1) {
                return err("no hay un campo de texto activo; toca primero el campo y vuelve a intentar");
            }
            n = unico;
            n.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
        }
        CharSequence actual = n.getText();
        boolean pista = Build.VERSION.SDK_INT >= 26 && n.isShowingHintText();
        String base = (actual == null || pista) ? "" : actual.toString();
        Bundle b = new Bundle();
        b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, base + texto);
        return n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b)
                ? ok("texto escrito") : err("la app no dejo escribir en ese campo");
    }

    private String[] tecla(String t) throws InterruptedException {
        switch (t) {
            case "atras":
            case "back":
                return global(GLOBAL_ACTION_BACK) ? ok("atras") : err("no pude volver atras");
            case "inicio":
            case "home":
                return global(GLOBAL_ACTION_HOME) ? ok("inicio") : err("no pude ir a inicio");
            case "recientes":
                return global(GLOBAL_ACTION_RECENTS) ? ok("recientes") : err("no pude abrir recientes");
            case "notificaciones":
                return global(GLOBAL_ACTION_NOTIFICATIONS) ? ok("notificaciones") : err("no pude abrir notificaciones");
            case "enter":
            case "intro": {
                AccessibilityNodeInfo n = findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
                if (n == null || Build.VERSION.SDK_INT < 30) {
                    return err("enter no disponible aqui; toca el boton de enviar o buscar");
                }
                return n.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.getId())
                        ? ok("enter") : err("la app no acepto enter");
            }
            case "borrar":
            case "backspace": {
                AccessibilityNodeInfo n = findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
                if (n == null || !n.isEditable() || n.getText() == null || n.getText().length() == 0) {
                    return err("no hay texto que borrar");
                }
                String s = n.getText().toString();
                Bundle b = new Bundle();
                b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, s.substring(0, s.length() - 1));
                return n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b) ? ok("borrado") : err("no pude borrar");
            }
            default:
                return err("esa tecla no existe en el celular: " + t);
        }
    }

    private String[] scroll(String dir, int veces) throws Exception {
        int[] t = tam();
        boolean abajo = !"arriba".equals(dir);
        float y1 = t[1] * (abajo ? 0.70f : 0.30f);
        float y2 = t[1] * (abajo ? 0.30f : 0.70f);
        int n = Math.max(1, Math.min(10, veces));
        for (int i = 0; i < n; i++) {
            Path p = new Path();
            p.moveTo(t[0] / 2f, y1);
            p.lineTo(t[0] / 2f, y2);
            GestureDescription.Builder b = new GestureDescription.Builder();
            b.addStroke(new GestureDescription.StrokeDescription(p, 0, 350));
            if (!gesto(b.build())) {
                return err("el sistema no completo el scroll");
            }
            asentar(350);
        }
        return ok("scroll hacia " + (abajo ? "abajo" : "arriba"));
    }

    private static String norm(CharSequence cs) {
        if (cs == null) {
            return "";
        }
        String s = java.text.Normalizer.normalize(cs.toString(), java.text.Normalizer.Form.NFD);
        return s.replaceAll("\\p{M}", "").toLowerCase(java.util.Locale.ROOT).trim();
    }

    private void hallar(AccessibilityNodeInfo n, String q, java.util.List<AccessibilityNodeInfo> res, int prof) {
        if (n == null || prof > 40 || res.size() >= 12) {
            return;
        }
        if (n.isVisibleToUser()) {
            String t = n.isPassword() ? "" : norm(n.getText());
            String d = norm(n.getContentDescription());
            if ((!t.isEmpty() && t.contains(q)) || (!d.isEmpty() && d.contains(q))) {
                res.add(n);
            }
        }
        for (int i = 0; i < n.getChildCount(); i++) {
            hallar(n.getChild(i), q, res, prof + 1);
        }
    }

    /** Toca un elemento por su nombre (texto o descripcion), sin depender de coordenadas. */
    private String[] tocarTexto(String texto) throws Exception {
        String q = norm(texto);
        if (q.isEmpty()) {
            return err("falta el nombre del elemento a tocar");
        }
        java.util.ArrayList<AccessibilityNodeInfo> res = new java.util.ArrayList<AccessibilityNodeInfo>();
        for (long fin = System.currentTimeMillis() + 1800; res.isEmpty() && System.currentTimeMillis() < fin; ) {
            AccessibilityNodeInfo raiz = getRootInActiveWindow();
            if (raiz != null) {
                hallar(raiz, q, res, 0);
            }
            if (res.isEmpty()) {
                dormir(100);
            }
        }
        if (res.isEmpty()) {
            return err("no encontre en pantalla un elemento que diga \"" + texto + "\"; usa el nombre exacto que ves");
        }
        AccessibilityNodeInfo mejor = null;
        int puntos = -1;
        int empates = 0;
        for (AccessibilityNodeInfo n : res) {
            int pt = 0;
            if (norm(n.getText()).equals(q) || norm(n.getContentDescription()).equals(q)) {
                pt += 2;
            }
            if (n.isClickable()) {
                pt += 1;
            }
            if (pt > puntos) {
                puntos = pt;
                mejor = n;
                empates = 1;
            } else if (pt == puntos) {
                empates++;
            }
        }
        AccessibilityNodeInfo c = mejor;
        for (int i = 0; i < 6 && c != null && !c.isClickable(); i++) {
            c = c.getParent();
        }
        String aviso = empates > 1 ? " (habia " + empates + " coincidencias, toque la primera)" : "";
        if (c != null && c.isClickable() && c.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            asentar(450);
            return ok("toque hecho en \"" + texto + "\"" + aviso);
        }
        Rect r = new Rect();
        mejor.getBoundsInScreen(r);
        return toque(r.centerX(), r.centerY(), 50, false);
    }

    // ---- Acciones compuestas: se ejecutan completas aqui, sin viajes al modelo ----

    private String paqueteRaiz() {
        AccessibilityNodeInfo r = getRootInActiveWindow();
        return (r == null || r.getPackageName() == null) ? "" : r.getPackageName().toString();
    }

    private boolean esperarApp(String paq, long ms) {
        long fin = System.currentTimeMillis() + ms;
        while (System.currentTimeMillis() < fin) {
            if (paqueteRaiz().equals(paq)) {
                return true;
            }
            dormir(80);
        }
        return false;
    }

    private boolean lanzar(String paq) {
        try {
            Intent i = getPackageManager().getLaunchIntentForPackage(paq);
            if (i == null) {
                return false;
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Busca una app instalada por su nombre visible. Devuelve {paquete, nombre} o null. */
    private String[] buscarApp(String nombre) {
        String q = norm(nombre);
        if (q.isEmpty()) {
            return null;
        }
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        java.util.List<android.content.pm.ResolveInfo> lista = getPackageManager().queryIntentActivities(main, 0);
        String[] mejor = null;
        int puntos = 0;
        int largo = Integer.MAX_VALUE;
        for (android.content.pm.ResolveInfo ri : lista) {
            String etiqueta = String.valueOf(ri.loadLabel(getPackageManager()));
            String n = norm(etiqueta);
            int pt = n.equals(q) ? 2 : (n.contains(q) ? 1 : 0);
            if (pt > 0 && (pt > puntos || (pt == puntos && n.length() < largo))) {
                puntos = pt;
                largo = n.length();
                mejor = new String[]{ri.activityInfo.packageName, etiqueta};
            }
        }
        return mejor;
    }

    private String[] abrirApp(String nombre) throws Exception {
        String[] app = buscarApp(nombre);
        if (app == null) {
            return err("no encontre una app llamada \"" + nombre + "\" instalada");
        }
        if (paqueteRaiz().equals(app[0])) {
            return ok("la app " + app[1] + " ya estaba abierta");
        }
        if (lanzar(app[0]) && esperarApp(app[0], 2500)) {
            asentar(500);
            return ok("abri " + app[1]);
        }
        // Respaldo: ir a inicio y tocar el icono por su nombre
        global(GLOBAL_ACTION_HOME);
        asentar(500);
        String[] r = tocarTexto(app[1]);
        if (r[0].equals("1") && esperarApp(app[0], 2500)) {
            asentar(500);
            return ok("abri " + app[1]);
        }
        return err("no pude abrir " + app[1]);
    }

    private static boolean idTermina(AccessibilityNodeInfo n, String fin) {
        String id = n.getViewIdResourceName();
        return id != null && id.endsWith(fin);
    }

    private String pista(AccessibilityNodeInfo n) {
        if (Build.VERSION.SDK_INT >= 26 && n.getHintText() != null) {
            return norm(n.getHintText());
        }
        return "";
    }

    private void todos(AccessibilityNodeInfo n, java.util.List<AccessibilityNodeInfo> out, int prof) {
        if (n == null || prof > 40 || out.size() >= 600) {
            return;
        }
        if (n.isVisibleToUser()) {
            out.add(n);
        }
        for (int i = 0; i < n.getChildCount(); i++) {
            todos(n.getChild(i), out, prof + 1);
        }
    }

    private java.util.List<AccessibilityNodeInfo> nodosVisibles() {
        java.util.ArrayList<AccessibilityNodeInfo> l = new java.util.ArrayList<AccessibilityNodeInfo>();
        todos(getRootInActiveWindow(), l, 0);
        return l;
    }

    private static boolean esMetaAi(String t) {
        return t.contains("meta ai") || t.startsWith("preguntar") || t.startsWith("ask ")
                || t.startsWith("buscar") || t.startsWith("search");
    }

    private boolean pulsar(AccessibilityNodeInfo n) throws Exception {
        AccessibilityNodeInfo c = n;
        for (int i = 0; i < 6 && c != null && !c.isClickable(); i++) {
            c = c.getParent();
        }
        if (c != null && c.isClickable() && c.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            return true;
        }
        Rect r = new Rect();
        n.getBoundsInScreen(r);
        return toque(r.centerX(), r.centerY(), 50, false)[0].equals("1");
    }

    private AccessibilityNodeInfo campoMensaje() {
        for (AccessibilityNodeInfo n : nodosVisibles()) {
            if (!n.isEditable()) {
                continue;
            }
            String p = pista(n);
            if (idTermina(n, "/entry") || p.contains("mensaje") || p.contains("message")) {
                return n;
            }
        }
        return null;
    }

    private AccessibilityNodeInfo campoBusqueda() {
        for (AccessibilityNodeInfo n : nodosVisibles()) {
            if (!n.isEditable()) {
                continue;
            }
            String p = pista(n);
            if (idTermina(n, "/search_input") || p.contains("buscar") || p.contains("search")
                    || p.contains("meta ai")) {
                return n;
            }
        }
        return null;
    }

    /** La lupa o barra de busqueda de la lista principal de WhatsApp. */
    private AccessibilityNodeInfo entradaBusqueda() {
        for (AccessibilityNodeInfo n : nodosVisibles()) {
            if (n.isEditable()) {
                continue;
            }
            String t = norm(n.getText());
            String d = norm(n.getContentDescription());
            if (idTermina(n, "/menuitem_search") || idTermina(n, "/my_search_bar")
                    || t.contains("buscar") || d.contains("buscar") || t.equals("search") || d.equals("search")
                    || t.contains("or search") || d.contains("or search")) {
                return n;
            }
        }
        return null;
    }

    private AccessibilityNodeInfo botonEnviar() {
        for (AccessibilityNodeInfo n : nodosVisibles()) {
            if (n.isEditable()) {
                continue;
            }
            String t = norm(n.getText());
            String d = norm(n.getContentDescription());
            if (idTermina(n, "/send") || t.equals("enviar") || d.equals("enviar")
                    || t.equals("send") || d.equals("send")) {
                return n;
            }
        }
        return null;
    }

    private boolean hayTexto(String parte) {
        for (AccessibilityNodeInfo n : nodosVisibles()) {
            if (!n.isEditable() && norm(n.getText()).contains(parte)) {
                return true;
            }
        }
        return false;
    }

    /** Titulo del chat abierto: texto en la franja de arriba que contiene el nombre. */
    private boolean tituloEs(String q) {
        int alto = tam()[1];
        for (AccessibilityNodeInfo n : nodosVisibles()) {
            if (n.isEditable() || !norm(n.getText()).contains(q)) {
                continue;
            }
            Rect r = new Rect();
            n.getBoundsInScreen(r);
            if (r.top < alto * 0.22f) {
                return true;
            }
        }
        return false;
    }

    /**
     * Elige el chat o contacto cuyo nombre coincide. Exacto > empieza por el nombre. Ignora Meta AI,
     * sugerencias y el propio campo de busqueda. Si hay varios distintos, no adivina: devuelve null
     * y deja los nombres en candidatos.
     */
    private AccessibilityNodeInfo mejorCoincidencia(String q, java.util.List<String> candidatos) {
        AccessibilityNodeInfo mejor = null;
        int mejorPt = 0;
        int mejorTop = Integer.MAX_VALUE;
        java.util.HashSet<String> distintos = new java.util.HashSet<String>();
        for (AccessibilityNodeInfo n : nodosVisibles()) {
            if (n.isEditable() || n.isPassword()) {
                continue;
            }
            String t = norm(n.getText());
            if (t.isEmpty() || esMetaAi(t)) {
                continue;
            }
            int pt = t.equals(q) ? 3 : (t.startsWith(q) ? 2 : 0);
            if (pt == 0) {
                continue;
            }
            Rect r = new Rect();
            n.getBoundsInScreen(r);
            if (pt > mejorPt) {
                mejorPt = pt;
                mejor = n;
                mejorTop = r.top;
                distintos.clear();
                distintos.add(t);
                candidatos.clear();
                candidatos.add(limpiar(n.getText()));
            } else if (pt == mejorPt) {
                if (distintos.add(t)) {
                    candidatos.add(limpiar(n.getText()));
                }
                if (r.top < mejorTop) {
                    mejor = n;
                    mejorTop = r.top;
                }
            }
        }
        if (mejorPt == 2 && distintos.size() > 1) {
            return null;
        }
        return mejor;
    }

    private String[] whatsappEnviar(String contacto, String mensaje) throws Exception {
        final String q = norm(contacto);
        if (q.isEmpty() || mensaje == null || mensaje.trim().isEmpty()) {
            return err("faltan el contacto o el mensaje");
        }
        String paq = null;
        for (String p : WA_PAQ) {
            if (getPackageManager().getLaunchIntentForPackage(p) != null) {
                paq = p;
                break;
            }
        }
        if (paq == null) {
            return err("WhatsApp no esta instalado en este celular");
        }

        // 1) Abrir WhatsApp
        if (!paqueteRaiz().equals(paq)) {
            if (!(lanzar(paq) && esperarApp(paq, 3000))) {
                global(GLOBAL_ACTION_HOME);
                asentar(500);
                String[] t = tocarTexto("WhatsApp");
                if (!t[0].equals("1") || !esperarApp(paq, 3000)) {
                    return err("no pude abrir WhatsApp");
                }
            }
            asentar(600);
        }

        // 2) Llegar al chat. Si ya estamos en el correcto, se salta todo.
        boolean enChat = campoMensaje() != null && tituloEs(q);
        if (!enChat) {
            for (int i = 0; i < 4 && (campoMensaje() != null || campoBusqueda() != null); i++) {
                global(GLOBAL_ACTION_BACK);
                asentar(500);
            }
            java.util.ArrayList<String> cand = new java.util.ArrayList<String>();
            // Atajo: si el chat ya sale en la lista principal con el nombre exacto, se toca directo
            AccessibilityNodeInfo fila = null;
            for (AccessibilityNodeInfo n : nodosVisibles()) {
                if (!n.isEditable() && norm(n.getText()).equals(q)) {
                    fila = n;
                    break;
                }
            }
            if (fila == null) {
                AccessibilityNodeInfo entrada = null;
                for (long fin = System.currentTimeMillis() + 2500; entrada == null && System.currentTimeMillis() < fin; ) {
                    entrada = entradaBusqueda();
                    if (entrada == null) {
                        dormir(80);
                    }
                }
                if (entrada == null || !pulsar(entrada)) {
                    return err("no encontre la busqueda de WhatsApp");
                }
                AccessibilityNodeInfo campo = null;
                for (long fin = System.currentTimeMillis() + 2500; campo == null && System.currentTimeMillis() < fin; ) {
                    campo = campoBusqueda();
                    if (campo == null) {
                        dormir(80);
                    }
                }
                if (campo == null) {
                    return err("se abrio la busqueda pero no pude escribir en ella");
                }
                Bundle b = new Bundle();
                b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, contacto.trim());
                if (!campo.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b)) {
                    return err("WhatsApp no dejo escribir el nombre en la busqueda");
                }
                for (long fin = System.currentTimeMillis() + 3000; fila == null && System.currentTimeMillis() < fin; ) {
                    asentar(400);
                    fila = mejorCoincidencia(q, cand);
                    if (fila == null && cand.size() > 1) {
                        break;
                    }
                }
                if (fila == null) {
                    return err(cand.size() > 1
                            ? "hay varios contactos que empiezan por \"" + contacto + "\": " + cand
                                    + ". Pregunta al usuario cual es."
                            : "no encontre un chat o contacto llamado \"" + contacto + "\"");
                }
            }
            if (!pulsar(fila)) {
                return err("no pude abrir el chat de " + contacto);
            }
            long fin = System.currentTimeMillis() + 3000;
            while (campoMensaje() == null && System.currentTimeMillis() < fin) {
                dormir(80);
            }
            asentar(400);
            if (campoMensaje() == null) {
                return err("toque el resultado pero no se abrio el chat de " + contacto);
            }
            if (!tituloEs(q)) {
                return err("se abrio un chat pero no es el de \"" + contacto + "\"; no envie nada");
            }
        }

        // 3) Escribir y enviar
        AccessibilityNodeInfo campo = campoMensaje();
        if (campo == null) {
            return err("no encontre el campo de mensaje");
        }
        Bundle b = new Bundle();
        b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, mensaje);
        if (!campo.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b)) {
            return err("WhatsApp no dejo escribir el mensaje");
        }
        AccessibilityNodeInfo enviar = null;
        for (long fin = System.currentTimeMillis() + 2500; enviar == null && System.currentTimeMillis() < fin; ) {
            enviar = botonEnviar();
            if (enviar == null) {
                dormir(80);
            }
        }
        if (enviar == null || !pulsar(enviar)) {
            return err("escribi el mensaje pero no encontre el boton de enviar");
        }

        // 4) Comprobar que aparecio en el chat
        String n = norm(mensaje);
        String parte = n.length() > 25 ? n.substring(0, 25) : n;
        for (long fin = System.currentTimeMillis() + 2500; System.currentTimeMillis() < fin; ) {
            asentar(300);
            if (hayTexto(parte)) {
                return ok("mensaje enviado a " + contacto + " y confirmado en el chat");
            }
        }
        return err("pulse enviar pero no pude confirmar que el mensaje aparezca en el chat");
    }

    private String[] abrirAjustes(String que) {
        String q = norm(que);
        String a = "android.settings.SETTINGS";
        if (q.contains("wifi") || q.contains("wi-fi")) {
            a = "android.settings.WIFI_SETTINGS";
        } else if (q.contains("bluetooth")) {
            a = "android.settings.BLUETOOTH_SETTINGS";
        } else if (q.contains("avion") || q.contains("airplane")) {
            a = "android.settings.AIRPLANE_MODE_SETTINGS";
        } else if (q.contains("datos") || q.contains("movil")) {
            a = "android.settings.DATA_ROAMING_SETTINGS";
        } else if (q.contains("pantalla") || q.contains("brillo")) {
            a = "android.settings.DISPLAY_SETTINGS";
        } else if (q.contains("sonido") || q.contains("volumen")) {
            a = "android.settings.SOUND_SETTINGS";
        } else if (q.contains("bateria")) {
            a = "android.settings.BATTERY_SAVER_SETTINGS";
        } else if (q.contains("ubicacion") || q.contains("gps")) {
            a = "android.settings.LOCATION_SOURCE_SETTINGS";
        } else if (q.contains("accesibilidad")) {
            a = "android.settings.ACCESSIBILITY_SETTINGS";
        } else if (q.contains("app") || q.contains("aplicacion")) {
            a = "android.settings.APPLICATION_SETTINGS";
        } else if (q.contains("nfc")) {
            a = "android.settings.NFC_SETTINGS";
        } else if (q.contains("fecha") || q.contains("hora")) {
            a = "android.settings.DATE_SETTINGS";
        } else if (q.contains("idioma")) {
            a = "android.settings.LOCALE_SETTINGS";
        }
        try {
            Intent i = new Intent(a);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            return err("no pude abrir esos ajustes: " + e.getMessage());
        }
        asentar(800);
        return ok("abri los ajustes" + (q.isEmpty() ? "" : " de " + que));
    }

    private String[] abrirUrl(String url) {
        String u = url == null ? "" : url.trim();
        if (!(u.startsWith("https://") || u.startsWith("http://"))) {
            return err("solo puedo abrir enlaces http o https");
        }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(u));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            return err("no pude abrir el enlace: " + e.getMessage());
        }
        asentar(1200);
        return ok("abri el enlace " + (u.length() > 60 ? u.substring(0, 60) : u));
    }

    /** Varios pasos seguidos en una sola orden: se detiene en el primero que falle. */
    private String[] secuencia(org.json.JSONArray pasos) throws Exception {
        if (pasos == null || pasos.length() == 0) {
            return err("la secuencia esta vacia");
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < pasos.length(); i++) {
            if (cancelada) {
                return err("cancelado por el usuario antes del paso " + (i + 1) + "\n" + sb);
            }
            JSONObject p = pasos.getJSONObject(i);
            String t = p.optString("accion");
            String[] r = ejecutar(t, p);
            sb.append(i + 1).append(". ").append(t).append(": ").append(r[1]).append('\n');
            if (!r[0].equals("1")) {
                return err("se detuvo en el paso " + (i + 1) + " de " + pasos.length() + "\n" + sb);
            }
            if (i < pasos.length() - 1) {
                asentar(300);
            }
        }
        return ok(pasos.length() + " pasos hechos\n" + sb);
    }

    // ---- Leer la pantalla: lo tocable siempre entra; del texto sobrante se omite el de arriba ----

    private String arbol() {
        mostrarAviso("Jarvis est\u00e1 leyendo tu pantalla...");
        AccessibilityNodeInfo raiz = getRootInActiveWindow();
        if (raiz == null) {
            return "(no pude leer la pantalla; puede ser una app protegida)";
        }
        int[] t = tam();
        java.util.ArrayList<String> lineas = new java.util.ArrayList<String>();
        java.util.ArrayList<Boolean> vivas = new java.util.ArrayList<Boolean>();
        recorrer(raiz, lineas, vivas, 0);
        int interactivas = 0;
        for (int i = 0; i < vivas.size(); i++) {
            if (vivas.get(i)) {
                interactivas++;
            }
        }
        int textos = lineas.size() - interactivas;
        int saltar = Math.max(0, textos - Math.max(0, MAX_NODOS - interactivas));
        while (true) {
            int total = 0;
            int ss = saltar;
            for (int i = 0; i < lineas.size(); i++) {
                if (!vivas.get(i) && ss > 0) {
                    ss--;
                    continue;
                }
                total += lineas.get(i).length();
            }
            if (total <= 5200 || saltar >= textos) {
                break;
            }
            saltar += 5;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("App: ").append(raiz.getPackageName()).append(" | pantalla ")
                .append(t[0]).append("x").append(t[1]).append('\n');
        int omitir = saltar;
        for (int i = 0; i < lineas.size(); i++) {
            if (!vivas.get(i) && omitir > 0) {
                omitir--;
                continue;
            }
            sb.append(lineas.get(i));
        }
        if (saltar > 0) {
            sb.append("(se omitio texto de arriba; haz scroll si buscas algo mas)\n");
        }
        return sb.toString();
    }

    private void recorrer(AccessibilityNodeInfo n, java.util.List<String> lineas, java.util.List<Boolean> vivas, int prof) {
        if (n == null || lineas.size() >= 400 || prof > 40) {
            return;
        }
        if (n.isVisibleToUser()) {
            String texto = n.isPassword() ? "[contrasena oculta]" : limpiar(n.getText());
            String desc = limpiar(n.getContentDescription());
            if (!texto.isEmpty() || !desc.isEmpty() || n.isClickable() || n.isEditable()) {
                Rect r = new Rect();
                n.getBoundsInScreen(r);
                String clase = n.getClassName() == null ? "" : n.getClassName().toString();
                clase = clase.substring(clase.lastIndexOf('.') + 1);
                StringBuilder sb = new StringBuilder();
                sb.append("- ").append(clase);
                if (!texto.isEmpty()) {
                    sb.append(" \"").append(texto).append('"');
                }
                if (!desc.isEmpty() && !desc.equals(texto)) {
                    sb.append(" {").append(desc).append('}');
                }
                sb.append(" (").append(r.centerX()).append(',').append(r.centerY()).append(')');
                if (n.isEditable()) {
                    sb.append(" [campo]");
                } else if (n.isClickable()) {
                    sb.append(" [tocable]");
                }
                sb.append('\n');
                lineas.add(sb.toString());
                vivas.add(n.isClickable() || n.isEditable());
            }
        }
        for (int i = 0; i < n.getChildCount(); i++) {
            recorrer(n.getChild(i), lineas, vivas, prof + 1);
        }
    }
}
