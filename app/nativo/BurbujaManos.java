package com.david.jarvis;

import android.Manifest;
import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.text.InputType;
import android.text.method.ScrollingMovementMethod;
import android.view.ContextThemeWrapper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Burbuja flotante de Jarvis. Vive dentro del servicio de accesibilidad (no pide el permiso
 * "Mostrar sobre otras apps"): aparece cuando sales de Jarvis; al tocarla se abre una barra
 * arriba para escribirle o hablarle sin volver a la app.
 */
class BurbujaManos {
    private static final int CIAN = Color.parseColor("#00E5FF");
    private static final int VERDE = Color.parseColor("#3DDC84");
    private static final int ROJO = Color.parseColor("#FF5C5C");
    private static final int FONDO = Color.parseColor("#F2061018");
    private static final int TEXTO = Color.parseColor("#E6F7FF");
    private static final int SUAVE = Color.parseColor("#8FB3BF");
    private static final int FLAGS_PLEGADA = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
    private static final int FLAGS_ABIERTA = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;

    private final AccessibilityService srv;
    private final Context cx;
    private final WindowManager wm;
    private final SharedPreferences prefs;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final float d;
    private final BurbujaVoz voz;

    private FrameLayout raiz;
    private LinearLayout pildora;
    private BurbujaUI.Ondas ondasMini;
    private BurbujaUI.Ondas ondasPanel;
    private BurbujaUI.Logo logoMini;
    private TextView estadoTv;
    private BurbujaUI.Icono micBtn;
    private LinearLayout panel;
    private EditText campo;
    private WindowManager.LayoutParams lp;
    private SpeechRecognizer sr;
    private SpeechRecognizer srp;
    private boolean viaPalabra;
    private int fallosPalabra;
    private final Runnable reinicioPalabra = this::sincronizarPalabra;
    private volatile long ultimaPalabra = 0;
    /** Si la escucha de la palabra lleva 60 s sin dar señales, la reinicia. */
    private final Runnable vigiaPalabra = new Runnable() {
        @Override
        public void run() {
            if (srp == null) {
                return;
            }
            if (System.currentTimeMillis() - ultimaPalabra > 60000) {
                detenerPalabra();
                restaurarSonido();
                sincronizarPalabra();
            } else {
                ui.postDelayed(this, 20000);
            }
        }
    };
    private final Runnable cierreAuto = this::cierreAutomatico;
    private boolean cerrarAlHablar;
    private static final int[] CANALES = {AudioManager.STREAM_NOTIFICATION, AudioManager.STREAM_SYSTEM,
            AudioManager.STREAM_MUSIC};
    private final boolean[] mudos = new boolean[3];
    private AudioManager audio;
    private final Runnable soltarBip = this::restaurarSonido;

    private boolean puesta;
    private boolean abierta;
    private boolean pensando;
    private boolean escuchando;
    private boolean nuevo;
    private TextView detenerBtn;
    private volatile HttpURLConnection conexion;
    private int peticion;
    private int bx;
    private int by;
    private String ultimo = "";

    BurbujaManos(AccessibilityService srv) {
        this.srv = srv;
        this.cx = new ContextThemeWrapper(srv, android.R.style.Theme_DeviceDefault);
        this.wm = (WindowManager) srv.getSystemService(Context.WINDOW_SERVICE);
        this.prefs = srv.getSharedPreferences("manos", Context.MODE_PRIVATE);
        this.d = srv.getResources().getDisplayMetrics().density;
        this.voz = new BurbujaVoz(srv, this::vozTermino);
        int ancho = srv.getResources().getDisplayMetrics().widthPixels;
        bx = 0;
        by = prefs.getInt("by2", (int) (6 * d));
    }

    // ---- Mostrar y ocultar ----------------------------------------------------

    /** Pone o quita la burbuja: activada, celular vinculado, con sesion y Jarvis fuera de pantalla. */
    void actualizar() {
        ui.post(() -> {
            boolean debe = prefs.getBoolean("burbuja", true)
                    && !prefs.getString("token", "").isEmpty()
                    && !prefs.getString("acceso", "").isEmpty()
                    && !ManosServicio.jarvisAdelante;
            try {
                if (debe && !puesta) {
                    poner();
                } else if (!debe && puesta) {
                    sacar();
                }
            } catch (Exception ignorada) {
            }
            sincronizarPalabra();
        });
    }

    void quitar() {
        ui.post(() -> {
            if (puesta) {
                sacar();
            }
        });
    }

    /** Recoge la barra y deja solo la burbuja (por ejemplo cuando sale una tarjeta de confirmacion). */
    void plegar() {
        ui.post(() -> {
            if (puesta && abierta) {
                cerrarPanel();
            }
        });
    }

    private void poner() {
        crearVistas();
        lp = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, FLAGS_PLEGADA, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.x = 0;
        lp.y = by;
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING;
        abierta = false;
        mostrarPlegada();
        wm.addView(raiz, lp);
        puesta = true;
    }

    private void sacar() {
        voz.parar();
        detenerPalabra();
        restaurarSonido();
        detenerVoz();
        try {
            wm.removeView(raiz);
        } catch (Exception ignorada) {
        }
        puesta = false;
        abierta = false;
    }

    // ---- La burbuja (pildora arrastrable, como la isla de la musica) ------------

    private static final int PILDORA_W = 136;
    private static final int PILDORA_H = 30;

    private BurbujaUI.Icono icono(int tipo, int color, int padDp, int fondo) {
        BurbujaUI.Icono ic = new BurbujaUI.Icono(cx, tipo, color);
        int pd = (int) (padDp * d);
        ic.setPadding(pd, pd, pd, pd);
        if (fondo != 0) {
            GradientDrawable g = new GradientDrawable();
            g.setShape(GradientDrawable.OVAL);
            g.setColor(fondo);
            ic.setBackground(g);
        }
        return ic;
    }

    private LinearLayout.LayoutParams cuadro(int dp, int izqDp) {
        LinearLayout.LayoutParams l = new LinearLayout.LayoutParams((int) (dp * d), (int) (dp * d));
        l.leftMargin = (int) (izqDp * d);
        return l;
    }

    private void crearVistas() {
        raiz = new FrameLayout(cx) {
            @Override
            public boolean dispatchKeyEvent(KeyEvent e) {
                if (abierta && e.getKeyCode() == KeyEvent.KEYCODE_BACK) {
                    if (e.getAction() == KeyEvent.ACTION_UP) {
                        cerrarPanel();
                    }
                    return true;
                }
                return super.dispatchKeyEvent(e);
            }
        };
        pildora = new LinearLayout(cx);
        pildora.setOrientation(LinearLayout.HORIZONTAL);
        pildora.setGravity(Gravity.CENTER_VERTICAL);
        pildora.setPadding((int) (7 * d), 0, (int) (8 * d), 0);
        ondasMini = new BurbujaUI.Ondas(cx, 6);
        pildora.addView(ondasMini, new LinearLayout.LayoutParams((int) (28 * d), (int) (12 * d)));
        pildora.addView(new View(cx), new LinearLayout.LayoutParams(0, 1, 1f));
        logoMini = new BurbujaUI.Logo(cx);
        pildora.addView(logoMini, cuadro(26, 0));
        raiz.addView(pildora, new FrameLayout.LayoutParams((int) (PILDORA_W * d), (int) (PILDORA_H * d)));
        pildora.setOnTouchListener(new View.OnTouchListener() {
            private float ox;
            private float oy;
            private int x0;
            private int y0;
            private boolean arrastro;

            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN: {
                        ox = e.getRawX();
                        oy = e.getRawY();
                        x0 = lp.x;
                        y0 = lp.y;
                        arrastro = false;
                        return true;
                    }
                    case MotionEvent.ACTION_MOVE: {
                        float dx = e.getRawX() - ox;
                        float dy = e.getRawY() - oy;
                        if (Math.abs(dx) > 10 * d || Math.abs(dy) > 10 * d) {
                            arrastro = true;
                        }
                        if (arrastro) {
                            lp.x = x0 + (int) dx;
                            lp.y = y0 + (int) dy;
                            try {
                                wm.updateViewLayout(raiz, lp);
                            } catch (Exception ignorada) {
                            }
                        }
                        return true;
                    }
                    case MotionEvent.ACTION_UP: {
                        if (arrastro) {
                            soltar();
                        } else {
                            abrir();
                        }
                        return true;
                    }
                    default:
                        return true;
                }
            }
        });
        crearPanel();
    }

    /** Al soltar la burbuja se pega al borde izquierdo o derecho y recuerda su sitio. */
    private void soltar() {
        int ancho = srv.getResources().getDisplayMetrics().widthPixels;
        int alto = srv.getResources().getDisplayMetrics().heightPixels;
        lp.x = 0;
        lp.y = Math.max(0, Math.min(lp.y, alto / 3));
        bx = 0;
        by = lp.y;
        prefs.edit().putInt("by2", by).apply();
        try {
            wm.updateViewLayout(raiz, lp);
        } catch (Exception ignorada) {
        }
    }

    /** Colores de la pildora: cian normal, verde con respuesta nueva; las ondas corren mas rapido mientras Jarvis piensa. */
    private void estiloCirculo() {
        int borde = nuevo ? VERDE : CIAN;
        GradientDrawable f = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.parseColor("#F2081521"), Color.parseColor("#F2050A12")});
        f.setCornerRadius(PILDORA_H * d / 2f);
        f.setStroke((int) (1.2f * d), (borde & 0x00FFFFFF) | 0x99000000);
        pildora.setBackground(f);
        ondasMini.color(borde);
        ondasMini.modo(pensando ? 1 : (nuevo ? 3 : 0));
        logoMini.borde(nuevo ? VERDE : 0);
        pildora.setAlpha(pensando ? 0.85f : 1f);
    }

    // ---- La barra de arriba (escribir, hablar, ver la respuesta) ----------------

    private void crearPanel() {
        panel = new LinearLayout(cx);
        panel.setOrientation(LinearLayout.VERTICAL);
        int p = (int) (14 * d);
        panel.setPadding(p, p, p, p);
        GradientDrawable f = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{Color.parseColor("#F5101C2B"), Color.parseColor("#F5060B14")});
        f.setCornerRadius(28 * d);
        f.setStroke((int) (1 * d), Color.parseColor("#3300E5FF"));
        panel.setBackground(f);

        LinearLayout cab = new LinearLayout(cx);
        cab.setOrientation(LinearLayout.HORIZONTAL);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        cab.addView(new BurbujaUI.Logo(cx), cuadro(32, 0));
        TextView titulo = new TextView(cx);
        titulo.setText("Jarvis");
        titulo.setTextColor(TEXTO);
        titulo.setTextSize(18);
        titulo.setTypeface(Typeface.SERIF, Typeface.BOLD);
        LinearLayout.LayoutParams lt = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lt.leftMargin = (int) (10 * d);
        cab.addView(titulo, lt);
        ondasPanel = new BurbujaUI.Ondas(cx, 7);
        LinearLayout.LayoutParams lo = new LinearLayout.LayoutParams((int) (52 * d), (int) (16 * d));
        lo.leftMargin = (int) (12 * d);
        cab.addView(ondasPanel, lo);
        cab.addView(new View(cx), new LinearLayout.LayoutParams(0, 1, 1f));
        BurbujaUI.Icono abrirApp = icono(BurbujaUI.Icono.ABRIR, SUAVE, 9, 0);
        abrirApp.setOnClickListener(v -> abrirJarvis());
        BurbujaUI.Icono plegar = icono(BurbujaUI.Icono.PLEGAR, SUAVE, 8, 0);
        plegar.setOnClickListener(v -> cerrarPanel());
        cab.addView(abrirApp, cuadro(34, 0));
        cab.addView(plegar, cuadro(34, 2));
        panel.addView(cab);

        estadoTv = new TextView(cx);
        estadoTv.setTextColor(TEXTO);
        estadoTv.setTextSize(14.5f);
        estadoTv.setLineSpacing(0f, 1.15f);
        estadoTv.setMaxLines(9);
        estadoTv.setMovementMethod(ScrollingMovementMethod.getInstance());
        estadoTv.setPadding((int) (2 * d), (int) (10 * d), (int) (2 * d), (int) (2 * d));
        estadoTv.setVisibility(View.GONE);
        panel.addView(estadoTv);

        detenerBtn = new TextView(cx);
        detenerBtn.setText("\u25A0  Detener");
        detenerBtn.setTextColor(ROJO);
        detenerBtn.setTextSize(15);
        detenerBtn.setTypeface(Typeface.DEFAULT_BOLD);
        detenerBtn.setGravity(Gravity.CENTER);
        GradientDrawable fd = new GradientDrawable();
        fd.setColor(Color.parseColor("#1AFF5C5C"));
        fd.setCornerRadius(22 * d);
        fd.setStroke((int) (1.2f * d), ROJO);
        detenerBtn.setBackground(fd);
        detenerBtn.setPadding(0, (int) (11 * d), 0, (int) (11 * d));
        detenerBtn.setOnClickListener(v -> detener());
        LinearLayout.LayoutParams ld = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        ld.topMargin = (int) (12 * d);
        detenerBtn.setVisibility(View.GONE);
        panel.addView(detenerBtn, ld);

        LinearLayout fila = new LinearLayout(cx);
        fila.setOrientation(LinearLayout.HORIZONTAL);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams lf = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lf.topMargin = (int) (12 * d);
        campo = new EditText(cx);
        campo.setHint("Escr\u00edbele a Jarvis\u2026");
        campo.setHintTextColor(SUAVE);
        campo.setTextColor(TEXTO);
        campo.setTextSize(15);
        campo.setRawInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        campo.setImeOptions(EditorInfo.IME_ACTION_SEND);
        campo.setMaxLines(3);
        campo.setHorizontallyScrolling(false);
        GradientDrawable fc = new GradientDrawable();
        fc.setColor(Color.parseColor("#14212E"));
        fc.setCornerRadius(22 * d);
        fc.setStroke((int) (1 * d), Color.parseColor("#26FFFFFF"));
        campo.setBackground(fc);
        campo.setPadding((int) (16 * d), (int) (10 * d), (int) (16 * d), (int) (10 * d));
        campo.setOnEditorActionListener((v, acc, ev) -> {
            if (acc == EditorInfo.IME_ACTION_SEND) {
                enviar();
                return true;
            }
            return false;
        });
        micBtn = icono(BurbujaUI.Icono.MIC, TEXTO, 10, Color.parseColor("#1A2B36"));
        micBtn.setOnClickListener(v -> escuchar());
        BurbujaUI.Icono enviarBtn = icono(BurbujaUI.Icono.ENVIAR, Color.parseColor("#04121A"), 11, CIAN);
        enviarBtn.setOnClickListener(v -> enviar());
        fila.addView(campo, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        fila.addView(micBtn, cuadro(42, 8));
        fila.addView(enviarBtn, cuadro(42, 8));
        panel.addView(fila, lf);

        panel.setVisibility(View.GONE);
        raiz.addView(panel, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));
    }

    private void mostrarPlegada() {
        panel.setVisibility(View.GONE);
        pildora.setVisibility(View.VISIBLE);
        estiloCirculo();
        pildora.setScaleX(0.7f);
        pildora.setScaleY(0.7f);
        pildora.animate().scaleX(1f).scaleY(1f).setDuration(170)
                .setInterpolator(new android.view.animation.DecelerateInterpolator()).start();
    }

    private void mostrarPanel() {
        pildora.setVisibility(View.GONE);
        panel.setVisibility(View.VISIBLE);
        if (ultimo.isEmpty()) {
            estadoTv.setVisibility(View.GONE);
        } else {
            estadoTv.setText(ultimo);
            estadoTv.scrollTo(0, 0);
            estadoTv.setVisibility(View.VISIBLE);
        }
        actualizarTrabajo();
        panel.setPivotX(srv.getResources().getDisplayMetrics().widthPixels * 0.47f);
        panel.setPivotY(0f);
        panel.setAlpha(0f);
        panel.setScaleX(0.8f);
        panel.setScaleY(0.55f);
        panel.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(230)
                .setInterpolator(new android.view.animation.DecelerateInterpolator()).start();
    }

    private void abrir() {
        abierta = true;
        nuevo = false;
        mostrarPanel();
        aplicar();
    }

    private void cerrarPanel() {
        cerrarAlHablar = false;
        detenerVoz();
        ocultarTeclado();
        abierta = false;
        mostrarPlegada();
        aplicar();
    }

    /** Barra abierta: ancha, arriba y con foco (para el teclado). Plegada: circulo que no roba foco. */
    private void aplicar() {
        int ancho = srv.getResources().getDisplayMetrics().widthPixels;
        if (abierta) {
            lp.width = (int) (ancho * 0.94f);
            lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            lp.x = 0;
            lp.y = (int) (36 * d);
            lp.flags = FLAGS_ABIERTA;
        } else {
            lp.width = WindowManager.LayoutParams.WRAP_CONTENT;
            lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            lp.x = 0;
            lp.y = by;
            lp.flags = FLAGS_PLEGADA;
        }
        try {
            wm.updateViewLayout(raiz, lp);
        } catch (Exception ignorada) {
        }
    }

    private void ocultarTeclado() {
        try {
            InputMethodManager m = (InputMethodManager) srv.getSystemService(Context.INPUT_METHOD_SERVICE);
            if (m != null && campo != null) {
                m.hideSoftInputFromWindow(campo.getWindowToken(), 0);
            }
        } catch (Exception ignorada) {
        }
    }

    private void abrirJarvis() {
        try {
            Intent i = srv.getPackageManager().getLaunchIntentForPackage(srv.getPackageName());
            if (i != null) {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                srv.startActivity(i);
            }
        } catch (Exception ignorada) {
        }
    }

    // ---- Hablar con Jarvis ------------------------------------------------------

    private void mostrarTexto(String t) {
        ultimo = t;
        if (puesta && abierta && estadoTv != null) {
            estadoTv.setText(t);
            estadoTv.scrollTo(0, 0);
            estadoTv.setVisibility(View.VISIBLE);
        }
    }

    /** Con Jarvis trabajando, la barra muestra el boton Detener; si no, vuelve a escribir normal. */
    private void actualizarTrabajo() {
        if (detenerBtn == null || campo == null) {
            return;
        }
        detenerBtn.setVisibility(pensando ? View.VISIBLE : View.GONE);
        campo.setEnabled(!pensando);
        campo.setAlpha(pensando ? 0.5f : 1f);
        if (ondasPanel != null && !escuchando) {
            ondasPanel.modo(pensando ? 1 : 0);
        }
        if (pensando && abierta && ultimo.isEmpty() && estadoTv != null) {
            estadoTv.setText("Jarvis est\u00e1 trabajando\u2026");
            estadoTv.setVisibility(View.VISIBLE);
        }
    }

    /** Boton Detener: corta la tarea en curso (servidor y celular) y deja a Jarvis listo para otra orden. */
    private void detener() {
        if (!pensando) {
            return;
        }
        peticion++;
        pensando = false;
        viaPalabra = false;
        voz.parar();
        final HttpURLConnection actual = conexion;
        conexion = null;
        final String base = prefs.getString("url", "");
        final String acceso = prefs.getString("acceso", "");
        new Thread(() -> {
            try {
                if (actual != null) {
                    actual.disconnect();
                }
            } catch (Exception ignorada) {
            }
            try {
                HttpURLConnection k = (HttpURLConnection) new URL(base + "/manos/cancelar").openConnection();
                try {
                    k.setRequestMethod("POST");
                    k.setConnectTimeout(8000);
                    k.setReadTimeout(8000);
                    k.setDoOutput(true);
                    k.setRequestProperty("Authorization", "Bearer " + acceso);
                    k.getOutputStream().close();
                    k.getResponseCode();
                } finally {
                    k.disconnect();
                }
            } catch (Exception ignorada) {
            }
        }, "burbuja-detener").start();
        nuevo = false;
        ultimo = "Cancelado, se\u00f1or.";
        if (puesta) {
            estiloCirculo();
            mostrarTexto(ultimo);
            actualizarTrabajo();
        }
        sincronizarPalabra();
    }

    private void enviar() {
        final String t = campo.getText().toString().trim();
        if (t.isEmpty() || pensando) {
            return;
        }
        campo.setText("");
        voz.parar();
        pensando = true;
        ultimo = "";
        cerrarPanel();
        final int mi = ++peticion;
        new Thread(() -> llamar(t, mi), "burbuja-chat").start();
    }

    /** Manda el mensaje a /chat con la sesion que le paso la app (el servidor usa tus llaves de la cuenta). */
    private static final Pattern ACCION_ABRIR = Pattern.compile("\\[ACCION:abrir:(.*?)\\]");

    private void llamar(String mensaje, final int mi) {
        String texto = "";
        final ArrayList<String> enlaces = new ArrayList<>();
        final JSONArray[] ordenes = new JSONArray[1];
        try {
            String base = prefs.getString("url", "");
            String acceso = prefs.getString("acceso", "");
            JSONObject b = new JSONObject();
            b.put("mensaje", mensaje);
            b.put("zona_horaria", TimeZone.getDefault().getID());
            String cid = prefs.getString("chat_id", "");
            if (!cid.isEmpty()) {
                b.put("chat_id", cid);
            }
            HttpURLConnection c = (HttpURLConnection) new URL(base + "/chat").openConnection();
            conexion = c;
            try {
                c.setRequestMethod("POST");
                c.setConnectTimeout(10000);
                c.setReadTimeout(120000);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                c.setRequestProperty("Authorization", "Bearer " + acceso);
                c.setRequestProperty("X-Herramientas-Off", prefs.getString("herr_off", ""));
                OutputStream o = c.getOutputStream();
                o.write(b.toString().getBytes(StandardCharsets.UTF_8));
                o.close();
                int cod = c.getResponseCode();
                String cuerpo = leer(cod >= 400 ? c.getErrorStream() : c.getInputStream());
                if (cod == 401) {
                    texto = "Tu sesi\u00f3n caduc\u00f3. Abre Jarvis un momento y vuelve a intentarlo.";
                } else {
                    JSONObject j = new JSONObject(cuerpo);
                    ordenes[0] = j.optJSONArray("comandos");
                    JSONArray ua = j.optJSONArray("urls_abrir");
                    for (int k = 0; ua != null && k < ua.length(); k++) {
                        String u = ua.optString(k, "").trim();
                        if (!u.isEmpty()) {
                            enlaces.add(u);
                        }
                    }
                    Matcher ma = ACCION_ABRIR.matcher(j.optString("respuesta", ""));
                    while (ma.find()) {
                        enlaces.add(ma.group(1).trim());
                    }
                    texto = limpiar(j.optString("respuesta", ""));
                    String nuevoId = j.optString("chat_id", "");
                    if (cod < 400 && !nuevoId.isEmpty()) {
                        prefs.edit().putString("chat_id", nuevoId).apply();
                    }
                    if (texto.isEmpty()) {
                        texto = "No recib\u00ed respuesta (c\u00f3digo " + cod + ").";
                    }
                }
            } finally {
                if (conexion == c) {
                    conexion = null;
                }
                c.disconnect();
            }
        } catch (SocketTimeoutException e) {
            texto = "Jarvis tard\u00f3 demasiado en responder. Prueba otra vez.";
        } catch (Exception e) {
            texto = "No pude conectar con Jarvis.";
        }
        final String fin = texto;
        ui.post(() -> {
            if (mi != peticion) {
                return;
            }
            abrirEnlace(enlaces);
            terminar(aplicarOrdenes(ordenes[0], fin));
        });
    }

    /** Aplica las ordenes «activa/desactiva X» que entendio el servidor. Devuelve el texto a mostrar y decir. */
    private String aplicarOrdenes(JSONArray ordenes, String texto) {
        if (ordenes == null || ordenes.length() == 0) {
            return texto;
        }
        String aviso = null;
        boolean cambioHerr = false;
        ArrayList<String> off = new ArrayList<>();
        for (String x : prefs.getString("herr_off", "").split(",")) {
            if (!x.trim().isEmpty()) {
                off.add(x.trim());
            }
        }
        for (int k = 0; k < ordenes.length(); k++) {
            JSONObject o = ordenes.optJSONObject(k);
            if (o == null) {
                continue;
            }
            String id = o.optString("id", "");
            boolean on = o.optBoolean("activar", true);
            if (id.equals("escucha")) {
                if (on && srv.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    aviso = "Falta el permiso del micr\u00f3fono. Dame el permiso en Jarvis: Ajustes \u2192 Manos de Jarvis.";
                } else {
                    prefs.edit().putBoolean("palabra", on).apply();
                    if (on) {
                        EscuchaServicio.iniciar(srv);
                    } else {
                        EscuchaServicio.detener(srv);
                    }
                }
            } else if (id.equals("burbuja")) {
                prefs.edit().putBoolean("burbuja", on).apply();
                ui.postDelayed(this::actualizar, on ? 0 : 4000);
            } else if (id.equals("voz_burbuja")) {
                prefs.edit().putBoolean("vozBurbuja", on).apply();
                if (!on) {
                    voz.parar();
                }
            } else if (id.matches("[a-z_]{2,20}")) {
                off.remove(id);
                if (!on) {
                    off.add(id);
                }
                cambioHerr = true;
            }
        }
        if (cambioHerr) {
            StringBuilder sb = new StringBuilder();
            for (String x : off) {
                sb.append(sb.length() > 0 ? "," : "").append(x);
            }
            prefs.edit().putString("herr_off", sb.toString()).putLong("herr_ts", System.currentTimeMillis()).apply();
        }
        return aviso != null ? aviso : texto;
    }

    /** Jarvis pidio abrir una pagina: la web lo hace sola, pero la burbuja no es la web, asi que lo hace aqui. */
    private void abrirEnlace(ArrayList<String> enlaces) {
        for (String u : enlaces) {
            if (!u.matches("(?i)^https?://\\S+$")) {
                continue;
            }
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(u));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                srv.startActivity(i);
                return;
            } catch (Exception ignorada) {
            }
        }
    }

    private void terminar(String texto) {
        cerrarAlHablar = false;
        pensando = false;
        ultimo = texto;
        nuevo = true;
        if (puesta && prefs.getBoolean("vozBurbuja", true)) {
            restaurarSonido();
            voz.hablar(prefs.getString("url", ""), prefs.getString("acceso", ""), texto);
        }
        if (puesta && !abierta) {
            estiloCirculo();
            aplicar();
        }
        if (puesta && abierta) {
            nuevo = false;
            mostrarTexto(texto);
            actualizarTrabajo();
        }
        if (viaPalabra && puesta) {
            viaPalabra = false;
            if (!abierta) {
                abrir();
            } else {
                mostrarTexto(texto);
            }
            ui.removeCallbacks(cierreAuto);
            ui.postDelayed(cierreAuto, 20000);
            cerrarAlHablar = puesta && prefs.getBoolean("vozBurbuja", true) && voz.hablando();
        }
        sincronizarPalabra();
    }

    private static String leer(InputStream in) throws Exception {
        if (in == null) {
            return "{}";
        }
        BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String linea;
        while ((linea = br.readLine()) != null) {
            sb.append(linea);
        }
        br.close();
        return sb.length() == 0 ? "{}" : sb.toString();
    }

    /** Quita las marcas internas y el Markdown que en una burbuja se ven feos. */
    private static String limpiar(String s) {
        s = s.replaceAll("\\[ACCION:[^\\]]*\\]", "");
        s = s.replace("**", "").replace("`", "");
        s = s.replaceAll("(?m)^#+\\s*", "");
        return s.trim();
    }

    // ---- Palabra de activacion: decir "Jarvis" ------------------------------------

    private static final Pattern PALABRA = Pattern.compile(
            "\\b(jarvis|jarvi|yarvis|jarbis|harvis|charvis|yarbis|garvis|jarviz|jarves|yarvi)\\b");

    private boolean palabraActiva() {
        return puesta && prefs.getBoolean("palabra", false) && !pensando && !escuchando && !voz.hablando()
                && srv.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                && SpeechRecognizer.isRecognitionAvailable(srv);
    }

    /** Enciende o apaga la escucha de la palabra segun el estado actual (siempre en el hilo principal). */
    void sincronizarPalabra() {
        ui.removeCallbacks(reinicioPalabra);
        boolean debe = palabraActiva();
        if (debe && srp == null) {
            arrancarPalabra();
        } else if (!debe && srp != null) {
            detenerPalabra();
            restaurarSonido();
        }
    }

    /** Silencia unos instantes los canales por donde suena el bip del reconocedor (solo si el telefono esta en modo normal). */
    private void silenciarBip() {
        ui.removeCallbacks(soltarBip);
        if (!prefs.getBoolean("sinBip", true)) {
            return;
        }
        try {
            if (audio == null) {
                audio = (AudioManager) srv.getSystemService(Context.AUDIO_SERVICE);
            }
            if (audio == null || audio.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) {
                return;
            }
            for (int k = 0; k < CANALES.length; k++) {
                if (mudos[k] || audio.isStreamMute(CANALES[k])) {
                    continue;
                }
                if (CANALES[k] == AudioManager.STREAM_MUSIC && audio.isMusicActive()) {
                    continue;
                }
                audio.adjustStreamVolume(CANALES[k], AudioManager.ADJUST_MUTE, 0);
                mudos[k] = true;
            }
        } catch (Exception ignorada) {
        }
        ui.postDelayed(soltarBip, 1800);
    }

    private void soltarEn(long ms) {
        ui.removeCallbacks(soltarBip);
        ui.postDelayed(soltarBip, ms);
    }

    /** Devuelve el sonido a lo que silencio la app (nunca toca lo que ya estaba mudo). */
    private void restaurarSonido() {
        ui.removeCallbacks(soltarBip);
        if (audio == null) {
            return;
        }
        for (int k = 0; k < CANALES.length; k++) {
            if (mudos[k]) {
                try {
                    audio.adjustStreamVolume(CANALES[k], AudioManager.ADJUST_UNMUTE, 0);
                } catch (Exception ignorada) {
                }
                mudos[k] = false;
            }
        }
    }

    /** La voz termino de hablar: si la barra se abrio sola con la respuesta, se cierra. */
    private void vozTermino() {
        if (cerrarAlHablar) {
            cerrarAlHablar = false;
            ui.removeCallbacks(cierreAuto);
            cierreAutomatico();
        }
        sincronizarPalabra();
    }

    /** Cierra la barra que se abrio sola con la respuesta, si no la tocaste. */
    private void cierreAutomatico() {
        if (puesta && abierta && !pensando && !escuchando && campo != null && !campo.hasFocus()) {
            cerrarPanel();
        }
    }

    private void arrancarPalabra() {
        try {
            srp = SpeechRecognizer.createSpeechRecognizer(srv);
            srp.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onReadyForSpeech(Bundle p) {
                }

                @Override
                public void onBeginningOfSpeech() {
                }

                @Override
                public void onRmsChanged(float v) {
                }

                @Override
                public void onBufferReceived(byte[] b) {
                }

                @Override
                public void onEndOfSpeech() {
                    ui.post(() -> silenciarBip());
                }

                @Override
                public void onEvent(int t, Bundle p) {
                }

                @Override
                public void onPartialResults(Bundle p) {
                }

                @Override
                public void onResults(Bundle p) {
                    final String t = primero(p);
                    ui.post(() -> alOirPalabra(t));
                }

                @Override
                public void onError(int codigo) {
                    ui.post(() -> errorPalabra(codigo));
                }
            });
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag());
            i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, srv.getPackageName());
            ultimaPalabra = System.currentTimeMillis();
            ui.removeCallbacks(vigiaPalabra);
            ui.postDelayed(vigiaPalabra, 20000);
            silenciarBip();
            srp.startListening(i);
            soltarEn(900);
        } catch (Exception e) {
            detenerPalabra();
            ui.postDelayed(reinicioPalabra, 3000);
        }
    }

    private void detenerPalabra() {
        ui.removeCallbacks(vigiaPalabra);
        ui.removeCallbacks(reinicioPalabra);
        if (srp != null) {
            try {
                srp.cancel();
                srp.destroy();
            } catch (Exception ignorada) {
            }
            srp = null;
        }
    }

    /** Quita acentos y pasa a minusculas sin cambiar el largo (para que los indices coincidan con el original). */
    private static String plano(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            String n = Normalizer.normalize(String.valueOf(s.charAt(i)), Normalizer.Form.NFD);
            b.append(Character.toLowerCase(n.charAt(0)));
        }
        return b.toString();
    }

    private void alOirPalabra(String t) {
        if (srp == null) {
            return;
        }
        detenerPalabra();
        fallosPalabra = 0;
        Matcher m = t.isEmpty() ? null : PALABRA.matcher(plano(t));
        if (m == null || !m.find()) {
            soltarEn(900);
            ui.postDelayed(reinicioPalabra, 300);
            return;
        }
        if (pensando) {
            return;
        }
        String resto = t.substring(Math.min(m.end(), t.length()))
                .replaceFirst("^[\\s,.:;!?\\u00bf\\u00a1-]+", "").trim();
        restaurarSonido();
        viaPalabra = true;
        ui.removeCallbacks(cierreAuto);
        if (!resto.isEmpty()) {
            abrir();
            campo.setText(resto);
            enviar();
        } else {
            abrir();
            ui.postDelayed(this::escuchar, 250);
        }
    }

    private void errorPalabra(int c) {
        if (srp == null) {
            return;
        }
        detenerPalabra();
        if (c == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
            prefs.edit().putBoolean("palabra", false).apply();
            restaurarSonido();
            mostrarTexto("Falta el permiso del micr\u00f3fono para o\u00edr \u00abJarvis\u00bb.");
            return;
        }
        silenciarBip();
        soltarEn(900);
        long espera = 350;
        if (c == SpeechRecognizer.ERROR_NO_MATCH || c == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
            fallosPalabra = 0;
        } else {
            fallosPalabra++;
            espera = Math.min(15000L, 1000L * (1 << Math.min(fallosPalabra, 4)));
        }
        ui.postDelayed(reinicioPalabra, espera);
    }

    // ---- Microfono --------------------------------------------------------------

    private void escuchar() {
        if (escuchando) {
            detenerVoz();
            return;
        }
        if (pensando) {
            return;
        }
        if (srv.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            mostrarTexto("Falta el permiso del micr\u00f3fono. En Jarvis: Ajustes \u2192 Manos de Jarvis \u2192 Permitir micr\u00f3fono.");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(srv)) {
            mostrarTexto("Este celular no tiene reconocimiento de voz disponible.");
            return;
        }
        voz.parar();
        ocultarTeclado();
        detenerPalabra();
        restaurarSonido();
        escuchando = true;
        micBtn.color(ROJO);
        ondasPanel.modo(2);
        mostrarTexto("Te escucho\u2026");
        sr = SpeechRecognizer.createSpeechRecognizer(srv);
        sr.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle p) {
            }

            @Override
            public void onBeginningOfSpeech() {
            }

            @Override
            public void onRmsChanged(float v) {
                if (ondasPanel != null) {
                    ondasPanel.nivel((v + 2f) / 12f);
                }
            }

            @Override
            public void onBufferReceived(byte[] b) {
            }

            @Override
            public void onEndOfSpeech() {
            }

            @Override
            public void onEvent(int t, Bundle p) {
            }

            @Override
            public void onPartialResults(Bundle p) {
                String t = primero(p);
                if (!t.isEmpty()) {
                    mostrarTexto(t);
                }
            }

            @Override
            public void onResults(Bundle p) {
                final String t = primero(p);
                ui.post(() -> {
                    detenerVoz();
                    if (t.isEmpty()) {
                        viaPalabra = false;
                        mostrarTexto("No te escuch\u00e9. Intenta de nuevo.");
                    } else {
                        campo.setText(t);
                        enviar();
                    }
                });
            }

            @Override
            public void onError(int codigo) {
                ui.post(() -> {
                    detenerVoz();
                    viaPalabra = false;
                    mostrarTexto(errorVoz(codigo));
                });
            }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag());
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        sr.startListening(i);
    }

    private void detenerVoz() {
        escuchando = false;
        if (micBtn != null) {
            micBtn.color(TEXTO);
            if (ondasPanel != null) {
                ondasPanel.modo(0);
                ondasPanel.nivel(0f);
            }
        }
        if (sr != null) {
            try {
                sr.cancel();
                sr.destroy();
            } catch (Exception ignorada) {
            }
            sr = null;
        }
        ui.removeCallbacks(reinicioPalabra);
        ui.postDelayed(reinicioPalabra, 700);
    }

    private static String primero(Bundle p) {
        ArrayList<String> l = p == null ? null : p.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return (l == null || l.isEmpty() || l.get(0) == null) ? "" : l.get(0).trim();
    }

    private String errorVoz(int c) {
        switch (c) {
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No te escuch\u00e9. Intenta de nuevo.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Falta el permiso del micr\u00f3fono. En Jarvis: Ajustes \u2192 Manos de Jarvis \u2192 Permitir micr\u00f3fono.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "Sin conexi\u00f3n para reconocer la voz.";
            case SpeechRecognizer.ERROR_AUDIO:
                return "No pude usar el micr\u00f3fono (Android puede bloquearlo con la app en segundo plano).";
            default:
                return "Error de voz (c\u00f3digo " + c + ").";
        }
    }
}
