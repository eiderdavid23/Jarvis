/* Login y chats por usuario. Habla con /auth/* y /chats del backend. */
(function () {
  const K = { acc: 'jarvisAcceso', ref: 'jarvisRefresco', mail: 'jarvisCorreo', nom: 'jarvisNombre' };
  const fetchOrig = window.fetch.bind(window);
  let chatId = null;
  let refrescando = null;

  const st = document.createElement('style');
  st.textContent = `
    #listaChats { overflow-y: auto; max-height: 38vh; }
    .chatItem { cursor: pointer; padding: 10px 12px; }
    .chatItem.activo { background: rgba(0,229,255,.12); }
    .chatTit { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chatDel { color: var(--suave); padding: 0 6px; font-size: 18px; }
    .sbVacio { padding: 8px 12px; font-size: 13px; color: var(--suave); }
    #authOverlay { position: fixed; inset: 0; z-index: 1000; display: flex; overflow-y: auto; padding: max(20px, env(safe-area-inset-top)) 18px 20px; background: var(--fondo); color: var(--texto); transition: opacity .55s var(--ease); }
    #authOverlay.saliendo { opacity: 0; pointer-events: none; }
    #authOverlay * { box-sizing: border-box; }
    .auBg { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }
    .auBg::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(0,229,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,.07) 1px, transparent 1px); background-size: 44px 44px; animation: auPan 16s linear infinite; -webkit-mask-image: radial-gradient(ellipse at center, #000 0, transparent 70%); mask-image: radial-gradient(ellipse at center, #000 0, transparent 70%); }
    .auBlob { position: absolute; width: 320px; height: 320px; border-radius: 50%; filter: blur(70px); opacity: .32; animation: auFloat 14s ease-in-out infinite alternate; }
    .auBlob.a1 { background: var(--cian); top: -80px; left: -100px; }
    .auBlob.a2 { background: #3b6cff; bottom: -90px; right: -110px; animation-delay: -6s; }
    .auCard { position: relative; width: min(100%, 380px); margin: auto; padding: 28px 22px 24px; background: rgba(11,17,27,.74); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border: 1px solid var(--linea); border-radius: 24px; box-shadow: 0 24px 70px rgba(0,0,0,.55); animation: auCardIn .8s var(--ease) both; transition: transform .55s var(--ease); }
    .auCard.shake { animation: auShake .45s; }
    #authOverlay.saliendo .auCard { transform: scale(.95); }
    .auCard::before { content: ""; position: absolute; top: 0; left: 14%; right: 14%; height: 1px; background: linear-gradient(90deg, transparent, var(--cian), transparent); animation: auShine 4s ease-in-out infinite; }
    .auCard > * { opacity: 0; transform: translateY(14px); animation: auUp .6s var(--ease) forwards; animation-delay: calc(var(--i) * 70ms + 250ms); }
    .auOrb { position: relative; width: 84px; height: 84px; margin: 0 auto 12px; }
    .auOrb i, .auOrb b { position: absolute; border-radius: 50%; }
    .auOrb i { inset: 0; border: 1.5px solid transparent; }
    .auOrb .r1 { border-top-color: var(--cian); border-bottom-color: rgba(0,229,255,.25); animation: auSpin 6s linear infinite; }
    .auOrb .r2 { inset: 10px; border-left-color: var(--cian); border-right-color: rgba(0,229,255,.25); animation: auSpin 4s linear infinite reverse; }
    .auOrb b { inset: 27px; background: radial-gradient(circle, #c8faff 0, var(--cian) 42%, rgba(0,229,255,0) 72%); animation: auPulse 2.6s ease-in-out infinite; }
    .auTit { margin: 0; text-align: center; font-size: 20px; font-weight: 600; letter-spacing: 7px; text-indent: 7px; color: var(--cian); }
    .auSub { margin: 6px 0 20px; text-align: center; font-size: 13px; color: var(--suave); }
    .auGoogle { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; height: 50px; border: 0; border-radius: 14px; background: #fff; color: #1f1f1f; font-size: 15px; font-weight: 500; cursor: pointer; transition: transform .15s, box-shadow .3s; }
    .auGoogle:hover { box-shadow: 0 8px 24px rgba(255,255,255,.18); }
    .auGoogle:active { transform: scale(.98); }
    .auSep { display: flex; align-items: center; gap: 12px; margin: 16px 0; font-size: 12px; color: var(--suave); }
    .auSep::before, .auSep::after { content: ""; flex: 1; height: 1px; background: var(--linea); }
    .auTabs { position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 4px; margin-bottom: 16px; background: var(--panel2); border: 1px solid var(--linea); border-radius: 14px; }
    .auTabs button { position: relative; z-index: 1; padding: 10px 0; border: 0; background: none; color: var(--suave); font-size: 14px; cursor: pointer; transition: color .3s; }
    .auTabs button.on { color: #04131a; font-weight: 600; }
    .auPill { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); border-radius: 10px; background: var(--cian); transition: transform .38s var(--ease); }
    #authOverlay.reg .auPill { transform: translateX(100%); }
    .auNombre { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .42s var(--ease), opacity .3s; }
    .auNombre > div { overflow: hidden; }
    #authOverlay.reg .auNombre { grid-template-rows: 1fr; opacity: 1; }
    .auFld { position: relative; display: block; margin-bottom: 12px; }
    .auFld input { width: 100%; height: 54px; padding: 20px 46px 6px 15px; background: var(--panel2); border: 1px solid var(--linea); border-radius: 14px; color: var(--texto); font-size: 16px; font-family: inherit; outline: none; transition: border-color .25s, box-shadow .25s; }
    .auFld span { position: absolute; left: 16px; top: 18px; font-size: 15px; color: var(--suave); pointer-events: none; transition: top .2s var(--ease), font-size .2s var(--ease), color .2s; }
    .auFld input:focus + span, .auFld input:not(:placeholder-shown) + span { top: 8px; font-size: 11px; color: var(--cian); }
    .auFld input:focus { border-color: var(--cian); box-shadow: 0 0 0 3px rgba(0,229,255,.14), 0 0 24px rgba(0,229,255,.12); }
    .auOjo { position: absolute; right: 6px; top: 7px; width: 40px; height: 40px; border: 0; background: none; color: var(--suave); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color .2s; }
    .auOjo:hover { color: var(--cian); }
    .auMsg { min-height: 20px; margin: 0 0 10px; font-size: 13px; color: var(--rojo); opacity: 0; transform: translateY(-4px); transition: opacity .25s, transform .25s; }
    .auMsg.v { opacity: 1; transform: none; }
    .auGo { position: relative; overflow: hidden; width: 100%; height: 52px; border: 0; border-radius: 14px; background: var(--cian); color: #04131a; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 8px 24px rgba(0,229,255,.25); transition: transform .15s, box-shadow .3s; }
    .auGo:hover { box-shadow: 0 10px 34px rgba(0,229,255,.42); }
    .auGo:active { transform: scale(.98); }
    .auGo::after { content: ""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent); transform: skewX(-20deg); transition: left .6s; }
    .auGo:hover::after { left: 130%; }
    .auGo .auSp { display: none; width: 20px; height: 20px; margin: 0 auto; border: 2px solid rgba(4,19,26,.3); border-top-color: #04131a; border-radius: 50%; animation: auSpin .7s linear infinite; }
    .auGo.load span { display: none; }
    .auGo.load .auSp { display: block; }
    @keyframes auUp { to { opacity: 1; transform: none; } }
    @keyframes auCardIn { from { opacity: 0; transform: translateY(24px) scale(.96); } }
    @keyframes auSpin { to { transform: rotate(360deg); } }
    @keyframes auPulse { 50% { transform: scale(.8); opacity: .75; } }
    @keyframes auShine { 50% { opacity: .2; } }
    @keyframes auPan { to { background-position: 44px 44px; } }
    @keyframes auFloat { to { transform: translate(50px, 40px); } }
    @keyframes auShake { 20% { transform: translateX(-8px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(3px); } }
    @media (prefers-reduced-motion: reduce) { #authOverlay *, #authOverlay { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
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
  let modoRegistro = false;
  function mensaje(t) {
    const m = document.getElementById('authMsg');
    if (!m) return;
    m.textContent = t || '';
    m.classList.toggle('v', !!t);
  }
  function traducir(e) {
    e = e || '';
    if (/invalid login/i.test(e)) return 'Correo o contraseña incorrectos, señor.';
    if (/already registered|already been registered/i.test(e)) return 'Ese correo ya tiene cuenta, señor.';
    if (/password/i.test(e) && /6|short|least/i.test(e)) return 'La contraseña debe tener al menos 6 caracteres, señor.';
    return e || 'Algo salió mal, señor.';
  }
  function temblar() {
    const c = document.querySelector('#authOverlay .auCard');
    c.classList.remove('shake');
    void c.offsetWidth;
    c.classList.add('shake');
  }
  async function enviarAuth() {
    const o = document.getElementById('authOverlay');
    const boton = document.getElementById('authGo');
    if (boton.classList.contains('load')) return;
    const email = document.getElementById('authMail').value.trim();
    const password = document.getElementById('authPass').value;
    if (!email || !password) { mensaje('Escriba su correo y contraseña, señor.'); temblar(); return; }
    mensaje('');
    boton.classList.add('load');
    try {
      const res = await fetchOrig('/auth/' + (modoRegistro ? 'registro' : 'login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nombre: document.getElementById('authNombre').value.trim() })
      });
      const d = await res.json();
      if (!res.ok) { mensaje(traducir(d.error)); temblar(); return; }
      if (d.confirmar_correo) { mensaje('Revise su correo para confirmar la cuenta, señor.'); return; }
      guardarSesion(d);
      cargarPerfil();
      reiniciarVista();
      cargarChats();
      o.classList.add('saliendo');
      setTimeout(() => { if (o.classList.contains('saliendo')) o.remove(); }, 600);
    } catch (e) {
      mensaje('No logro conectar con el servidor, señor.');
      temblar();
    } finally {
      boton.classList.remove('load');
    }
  }
  function mostrarLogin(aviso) {
    let o = document.getElementById('authOverlay');
    if (!o) {
      modoRegistro = false;
      o = document.createElement('div');
      o.id = 'authOverlay';
      o.innerHTML = `
        <div class="auBg"><div class="auBlob a1"></div><div class="auBlob a2"></div></div>
        <section class="auCard">
          <div class="auOrb" style="--i:0"><i class="r1"></i><i class="r2"></i><b></b></div>
          <h1 class="auTit" style="--i:1">J.A.R.V.I.S.</h1>
          <p class="auSub" style="--i:2">Su asistente personal</p>
          <button class="auGoogle" id="authGoogle" style="--i:3" type="button"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Continuar con Google</button>
          <div class="auSep" style="--i:4">o con correo</div>
          <div class="auTabs" style="--i:5"><span class="auPill"></span><button type="button" class="on" data-m="login">Entrar</button><button type="button" data-m="registro">Crear cuenta</button></div>
          <div style="--i:6">
            <div class="auNombre"><div><label class="auFld"><input id="authNombre" placeholder=" " autocomplete="off"><span>Nombre</span></label></div></div>
            <label class="auFld"><input id="authMail" type="email" placeholder=" " autocomplete="off"><span>Correo</span></label>
            <label class="auFld"><input id="authPass" type="password" placeholder=" " autocomplete="new-password"><span>Contraseña</span><button type="button" class="auOjo" id="authOjo" aria-label="Mostrar contraseña"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></label>
            <p class="auMsg" id="authMsg"></p>
            <button class="auGo" id="authGo" type="button"><span>Entrar</span><i class="auSp"></i></button>
          </div>
        </section>`;
      document.body.appendChild(o);
      o.querySelectorAll('.auTabs button').forEach((b) => b.addEventListener('click', () => {
        modoRegistro = b.dataset.m === 'registro';
        o.classList.toggle('reg', modoRegistro);
        o.querySelectorAll('.auTabs button').forEach((x) => x.classList.toggle('on', x === b));
        document.querySelector('#authGo span').textContent = modoRegistro ? 'Crear cuenta' : 'Entrar';
        mensaje('');
      }));
      document.getElementById('authOjo').addEventListener('click', () => {
        const p = document.getElementById('authPass');
        p.type = p.type === 'password' ? 'text' : 'password';
      });
      document.getElementById('authGo').addEventListener('click', enviarAuth);
      document.getElementById('authGoogle').addEventListener('click', () => {
        location.href = '/auth/google?redirect=' + encodeURIComponent(location.origin);
      });
      document.getElementById('authPass').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enviarAuth();
      });
    }
    o.classList.remove('saliendo');
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
