// Tareas: programar, ver y cancelar. La ejecucion a la hora la hace nucleo/tareas_auto.js.
import { api } from '../../nucleo/api.js';

const ESTADOS = { pendiente: 'Pendiente', en_curso: 'Ejecutando', hecha: 'Hecha', fallida: 'Fallida' };

function el(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

export function iniciar(raiz) {
  const $ = (id) => raiz.querySelector('#' + id);
  const form = $('tar-form');
  const lista = $('tar-lista');
  const mensaje = $('tar-mensaje');

  function decir(texto, bueno = false) {
    mensaje.textContent = texto;
    mensaje.classList.toggle('mensaje--ok', bueno);
  }

  function tarjeta(t) {
    const c = el('div', 'tarjeta');
    const cab = el('div', 'fila');
    cab.append(el('b', '', t.titulo), el('small', '', ESTADOS[t.estado] || t.estado));
    c.append(cab, el('small', '', new Date(t.cuando).toLocaleString('es')));
    if (t.resultado) c.append(el('small', 'tar__resultado', t.resultado));
    const quitar = el('button', 'boton', t.estado === 'pendiente' ? 'Cancelar' : 'Borrar');
    quitar.type = 'button';
    quitar.addEventListener('click', async () => { await api.borrar('/tareas/' + t.id); cargar(); });
    c.append(quitar);
    return c;
  }

  async function cargar() {
    const r = await api.get('/tareas');
    lista.replaceChildren();
    if (!r.ok) { decir(r.datos.error || 'No pude cargar las tareas'); return; }
    if (!r.datos.length) lista.append(el('small', 'tar__vacio', 'Aún no hay tareas programadas'));
    r.datos.forEach((t) => lista.append(tarjeta(t)));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fecha = new Date($('tar-cuando').value);
    if (isNaN(fecha) || fecha.getTime() < Date.now()) { decir('Elija una fecha y hora futuras'); return; }
    const r = await api.post('/tareas', {
      titulo: $('tar-titulo').value,
      instruccion: $('tar-instruccion').value,
      cuando: fecha.toISOString(),
    });
    if (!r.ok) { decir(r.datos.error || 'No pude guardar la tarea'); return; }
    form.reset();
    decir('Tarea programada', true);
    cargar();
  });

  const alCambiar = () => {
    if (lista.isConnected) cargar(); else window.removeEventListener('tareas-cambio', alCambiar);
  };
  window.addEventListener('tareas-cambio', alCambiar);
  cargar();
}
