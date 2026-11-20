// Doble aplauso: lee el microfono y avisa cuando oye dos palmadas seguidas.
// El audio se analiza en el celular y no se graba ni se envia a ningun servidor.

// Detector puro: se le da el volumen (rms) y la hora en ms; devuelve true al oir el doble aplauso.
// Una palmada es un golpe corto y muy fuerte (sube de golpe y dura menos de 250 ms), asi que
// la voz y la musica, que duran mas, no la activan.
export function crearDetector({ minimo = 0.1, razon = 4, minGap = 150, maxGap = 900, maxDuracion = 250, enfriar = 3000 } = {}) {
  let base = 0.01;          // ruido de fondo, se aprende solo
  let previo = 0;
  let enPico = false;
  let inicio = 0;
  let candidato = false;    // este golpe llego en el momento justo despues de otro
  let tPrimero = -Infinity; // inicio del golpe anterior valido
  let tAviso = -Infinity;

  return function procesar(rms, t) {
    const umbral = Math.max(minimo, base * razon);
    if (!enPico) {
      if (rms > umbral && rms > previo * 2) {
        enPico = true;
        inicio = t;
        const gap = t - tPrimero;
        candidato = gap >= minGap && gap <= maxGap && t - tAviso > enfriar;
      } else if (rms <= umbral) {
        base = base * 0.98 + rms * 0.02;
      }
      previo = rms;
      return false;
    }
    previo = rms;
    if (rms < umbral * 0.5) {
      enPico = false;
      if (t - inicio > maxDuracion) { tPrimero = -Infinity; return false; } // muy largo: voz o musica
      if (candidato) { tAviso = t; tPrimero = -Infinity; return true; }
      tPrimero = inicio;
    }
    return false;
  };
}

// Abre el microfono y llama a alDetectar() con cada doble aplauso. Devuelve { parar }.
export async function escucharAplauso(alDetectar) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('sin-microfono');
  const flujo = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const Contexto = window.AudioContext || window.webkitAudioContext;
  const ctx = new Contexto();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const fuente = ctx.createMediaStreamSource(flujo);
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 512;
  fuente.connect(analizador);

  const datos = new Float32Array(analizador.fftSize);
  const detectar = crearDetector();
  const reloj = setInterval(() => {
    analizador.getFloatTimeDomainData(datos);
    let suma = 0;
    for (let i = 0; i < datos.length; i++) suma += datos[i] * datos[i];
    if (detectar(Math.sqrt(suma / datos.length), performance.now())) alDetectar();
  }, 20);

  return {
    parar() {
      clearInterval(reloj);
      flujo.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}
