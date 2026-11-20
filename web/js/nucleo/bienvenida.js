// Musica de bienvenida: la cancion se guarda en el celular (IndexedDB) y suena con el saludo.
import { leer } from './preferencias.js';
import { hablar } from './voz.js';

const BD = 'jarvis_bd';
const ALMACEN = 'archivos';
const CLAVE = 'bienvenida';
const VOLUMEN = 0.6;
const VOLUMEN_HABLANDO = 0.2;
const DURACION_MS = 25000;

export const SALUDO_BASE = 'Bienvenido, señor';

function abrir() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function operar(modo, hacer) {
  const bd = await abrir();
  return new Promise((ok, mal) => {
    const t = bd.transaction(ALMACEN, modo);
    const r = hacer(t.objectStore(ALMACEN));
    t.oncomplete = () => { bd.close(); ok(r && r.result); };
    t.onerror = () => { bd.close(); mal(t.error); };
  });
}

export const guardarCancion = (archivo) =>
  operar('readwrite', (s) => s.put({ blob: archivo, nombre: archivo.name.replace(/\.[^.]+$/, '') }, CLAVE));
export const leerCancion = () => operar('readonly', (s) => s.get(CLAVE));
export const quitarCancion = () => operar('readwrite', (s) => s.delete(CLAVE));

let audio = null;
let desvanecer = 0;

export function parar() {
  clearInterval(desvanecer);
  if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); audio = null; }
}

// Suena la cancion (bajita mientras habla) y dice el saludo. Se apaga sola a los 25 s con un fundido.
export async function reproducir() {
  parar();
  let cancion = null;
  try { cancion = await leerCancion(); } catch (e) { /* sin almacenamiento: solo el saludo */ }

  const saludo = leer().saludo ?? SALUDO_BASE;
  if (cancion && cancion.blob) {
    const mio = new Audio(URL.createObjectURL(cancion.blob));
    audio = mio;
    mio.volume = saludo ? VOLUMEN_HABLANDO : VOLUMEN;
    mio.play().catch(() => {});
    setTimeout(() => {
      if (audio !== mio) return;
      desvanecer = setInterval(() => {
        mio.volume = Math.max(0, mio.volume - 0.03);
        if (mio.volume <= 0) parar();
      }, 150);
    }, DURACION_MS);
  }
  if (saludo) {
    await hablar(saludo);
    if (audio) audio.volume = VOLUMEN;
  }
}
