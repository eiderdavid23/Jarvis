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

/**
 * Manos de Jarvis: servicio de accesibilidad. Pregunta al servidor por ordenes
 * (ver pantalla, tocar, escribir...), pide confirmacion al usuario y las ejecuta.
 */
public class ManosServicio extends AccessibilityService {
    static volatile ManosServicio instancia;
    private static final int MAX_NODOS = 110;
    private volatile long ultimaOrden = 0;
    private final Handler principal = new Handler(Looper.getMainLooper());
    private volatile int generacion = 0;

    private static class SinPermiso extends Exception {
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
    }

    @Override
    public void onInterrupt() {
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instancia = this;
        arrancar();
    }

    @Override
    public boolean onUnbind(Intent intent) {
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
                    dormir(System.currentTimeMillis() - ultimaOrden < 90000 ? 400 : 2000);
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
        boolean ok = false;
        boolean rechazada = false;
        String texto = "";
        try {
            boolean pide = !tipo.equals("capturar") && !tipo.equals("esperar");
            if (pide && !confirmar(describir(tipo, args))) {
                rechazada = true;
                texto = "El usuario rechazo la accion.";
            } else {
                String[] r = ejecutar(tipo, args);
                ok = r[0].equals("1");
                texto = r[1];
                if (!tipo.equals("capturar") && !tipo.equals("esperar")) {
                    dormir(600);
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
            http("POST", base + "/manos/d/resultado", token, cuerpo);
        } catch (Exception ignorada) {
        }
    }

    private String[] ok(String t) {
        return new String[]{"1", t};
    }

    private String[] err(String t) {
        return new String[]{"0", t};
    }

    private int[] tam() {
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
                int x = a.optInt("x");
                int y = a.optInt("y");
                String el = elementoEn(x, y);
                String verbo = tipo.equals("doble_clic") ? "Tocar dos veces" : (tipo.equals("clic") ? "Tocar" : "Mantener pulsado");
                return verbo + (el.isEmpty() ? " la pantalla" : " \"" + el + "\"") + " (" + x + ", " + y + ")";
            }
            case "tocar_texto":
                return "Tocar el elemento \"" + limpiar(a.optString("texto")) + "\"";
            case "escribir":
                return "Escribir: \"" + limpiar(a.optString("texto")) + "\"";
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
            case "capturar":
                avisar("Jarvis esta leyendo la pantalla");
                return ok(arbol());
            case "clic":
                return toque(a.getInt("x"), a.getInt("y"), 50, false);
            case "doble_clic":
                return toque(a.getInt("x"), a.getInt("y"), 50, true);
            case "clic_derecho":
                return toque(a.getInt("x"), a.getInt("y"), 700, false);
            case "escribir":
                return escribir(a.optString("texto"));
            case "tecla":
                return tecla(a.optString("tecla"));
            case "scroll":
                return scroll(a.optString("direccion"), a.optInt("cantidad", 3));
            case "tocar_texto":
                return tocarTexto(a.optString("texto"));
            case "esperar":
                dormir(Math.max(1, Math.min(10, a.optInt("segundos", 2))) * 1000L);
                return ok("espera lista");
            default:
                return err("esa accion no existe en el celular: " + tipo);
        }
    }

    private boolean gesto(final GestureDescription g) throws InterruptedException {
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
        l.await(5, TimeUnit.SECONDS);
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
        dormir(250);
        return ok("toque hecho en (" + x + "," + y + ")");
    }

    private String[] escribir(String texto) {
        AccessibilityNodeInfo n = findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (n == null || !n.isEditable()) {
            return err("no hay un campo de texto activo; toca primero el campo y vuelve a intentar");
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
            dormir(250);
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
        AccessibilityNodeInfo raiz = getRootInActiveWindow();
        if (raiz == null) {
            return err("no pude leer la pantalla");
        }
        java.util.ArrayList<AccessibilityNodeInfo> res = new java.util.ArrayList<AccessibilityNodeInfo>();
        hallar(raiz, q, res, 0);
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
            dormir(250);
            return ok("toque hecho en \"" + texto + "\"" + aviso);
        }
        Rect r = new Rect();
        mejor.getBoundsInScreen(r);
        return toque(r.centerX(), r.centerY(), 50, false);
    }

    // ---- Leer la pantalla: lo tocable siempre entra; del texto sobrante se omite el de arriba ----

    private String arbol() {
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
