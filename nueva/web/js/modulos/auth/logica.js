// Pantalla de acceso: entrar o crear cuenta.
import { api } from '../../nucleo/api.js';
import { sesion } from '../../nucleo/sesion.js';
import { entrarConGoogle } from '../../nucleo/google.js';

export function iniciar(raiz) {
  const form = raiz.querySelector('#auth-form');
  const nombre = raiz.querySelector('#auth-nombre');
  const correo = raiz.querySelector('#auth-correo');
  const clave = raiz.querySelector('#auth-clave');
  const mensaje = raiz.querySelector('#auth-mensaje');
  const enviar = raiz.querySelector('#auth-enviar');
  const cambiar = raiz.querySelector('#auth-cambiar');

  let creando = false;

  function decir(texto, bueno = false) {
    mensaje.textContent = texto;
    mensaje.classList.toggle('mensaje--ok', bueno);
  }

  function ponerModo(crear) {
    creando = crear;
    nombre.hidden = !crear;
    enviar.textContent = crear ? 'Crear cuenta' : 'Entrar';
    cambiar.textContent = crear ? 'Ya tengo cuenta' : 'Crear cuenta';
    clave.autocomplete = crear ? 'new-password' : 'current-password';
    decir('');
  }

  cambiar.addEventListener('click', () => ponerModo(!creando));
  raiz.querySelector('#auth-google').addEventListener('click', entrarConGoogle);

  const aviso = sesion.tomarAviso();
  if (aviso) decir(aviso);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    decir('');
    enviar.disabled = true;
    const cuerpo = { email: correo.value.trim(), password: clave.value };
    if (creando) cuerpo.nombre = nombre.value.trim();

    const r = await api.post(creando ? '/auth/registro' : '/auth/login', cuerpo, false);
    enviar.disabled = false;

    if (r.ok && r.datos.access_token) {
      sesion.guardar(r.datos);
      window.dispatchEvent(new Event('sesion-cambio'));
    } else if (r.ok && r.datos.confirmar_correo) {
      ponerModo(false);
      decir('Revise su correo para confirmar la cuenta y luego entre.', true);
    } else {
      decir(r.datos.error || 'No pude conectar con el servidor.');
    }
  });
}
