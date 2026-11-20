// Manos: permisos y funciones nativas de la APK (burbuja, palabra «Jarvis», accesibilidad).
// Solo funciona dentro de la APK; en el navegador avisa. Usa el plugin nativo Manos que ya existe.
import { sesion } from '../../nucleo/sesion.js';

const cap = window.Capacitor;
const Manos = cap && cap.Plugins && (cap.Plugins.Manos || (cap.registerPlugin && cap.registerPlugin('Manos')));
const nativa = !!(cap && cap.isNativePlatform && cap.isNativePlatform() && Manos);

const PERMISOS = [
  ['mic', 'Micrófono'],
  ['llamadas', 'Llamadas y contactos'],
  ['notif', 'Notificaciones'],
  ['bateriaLibre', 'Sin límite de batería'],
  ['servicio', 'Accesibilidad (las manos)'],
];
const INTERRUPTORES = [
  ['burbuja', 'Burbuja flotante'],
  ['palabra', 'Llamar diciendo «Jarvis»'],
  ['vozBurbuja', 'Voz de la burbuja'],
];
const ACCIONES = [
  ['Activar permisos', 'pedirTodo'],
  ['Activar accesibilidad', 'abrirAccesibilidad'],
  ['Permitir sin límite de batería', 'pedirBateria'],
];

function el(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

export function iniciar(raiz) {
  const cuerpo = raiz.querySelector('#man-cuerpo');

  if (!nativa) {
    const t = el('div', 'tarjeta');
    t.append(el('b', '', 'Solo en la APK'), el('small', '', 'Las manos, la burbuja y la palabra «Jarvis» funcionan dentro de la app instalada en el celular.'));
    cuerpo.append(t);
    return;
  }

  const permisos = el('div', 'tarjeta');
  const interruptores = el('div', 'tarjeta');
  const acciones = el('div', 'tarjeta');
  cuerpo.append(permisos, interruptores, acciones);

  async function pintar() {
    const e = await Manos.estado();
    permisos.replaceChildren(el('b', '', 'Permisos'));
    PERMISOS.forEach(([k, nombre]) => {
      const f = el('div', 'man__fila');
      f.append(el('span', '', nombre), el('span', e[k] ? 'man__ok' : 'man__no', e[k] ? 'Activo' : 'Falta'));
      permisos.append(f);
    });
    interruptores.replaceChildren(el('b', '', 'Funciones'));
    INTERRUPTORES.forEach(([k, nombre]) => {
      const f = el('label', 'man__fila');
      const caja = el('input');
      caja.type = 'checkbox';
      caja.checked = !!e[k];
      caja.addEventListener('change', async () => { await Manos[k]({ activa: caja.checked }); pintar(); });
      f.append(el('span', '', nombre), caja);
      interruptores.append(f);
    });
  }

  ACCIONES.forEach(([texto, metodo]) => {
    const b = el('button', 'boton', texto);
    b.type = 'button';
    b.addEventListener('click', async () => { await Manos[metodo](); setTimeout(pintar, 1500); });
    acciones.append(b);
  });
  acciones.append(el('small', '', 'Las órdenes de tocar la pantalla y abrir apps llegan cuando se pase el servidor de las Manos a esta versión.'));

  // La burbuja y la palabra «Jarvis» hablan con el servidor usando esta sesion.
  Manos.sesion({ acceso: sesion.acceso(), refresco: sesion.refresco(), ts: Date.now() }).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (!document.hidden && cuerpo.isConnected) pintar(); });
  pintar();
}
