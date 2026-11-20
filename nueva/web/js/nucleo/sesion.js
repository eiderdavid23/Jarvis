// Sesion: guarda y lee los tokens en el celular. No habla con el servidor.
const ACCESO = 'jv_acceso';
const REFRESCO = 'jv_refresco';
const CORREO = 'jv_correo';

export const sesion = {
  acceso: () => localStorage.getItem(ACCESO) || '',
  refresco: () => localStorage.getItem(REFRESCO) || '',
  correo: () => localStorage.getItem(CORREO) || '',
  activa: () => !!localStorage.getItem(ACCESO),

  guardar(d) {
    if (d.access_token) localStorage.setItem(ACCESO, d.access_token);
    if (d.refresh_token) localStorage.setItem(REFRESCO, d.refresh_token);
    if (d.email) localStorage.setItem(CORREO, d.email);
  },

  borrar() {
    [ACCESO, REFRESCO, CORREO].forEach((k) => localStorage.removeItem(k));
  },

  // Al volver de entrar con Google, Supabase deja los tokens en el # de la direccion.
  leerDeLaDireccion() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (!h.get('access_token')) return false;
    this.guardar({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token') });
    history.replaceState(null, '', location.pathname);
    return true;
  },
};
