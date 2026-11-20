// Ejecuta las tareas automaticas vencidas mientras la app esta abierta (una sola vez cada una).
import { api } from './api.js';
import { sesion } from './sesion.js';

const CADA = 30000;
const MARGEN = 30 * 60000;
let corriendo = false;

async function revisar() {
  if (corriendo || !sesion.activa()) return;
  corriendo = true;
  try {
    const r = await api.get('/tareas');
    if (!r.ok || !Array.isArray(r.datos)) return;
    for (const t of r.datos) {
      const atraso = Date.now() - new Date(t.cuando).getTime();
      if (t.estado !== 'pendiente' || atraso < 0) continue;
      if (atraso > MARGEN) {
        await api.patch('/tareas/' + t.id, { estado: 'fallida', resultado: 'Se pasó la hora con la app cerrada' });
        continue;
      }
      const c = await api.patch('/tareas/' + t.id, { estado: 'en_curso' });
      if (!c.ok || !c.datos.ok) continue;
      const m = await api.post('/chat', { mensaje: t.instruccion });
      await api.patch('/tareas/' + t.id, {
        estado: m.ok ? 'hecha' : 'fallida',
        resultado: m.datos.respuesta || m.datos.error || 'Sin respuesta',
      });
    }
    window.dispatchEvent(new Event('tareas-cambio'));
  } finally {
    corriendo = false;
  }
}

setTimeout(revisar, 3000);
setInterval(revisar, CADA);
