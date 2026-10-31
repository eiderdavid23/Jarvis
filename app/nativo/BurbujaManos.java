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

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.TimeZone;

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
            | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
    private static final int FLAGS_ABIERTA = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;

    private final AccessibilityService srv;
    private final Context cx;
    private final WindowManager wm;
    private final SharedPreferences prefs;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final float d;

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

    private boolean puesta;
    private boolean abierta;
    private boolean pensando;
    private boolean escuchando;
    private boolean nuevo;
    private int bx;
    private int by;
    private String ultimo = "";

    BurbujaManos(AccessibilityService srv) {
        this.srv = srv;
        this.cx = new ContextThemeWrapper(srv, android.R.style.Theme_DeviceDefault);
        this.wm = (WindowManager) srv.getSystemService(Context.WINDOW_SERVICE);
        this.prefs = srv.getSharedPreferences("manos", Context.MODE_PRIVATE);
        this.d = srv.getResources().getDisplayMetrics().density;
        int ancho = srv.getResources().getDisplayMetrics().widthPixels;
        bx = prefs.getInt("bx", ancho - (int) (64 * d));
        by = prefs.getInt("by", (int) (110 * d));
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
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.x = bx;
        lp.y = by;
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING;
        abierta = false;
        mostrarPlegada();
        wm.addView(raiz, lp);
        puesta = true;
    }

    private void sacar() {
        detenerVoz();
        try {
            wm.removeView(raiz);
        } catch (Exception ignorada) {
        }
        puesta = false;
        abierta = false;
    }

    // ---- La burbuja (pildora arrastrable, como la isla de la musica) ------------

    private static final int PILDORA_W = 104;
    private static final int PILDORA_H = 38;

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
        pildora.setPadding((int) (14 * d), 0, (int) (5 * d), 0);
        ondasMini = new BurbujaUI.Ondas(cx, 6);
        pildora.addView(ondasMini, new LinearLayout.LayoutParams(0, (int) (18 * d), 1f));
        logoMini = new BurbujaUI.Logo(cx);
        pildora.addView(logoMini, cuadro(28, 10));
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
        int pw = (int) (PILDORA_W * d);
        int ph = (int) (PILDORA_H * d);
        int margen = (int) (6 * d);
        lp.x = (lp.x + pw / 2 < ancho / 2) ? margen : ancho - pw - margen;
        lp.y = Math.max((int) (30 * d), Math.min(lp.y, alto - ph - (int) (60 * d)));
        bx = lp.x;
        by = lp.y;
        prefs.edit().putInt("bx", bx).putInt("by", by).apply();
        try {
            wm.updateViewLayout(raiz, lp);
        } catch (Exception ignorada) {
        }
    }

    private void abrir() {
        if (pensando) {
            return;
        }
        abierta = true;
        nuevo = false;
        mostrarPanel();
        aplicar();
    }

    private void cerrarPanel() {
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
            lp.gravity = Gravity.TOP | Gravity.START;
            lp.x = bx;
            lp.y = by;
            lp.flags = FLAGS_PLEGADA | (pensando ? WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE : 0);
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

    private void enviar() {
        final String t = campo.getText().toString().trim();
        if (t.isEmpty() || pensando) {
            return;
        }
        campo.setText("");
        pensando = true;
        ultimo = "";
        cerrarPanel();
        new Thread(() -> llamar(t), "burbuja-chat").start();
    }

    /** Manda el mensaje a /chat con la sesion que le paso la app (el servidor usa tus llaves de la cuenta). */
    private void llamar(String mensaje) {
        String texto = "";
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
            try {
                c.setRequestMethod("POST");
                c.setConnectTimeout(10000);
                c.setReadTimeout(120000);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                c.setRequestProperty("Authorization", "Bearer " + acceso);
                OutputStream o = c.getOutputStream();
                o.write(b.toString().getBytes(StandardCharsets.UTF_8));
                o.close();
                int cod = c.getResponseCode();
                String cuerpo = leer(cod >= 400 ? c.getErrorStream() : c.getInputStream());
                if (cod == 401) {
                    texto = "Tu sesi\u00f3n caduc\u00f3. Abre Jarvis un momento y vuelve a intentarlo.";
                } else {
                    JSONObject j = new JSONObject(cuerpo);
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
                c.disconnect();
            }
        } catch (SocketTimeoutException e) {
            texto = "Jarvis tard\u00f3 demasiado en responder. Prueba otra vez.";
        } catch (Exception e) {
            texto = "No pude conectar con Jarvis.";
        }
        final String fin = texto;
        ui.post(() -> terminar(fin));
    }

    private void terminar(String texto) {
        pensando = false;
        ultimo = texto;
        nuevo = true;
        if (puesta && !abierta) {
            estiloCirculo();
            aplicar();
        }
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
        ocultarTeclado();
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
