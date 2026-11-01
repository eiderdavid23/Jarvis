package com.david.jarvis;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeSet;

/** Las ordenes que Jarvis puede dar a la TV (lista fija). Java puro, igual que agente_tv.py. */
final class TvOrdenes {

    private TvOrdenes() {
    }

    static final Map<String, Integer> TECLAS = new LinkedHashMap<String, Integer>();
    static final Map<String, String> ALIAS_TECLA = new LinkedHashMap<String, String>();
    static final Map<String, String> APPS = new LinkedHashMap<String, String>();
    static final Map<String, String> ALIAS_APP = new LinkedHashMap<String, String>();
    static final int K_POWER = 26;
    static final int K_VOL_MAS = 24;
    static final int K_VOL_MENOS = 25;
    static final int K_MUTE = 164;

    private static void t(String n, int c) {
        TECLAS.put(n, Integer.valueOf(c));
    }

    static {
        t("inicio", 3);
        t("atras", 4);
        t("arriba", 19);
        t("abajo", 20);
        t("izquierda", 21);
        t("derecha", 22);
        t("ok", 23);
        t("enter", 66);
        t("menu", 82);
        t("buscar", 84);
        t("play_pausa", 85);
        t("parar", 86);
        t("siguiente", 87);
        t("anterior", 88);
        t("adelantar", 90);
        t("retroceder", 89);
        t("play", 126);
        t("pausa", 127);
        t("canal_mas", 166);
        t("canal_menos", 167);
        t("info", 165);
        t("entrada", 178);
        t("ajustes", 176);
        t("guia", 172);
        String[][] al = {{"home", "inicio"}, {"back", "atras"}, {"volver", "atras"}, {"up", "arriba"},
                {"down", "abajo"}, {"left", "izquierda"}, {"right", "derecha"}, {"select", "ok"},
                {"aceptar", "ok"}, {"centro", "ok"}, {"settings", "ajustes"}, {"configuracion", "ajustes"},
                {"input", "entrada"}, {"fuente", "entrada"}, {"pausar", "pausa"}, {"reproducir", "play"},
                {"playpause", "play_pausa"}, {"siguiente_canal", "canal_mas"}, {"canal_arriba", "canal_mas"},
                {"canal_abajo", "canal_menos"}, {"next", "siguiente"}, {"previous", "anterior"}, {"stop", "parar"}};
        for (String[] x : al) {
            ALIAS_TECLA.put(x[0], x[1]);
        }
        APPS.put("youtube", "https://www.youtube.com");
        APPS.put("netflix", "market://launch?id=com.netflix.ninja");
        APPS.put("prime video", "market://launch?id=com.amazon.amazonvideo.livingroom");
        APPS.put("disney", "market://launch?id=com.disney.disneyplus");
        APPS.put("spotify", "market://launch?id=com.spotify.tv.android");
        APPS.put("youtube music", "market://launch?id=com.google.android.youtube.tvmusic");
        APPS.put("play store", "market://launch?id=com.android.vending");
        APPS.put("twitch", "market://launch?id=tv.twitch.android.app");
        String[][] aa = {{"yt", "youtube"}, {"you tube", "youtube"}, {"prime", "prime video"},
                {"amazon", "prime video"}, {"amazon prime", "prime video"}, {"disney+", "disney"},
                {"disney plus", "disney"}, {"tienda", "play store"}, {"google play", "play store"}};
        for (String[] x : aa) {
            ALIAS_APP.put(x[0], x[1]);
        }
    }

    static String limpio(Object o) {
        String s = o == null ? "" : String.valueOf(o);
        s = Normalizer.normalize(s.toLowerCase(), Normalizer.Form.NFD);
        return s.replaceAll("\\p{M}", "").trim();
    }

    private static int entero(Map<String, Object> a, String k, int def) {
        Object o = a.get(k);
        if (o == null) {
            return def;
        }
        try {
            return (int) Math.round(Double.parseDouble(String.valueOf(o)));
        } catch (NumberFormatException e) {
            return def;
        }
    }

    // ---- Conexion con reintento ------------------------------------------------------

    private static void conectar(TvRemoto tv, String ip) throws Exception {
        if (!tv.conectada()) {
            tv.conectar(ip);
        }
    }

    private static void tecla(TvRemoto tv, String ip, int codigo, int veces) throws Exception {
        conectar(tv, ip);
        try {
            tv.tecla(codigo, veces);
        } catch (Exception e) {
            tv.cerrar();
            tv.conectar(ip);
            tv.tecla(codigo, veces);
        }
    }

    private static void enlace(TvRemoto tv, String ip, String url) throws Exception {
        conectar(tv, ip);
        try {
            tv.abrirEnlace(url);
        } catch (Exception e) {
            tv.cerrar();
            tv.conectar(ip);
            tv.abrirEnlace(url);
        }
    }

    private static String txtVol(int[] v) {
        return v == null ? "Volumen desconocido" : "Volumen " + v[0] + "/" + v[1] + (v[2] != 0 ? " (en silencio)" : "");
    }

    // ---- Acciones -------------------------------------------------------------------

    /** Ejecuta una orden tv_* y devuelve el texto del resultado. Si algo falla lanza TvRemoto.Fallo u otra excepcion. */
    static String ejecutar(TvRemoto tv, String ip, String tipo, Map<String, Object> a) throws Exception {
        if ("tv_estado".equals(tipo)) {
            conectar(tv, ip);
            Boolean on = tv.esperarEstado(1500);
            return "TV " + tv.modelo() + ": " + (on == null ? "estado desconocido" : on ? "encendida" : "apagada")
                    + ". " + txtVol(tv.volumen(1500)) + ".";
        }
        if ("tv_encender".equals(tipo)) {
            conectar(tv, ip);
            Boolean on = tv.esperarEstado(1500);
            if (on != null && on) {
                return "La TV ya estaba encendida.";
            }
            tecla(tv, ip, K_POWER, 1);
            Thread.sleep(2000);
            Boolean ahora = tv.encendida();
            return ahora != null && ahora ? "TV encendida." : "Orden de encender enviada.";
        }
        if ("tv_apagar".equals(tipo)) {
            conectar(tv, ip);
            Boolean on = tv.esperarEstado(1500);
            if (on != null && !on) {
                return "La TV ya estaba apagada.";
            }
            tecla(tv, ip, K_POWER, 1);
            return "Orden de apagar enviada.";
        }
        if ("tv_volumen".equals(tipo)) {
            return volumen(tv, ip, a);
        }
        if ("tv_tecla".equals(tipo)) {
            String n = limpio(a.get("tecla")).replace(' ', '_');
            if (ALIAS_TECLA.containsKey(n)) {
                n = ALIAS_TECLA.get(n);
            }
            if (!TECLAS.containsKey(n)) {
                throw new TvRemoto.Fallo("Tecla no permitida. Puedo: " + new TreeSet<String>(TECLAS.keySet()));
            }
            int veces = Math.max(1, Math.min(10, entero(a, "veces", 1)));
            tecla(tv, ip, TECLAS.get(n).intValue(), veces);
            return "Puls\u00e9 " + n + (veces > 1 ? " x" + veces : "") + ".";
        }
        if ("tv_abrir_app".equals(tipo)) {
            String n = limpio(a.get("nombre"));
            if (ALIAS_APP.containsKey(n)) {
                n = ALIAS_APP.get(n);
            }
            if (!APPS.containsKey(n)) {
                throw new TvRemoto.Fallo("No conozco esa app. Puedo abrir: " + new TreeSet<String>(APPS.keySet()));
            }
            enlace(tv, ip, APPS.get(n));
            return "Abr\u00ed " + n + " en la TV.";
        }
        if ("tv_abrir_url".equals(tipo)) {
            String url = String.valueOf(a.get("url") == null ? "" : a.get("url")).trim();
            if (!url.matches("^https?://\\S+$")) {
                throw new TvRemoto.Fallo("El enlace debe empezar por http:// o https://");
            }
            enlace(tv, ip, url);
            return "Mand\u00e9 el enlace a la TV.";
        }
        throw new TvRemoto.Fallo("Esta TV no conoce la accion " + (tipo.length() > 30 ? tipo.substring(0, 30) : tipo));
    }

    private static String volumen(TvRemoto tv, String ip, Map<String, Object> a) throws Exception {
        String modo = limpio(a.get("modo"));
        conectar(tv, ip);
        if (modo.equals("subir") || modo.equals("bajar")) {
            int pasos = Math.max(1, Math.min(10, entero(a, "pasos", 3)));
            tecla(tv, ip, modo.equals("subir") ? K_VOL_MAS : K_VOL_MENOS, pasos * 2);
            Thread.sleep(400);
            return "Volumen " + modo + ". " + txtVol(tv.volumen(1000)) + ".";
        }
        if (modo.equals("silenciar") || modo.equals("activar_sonido")) {
            int[] v = tv.volumen(2000);
            if (v == null) {
                throw new TvRemoto.Fallo("La TV no informa si esta en silencio; no quiero adivinar.");
            }
            boolean quiere = modo.equals("silenciar");
            if ((v[2] != 0) == quiere) {
                return "La TV ya estaba " + (quiere ? "en silencio." : "con sonido.");
            }
            tecla(tv, ip, K_MUTE, 1);
            Thread.sleep(400);
            return quiere ? "TV en silencio." : "Sonido activado. " + txtVol(tv.volumen(1000)) + ".";
        }
        if (modo.equals("poner")) {
            if (a.get("nivel") == null) {
                throw new TvRemoto.Fallo("Falta el nivel de volumen (0 a 100).");
            }
            int meta = entero(a, "nivel", -1);
            if (meta < 0 || meta > 100) {
                throw new TvRemoto.Fallo("El nivel va de 0 a 100.");
            }
            int[] v = tv.volumen(2000);
            if (v == null) {
                throw new TvRemoto.Fallo("La TV no informa su volumen; no puedo poner un nivel exacto.");
            }
            if (v[2] != 0) {
                tecla(tv, ip, K_MUTE, 1);
                Thread.sleep(400);
                int[] n = tv.volumen(1000);
                v = n != null ? n : v;
            }
            if (v[1] != 100) {
                meta = Math.round(meta * v[1] / 100f);
            }
            for (int i = 0; i < 80; i++) {
                v = tv.volumen(1000);
                if (v == null || v[0] == meta) {
                    break;
                }
                tecla(tv, ip, v[0] < meta ? K_VOL_MAS : K_VOL_MENOS, 1);
                Thread.sleep(250);
            }
            v = tv.volumen(1000);
            if (v == null || v[0] != meta) {
                throw new TvRemoto.Fallo("No logr\u00e9 dejar el volumen en " + meta + ". " + txtVol(v) + ".");
            }
            return "Volumen puesto. " + txtVol(v) + ".";
        }
        throw new TvRemoto.Fallo("modo de volumen no valido (subir, bajar, silenciar, activar_sonido o poner)");
    }
}
