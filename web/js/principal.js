// Arranque: decide que pantalla se ve segun haya sesion y a donde se navegue.
import { sesion } from './nucleo/sesion.js';
import { montar } from './nucleo/montar.js';
import './nucleo/preferencias.js';
import './nucleo/tareas_auto.js';
import './nucleo/encendido.js';
import { escucharRetornoApp } from './nucleo/google.js';

const app = document.getElementById('app');
let actual = 'inicio';

function mostrar() {
  montar(sesion.activa() ? actual : 'auth', app);
}

sesion.leerDeLaDireccion();
escucharRetornoApp();
window.addEventListener('sesion-cambio', () => { actual = 'inicio'; mostrar(); });
window.addEventListener('ir', (e) => { actual = e.detail; mostrar(); });
mostrar();
