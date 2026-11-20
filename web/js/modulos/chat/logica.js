// Pantalla de chat: manda el mensaje al servidor y muestra la respuesta.
import { api } from '../../nucleo/api.js';
import { sesion } from '../../nucleo/sesion.js';

export function iniciar(raiz) {
  const lista = raiz.querySelector('#chat-lista');
  const vacio = raiz.querySelector('#chat-vacio');
  const form = raiz.querySelector('#chat-form');
  const texto = raiz.querySelector('#chat-texto');
  const enviar = raiz.querySelector('#chat-enviar');

  let chatId = null;
  let ocupado = false;

  function burbuja(clase, contenido) {
    vacio.hidden = true;
    const b = document.createElement('div');
    b.className = 'burbuja ' + clase;
    b.textContent = contenido;
    lista.appendChild(b);
    lista.scrollTop = lista.scrollHeight;
    return b;
  }

  function ajustarAlto() {
    texto.style.height = 'auto';
    texto.style.height = Math.min(texto.scrollHeight, 140) + 'px';
  }

  async function mandar() {
    const mensaje = texto.value.trim();
    if (!mensaje || ocupado) return;
    ocupado = true;
    enviar.disabled = true;
    texto.value = '';
    ajustarAlto();

    burbuja('burbuja--yo', mensaje);
    const espera = burbuja('burbuja--jarvis burbuja--pensando', 'Pensando…');

    const r = await api.post('/chat', { mensaje, chat_id: chatId });
    if (r.datos.chat_id) chatId = r.datos.chat_id;

    espera.classList.remove('burbuja--pensando');
    if (r.ok) {
      espera.textContent = r.datos.respuesta;
    } else {
      espera.classList.add('burbuja--error');
      espera.textContent = r.datos.respuesta || 'No pude conectar con el servidor, señor.';
    }
    lista.scrollTop = lista.scrollHeight;
    ocupado = false;
    enviar.disabled = false;
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); mandar(); });

  texto.addEventListener('input', ajustarAlto);
  texto.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mandar(); }
  });

  raiz.querySelector('#chat-nuevo').addEventListener('click', () => {
    chatId = null;
    lista.querySelectorAll('.burbuja').forEach((b) => b.remove());
    vacio.hidden = false;
  });

  raiz.querySelector('#chat-salir').addEventListener('click', () => {
    sesion.borrar();
    window.dispatchEvent(new Event('sesion-cambio'));
  });
}
