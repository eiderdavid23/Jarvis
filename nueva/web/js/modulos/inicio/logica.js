// Pantalla de inicio: la orbita de Jarvis. El nucleo conversa por voz; los satelites con
// data-ir abren su modulo y los que tienen data-pronto avisan que aun no estan construidos.
import { api } from '../../nucleo/api.js';
import { puedeEscuchar, escuchar, hablar, parar } from '../../nucleo/voz.js';

const BASE = 'Toca el núcleo para activar';
const ERRORES = {
  'not-allowed': 'Permita el micrófono en el navegador',
  'no-speech': 'No le oí. Toque de nuevo',
  'network': 'El reconocimiento de voz necesita internet',
  'sin-reconocimiento': 'Este navegador no tiene reconocimiento de voz',
};

let chatId = null;

export function iniciar(raiz) {
  const estado = raiz.querySelector('#inicio-estado');
  const sub = raiz.querySelector('#inicio-sub');
  const nucleo = raiz.querySelector('#inicio-nucleo');
  let espera = 0;
  let turno = 0;
  let ocupado = false;

  function poner(nombre, detalle) {
    clearTimeout(espera);
    estado.textContent = nombre;
    nucleo.dataset.estado = nombre;
    sub.textContent = detalle;
  }

  function aviso(texto) {
    sub.textContent = texto;
    clearTimeout(espera);
    espera = setTimeout(() => { if (!ocupado) sub.textContent = BASE; }, 2800);
  }

  function terminar(detalle) {
    ocupado = false;
    poner('CONECTADO', detalle);
  }

  async function conversar() {
    if (ocupado) { turno++; parar(); terminar(BASE); return; }
    if (!puedeEscuchar) { aviso(ERRORES['sin-reconocimiento']); return; }
    const mio = ++turno;
    ocupado = true;
    try {
      poner('ESCUCHANDO', 'Hable ahora…');
      const dicho = await escuchar();
      if (mio !== turno) return;
      if (!dicho) { terminar(ERRORES['no-speech']); return; }
      poner('PENSANDO', '«' + dicho + '»');
      const r = await api.post('/chat', { mensaje: dicho, chat_id: chatId });
      if (mio !== turno) return;
      if (r.datos.chat_id) chatId = r.datos.chat_id;
      const texto = r.datos.respuesta || 'No pude conectar con el servidor, señor.';
      poner('HABLANDO', texto.length > 90 ? texto.slice(0, 90) + '…' : texto);
      await hablar(texto);
      if (mio === turno) terminar(BASE);
    } catch (e) {
      if (mio === turno) terminar(ERRORES[e.message] || 'No pude usar el micrófono');
    }
  }

  nucleo.addEventListener('click', conversar);

  raiz.querySelectorAll('[data-pronto]').forEach((boton) => {
    boton.addEventListener('click', () => aviso(boton.dataset.pronto + ' llega en una próxima parte'));
  });
}
