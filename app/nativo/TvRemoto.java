package com.david.jarvis;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Principal;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.KeyManager;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509ExtendedKeyManager;
import javax.net.ssl.X509TrustManager;

/** Control remoto de una Android TV / Google TV (protocolo Remote v2). Java puro: sin Termux. */
public class TvRemoto {

    public static class Fallo extends Exception {
        public Fallo(String m) {
            super(m);
        }
    }

    static int puertoRemoto = 6466;
    static int puertoEmparejar = 6467;

    private final File carpeta;
    private X509Certificate cert;
    private PrivateKey llave;

    private SSLSocket pSock;
    private InputStream pIn;
    private OutputStream pOut;
    private X509Certificate pServidor;

    private SSLSocket sock;
    private OutputStream out;
    private volatile boolean vivo;
    private volatile boolean lista;
    private volatile Boolean encendida;
    private volatile int[] vol;
    private volatile String modelo = "";
    private CountDownLatch listo = new CountDownLatch(1);
    private final Object escritura = new Object();

    public TvRemoto(File carpeta) {
        this.carpeta = carpeta;
    }

    // ---- Protobuf minimo --------------------------------------------------------

    static void varint(ByteArrayOutputStream b, long v) {
        while ((v & ~0x7FL) != 0) {
            b.write((int) ((v & 0x7F) | 0x80));
            v >>>= 7;
        }
        b.write((int) v);
    }

    static byte[] unir(byte[]... partes) {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        for (byte[] p : partes) {
            b.write(p, 0, p.length);
        }
        return b.toByteArray();
    }

    static byte[] num(int f, long v) {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        varint(b, (long) f << 3);
        varint(b, v);
        return b.toByteArray();
    }

    static byte[] bytes(int f, byte[] d) {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        varint(b, ((long) f << 3) | 2);
        varint(b, d.length);
        b.write(d, 0, d.length);
        return b.toByteArray();
    }

    static byte[] txt(int f, String s) {
        return bytes(f, s.getBytes(StandardCharsets.UTF_8));
    }

    /** Lee un mensaje: cada campo queda como Long (numero) o byte[] (texto o submensaje). */
    static Map<Integer, Object> leer(byte[] d) throws Fallo {
        Map<Integer, Object> m = new HashMap<Integer, Object>();
        int p = 0;
        while (p < d.length) {
            long k = 0;
            int sh = 0;
            while (true) {
                if (p >= d.length || sh > 63) {
                    throw new Fallo("Mensaje de la TV danado");
                }
                int c = d[p++] & 0xFF;
                k |= (long) (c & 0x7F) << sh;
                sh += 7;
                if ((c & 0x80) == 0) {
                    break;
                }
            }
            int campo = (int) (k >>> 3);
            int tipo = (int) (k & 7);
            if (tipo == 0) {
                long v = 0;
                sh = 0;
                while (true) {
                    if (p >= d.length || sh > 63) {
                        throw new Fallo("Mensaje de la TV danado");
                    }
                    int c = d[p++] & 0xFF;
                    v |= (long) (c & 0x7F) << sh;
                    sh += 7;
                    if ((c & 0x80) == 0) {
                        break;
                    }
                }
                m.put(campo, Long.valueOf(v));
            } else if (tipo == 2) {
                long n = 0;
                sh = 0;
                while (true) {
                    if (p >= d.length || sh > 35) {
                        throw new Fallo("Mensaje de la TV danado");
                    }
                    int c = d[p++] & 0xFF;
                    n |= (long) (c & 0x7F) << sh;
                    sh += 7;
                    if ((c & 0x80) == 0) {
                        break;
                    }
                }
                if (n < 0 || p + n > d.length) {
                    throw new Fallo("Mensaje de la TV danado");
                }
                byte[] x = new byte[(int) n];
                System.arraycopy(d, p, x, 0, (int) n);
                p += (int) n;
                m.put(campo, x);
            } else if (tipo == 1) {
                p += 8;
            } else if (tipo == 5) {
                p += 4;
            } else {
                throw new Fallo("Mensaje de la TV no entendido");
            }
        }
        return m;
    }

    static long numero(Map<Integer, Object> m, int f, long def) {
        Object o = m == null ? null : m.get(f);
        return o instanceof Long ? ((Long) o).longValue() : def;
    }

    static Map<Integer, Object> sub(Map<Integer, Object> m, int f) throws Fallo {
        Object o = m == null ? null : m.get(f);
        return o instanceof byte[] ? leer((byte[]) o) : null;
    }

    static String texto(Map<Integer, Object> m, int f) {
        Object o = m == null ? null : m.get(f);
        return o instanceof byte[] ? new String((byte[]) o, StandardCharsets.UTF_8) : "";
    }

    static void enviar(OutputStream o, byte[] msg) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        varint(b, msg.length);
        b.write(msg, 0, msg.length);
        o.write(b.toByteArray());
        o.flush();
    }

    static byte[] recibir(InputStream i) throws IOException {
        long n = 0;
        int sh = 0;
        while (true) {
            int c = i.read();
            if (c < 0) {
                throw new IOException("conexion cerrada");
            }
            n |= (long) (c & 0x7F) << sh;
            if ((c & 0x80) == 0) {
                break;
            }
            sh += 7;
            if (sh > 28) {
                throw new IOException("mensaje invalido");
            }
        }
        if (n > 1000000) {
            throw new IOException("mensaje demasiado grande");
        }
        byte[] d = new byte[(int) n];
        int p = 0;
        while (p < n) {
            int r = i.read(d, p, (int) n - p);
            if (r < 0) {
                throw new IOException("conexion cerrada");
            }
            p += r;
        }
        return d;
    }

    // ---- Certificado propio de Jarvis (se crea una vez) -------------------------------

    static byte[] der(int tag, byte[]... partes) {
        byte[] c = unir(partes);
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        b.write(tag);
        int n = c.length;
        if (n < 128) {
            b.write(n);
        } else if (n < 256) {
            b.write(0x81);
            b.write(n);
        } else {
            b.write(0x82);
            b.write(n >> 8);
            b.write(n & 255);
        }
        b.write(c, 0, c.length);
        return b.toByteArray();
    }

    private static byte[] crearCertificado(KeyPair kp) throws Exception {
        byte[] alg = der(0x30, new byte[]{0x06, 0x09, 0x2A, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xF7, 0x0D, 0x01, 0x01, 0x0B},
                new byte[]{0x05, 0x00});
        byte[] nombre = der(0x30, der(0x31, der(0x30, new byte[]{0x06, 0x03, 0x55, 0x04, 0x03},
                der(0x0C, "Jarvis".getBytes(StandardCharsets.UTF_8)))));
        byte[] valido = der(0x30, der(0x17, "200101000000Z".getBytes(StandardCharsets.US_ASCII)),
                der(0x17, "491231235959Z".getBytes(StandardCharsets.US_ASCII)));
        byte[] serie = new byte[8];
        new SecureRandom().nextBytes(serie);
        serie[0] = (byte) ((serie[0] & 0x7F) | 0x01);
        byte[] tbs = der(0x30, new byte[]{(byte) 0xA0, 0x03, 0x02, 0x01, 0x02}, der(0x02, serie), alg, nombre, valido,
                nombre, kp.getPublic().getEncoded());
        Signature f = Signature.getInstance("SHA256withRSA");
        f.initSign(kp.getPrivate());
        f.update(tbs);
        byte[] firma = f.sign();
        return der(0x30, tbs, alg, der(0x03, new byte[]{0}, firma));
    }

    public boolean hayCredencial() {
        return new File(carpeta, "tv_cert.der").exists() && new File(carpeta, "tv_key.pk8").exists();
    }

    private static byte[] leerArchivo(File f) throws IOException {
        FileInputStream in = new FileInputStream(f);
        try {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) {
                b.write(buf, 0, n);
            }
            return b.toByteArray();
        } finally {
            in.close();
        }
    }

    private static void escribirArchivo(File f, byte[] d) throws IOException {
        FileOutputStream o = new FileOutputStream(f);
        try {
            o.write(d);
        } finally {
            o.close();
        }
    }

    private synchronized void cargarCredencial(boolean crear) throws Exception {
        if (cert != null && llave != null) {
            return;
        }
        File fc = new File(carpeta, "tv_cert.der");
        File fk = new File(carpeta, "tv_key.pk8");
        if (!(fc.exists() && fk.exists())) {
            if (!crear) {
                throw new Fallo("Esta TV aun no esta emparejada con Jarvis.");
            }
            carpeta.mkdirs();
            KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
            g.initialize(2048);
            KeyPair kp = g.generateKeyPair();
            escribirArchivo(fc, crearCertificado(kp));
            escribirArchivo(fk, kp.getPrivate().getEncoded());
        }
        cert = (X509Certificate) CertificateFactory.getInstance("X.509")
                .generateCertificate(new java.io.ByteArrayInputStream(leerArchivo(fc)));
        llave = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(leerArchivo(fk)));
    }

    /** Borra el certificado: las TVs ya emparejadas dejaran de reconocer a Jarvis. */
    public synchronized void olvidar() {
        cerrar();
        emparejarCancelar();
        new File(carpeta, "tv_cert.der").delete();
        new File(carpeta, "tv_key.pk8").delete();
        cert = null;
        llave = null;
    }

    // ---- Conexion segura -----------------------------------------------------------

    private static class Llaves extends X509ExtendedKeyManager {
        private final X509Certificate c;
        private final PrivateKey k;

        Llaves(X509Certificate c, PrivateKey k) {
            this.c = c;
            this.k = k;
        }

        public String chooseClientAlias(String[] t, Principal[] i, Socket s) {
            return "jarvis";
        }

        public String chooseEngineClientAlias(String[] t, Principal[] i, SSLEngine e) {
            return "jarvis";
        }

        public String chooseServerAlias(String t, Principal[] i, Socket s) {
            return null;
        }

        public X509Certificate[] getCertificateChain(String a) {
            return new X509Certificate[]{c};
        }

        public String[] getClientAliases(String t, Principal[] i) {
            return new String[]{"jarvis"};
        }

        public PrivateKey getPrivateKey(String a) {
            return k;
        }

        public String[] getServerAliases(String t, Principal[] i) {
            return null;
        }
    }

    /** La TV usa un certificado propio; Jarvis solo se conecta a la IP que el usuario eligio. */
    private static class Confia implements X509TrustManager {
        public void checkClientTrusted(X509Certificate[] c, String t) {
        }

        public void checkServerTrusted(X509Certificate[] c, String t) {
        }

        public X509Certificate[] getAcceptedIssuers() {
            return new X509Certificate[0];
        }
    }

    private SSLSocket abrir(String ip, int puerto) throws Exception {
        SSLContext c = SSLContext.getInstance("TLS");
        c.init(new KeyManager[]{new Llaves(cert, llave)}, new TrustManager[]{new Confia()}, null);
        SSLSocket s = (SSLSocket) c.getSocketFactory().createSocket();
        try {
            s.connect(new InetSocketAddress(ip, puerto), 6000);
            s.setSoTimeout(15000);
            s.startHandshake();
        } catch (Exception e) {
            try {
                s.close();
            } catch (Exception ignorada) {
            }
            throw e;
        }
        return s;
    }

    public static String mensaje(Exception e) {
        if (e instanceof Fallo) {
            return e.getMessage();
        }
        if (e instanceof SSLHandshakeException) {
            return "La TV no acepto la conexion segura. Prueba emparejarla de nuevo.";
        }
        if (e instanceof java.net.SocketTimeoutException || e instanceof java.net.ConnectException
                || e instanceof java.net.NoRouteToHostException || e instanceof java.net.UnknownHostException) {
            return "No llego a la TV. Revisa que este encendida (o en reposo con WiFi) y en el mismo WiFi que el celular.";
        }
        String m = e.getMessage();
        return "Error con la TV: " + (m == null ? e.getClass().getSimpleName() : m);
    }

    // ---- Emparejar (una sola vez por TV) -------------------------------------------------

    private static byte[] msgEmparejar(byte[] cuerpo) {
        return unir(num(1, 2), num(2, 200), cuerpo);
    }

    private static void esperarOk(InputStream i) throws Exception {
        Map<Integer, Object> m = leer(recibir(i));
        long est = numero(m, 2, 0);
        if (est != 200) {
            throw new Fallo("La TV rechazo el emparejamiento (estado " + est + ").");
        }
    }

    /** Abre el emparejamiento: la TV muestra un codigo de 6 caracteres. */
    public synchronized void emparejarIniciar(String ip) throws Exception {
        emparejarCancelar();
        cargarCredencial(true);
        pSock = abrir(ip, puertoEmparejar);
        pIn = pSock.getInputStream();
        pOut = pSock.getOutputStream();
        pServidor = (X509Certificate) pSock.getSession().getPeerCertificates()[0];
        enviar(pOut, msgEmparejar(bytes(10, unir(txt(1, "Jarvis"), txt(2, "androidtvremote2")))));
        esperarOk(pIn);
        byte[] cod = unir(num(1, 3), num(2, 6));
        enviar(pOut, msgEmparejar(bytes(20, unir(bytes(1, cod), num(3, 1)))));
        esperarOk(pIn);
        enviar(pOut, msgEmparejar(bytes(30, unir(bytes(1, cod), num(2, 1)))));
        esperarOk(pIn);
    }

    private static byte[] sinCero(byte[] b) {
        int i = 0;
        while (i < b.length - 1 && b[i] == 0) {
            i++;
        }
        byte[] r = new byte[b.length - i];
        System.arraycopy(b, i, r, 0, r.length);
        return r;
    }

    /** Termina el emparejamiento con el codigo que salio en la TV. Si el codigo esta mal, se puede reintentar. */
    public synchronized void emparejarTerminar(String codigo) throws Exception {
        if (pSock == null) {
            throw new Fallo("Primero inicia el emparejamiento.");
        }
        String c = codigo == null ? "" : codigo.trim().toUpperCase();
        if (!c.matches("[0-9A-F]{6}")) {
            throw new Fallo("El codigo tiene 6 caracteres (numeros y letras de la A a la F).");
        }
        byte[] cb = new byte[3];
        for (int i = 0; i < 3; i++) {
            cb[i] = (byte) Integer.parseInt(c.substring(i * 2, i * 2 + 2), 16);
        }
        RSAPublicKey cl = (RSAPublicKey) cert.getPublicKey();
        RSAPublicKey sv = (RSAPublicKey) pServidor.getPublicKey();
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        md.update(sinCero(cl.getModulus().toByteArray()));
        md.update(sinCero(cl.getPublicExponent().toByteArray()));
        md.update(sinCero(sv.getModulus().toByteArray()));
        md.update(sinCero(sv.getPublicExponent().toByteArray()));
        md.update(cb, 1, 2);
        byte[] h = md.digest();
        if (h[0] != cb[0]) {
            throw new Fallo("Codigo incorrecto. Mira bien la TV y escribelo otra vez.");
        }
        enviar(pOut, msgEmparejar(bytes(40, bytes(1, h))));
        esperarOk(pIn);
        emparejarCancelar();
    }

    public synchronized void emparejarCancelar() {
        try {
            if (pSock != null) {
                pSock.close();
            }
        } catch (Exception ignorada) {
        }
        pSock = null;
        pIn = null;
        pOut = null;
        pServidor = null;
    }

    // ---- Control (conexion que se queda abierta) --------------------------------------------

    public boolean conectada() {
        return vivo && lista;
    }

    public String modelo() {
        return modelo;
    }

    /** true / false si la TV ya informo si esta encendida; null si aun no sabe. */
    public Boolean encendida() {
        return encendida;
    }

    public synchronized void conectar(String ip) throws Exception {
        cerrar();
        cargarCredencial(false);
        final SSLSocket s = abrir(ip, puertoRemoto);
        s.setSoTimeout(40000);
        final java.io.InputStream entrada = s.getInputStream();
        sock = s;
        out = s.getOutputStream();
        vivo = true;
        lista = false;
        encendida = null;
        vol = null;
        listo = new CountDownLatch(1);
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                bucle(s, entrada);
            }
        }, "tv-remoto");
        t.setDaemon(true);
        t.start();
        listo.await(10, TimeUnit.SECONDS);
        if (!(vivo && lista)) {
            cerrar();
            throw new Fallo("La TV cerro la conexion. Puede que haya que emparejarla de nuevo.");
        }
    }

    private void bucle(SSLSocket s, InputStream entrada) {
        try {
            while (vivo && sock == s) {
                atender(leer(recibir(entrada)));
            }
        } catch (Exception ignorada) {
        } finally {
            if (sock == s) {
                vivo = false;
            }
            try {
                s.close();
            } catch (Exception ignorada) {
            }
            listo.countDown();
        }
    }

    private void atender(Map<Integer, Object> m) throws Exception {
        Map<Integer, Object> conf = sub(m, 1);
        if (conf != null) {
            Map<Integer, Object> dev = sub(conf, 2);
            if (dev != null) {
                modelo = (texto(dev, 2) + " " + texto(dev, 1)).trim();
            }
            byte[] info = unir(txt(1, "Jarvis"), txt(2, "Google"), num(3, 1), txt(4, "1"), txt(5, "com.david.jarvis"),
                    txt(6, "1.0.0"));
            mandar(bytes(1, unir(num(1, 622), bytes(2, info))));
            return;
        }
        if (m.get(2) != null) {
            mandar(bytes(2, num(1, 622)));
            lista = true;
            listo.countDown();
            return;
        }
        Map<Integer, Object> ping = sub(m, 8);
        if (ping != null) {
            mandar(bytes(9, num(1, numero(ping, 1, 0))));
            return;
        }
        Map<Integer, Object> inicio = sub(m, 40);
        if (inicio != null) {
            encendida = numero(inicio, 1, 0) != 0;
            return;
        }
        Map<Integer, Object> v = sub(m, 50);
        if (v != null && numero(v, 6, 0) > 0) {
            vol = new int[]{(int) numero(v, 7, 0), (int) numero(v, 6, 0), numero(v, 8, 0) != 0 ? 1 : 0};
        }
    }

    private void mandar(byte[] msg) throws IOException {
        synchronized (escritura) {
            if (out == null) {
                throw new IOException("sin conexion");
            }
            enviar(out, msg);
        }
    }

    private void asegurar() throws Fallo {
        if (!conectada()) {
            throw new Fallo("Jarvis no esta conectado a la TV.");
        }
    }

    public synchronized void cerrar() {
        vivo = false;
        lista = false;
        try {
            if (sock != null) {
                sock.close();
            }
        } catch (Exception ignorada) {
        }
        sock = null;
        out = null;
    }

    /** Espera hasta que la TV informe si esta encendida (o se acabe el tiempo). */
    public Boolean esperarEstado(long ms) throws InterruptedException {
        long fin = System.currentTimeMillis() + ms;
        while (encendida == null && vivo && System.currentTimeMillis() < fin) {
            Thread.sleep(80);
        }
        return encendida;
    }

    /** {nivel, maximo, silenciado 0/1} o null si la TV no lo informa. */
    public int[] volumen(long ms) throws InterruptedException {
        long fin = System.currentTimeMillis() + ms;
        while (vol == null && vivo && System.currentTimeMillis() < fin) {
            Thread.sleep(80);
        }
        return vol;
    }

    public void tecla(int codigo, int veces) throws Exception {
        asegurar();
        for (int i = 0; i < veces; i++) {
            mandar(bytes(10, unir(num(1, codigo), num(2, 3))));
            if (i < veces - 1) {
                Thread.sleep(120);
            }
        }
    }

    public void abrirEnlace(String enlace) throws Exception {
        asegurar();
        mandar(bytes(90, txt(1, enlace)));
    }
}
