/* Login y chats por usuario. Habla con /auth/* y /chats del backend. */
(function () {
  const K = { acc: 'jarvisAcceso', ref: 'jarvisRefresco', mail: 'jarvisCorreo', nom: 'jarvisNombre' };
  const fetchOrig = window.fetch.bind(window);
  let chatId = null;
  let refrescando = null;

  const st = document.createElement('style');
  st.textContent = `
    #authOverlay { position: fixed; inset: 0; z-index: 1000; display: none; align-items: center;
      justify-content: center; padding: 20px; background: var(--fondo); }
    #authCaja { width: min(100%, 360px); background: var(--panel); border: 1px solid var(--linea);
      border-radius: 18px; padding: 26px 22px; text-align: center; }
    #authCaja h1 { margin: 0 0 4px; font-size: 18px; letter-spacing: 5px; color: var(--cian); }
    #authCaja p { margin: 0 0 18px; font-size: 13px; color: var(--suave); }
    #authCaja input { width: 100%; margin-bottom: 10px; padding: 13px; border-radius: 12px;
      border: 1px solid var(--linea); background: var(--panel2); color: var(--texto); font-size: 16px; }
    #authMsg { min-height: 18px; margin: 4px 0 10px; font-size: 13px; color: var(--rojo); }
    #authCaja button { width: 100%; padding: 13px; border-radius: 12px; font-size: 15px; margin-top: 8px;
      border: 1px solid var(--cian); background: var(--cian); color: #04131a; font-weight: 700; }
    #authCaja button.sec { background: transparent; color: var(--cian); font-weight: 400; }
    #listaChats { overflow-y: auto; max-height: 38vh; }
    .chatItem { cursor: pointer; padding: 10px 12px; }
    .chatItem.activo { background: rgba(0,229,255,.12); }
    .chatTit { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chatDel { color: var(--suave); padding: 0 6px; font-size: 18px; }
    .sbVacio { padding: 8px 12px; font-size: 13px; color: var(--suave); }
    #authCaja button#authGoogle { background: #fff; border-color: #fff; color: #1f1f1f; margin-top: 0; }
    .authSep { margin: 14px 0; font-size: 12px; color: var(--suave); }
  `;
  document.head.appendChild(st);

  /* ---------- sesion ---------- */
  function guardarSesion(d) {
    if (d.access_token) localStorage.setItem(K.acc, d.access_token);
    if (d.refresh_token) localStorage.setItem(K.ref, d.refresh_token);
    if (d.email) localStorage.setItem(K.mail, d.email);
  }
  function limpiarSesion() {
    Object.values(K).forEach((k) => localStorage.removeItem(k));
  }
  function refrescar() {
    if (refrescando) return refrescando;
    refrescando = fetchOrig('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: localStorage.getItem(K.ref) })
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.access_token) { guardarSesion(d); return true; }
        limpiarSesion();
        return false;
      })
      .catch(() => false)
      .finally(() => { refrescando = null; });
    return refrescando;
  }
  async function api(url, opts, reintento) {
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

  /* /chat pasa por aqui: agrega la sesion y el chat_id actual */
  window.fetch = function (url, opts) {
    if (url === '/chat' && opts && opts.method === 'POST') {
      try {
        const b = JSON.parse(opts.body || '{}');
        if (chatId) b.chat_id = chatId;
        opts = Object.assign({}, opts, { body: JSON.stringify(b) });
      } catch (e) {}
      return api(url, opts).then(async (res) => {
        try {
          const d = await res.clone().json();
          if (d.chat_id) chatId = d.chat_id;
          if (res.ok) cargarChats();
        } catch (e) {}
        return res;
      });
    }
    return fetchOrig(url, opts);
  };

  /* ---------- pantalla de login ---------- */
  function mensaje(t) { document.getElementById('authMsg').textContent = t || ''; }
  function traducir(e) {
    e = e || '';
    if (/invalid login/i.test(e)) return 'Correo o contraseña incorrectos, señor.';
    if (/already registered|already been registered/i.test(e)) return 'Ese correo ya tiene cuenta, señor.';
    if (/password/i.test(e) && /6|short|least/i.test(e)) return 'La contraseña debe tener al menos 6 caracteres, señor.';
    return e || 'Algo salió mal, señor.';
  }
  async function autenticar(ruta) {
    const email = document.getElementById('authMail').value.trim();
    const password = document.getElementById('authPass').value;
    if (!email || !password) { mensaje('Escriba su correo y contraseña, señor.'); return; }
    mensaje('Un momento, señor...');
    try {
      const res = await fetchOrig('/auth/' + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nombre: document.getElementById('authNombre').value.trim() })
      });
      const d = await res.json();
      if (!res.ok) { mensaje(traducir(d.error)); return; }
      if (d.confirmar_correo) { mensaje('Revise su correo para confirmar la cuenta, señor.'); return; }
      guardarSesion(d);
      cargarPerfil();
      mensaje('');
      document.getElementById('authOverlay').remove();
      reiniciarVista();
      cargarChats();
    } catch (e) {
      mensaje('No logro conectar con el servidor, señor.');
    }
  }
  function mostrarLogin(aviso) {
    let o = document.getElementById('authOverlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'authOverlay';
      o.innerHTML =
        '<div id="authCaja"><h1>J.A.R.V.I.S.</h1><p>Inicie sesión para continuar</p>' +
        '<button id="authGoogle">Continuar con Google</button><div class="authSep">o con correo</div>' +
        '<input id="authMail" type="email" placeholder="Correo" autocomplete="off">' +
        '<input id="authPass" type="password" placeholder="Contraseña" autocomplete="new-password">' +
        '<input id="authNombre" type="text" placeholder="Nombre (solo al crear cuenta)" autocomplete="off">' +
        '<div id="authMsg"></div>' +
        '<button id="authEntrar">Entrar</button>' +
        '<button id="authCrear" class="sec">Crear cuenta</button></div>';
      document.body.appendChild(o);
      document.getElementById('authEntrar').addEventListener('click', () => autenticar('login'));
      document.getElementById('authGoogle').addEventListener('click', () => {
        location.href = '/auth/google?redirect=' + encodeURIComponent(location.origin);
      });
      document.getElementById('authCrear').addEventListener('click', () => autenticar('registro'));
      document.getElementById('authPass').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') autenticar('login');
      });
    }
    o.style.display = 'flex';
    if (aviso) mensaje(aviso);
  }
  function reiniciarVista() {
    chatId = null;
    nombre = localStorage.getItem(K.nom) || '';
    chatInner.innerHTML = '';
    cambiarModo('inicio');
    actualizarSaludo();
    const lista = document.getElementById('listaChats');
    if (lista) lista.innerHTML = '';
  }

  /* ---------- perfil (nombre) y saludo ---------- */
  let nombre = localStorage.getItem(K.nom) || '';
  const saludoOrig = window.actualizarSaludo;
  window.actualizarSaludo = function () {
    saludoOrig();
    if (nombre) {
      const el = document.getElementById('saludo');
      el.textContent = el.textContent.replace(/, señor$/, ', ' + nombre);
    }
  };
  window.actualizarSaludo();
  async function cargarPerfil() {
    try {
      const res = await api('/auth/yo');
      if (!res.ok) return;
      const d = await res.json();
      if (d.email) localStorage.setItem(K.mail, d.email);
      nombre = (d.nombre || '').split(' ')[0];
      if (nombre) localStorage.setItem(K.nom, nombre); else localStorage.removeItem(K.nom);
      textoSalir();
      window.actualizarSaludo();
    } catch (e) {}
  }
  /* al volver de Google, los tokens llegan en el # de la direccion */
  function leerRetornoGoogle() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (h.get('access_token')) {
      guardarSesion({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token') });
      history.replaceState(null, '', location.pathname);
      return '';
    }
    if (h.get('error_description')) {
      history.replaceState(null, '', location.pathname);
      return 'Google no pudo iniciar sesión: ' + h.get('error_description');
    }
    return '';
  }

  /* ---------- lista de chats en el sidebar ---------- */
  function marcarActivo() {
    document.querySelectorAll('#listaChats .chatItem').forEach((el) => {
      el.classList.toggle('activo', el.dataset.id === chatId);
    });
  }
  async function cargarChats() {
    const lista = document.getElementById('listaChats');
    if (!lista || !localStorage.getItem(K.acc)) return;
    try {
      const res = await api('/chats');
      if (!res.ok) return;
      const chats = await res.json();
      lista.innerHTML = '';
      if (!chats.length) {
        const v = document.createElement('div');
        v.className = 'sbVacio';
        v.textContent = 'Aún no hay chats, señor.';
        lista.appendChild(v);
      }
      chats.forEach((c) => {
        const fila = document.createElement('div');
        fila.className = 'sbItem chatItem';
        fila.dataset.id = c.id;
        const tit = document.createElement('span');
        tit.className = 'chatTit';
        tit.textContent = c.titulo;
        const del = document.createElement('span');
        del.className = 'chatDel';
        del.textContent = '×';
        del.addEventListener('click', (ev) => { ev.stopPropagation(); borrarChat(c.id); });
        fila.appendChild(tit);
        fila.appendChild(del);
        fila.addEventListener('click', () => abrirChat(c.id));
        lista.appendChild(fila);
      });
      marcarActivo();
    } catch (e) {}
  }
  async function abrirChat(id) {
    try {
      const res = await api('/chats/' + id + '/mensajes');
      if (!res.ok) return;
      const filas = await res.json();
      if (vozActiva) salirVoz();
      detenerHabla();
      chatInner.innerHTML = '';
      chatId = id;
      filas.forEach((f) => {
        let t = f.texto;
        try { t = procesarAcciones(t).textoLimpio; } catch (e) {}
        agregarMensaje(t, f.rol === 'user' ? 'user' : 'jarvis');
      });
      cambiarModo('chat');
      cerrarSidebar();
      marcarActivo();
    } catch (e) {}
  }
  async function borrarChat(id) {
    if (!confirm('¿Borrar este chat, señor?')) return;
    const res = await api('/chats/' + id, { method: 'DELETE' });
    if (!res.ok) return;
    if (chatId === id) { chatId = null; nuevoChat(); }
    cargarChats();
  }

  /* ---------- armar el sidebar ---------- */
  const sb = document.getElementById('sidebar');
  const pronto = Array.from(sb.querySelectorAll('.sbItem.pronto'))
    .find((e) => e.textContent.includes('Historial'));
  const seccionPronto = Array.from(sb.querySelectorAll('.sbSeccion'))
    .find((e) => e.textContent.includes('Próximamente'));
  if (pronto) pronto.remove();
  const titulo = document.createElement('div');
  titulo.className = 'sbSeccion';
  titulo.textContent = 'Chats';
  const lista = document.createElement('div');
  lista.id = 'listaChats';
  sb.insertBefore(titulo, seccionPronto);
  sb.insertBefore(lista, seccionPronto);

  const salir = document.createElement('button');
  salir.className = 'sbItem';
  salir.id = 'sbSalir';
  sb.insertBefore(salir, sb.querySelector('.sbPie'));
  function textoSalir() {
    salir.textContent = 'Cerrar sesión' + (localStorage.getItem(K.mail) ? ' (' + localStorage.getItem(K.mail) + ')' : '');
  }
  textoSalir();
  salir.addEventListener('click', () => {
    limpiarSesion();
    cerrarSidebar();
    reiniciarVista();
    textoSalir();
    mostrarLogin();
  });

  ['btnNuevoTop', 'sbNuevo'].forEach((id) => {
    document.getElementById(id).addEventListener('click', () => { chatId = null; marcarActivo(); });
  });

  /* ---------- arranque ---------- */
  const avisoGoogle = leerRetornoGoogle();
  if (!localStorage.getItem(K.acc)) mostrarLogin(avisoGoogle);
  else { cargarPerfil(); cargarChats(); }
})();
