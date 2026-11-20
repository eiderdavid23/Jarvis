package com.david.jarvis;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;
import android.view.HapticFeedbackConstants;
import android.view.MotionEvent;
import android.view.View;
import android.view.animation.OvershootInterpolator;

/** Dibujos de la burbuja de Jarvis (isla de cristal): vidrio, orbe, ondas e iconos, sin imagenes ni emojis. */
final class BurbujaUI {
    static final int CIAN = Color.parseColor("#00E5FF");
    static final int DORADO = Color.parseColor("#FFC857");

    private BurbujaUI() {
    }

    static int alfa(int c, int a) {
        return (c & 0x00FFFFFF) | ((a & 0xFF) << 24);
    }

    /** Fondo de cristal: cuerpo oscuro translucido, brillo en la parte de arriba y borde con degradado de color. */
    static class Vidrio extends Drawable {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF r = new RectF();
        private final float d;
        private final float radio;
        private int acento;
        private Shader cuerpo;
        private Shader brillo;
        private Shader borde;

        Vidrio(float d, float radio, int acento) {
            this.d = d;
            this.radio = radio;
            this.acento = acento;
        }

        void acento(int c) {
            acento = c;
            armar(getBounds());
            invalidateSelf();
        }

        @Override
        protected void onBoundsChange(Rect b) {
            armar(b);
        }

        private void armar(Rect b) {
            if (b.width() <= 0 || b.height() <= 0) {
                return;
            }
            cuerpo = new LinearGradient(0, b.top, 0, b.bottom, Color.parseColor("#F20F1B2B"),
                    Color.parseColor("#F2050A12"), Shader.TileMode.CLAMP);
            brillo = new LinearGradient(0, b.top, 0, b.top + b.height() * 0.5f, 0x30FFFFFF, 0x00FFFFFF,
                    Shader.TileMode.CLAMP);
            borde = new LinearGradient(b.left, b.top, b.right, b.bottom,
                    new int[]{alfa(acento, 0xE0), alfa(acento, 0x30), alfa(acento, 0x90)}, null,
                    Shader.TileMode.CLAMP);
        }

        @Override
        public void draw(Canvas c) {
            if (cuerpo == null) {
                return;
            }
            Rect b = getBounds();
            float s = 1.2f * d;
            r.set(b.left + s / 2f, b.top + s / 2f, b.right - s / 2f, b.bottom - s / 2f);
            float rad = Math.min(radio, r.height() / 2f);
            p.setStyle(Paint.Style.FILL);
            p.setShader(cuerpo);
            c.drawRoundRect(r, rad, rad, p);
            r.set(b.left + s * 1.5f, b.top + s * 1.5f, b.right - s * 1.5f, b.top + b.height() * 0.5f);
            float rb = Math.max(0f, rad - s);
            p.setShader(brillo);
            c.drawRoundRect(r, rb, rb, p);
            r.set(b.left + s / 2f, b.top + s / 2f, b.right - s / 2f, b.bottom - s / 2f);
            p.setShader(borde);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(s);
            c.drawRoundRect(r, rad, rad, p);
            p.setShader(null);
        }

        @Override
        public void setAlpha(int a) {
            p.setAlpha(a);
        }

        @Override
        public void setColorFilter(ColorFilter f) {
            p.setColorFilter(f);
        }

        @Override
        public int getOpacity() {
            return PixelFormat.TRANSLUCENT;
        }
    }

    /**
     * Ondas con brillo. Modos: 0 reposo (lento), 1 pensando (tres puntos que saltan), 2 escuchando (sigue la voz),
     * 3 respuesta nueva, 4 hablando.
     */
    static class Ondas extends View {
        private static final float[] VEL = {2.2f, 7f, 6f, 5f, 4f};
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF r = new RectF();
        private final int n;
        private int color = CIAN;
        private int modo;
        private float nivel;
        private float suave;

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
            float t = SystemClock.uptimeMillis() / 1000f;
            suave += (nivel - suave) * 0.3f;
            if (modo == 1) {
                puntos(c, w, h, t);
            } else {
                barras(c, w, h, t);
            }
            if (modo == 0) {
                postInvalidateDelayed(90);
            } else {
                postInvalidateOnAnimation();
            }
        }

        private void puntos(Canvas c, float w, float h, float t) {
            float rad = h * 0.17f;
            float sep = Math.min(w / 4f, rad * 3.4f);
            for (int i = -1; i <= 1; i++) {
                double fase = Math.sin(t * 6.5 - i * 0.9);
                float k = (float) (0.5 + 0.5 * fase);
                float y = h / 2f - (float) fase * h * 0.2f;
                p.setColor(alfa(color, (int) (255 * (0.55f + 0.45f * k))));
                c.drawCircle(w / 2f + i * sep, y, rad * (0.85f + 0.3f * k), p);
            }
        }

        private void barras(Canvas c, float w, float h, float t) {
            float vel = VEL[modo];
            float base = modo == 0 ? 0.24f : 0.30f;
            float amp;
            if (modo == 0) {
                amp = 0.18f;
            } else if (modo == 2) {
                amp = 0.25f + 0.5f * suave;
            } else if (modo == 4) {
                amp = 0.32f;
            } else {
                amp = 0.42f;
            }
            float hueco = w / n;
            float ancho = hueco * 0.5f;
            float g = ancho * 0.6f;
            for (int i = 0; i < n; i++) {
                double f = Math.sin(t * vel + i * 1.1) * 0.6 + Math.sin(t * vel * 0.63 + i * 2.3) * 0.4;
                float v = (float) (0.5 + 0.5 * f);
                float env = (float) (0.55 + 0.45 * Math.sin(Math.PI * (i + 0.5) / n));
                float alto = Math.min(h, h * (base + amp * v) * env);
                float x = i * hueco + (hueco - ancho) / 2f;
                if (modo != 0) {
                    p.setColor(alfa(color, 0x30));
                    r.set(x - g / 2f, (h - alto) / 2f - g / 2f, x + ancho + g / 2f, (h + alto) / 2f + g / 2f);
                    c.drawRoundRect(r, (ancho + g) / 2f, (ancho + g) / 2f, p);
                }
                p.setColor(color);
                r.set(x, (h - alto) / 2f, x + ancho, (h + alto) / 2f);
                c.drawRoundRect(r, ancho / 2f, ancho / 2f, p);
            }
        }
    }

    /** Orbe de Jarvis: halo que respira, brillo de cristal y aro dorado que gira mientras piensa. */
    static class Logo extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float d;
        private RadialGradient brillo;
        private SweepGradient giro;
        private int borde;
        private boolean pensando;

        Logo(Context cx) {
            super(cx);
            d = cx.getResources().getDisplayMetrics().density;
        }

        /** Color del aro exterior y del pulso rapido; 0 = ninguno. */
        void borde(int c) {
            borde = c;
            invalidate();
        }

        void pensando(boolean b) {
            pensando = b;
            invalidate();
        }

        @Override
        protected void onSizeChanged(int w, int h, int ow, int oh) {
            float ro = Math.min(w, h) / 2f * 0.8f;
            brillo = new RadialGradient(w / 2f, h / 2f, Math.max(1f, ro),
                    new int[]{Color.parseColor("#E600E5FF"), Color.parseColor("#0000E5FF")},
                    null, Shader.TileMode.CLAMP);
            giro = new SweepGradient(w / 2f, h / 2f,
                    new int[]{alfa(DORADO, 0), alfa(DORADO, 255), alfa(DORADO, 0)},
                    new float[]{0f, 0.7f, 1f});
        }

        @Override
        protected void onDraw(Canvas c) {
            float w = getWidth();
            float h = getHeight();
            float cx = w / 2f;
            float cy = h / 2f;
            float r = Math.min(w, h) / 2f;
            float ro = r * 0.8f;
            float t = SystemClock.uptimeMillis() / 1000f;
            int acento = pensando ? DORADO : (borde != 0 ? borde : CIAN);
            float vel = (pensando || borde != 0) ? 4.5f : 1.6f;
            float resp = (float) (0.5 + 0.5 * Math.sin(t * vel));
            p.setShader(null);
            p.setStyle(Paint.Style.FILL);
            p.setColor(alfa(acento, (int) (22 + 30 * resp)));
            c.drawCircle(cx, cy, r, p);
            p.setColor(alfa(acento, (int) (40 + 60 * resp)));
            c.drawCircle(cx, cy, ro + (r - ro) * 0.45f, p);
            p.setColor(Color.parseColor("#05070D"));
            c.drawCircle(cx, cy, ro, p);
            if (brillo != null) {
                p.setShader(brillo);
                c.drawCircle(cx, cy, ro, p);
                p.setShader(null);
            }
            p.setColor(Color.WHITE);
            c.drawCircle(cx, cy, ro * 0.36f, p);
            p.setColor(0x66FFFFFF);
            c.drawCircle(cx - ro * 0.32f, cy - ro * 0.38f, ro * 0.13f, p);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(1.6f * d);
            if (pensando && giro != null) {
                c.save();
                c.rotate((t * 300f) % 360f, cx, cy);
                p.setShader(giro);
                c.drawCircle(cx, cy, ro + 0.8f * d, p);
                p.setShader(null);
                c.restore();
            } else if (borde != 0) {
                p.setColor(borde);
                c.drawCircle(cx, cy, ro + 0.8f * d, p);
            }
            if (pensando || borde != 0) {
                postInvalidateOnAnimation();
            } else {
                postInvalidateDelayed(40);
            }
        }
    }

    /** Iconos dibujados a mano: microfono, enviar, abrir Jarvis y plegar. Rebotan al tocarlos; el microfono puede pulsar. */
    static class Icono extends View {
        static final int MIC = 0;
        static final int ENVIAR = 1;
        static final int ABRIR = 2;
        static final int PLEGAR = 3;
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint pr = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path ph = new Path();
        private final RectF r = new RectF();
        private final float d;
        private final int tipo;
        private int color;
        private boolean pulso;

        Icono(Context cx, int tipo, int color) {
            super(cx);
            this.tipo = tipo;
            this.color = color;
            this.d = cx.getResources().getDisplayMetrics().density;
            pr.setStyle(Paint.Style.STROKE);
            setOnTouchListener((v, e) -> {
                int a = e.getActionMasked();
                if (a == MotionEvent.ACTION_DOWN) {
                    v.animate().scaleX(0.86f).scaleY(0.86f).setDuration(90).start();
                    try {
                        v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                    } catch (Exception ignorada) {
                    }
                } else if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) {
                    v.animate().scaleX(1f).scaleY(1f).setDuration(260)
                            .setInterpolator(new OvershootInterpolator(3f)).start();
                }
                return false;
            });
        }

        void color(int c) {
            color = c;
            invalidate();
        }

        /** Anillo que se expande y se desvanece detras del icono (por ejemplo mientras escucha). */
        void pulso(boolean on) {
            pulso = on;
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
            if (pulso) {
                float fase = (SystemClock.uptimeMillis() % 1100L) / 1100f;
                float rr = Math.min(getWidth(), getHeight()) / 2f;
                pr.setStrokeWidth(2f * d);
                pr.setColor(alfa(color, (int) ((1f - fase) * 170f)));
                c.drawCircle(getWidth() / 2f, getHeight() / 2f, rr * (0.62f + 0.38f * fase) - d, pr);
                postInvalidateOnAnimation();
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
