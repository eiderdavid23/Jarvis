package com.david.jarvis;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.system.Os;
import android.system.OsConstants;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

/** Modelo local: corre llama-server dentro de la APK y habla con el por 127.0.0.1. */
@CapacitorPlugin(name = "LlamaLocal")
public class LlamaPlugin extends Plugin {
    static final int PUERTO = 8089;
    static final String BASE = "http://127.0.0.1:" + PUERTO;

    /* id, nombre, archivo, url, tamano en MB (aprox.), RAM minima en GB */
    static final String[][] CATALOGO = {
        {"qwen35-08b", "Qwen3.5 0.8B", "Qwen3.5-0.8B-Q4_K_M.gguf",
            "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf", "533", "3"},
        {"qwen35-2b", "Qwen3.5 2B", "Qwen3.5-2B-Q4_K_M.gguf",
            "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf", "1280", "5"},
        {"qwen35-4b", "Qwen3.5 4B", "Qwen3.5-4B-Q4_K_M.gguf",
            "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf", "2740", "7"},
    };

    private static Process proceso;
    private static String idActivo = "";
    private static final LinkedList<String> registro = new LinkedList<>();
    private DescargaServicio.Oyente mio;
    private static volatile HttpURLConnection conexionChat;

    private static synchronized void log(String s) {
        registro.add(s);
        while (registro.size() > 60) registro.removeFirst();
    }

    private static synchronized String ultimasLineas() {
        StringBuilder b = new StringBuilder();
        for (String s : registro) b.append(s).append('\n');
        return b.toString();
    }

    private File binario() {
        return new File(getContext().getApplicationInfo().nativeLibraryDir, "libllama_server.so");
    }

    private File archivo(String nombre) {
        return new File(new File(getContext().getFilesDir(), "modelos"), nombre);
    }

    private static String[] buscar(String id) {
        for (String[] m : CATALOGO) if (m[0].equals(id)) return m;
        return null;
    }

    private static boolean vivo() {
        if (proceso == null) return false;
        try {
            proceso.exitValue();
            return false;
        } catch (IllegalThreadStateException e) {
            return true;
        }
    }

    private static synchronized void matar() {
        if (proceso != null) {
            proceso.destroy();
            proceso = null;
        }
        idActivo = "";
    }

    @Override
    public void load() {
        mio = (id, bytes, total, listo, error) -> evento(id, bytes, total, listo, error);
        DescargaServicio.oyente = mio;
    }

    @Override
    protected void handleOnDestroy() {
        matar();
        // La descarga sigue en el servicio; solo se suelta el oyente si todavia es el de esta pantalla.
        if (DescargaServicio.oyente == mio) DescargaServicio.oyente = null;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("binario", binario().exists());
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        if (am != null) am.getMemoryInfo(mi);
        r.put("ramTotalMb", mi.totalMem / 1048576L);
        r.put("ramLibreMb", mi.availMem / 1048576L);
        r.put("activo", vivo());
        r.put("modelo", idActivo);
        r.put("descargando", DescargaServicio.activo);
        if (DescargaServicio.activo) {
            JSObject d = new JSObject();
            long b = DescargaServicio.bytesActual, t = DescargaServicio.totalActual;
            d.put("id", DescargaServicio.idActual);
            d.put("bytes", b);
            d.put("total", t);
            d.put("pct", t > 0 ? (int) (b * 100L / t) : 0);
            r.put("descarga", d);
        }
        JSArray lista = new JSArray();
        for (String[] m : CATALOGO) {
            JSObject o = new JSObject();
            o.put("id", m[0]);
            o.put("nombre", m[1]);
            o.put("mb", Integer.parseInt(m[4]));
            o.put("ramMinGb", Integer.parseInt(m[5]));
            o.put("descargado", archivo(m[2]).exists());
            lista.put(o);
        }
        r.put("modelos", lista);
        r.put("registro", ultimasLineas());
        call.resolve(r);
    }

    private void evento(String id, long bytes, long total, boolean listo, String error) {
        JSObject o = new JSObject();
        o.put("id", id);
        o.put("bytes", bytes);
        o.put("total", total);
        o.put("pct", total > 0 ? (int) (bytes * 100L / total) : 0);
        o.put("listo", listo);
        o.put("error", error == null ? "" : error);
        notifyListeners("descarga", o);
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        final String[] m = buscar(call.getString("id", ""));
        if (m == null) { call.reject("Modelo desconocido"); return; }
        String error = DescargaServicio.pedir(getContext(), m[0], m[1], m[3], archivo(m[2]).getPath());
        if (error != null) { call.reject(error); return; }
        call.resolve();
    }

    @PluginMethod
    public void cancelarDescarga(PluginCall call) {
        DescargaServicio.cancelar = true;
        call.resolve();
    }

    @PluginMethod
    public void borrar(PluginCall call) {
        String[] m = buscar(call.getString("id", ""));
        if (m == null) { call.reject("Modelo desconocido"); return; }
        if (DescargaServicio.activo && m[0].equals(DescargaServicio.idActual)) {
            call.reject("Cancela la descarga antes de borrar");
            return;
        }
        if (m[0].equals(idActivo)) matar();
        archivo(m[2]).delete();
        new File(archivo(m[2]).getPath() + ".part").delete();
        call.resolve();
    }

    @PluginMethod
    public void detener(PluginCall call) {
        matar();
        call.resolve();
    }

    @PluginMethod
    public void iniciar(PluginCall call) {
        final String[] m = buscar(call.getString("id", ""));
        if (m == null) { call.reject("Modelo desconocido"); return; }
        final File bin = binario();
        final File gguf = archivo(m[2]);
        if (!bin.exists()) { call.reject("Esta APK no trae el motor del modelo local"); return; }
        if (!gguf.exists()) { call.reject("Primero descarga el modelo"); return; }
        if (vivo() && m[0].equals(idActivo)) { call.resolve(); return; }
        final int ctx = call.getInt("ctx", 4096);
        final int hilos = call.getInt("hilos", 4);
        new Thread(() -> arrancar(call, m, bin, gguf, ctx, hilos)).start();
    }

    private void arrancar(PluginCall call, String[] m, File bin, File gguf, int ctx, int hilos) {
        try {
            matar();
            synchronized (LlamaPlugin.class) { registro.clear(); }
            List<String> cmd = new ArrayList<>();
            cmd.add(bin.getPath());
            cmd.add("-m"); cmd.add(gguf.getPath());
            cmd.add("--host"); cmd.add("127.0.0.1");
            cmd.add("--port"); cmd.add(String.valueOf(PUERTO));
            cmd.add("-c"); cmd.add(String.valueOf(ctx));
            cmd.add("-t"); cmd.add(String.valueOf(hilos));
            cmd.add("-np"); cmd.add("1");
            cmd.add("--jinja");
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(getContext().getFilesDir());
            String lib = getContext().getApplicationInfo().nativeLibraryDir;
            String antes = pb.environment().get("LD_LIBRARY_PATH");
            pb.environment().put("LD_LIBRARY_PATH", lib + (antes == null ? "" : ":" + antes));
            pb.redirectErrorStream(true);
            final Process p = pb.start();
            proceso = p;
            idActivo = m[0];
            new Thread(() -> {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String l;
                    while ((l = r.readLine()) != null) log(l);
                } catch (Exception ignorar) { }
            }).start();
            long limite = System.currentTimeMillis() + 180000L;
            while (System.currentTimeMillis() < limite) {
                if (!vivo()) {
                    idActivo = "";
                    call.reject("El motor se cerro al arrancar:\n" + ultimasLineas());
                    return;
                }
                if (sano()) { call.resolve(); return; }
                Thread.sleep(700);
            }
            matar();
            call.reject("El modelo tardo demasiado en cargar (mas de 3 minutos)");
        } catch (Exception e) {
            matar();
            call.reject("No pude arrancar el motor: " + e.getMessage());
        }
    }

    private boolean sano() {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(BASE + "/health").openConnection();
            c.setConnectTimeout(800);
            c.setReadTimeout(800);
            int code = c.getResponseCode();
            c.disconnect();
            return code == 200;
        } catch (Exception e) {
            return false;
        }
    }

    private static long ticksAntes = -1, msAntes = 0;

    private static int pidMotor() {
        Process p = proceso;
        if (p == null) return -1;
        try {
            return ((Number) Process.class.getMethod("pid").invoke(p)).intValue();
        } catch (Throwable e) { /* Android anterior a 13 */ }
        try {
            java.lang.reflect.Field f = p.getClass().getDeclaredField("pid");
            f.setAccessible(true);
            return f.getInt(p);
        } catch (Throwable e) {
            return -1;
        }
    }

    private static long ramMotorKb(int pid) {
        try (BufferedReader r = new BufferedReader(new java.io.FileReader("/proc/" + pid + "/status"))) {
            String l;
            while ((l = r.readLine()) != null) {
                if (l.startsWith("VmRSS:")) return Long.parseLong(l.replaceAll("[^0-9]", ""));
            }
        } catch (Throwable e) { /* sin lectura */ }
        return 0;
    }

    private static long ticksMotor(int pid) {
        try (BufferedReader r = new BufferedReader(new java.io.FileReader("/proc/" + pid + "/stat"))) {
            String l = r.readLine();
            if (l == null) return -1;
            String[] f = l.substring(l.lastIndexOf(')') + 2).split(" ");
            return Long.parseLong(f[11]) + Long.parseLong(f[12]);
        } catch (Throwable e) {
            return -1;
        }
    }

    /** RAM y CPU reales del motor, RAM del celular y temperatura de la bateria (para el monitor en vivo). */
    @PluginMethod
    public void recursos(PluginCall call) {
        JSObject r = new JSObject();
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        if (am != null) am.getMemoryInfo(mi);
        r.put("ramTotalMb", mi.totalMem / 1048576L);
        r.put("ramLibreMb", mi.availMem / 1048576L);
        boolean on = vivo();
        r.put("activo", on);
        r.put("modelo", idActivo);
        double cpu = 0;
        long ramMb = 0;
        if (on) {
            int pid = pidMotor();
            if (pid > 0) {
                ramMb = ramMotorKb(pid) / 1024L;
                long t = ticksMotor(pid), ahora = System.currentTimeMillis();
                if (t >= 0 && ticksAntes >= 0 && ahora > msAntes) {
                    long tck = Os.sysconf(OsConstants._SC_CLK_TCK);
                    int nucleos = Math.max(1, Runtime.getRuntime().availableProcessors());
                    cpu = (t - ticksAntes) * 1000.0 / tck / (ahora - msAntes) / nucleos * 100.0;
                    cpu = Math.max(0, Math.min(100, cpu));
                }
                ticksAntes = t;
                msAntes = ahora;
            }
        } else {
            ticksAntes = -1;
        }
        r.put("ramModeloMb", ramMb);
        r.put("cpuPct", cpu);
        Intent b = getContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int tt = b == null ? -1 : b.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1);
        r.put("tempC", tt < 0 ? -1 : tt / 10.0);
        call.resolve(r);
    }

    @PluginMethod
    public void detenerChat(PluginCall call) {
        HttpURLConnection c = conexionChat;
        if (c != null) c.disconnect();
        call.resolve();
    }

    /** mensajes: [{role, content}]. Emite eventos "token" {texto} y devuelve {texto}. */
    @PluginMethod
    public void chat(PluginCall call) {
        final JSArray mensajes = call.getArray("mensajes");
        if (mensajes == null) { call.reject("Faltan los mensajes"); return; }
        if (!vivo()) { call.reject("El modelo local no esta encendido"); return; }
        final int maxTokens = call.getInt("maxTokens", 1024);
        final double temp = call.getDouble("temperatura", 0.7);
        final boolean pensar = call.getBoolean("pensar", false);
        new Thread(() -> conversar(call, mensajes, maxTokens, temp, pensar)).start();
    }

    private void conversar(PluginCall call, JSArray mensajes, int maxTokens, double temp, boolean pensar) {
        StringBuilder todo = new StringBuilder();
        try {
            JSObject cuerpo = new JSObject();
            cuerpo.put("model", "local");
            cuerpo.put("messages", mensajes);
            cuerpo.put("stream", true);
            cuerpo.put("max_tokens", maxTokens);
            cuerpo.put("temperature", temp);
            JSObject kw = new JSObject();
            kw.put("enable_thinking", pensar);
            cuerpo.put("chat_template_kwargs", kw);
            HttpURLConnection c = (HttpURLConnection) new URL(BASE + "/v1/chat/completions").openConnection();
            conexionChat = c;
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setConnectTimeout(5000);
            c.setReadTimeout(300000);
            c.setRequestProperty("Content-Type", "application/json");
            try (OutputStream o = c.getOutputStream()) {
                o.write(cuerpo.toString().getBytes("UTF-8"));
            }
            int code = c.getResponseCode();
            if (code != 200) throw new Exception("El motor respondio " + code);
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
                String l;
                while ((l = r.readLine()) != null) {
                    if (!l.startsWith("data:")) continue;
                    String d = l.substring(5).trim();
                    if (d.equals("[DONE]")) break;
                    JSONArray ch = new JSONObject(d).optJSONArray("choices");
                    if (ch == null || ch.length() == 0) continue;
                    JSONObject delta = ch.optJSONObject(0).optJSONObject("delta");
                    if (delta == null) continue;
                    String t = delta.isNull("content") ? "" : delta.optString("content", "");
                    if (t.isEmpty()) continue;
                    todo.append(t);
                    JSObject ev = new JSObject();
                    ev.put("texto", t);
                    notifyListeners("token", ev);
                }
            }
            JSObject res = new JSObject();
            res.put("texto", todo.toString());
            call.resolve(res);
        } catch (Exception e) {
            if (todo.length() > 0) {
                JSObject res = new JSObject();
                res.put("texto", todo.toString());
                res.put("cortado", true);
                call.resolve(res);
            } else {
                call.reject("Error del modelo local: " + e.getMessage());
            }
        } finally {
            conexionChat = null;
        }
    }
}
