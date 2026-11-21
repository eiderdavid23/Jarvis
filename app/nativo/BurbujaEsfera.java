package com.david.jarvis;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.os.SystemClock;
import android.view.View;

/**
 * Esfera de Jarvis para la burbuja flotante (v1.56): una bola de puntos cian que gira,
 * respira y se eriza en picos cuando Jarvis habla. Es la misma idea de la esfera de la app,
 * dibujada en nativo con pocos puntos para que el celular no se trabe.
 * Mismos modos que las ondas: 0 reposo, 1 pensando, 3 respuesta nueva, 4 hablando.
 */
final class BurbujaEsfera extends View {
    private static final int N = 420;
    private final float[] px = new float[N];
    private final float[] py = new float[N];
    private final float[] pz = new float[N];
    private final float[] kk = new float[N];
    private final Paint punto = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint halo = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float d;
    private int color = Color.parseColor("#1ED7FF");
    private int modo;
    private float nivel;
    private float suave;
    private float giro;
    private float amp;
    private long ultimo;
    private RadialGradient brillo;
    private int colorBrillo;

    BurbujaEsfera(Context cx) {
        super(cx);
        d = cx.getResources().getDisplayMetrics().density;
        float oro = (float) (Math.PI * (3 - Math.sqrt(5)));
        java.util.Random rnd = new java.util.Random(7);
        for (int i = 0; i < N; i++) {
            float y = 1f - (i / (float) (N - 1)) * 2f;
            float r = (float) Math.sqrt(Math.max(0, 1 - y * y));
            float th = oro * i;
            px[i] = (float) Math.cos(th) * r;
            py[i] = y;
            pz[i] = (float) Math.sin(th) * r;
            kk[i] = 0.35f + 0.65f * rnd.nextFloat();
        }
        punto.setStyle(Paint.Style.FILL);
        halo.setStyle(Paint.Style.FILL);
    }

    void color(int c) {
        color = c;
        invalidate();
    }

    void modo(int m) {
        modo = Math.max(0, Math.min(4, m));
    }

    void nivel(float v) {
        nivel = Math.max(0f, Math.min(1f, v));
    }

    @Override
    protected void onDraw(Canvas c) {
        float w = getWidth();
        float h = getHeight();
        if (w <= 0 || h <= 0) {
            return;
        }
        long ahora = SystemClock.uptimeMillis();
        float dt = ultimo == 0 ? 0.016f : Math.min(0.1f, (ahora - ultimo) / 1000f);
        ultimo = ahora;
        float t = ahora / 1000f;
        float cx = w / 2f;
        float cy = h / 2f;
        float lado = Math.min(w, h);
        float radio = lado * 0.30f;

        // Fuerza de los picos segun el modo; al hablar sin dato de voz se simula una voz
        float objetivo = nivel;
        if (modo == 4 && nivel < 0.05f) {
            objetivo = 0.45f + 0.35f * (float) Math.sin(t * 7.3) * (float) Math.sin(t * 2.1);
        }
        suave += (objetivo - suave) * 0.25f;
        float base = modo == 0 ? 0.06f : (modo == 1 ? 0.14f : (modo == 3 ? 0.12f : 0.18f));
        float meta = base + suave * 0.95f;
        amp += (meta - amp) * 0.2f;

        float vel = modo == 1 ? 1.2f : (modo == 4 ? 0.8f : (modo == 3 ? 0.5f : 0.25f));
        giro += vel * dt;
        float cg = (float) Math.cos(giro);
        float sg = (float) Math.sin(giro);
        float ci = 0.35f;
        float cc = (float) Math.cos(ci);
        float sc = (float) Math.sin(ci);

        // Brillo del centro (se rehace solo si cambia el tamano o el color)
        if (brillo == null || colorBrillo != color) {
            brillo = new RadialGradient(cx, cy, lado * 0.46f,
                    new int[]{BurbujaUI.alfa(color, 150), BurbujaUI.alfa(color, 50), BurbujaUI.alfa(color, 0)},
                    new float[]{0f, 0.55f, 1f}, Shader.TileMode.CLAMP);
            colorBrillo = color;
        }
        halo.setShader(brillo);
        c.drawCircle(cx, cy, lado * 0.46f, halo);

        float rp = Math.max(0.8f * d, lado * 0.022f);
        for (int i = 0; i < N; i++) {
            // Picos en racimos que cambian de lugar con el tiempo
            float rac = 0.5f + 0.5f * (float) Math.sin(px[i] * 5.1f + py[i] * 4.3f + pz[i] * 3.7f + t * 2.3f);
            float pico = amp * rac * rac * rac * kk[i];
            float rr = radio * (1f + pico + 0.025f * (float) Math.sin(t * 1.6f));
            float x = px[i] * cg + pz[i] * sg;
            float z = -px[i] * sg + pz[i] * cg;
            float y = py[i] * cc - z * sc;
            float z2 = py[i] * sc + z * cc;
            float prof = 0.5f + 0.5f * z2;
            int a = 70 + (int) (185 * prof);
            punto.setColor(BurbujaUI.alfa(color, a));
            float rad = rp * (0.7f + 0.6f * prof) * (1f + pico * 0.8f);
            c.drawCircle(cx + x * rr, cy + y * rr, rad, punto);
        }
        // Nucleo claro
        punto.setColor(BurbujaUI.alfa(Color.WHITE, 120));
        c.drawCircle(cx, cy, radio * 0.16f, punto);

        if (modo == 0) {
            postInvalidateDelayed(40);
        } else {
            postInvalidateOnAnimation();
        }
    }
}
