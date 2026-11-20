// Gestos: controla la musica con la mano usando la camara. MediaPipe corre en el celular;
// el video nunca se envia a ningun servidor. Se carga solo al tocar «Activar camara».
import { clasificar, distanciaPellizco } from '../../nucleo/gesto.js';
import { control, volumen } from '../musica/logica.js';

const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODELO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const SOSTENER_MS = 800;   // cuanto hay que mantener un gesto para que cuente
const ENFRIAR_MS = 1200;   // espera minima entre dos acciones
const CUADROS_MS = 50;     // maximo ~20 lecturas por segundo, para no calentar el celular

const NOMBRES = { palma: '✋ Palma', uno: '☝️ Un dedo', dos: '✌️ Dos dedos', pellizco: '👌 Volumen', puno: '✊ Puño', otro: '' };
const ACCIONES = {
  palma: ['Reproducir / pausar', () => control.alternar()],
  uno: ['Siguiente', () => control.siguiente()],
  dos: ['Anterior', () => control.anterior()],
};
const UNIONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

let detector = null;

async function cargarDetector() {
  if (detector) return detector;
  const { FilesetResolver, HandLandmarker } = await import(`${CDN}/vision_bundle.mjs`);
  const vision = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const crear = (delegate) => HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODELO, delegate },
    runningMode: 'VIDEO',
    numHands: 1,
  });
  try { detector = await crear('GPU'); } catch (e) { detector = await crear('CPU'); }
  return detector;
}

export function iniciar(raiz) {
  const $ = (id) => raiz.querySelector('#' + id);
  const video = $('ges-video');
  const lienzo = $('ges-lienzo');
  const ctx = lienzo.getContext('2d');
  const estado = $('ges-estado');
  const sub = $('ges-sub');
  const boton = $('ges-boton');
  const etiqueta = $('ges-gesto');

  let flujo = null;
  let activo = false;
  let ultimoCuadro = 0;
  let gestoActual = 'otro';
  let desde = 0;
  let disparado = false;
  let ultimaAccion = 0;

  function decir(titulo, detalle) {
    estado.textContent = titulo;
    sub.textContent = detalle;
  }

  function parar() {
    activo = false;
    if (flujo) flujo.getTracks().forEach((t) => t.stop());
    flujo = null;
    video.srcObject = null;
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    etiqueta.hidden = true;
    boton.textContent = 'Activar cámara';
    boton.disabled = false;
  }

  function dibujar(p) {
    lienzo.width = video.videoWidth || 640;
    lienzo.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    if (!p) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--cian').trim() || '#4fd8ff';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    UNIONES.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(p[a].x * lienzo.width, p[a].y * lienzo.height);
      ctx.lineTo(p[b].x * lienzo.width, p[b].y * lienzo.height);
      ctx.stroke();
    });
    p.forEach((q) => {
      ctx.beginPath();
      ctx.arc(q.x * lienzo.width, q.y * lienzo.height, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function ejecutar(gesto) {
    const accion = ACCIONES[gesto];
    if (!accion) return;
    const ahora = performance.now();
    if (ahora - ultimaAccion < ENFRIAR_MS) return;
    ultimaAccion = ahora;
    accion[1]();
    etiqueta.textContent = '✔ ' + accion[0];
    etiqueta.classList.remove('ges__gesto--ok');
    void etiqueta.offsetWidth;
    etiqueta.classList.add('ges__gesto--ok');
  }

  function procesar(p) {
    const gesto = p ? clasificar(p) : 'otro';

    if (gesto === 'pellizco') {
      // Mano arriba = volumen alto, mano abajo = volumen bajo (entre 25 % y 85 % de la imagen).
      const altura = (p[8].y + p[4].y) / 2;
      const v = Math.max(0, Math.min(1, (0.85 - altura) / 0.6));
      volumen(v);
      etiqueta.hidden = false;
      etiqueta.textContent = '👌 Volumen ' + Math.round(v * 100) + ' %';
      gestoActual = gesto;
      return;
    }

    if (gesto !== gestoActual) {
      gestoActual = gesto;
      desde = performance.now();
      disparado = false;
    }

    if (!p || !NOMBRES[gesto]) { etiqueta.hidden = true; return; }
    etiqueta.hidden = false;

    const falta = SOSTENER_MS - (performance.now() - desde);
    if (ACCIONES[gesto]) {
      if (!disparado && falta <= 0) { disparado = true; ejecutar(gesto); }
      else if (!disparado) etiqueta.textContent = NOMBRES[gesto] + '…';
    } else {
      etiqueta.textContent = NOMBRES[gesto];
    }
  }

  function ciclo() {
    if (!activo) return;
    if (!raiz.isConnected) { parar(); return; } // el usuario salio de la pantalla
    const ahora = performance.now();
    if (video.readyState >= 2 && ahora - ultimoCuadro >= CUADROS_MS) {
      ultimoCuadro = ahora;
      try {
        const r = detector.detectForVideo(video, ahora);
        const p = r.landmarks && r.landmarks[0];
        dibujar(p);
        procesar(p);
        decir(p ? 'Mano detectada' : 'Muestre la mano', p ? 'Mantenga un gesto para usarlo' : 'Póngala frente a la cámara');
      } catch (e) { /* un cuadro malo no detiene todo */ }
    }
    requestAnimationFrame(ciclo);
  }

  async function encender() {
    boton.disabled = true;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('sin-camara');
      decir('Cargando…', 'Descargando el reconocimiento de manos (la primera vez tarda)');
      await cargarDetector();
      flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
      video.srcObject = flujo;
      await video.play();
      activo = true;
      boton.textContent = 'Apagar cámara';
      boton.disabled = false;
      decir('Muestre la mano', 'Póngala frente a la cámara');
      ciclo();
    } catch (e) {
      parar();
      const msg = String(e && e.name || e && e.message || e);
      decir('No pude usar la cámara',
        /NotAllowed|Permission/i.test(msg) ? 'Permita la cámara en el navegador o en la app'
        : /sin-camara/.test(msg) ? 'Este navegador no deja usar la cámara'
        : 'Revise su internet y vuelva a intentar');
    }
  }

  boton.addEventListener('click', () => {
    if (activo) { parar(); decir('Cámara apagada', 'Controle la música con la mano frente a la cámara'); }
    else encender();
  });
}
