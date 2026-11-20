// Encendido por doble aplauso: si esta activado en Ajustes y hay sesion, escucha el microfono
// y al oir dos palmadas suena la musica de bienvenida. Solo funciona con la app abierta.
import { sesion } from './sesion.js';
import { leer } from './preferencias.js';
import { escucharAplauso } from './aplauso.js';
import { reproducir } from './bienvenida.js';

let servicio = null;
let arrancando = false;

// Enciende o apaga la escucha segun la preferencia. Devuelve { ok } o { ok: false, motivo }.
export async function configurar() {
  const quiere = !!leer().aplauso && sesion.activa();
  if (!quiere) {
    if (servicio) { servicio.parar(); servicio = null; }
    return { ok: true };
  }
  if (servicio || arrancando) return { ok: true };
  arrancando = true;
  try {
    servicio = await escucharAplauso(() => reproducir());
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: String((e && e.name) || (e && e.message) || e) };
  } finally {
    arrancando = false;
  }
}

window.addEventListener('sesion-cambio', configurar);
configurar();
