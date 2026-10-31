package com.david.jarvis;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.SystemClock;
import android.view.View;

/** Dibujos de la burbuja de Jarvis: ondas animadas, logo e iconos (sin emojis). */
final class BurbujaUI {
    private BurbujaUI() {
    }

    /** Barras que se mueven como el sonido de la musica. Modos: 0 reposo, 1 pensando, 2 escuchando, 3 respuesta nueva. */
    static class Ondas extends View {
        private static final float[] VEL = {3f, 7f, 6f, 4.5f};
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF r = new RectF();
        private final int n;
        private int color = Color.parseColor("#00E5FF");
        private int modo;
        private float nivel;

        Ondas(Context cx, int barras) {
            super(cx);
            n = barras;
            p.setStyle(Paint.Style.FILL);
        }

        void color(int c) {
            color = c;
            invalidate();
        }

        void modo(int m) {
            modo = Math.max(0, Math.min(3, m));
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
            float t = SystemClock.uptimeMillis() / 1000f;
            float vel = VEL[modo];
            float base = modo == 0 ? 0.26f : 0.32f;
            float amp = modo == 0 ? 0.22f : (modo == 2 ? 0.25f + 0.45f * nivel : 0.40f);
            float hueco = w / n;
            float ancho = hueco * 0.52f;
            p.setColor(color);
            for (int i = 0; i < n; i++) {
                double f = Math.sin(t * vel + i * 1.1) * 0.6 + Math.sin(t * vel * 0.63 + i * 2.3) * 0.4;
                float v = (float) (0.5 + 0.5 * f);
                float env = (float) (0.55 + 0.45 * Math.sin(Math.PI * (i + 0.5) / n));
                float alto = Math.min(h, h * (base + amp * v) * env);
                float x = i * hueco + (hueco - ancho) / 2f;
                r.set(x, (h - alto) / 2f, x + ancho, (h + alto) / 2f);
                c.drawRoundRect(r, ancho / 2f, ancho / 2f, p);
            }
            postInvalidateDelayed(40);
        }
    }

    /** Logo de Jarvis: el mismo del icono de la app (fondo oscuro, brillo cian y circulo blanco). */
    static class Logo extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float d;
        private RadialGradient brillo;
        private int borde;

        Logo(Context cx) {
            super(cx);
            d = cx.getResources().getDisplayMetrics().density;
        }

        /** Color del aro exterior; 0 = sin aro. */
        void borde(int c) {
            borde = c;
            invalidate();
        }

        @Override
        protected void onSizeChanged(int w, int h, int ow, int oh) {
            float r = Math.min(w, h) / 2f;
            brillo = new RadialGradient(w / 2f, h / 2f, Math.max(1f, r),
                    new int[]{Color.parseColor("#E600E5FF"), Color.parseColor("#0000E5FF")},
                    null, Shader.TileMode.CLAMP);
        }

        @Override
        protected void onDraw(Canvas c) {
            float w = getWidth();
            float h = getHeight();
            float cx = w / 2f;
            float cy = h / 2f;
            float r = Math.min(w, h) / 2f;
            p.setShader(null);
            p.setStyle(Paint.Style.FILL);
            p.setColor(Color.parseColor("#05070D"));
            c.drawCircle(cx, cy, r, p);
            if (brillo != null) {
                p.setShader(brillo);
                c.drawCircle(cx, cy, r, p);
                p.setShader(null);
            }
            p.setColor(Color.WHITE);
            c.drawCircle(cx, cy, r * 0.38f, p);
            if (borde != 0) {
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeWidth(1.6f * d);
                p.setColor(borde);
                c.drawCircle(cx, cy, r - 0.8f * d, p);
            }
        }
    }

    /** Iconos dibujados a mano: microfono, enviar, abrir Jarvis y plegar. */
    static class Icono extends View {
        static final int MIC = 0;
        static final int ENVIAR = 1;
        static final int ABRIR = 2;
        static final int PLEGAR = 3;
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path ph = new Path();
        private final RectF r = new RectF();
        private final int tipo;
        private int color;

        Icono(Context cx, int tipo, int color) {
            super(cx);
            this.tipo = tipo;
            this.color = color;
        }

        void color(int c) {
            color = c;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas c) {
            float w = getWidth() - getPaddingLeft() - getPaddingRight();
            float h = getHeight() - getPaddingTop() - getPaddingBottom();
            float s = Math.min(w, h);
            if (s <= 0) {
                return;
            }
            c.save();
            c.translate(getPaddingLeft() + (w - s) / 2f, getPaddingTop() + (h - s) / 2f);
            c.scale(s / 24f, s / 24f);
            p.setColor(color);
            p.setStrokeCap(Paint.Cap.ROUND);
            p.setStrokeJoin(Paint.Join.ROUND);
            p.setStrokeWidth(2f);
            ph.reset();
            if (tipo == MIC) {
                p.setStyle(Paint.Style.STROKE);
                r.set(9f, 2.5f, 15f, 14f);
                c.drawRoundRect(r, 3f, 3f, p);
                r.set(5f, 4f, 19f, 18f);
                c.drawArc(r, 0f, 180f, false, p);
                c.drawLine(12f, 18f, 12f, 21.5f, p);
                c.drawLine(8.5f, 21.5f, 15.5f, 21.5f, p);
            } else if (tipo == ENVIAR) {
                p.setStyle(Paint.Style.FILL);
                ph.moveTo(3f, 11f);
                ph.lineTo(21f, 3f);
                ph.lineTo(14f, 21f);
                ph.lineTo(11.5f, 13f);
                ph.close();
                c.drawPath(ph, p);
            } else if (tipo == ABRIR) {
                p.setStyle(Paint.Style.STROKE);
                c.drawLine(7f, 17f, 17f, 7f, p);
                ph.moveTo(9f, 7f);
                ph.lineTo(17f, 7f);
                ph.lineTo(17f, 15f);
                c.drawPath(ph, p);
            } else {
                p.setStyle(Paint.Style.STROKE);
                ph.moveTo(6f, 15f);
                ph.lineTo(12f, 9f);
                ph.lineTo(18f, 15f);
                c.drawPath(ph, p);
            }
            c.restore();
        }
    }
}
