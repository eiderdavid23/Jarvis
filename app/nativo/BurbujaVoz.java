package com.david.jarvis;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Voz de la burbuja: cuando Jarvis termina de responder, lee la respuesta en voz alta.
 * Usa la misma voz del servidor (/voz) y, si falla, la voz del celular. Se corta con parar().
 */
class BurbujaVoz {
    private static final int TROZO = 420;
    private static final int MAXIMO = 2000;

    private final Context cx;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Runnable alTerminar;
    private final Object cerrojo = new Object();
    private volatile int turno;
    private volatile boolean hablando;
    private volatile boolean sinServidor;
    private MediaPlayer mp;
    private CountDownLatch espera;
    private TextToSpeech tts;
    private boolean ttsListo;

    BurbujaVoz(Context cx, Runnable alTerminar) {
        this.cx = cx;
        this.alTerminar = alTerminar;
    }

    boolean hablando() {
        return hablando;
    }

    /** Lee el texto en voz alta (corta lo que estuviera sonando). */
    void hablar(final String base, final String acceso, String texto) {
        parar();
        final ArrayList<String> trozos = partir(texto);
        if (trozos.isEmpty()) {
            return;
        }
        final int mi = turno;
        sinServidor = false;
        hablando = true;
        new Thread(() -> {
            try {
                leer(base, acceso, trozos, mi);
            } catch (Exception ignorada) {
            } finally {
                if (mi == turno) {
                    hablando = false;
                    ui.post(alTerminar);
                }
            }
        }, "burbuja-voz").start();
    }

    /** Calla la voz ya mismo. */
    void parar() {
        synchronized (cerrojo) {
            turno++;
            hablando = false;
            if (mp != null) {
                try {
                    mp.stop();
                } catch (Exception ignorada) {
                }
                try {
                    mp.release();
                } catch (Exception ignorada) {
                }
                mp = null;
            }
            if (espera != null) {
                espera.countDown();
            }
        }
        try {
            if (tts != null) {
                tts.stop();
            }
        } catch (Exception ignorada) {
        }
    }

    void liberar() {
        parar();
        try {
            if (tts != null) {
                tts.shutdown();
            }
        } catch (Exception ignorada) {
        }
        tts = null;
        ttsListo = false;
    }

    // ---- Leer trozo a trozo (mientras suena uno, se baja el siguiente) ----------

    private void leer(final String base, final String acceso, final ArrayList<String> trozos, int mi)
            throws Exception {
        File actual = bajar(base, acceso, trozos.get(0));
        for (int i = 0; i < trozos.size() && mi == turno; i++) {
            final int k = i + 1;
            final File[] pre = new File[1];
            Thread t = null;
            if (k < trozos.size()) {
                t = new Thread(() -> pre[0] = bajar(base, acceso, trozos.get(k)), "burbuja-voz-pre");
                t.start();
            }
            if (actual != null) {
                reproducir(actual, mi);
                actual.delete();
            } else {
                local(trozos.get(i), mi);
            }
            if (t != null) {
                t.join(20000);
            }
            actual = pre[0];
        }
        if (actual != null) {
            actual.delete();
        }
    }

    /** Pide el audio al servidor. Devuelve null si falla (y no vuelve a intentarlo en este mensaje). */
    private File bajar(String base, String acceso, String texto) {
        if (sinServidor || base == null || base.isEmpty()) {
            return null;
        }
        HttpURLConnection c = null;
        try {
            JSONObject b = new JSONObject();
            b.put("texto", texto);
            b.put("premium", true);
            c = (HttpURLConnection) new URL(base + "/voz").openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(8000);
            c.setReadTimeout(25000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            if (acceso != null && !acceso.isEmpty()) {
                c.setRequestProperty("Authorization", "Bearer " + acceso);
            }
            OutputStream o = c.getOutputStream();
            o.write(b.toString().getBytes(StandardCharsets.UTF_8));
            o.close();
            if (c.getResponseCode() != 200) {
                sinServidor = true;
                return null;
            }
            String tipo = c.getContentType();
            File f = File.createTempFile("voz", tipo != null && tipo.contains("wav") ? ".wav" : ".mp3",
                    cx.getCacheDir());
            InputStream in = c.getInputStream();
            FileOutputStream fo = new FileOutputStream(f);
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                fo.write(buf, 0, n);
            }
            fo.close();
            in.close();
            if (f.length() == 0) {
                f.delete();
                sinServidor = true;
                return null;
            }
            return f;
        } catch (Exception e) {
            sinServidor = true;
            return null;
        } finally {
            if (c != null) {
                c.disconnect();
            }
        }
    }

    private void reproducir(File f, int mi) {
        final CountDownLatch fin = new CountDownLatch(1);
        MediaPlayer m = new MediaPlayer();
        try {
            m.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            m.setDataSource(f.getAbsolutePath());
            m.setWakeMode(cx, android.os.PowerManager.PARTIAL_WAKE_LOCK);
            m.setOnCompletionListener(x -> fin.countDown());
            m.setOnErrorListener((x, a, b) -> {
                fin.countDown();
                return true;
            });
            m.prepare();
            synchronized (cerrojo) {
                if (mi != turno) {
                    return;
                }
                mp = m;
                espera = fin;
                m.start();
            }
            fin.await(90, TimeUnit.SECONDS);
        } catch (Exception ignorada) {
        } finally {
            synchronized (cerrojo) {
                if (mp == m) {
                    mp = null;
                }
                if (espera == fin) {
                    espera = null;
                }
            }
            try {
                m.release();
            } catch (Exception ignorada) {
            }
        }
    }

    /** Respaldo: la voz que trae el celular. */
    private void local(String texto, int mi) {
        final CountDownLatch fin = new CountDownLatch(1);
        try {
            synchronized (cerrojo) {
                if (mi != turno) {
                    return;
                }
                espera = fin;
            }
            if (tts == null) {
                final CountDownLatch listo = new CountDownLatch(1);
                tts = new TextToSpeech(cx, st -> {
                    ttsListo = st == TextToSpeech.SUCCESS;
                    listo.countDown();
                });
                listo.await(4, TimeUnit.SECONDS);
            }
            if (!ttsListo) {
                return;
            }
            tts.setLanguage(new Locale("es"));
            tts.setPitch(0.85f);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String id) {
                }

                @Override
                public void onDone(String id) {
                    fin.countDown();
                }

                @Override
                public void onError(String id) {
                    fin.countDown();
                }
            });
            tts.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "jv" + mi);
            fin.await(60, TimeUnit.SECONDS);
        } catch (Exception ignorada) {
        } finally {
            synchronized (cerrojo) {
                if (espera == fin) {
                    espera = null;
                }
            }
        }
    }

    // ---- Preparar el texto -------------------------------------------------------

    /** Limpia lo que no se lee bien (enlaces, emojis, saltos) y lo parte en trozos cortos. */
    private static ArrayList<String> partir(String t) {
        ArrayList<String> r = new ArrayList<>();
        if (t == null) {
            return r;
        }
        t = t.replaceAll("https?://\\S+", "enlace")
                .replaceAll("[\\x{1F000}-\\x{1FAFF}\\x{2600}-\\x{27BF}\\x{FE0F}]", "")
                .replaceAll("(?<![.!?:;,])\\s*\\n+\\s*", ". ")
                .replaceAll("\\s+", " ").trim();
        if (t.length() > MAXIMO) {
            t = t.substring(0, MAXIMO);
        }
        if (!t.matches("(?s).*[\\p{L}\\p{N}].*")) {
            return r;
        }
        StringBuilder sb = new StringBuilder();
        for (String s : t.split("(?<=[.!?\u2026:;])\\s+")) {
            while (s.length() > TROZO) {
                int k = s.lastIndexOf(' ', TROZO);
                if (k < 40) {
                    k = TROZO;
                }
                cerrar(r, sb);
                r.add(s.substring(0, k).trim());
                s = s.substring(k).trim();
            }
            if (sb.length() + s.length() + 1 > TROZO) {
                cerrar(r, sb);
            }
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(s);
        }
        cerrar(r, sb);
        return r;
    }

    private static void cerrar(ArrayList<String> r, StringBuilder sb) {
        if (sb.length() > 0) {
            r.add(sb.toString());
            sb.setLength(0);
        }
    }
}
