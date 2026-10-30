"""Parche: renueva la sesion antes de que caduque y reintenta si la red falla,
para que no salga "Su sesion expiro, senor" por un fallo pasajero.
Uso (dentro de ~/jarvis):  python3 parche_sesion.py
No escribe nada si el ancla no coincide; deja copia en auth.js.bak"""
import shutil
import sys

A = 'public/auth.js'
t = open(A, encoding='utf-8').read()

VIEJO = """  async function api(url, opts, reintento) {
    opts = opts || {};
    const h = Object.assign({}, opts.headers || {});
    const t = localStorage.getItem(K.acc);
    if (t) h['Authorization'] = 'Bearer ' + t;
    const res = await fetchOrig(url, Object.assign({}, opts, { headers: h }));
    if (res.status === 401 && reintento !== false && localStorage.getItem(K.ref)) {
      if (await refrescar()) return api(url, opts, false);
    }
    if (res.status === 401) mostrarLogin();
    return res;
  }
"""

NUEVO = """  /* La sesion caduca a la hora: se renueva ANTES de que falle y, si la red se cae justo
     al renovar, se reintenta en vez de mostrar "Su sesion expiro". */
  function tokenCaduca(seg) {
    try {
      const p = localStorage.getItem(K.acc).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(p)).exp * 1000 - Date.now() < (seg || 60) * 1000;
    } catch (e) { return false; }
  }
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  async function renovarConReintentos() {
    for (let i = 0; i < 3; i++) {
      if (await refrescar()) return true;
      if (!localStorage.getItem(K.ref)) return false;   /* el servidor rechazo la sesion de verdad */
      await pausa(1200 * (i + 1));                      /* fallo pasajero: red o Supabase ocupado */
    }
    return false;
  }
  async function api(url, opts, reintento) {
    opts = opts || {};
    if (reintento !== false && localStorage.getItem(K.ref) && tokenCaduca(60)) await renovarConReintentos();
    const h = Object.assign({}, opts.headers || {});
    const t = localStorage.getItem(K.acc);
    if (t) h['Authorization'] = 'Bearer ' + t;
    const res = await fetchOrig(url, Object.assign({}, opts, { headers: h }));
    if (res.status === 401 && reintento !== false && localStorage.getItem(K.ref)) {
      if (await renovarConReintentos()) return api(url, opts, false);
      if (localStorage.getItem(K.ref)) {
        return new Response(JSON.stringify({
          error: 'sesion sin renovar',
          respuesta: 'No logré renovar su sesión por la conexión, señor. Intente de nuevo en un momento.'
        }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
    }
    if (res.status === 401) mostrarLogin();
    return res;
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && localStorage.getItem(K.ref) && tokenCaduca(120)) renovarConReintentos();
  });
"""

if t.count(VIEJO) != 1:
    sys.exit(f'[ERROR] No encontre la funcion api() tal cual (aparece {t.count(VIEJO)} veces). No cambie nada.')
shutil.copyfile(A, A + '.bak')
open(A, 'w', encoding='utf-8').write(t.replace(VIEJO, NUEVO))
print('Listo: public/auth.js actualizado (copia en auth.js.bak).')
