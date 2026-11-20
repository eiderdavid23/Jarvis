// Unico lugar que habla con el servidor: pone el token y renueva la sesion si vence.
import { sesion } from './sesion.js';

function cabeceras(conSesion) {
  const h = { 'Content-Type': 'application/json' };
  if (conSesion && sesion.acceso()) h.Authorization = 'Bearer ' + sesion.acceso();
  const gemini = localStorage.getItem('jv_llave_gemini');
  const groq = localStorage.getItem('jv_llave_groq');
  if (gemini) h['X-Gemini-Key'] = gemini;
  if (groq) h['X-Groq-Key'] = groq;
  return h;
}

async function renovar() {
  if (!sesion.refresco()) return false;
  try {
    const r = await fetch('/auth/refresh', {
      method: 'POST',
      headers: cabeceras(false),
      body: JSON.stringify({ refresh_token: sesion.refresco() }),
    });
    if (!r.ok) throw new Error('refresco rechazado');
    sesion.guardar(await r.json());
    return true;
  } catch (e) {
    sesion.borrar();
    window.dispatchEvent(new Event('sesion-cambio'));
    return false;
  }
}

async function pedir(metodo, ruta, cuerpo, conSesion = true) {
  const intento = () => fetch(ruta, {
    method: metodo,
    headers: cabeceras(conSesion),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  let r;
  try {
    r = await intento();
    if (r.status === 401 && conSesion && (await renovar())) r = await intento();
  } catch (e) {
    return { ok: false, estado: 0, datos: { error: 'sin conexion' } };
  }
  let datos = {};
  try { datos = await r.json(); } catch (e) { /* respuesta sin cuerpo */ }
  return { ok: r.ok, estado: r.status, datos };
}

export const api = {
  get: (ruta) => pedir('GET', ruta),
  post: (ruta, cuerpo, conSesion = true) => pedir('POST', ruta, cuerpo, conSesion),
  patch: (ruta, cuerpo) => pedir('PATCH', ruta, cuerpo),
  borrar: (ruta) => pedir('DELETE', ruta),
};
