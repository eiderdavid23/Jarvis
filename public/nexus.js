(function () {
  'use strict';
  var K = { acc: 'jarvisAcceso', ref: 'jarvisRefresco', nom: 'jarvisNombre' };
  var $ = function (id) { return document.getElementById(id); };
  var yo = null, plats = [], usus = [], refrescando = null;

  /* Crea elementos sin innerHTML: todo texto entra por textContent (no hay XSS). */
  function el(tag, attrs) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      var v = attrs[k];
      if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) e.appendChild(arguments[i]);
    return e;
  }
  function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function seguro(u) { return /^https?:\/\//i.test(u || '') ? u : '#'; }

  var tt = null;
  function aviso(t) {
    var n = $('toast');
    n.textContent = t; n.hidden = false;
    clearTimeout(tt); tt = setTimeout(function () { n.hidden = true; }, 3500);
  }
  function fallo(e) { aviso((e && e.message) || 'Algo salió mal, señor.'); }

  /* ---------- Sesión (la misma de Jarvis, guardada en localStorage) ---------- */
  function caduca(seg) {
    try {
      var p = localStorage.getItem(K.acc).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(p)).exp * 1000 - Date.now() < seg * 1000;
    } catch (e) { return false; }
  }
  function renovar() {
    if (!refrescando) {
      refrescando = fetch('/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: localStorage.getItem(K.ref) }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || !d.access_token) return false;
          localStorage.setItem(K.acc, d.access_token);
          if (d.refresh_token) localStorage.setItem(K.ref, d.refresh_token);
          return true;
        })
        .catch(function () { return false; })
        .then(function (ok) { refrescando = null; return ok; });
    }
    return refrescando;
  }
  function login() { location.href = '/'; return new Promise(function () {}); }
  function api(url, metodo, cuerpo, reintento) {
    if (!localStorage.getItem(K.acc)) return login();
    var pre = (reintento !== false && caduca(60)) ? renovar() : Promise.resolve(true);
    return pre.then(function () {
      var h = { Authorization: 'Bearer ' + localStorage.getItem(K.acc) };
      if (cuerpo !== undefined) h['Content-Type'] = 'application/json';
      return fetch(url, { method: metodo || 'GET', headers: h, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
    }).then(function (r) {
      if (r.status === 401 && reintento !== false) {
        return renovar().then(function (ok) { return ok ? api(url, metodo, cuerpo, false) : login(); });
      }
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || d.respuesta || 'Error ' + r.status);
        return d;
      });
    });
  }

  /* ---------- Ventana reutilizable (sirve para formularios y confirmaciones) ---------- */
  function ventana(o) {
    return new Promise(function (res) {
      $('mTit').textContent = o.titulo;
      $('mTxt').textContent = o.texto || '';
      $('mTxt').hidden = !o.texto;
      $('mErr').textContent = '';
      var cont = $('mCampos'); vaciar(cont);
      (o.campos || []).forEach(function (c) {
        cont.appendChild(el('label', { for: 'm-' + c.id, text: c.label }));
        cont.appendChild(el('input', { id: 'm-' + c.id, type: c.tipo || 'text', value: c.valor || '', maxlength: c.max || 200 }));
      });
      $('modal').hidden = false;
      var p = cont.querySelector('input'); if (p) setTimeout(function () { p.focus(); }, 50);
      function fin(v) { $('modal').hidden = true; $('mForm').onsubmit = null; $('mNo').onclick = null; res(v); }
      $('mNo').onclick = function () { fin(null); };
      $('mForm').onsubmit = function (ev) {
        ev.preventDefault();
        var v = {};
        for (var i = 0; i < (o.campos || []).length; i++) {
          var c = o.campos[i], x = $('m-' + c.id).value.trim();
          if (!x && c.requerido !== false) { $('mErr').textContent = 'Complete "' + c.label + '".'; return; }
          v[c.id] = x;
        }
        fin(v);
      };
    });
  }
  function confirmar(titulo, texto) { return ventana({ titulo: titulo, texto: texto }).then(function (v) { return !!v; }); }

  /* ---------- Arranque ---------- */
  function pantalla(titulo, texto, boton, fn) {
    var p = $('pantalla'); vaciar(p);
    p.hidden = false; $('app').hidden = true;
    p.appendChild(el('h1', { text: titulo }));
    p.appendChild(el('p', { class: 'msg', text: texto }));
    if (boton) p.appendChild(el('button', { class: 'btn', text: boton, onclick: fn }));
    p.appendChild(el('a', { class: 'ir', href: '/', text: 'Volver a Jarvis' }));
  }
  function iniciar() {
    api('/nexus/yo').then(function (p) {
      yo = p;
      if (p.estado === 'aprobado') return mostrarApp();
      if (p.estado === 'pendiente') return pantalla('Acceso pendiente', 'Un administrador debe aprobar su cuenta, señor.', 'Revisar de nuevo', iniciar);
      pantalla('Sin acceso a Nexus', 'Puede solicitar acceso a un administrador.', 'Solicitar acceso', function () {
        api('/nexus/solicitar', 'POST', {}).then(iniciar).catch(fallo);
      });
    }).catch(function (e) { pantalla('No pude abrir Nexus', e.message, 'Reintentar', iniciar); });
  }
  function esAdmin() { return yo && yo.rol === 'admin'; }
  function mostrarApp() {
    $('pantalla').hidden = true; $('app').hidden = false;
    $('saludo').textContent = 'Hola, ' + (yo.nombre || 'señor');
    $('navAdmin').hidden = !esAdmin();
    cargar();
  }
  function cargar() {
    return Promise.all([api('/nexus/plataformas'), esAdmin() ? api('/nexus/usuarios') : Promise.resolve([])])
      .then(function (r) { plats = r[0]; usus = r[1]; pintarInicio(); pintarResumen(); pintarCuenta(); if (esAdmin()) pintarAdmin(); })
      .catch(fallo);
  }
  function accion(promesa, ok) {
    return promesa.then(function () { if (ok) aviso(ok); return cargar(); }).catch(fallo);
  }

  /* ---------- Menú ---------- */
  function ir(v) {
    document.querySelectorAll('.menu button').forEach(function (b) { b.classList.toggle('activo', b.dataset.v === v); });
    document.querySelectorAll('.vista').forEach(function (s) { s.hidden = s.id !== 'v-' + v; });
    $('menu').classList.remove('abierto'); $('velo').classList.remove('abierto');
  }
  document.querySelectorAll('.menu button').forEach(function (b) { b.addEventListener('click', function () { ir(b.dataset.v); }); });
  $('btnMenu').addEventListener('click', function () { $('menu').classList.add('abierto'); $('velo').classList.add('abierto'); });
  $('velo').addEventListener('click', function () { $('menu').classList.remove('abierto'); $('velo').classList.remove('abierto'); });

  /* ---------- Inicio: tarjetas de plataformas ---------- */
  function estadoUrl(url, punto, texto) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, 8000);
    fetch(url, { mode: 'no-cors', signal: c.signal })
      .then(function () { punto.className = 'punto on'; texto.textContent = 'En línea'; })
      .catch(function () { punto.className = 'punto off'; texto.textContent = 'No disponible'; })
      .then(function () { clearTimeout(t); });
  }
  function formPlat(titulo, actual) {
    actual = actual || {};
    return ventana({ titulo: titulo, campos: [
      { id: 'nombre', label: 'Nombre', valor: actual.nombre, max: 60 },
      { id: 'descripcion', label: 'Descripción', valor: actual.descripcion, requerido: false, max: 200 },
      { id: 'url', label: 'Dirección (https://...)', valor: actual.url, tipo: 'url', max: 500 }] });
  }
  function editar(p) {
    formPlat('Editar plataforma', p).then(function (v) {
      if (v) accion(api('/nexus/plataformas/' + p.id, 'PATCH', v), 'Plataforma actualizada.');
    });
  }
  function borrar(p) {
    confirmar('Eliminar plataforma', '¿Eliminar "' + p.nombre + '"? No se puede deshacer.').then(function (ok) {
      if (ok) accion(api('/nexus/plataformas/' + p.id, 'DELETE'), 'Plataforma eliminada.');
    });
  }
  function nueva(global) {
    formPlat(global ? 'Agregar plataforma global' : 'Agregar plataforma').then(function (v) {
      if (!v) return;
      if (global) v.global = true;
      accion(api('/nexus/plataformas', 'POST', v), 'Plataforma agregada.');
    });
  }
  function pintarInicio() {
    var g = $('grid'); vaciar(g);
    var vis = plats.filter(function (p) { return p.dueno_id === null || p.dueno_id === yo.user_id; });
    if (!vis.length) g.appendChild(el('p', { class: 'vacio', text: 'Aún no hay plataformas agregadas.' }));
    vis.forEach(function (p) {
      var propia = p.dueno_id === yo.user_id, editable = propia || (p.dueno_id === null && esAdmin());
      var punto = el('span', { class: 'punto' }), txt = el('span', { text: 'Verificando…' });
      g.appendChild(el('div', { class: 'card' },
        p.dueno_id === null ? el('span', { class: 'etiqueta', text: esAdmin() ? 'Global' : 'Asignada por el admin' }) : null,
        el('h3', { text: p.nombre }),
        el('p', { text: p.descripcion || '' }),
        el('div', { class: 'estado' }, punto, txt),
        el('a', { class: 'abrir', href: seguro(p.url), target: '_blank', rel: 'noopener', text: 'Abrir plataforma →' }),
        editable ? el('div', { class: 'acc' },
          el('button', { class: 'btn sec mini', text: 'Editar', onclick: function () { editar(p); } }),
          el('button', { class: 'btn mal mini', text: 'Eliminar', onclick: function () { borrar(p); } })) : null));
      estadoUrl(p.url, punto, txt);
    });
  }
  /* ---------- Inicio: resumen del día y línea de tiempo ---------- */
  var resumenHecho = false;
  function cuandoTxt(iso) {
    var d = new Date(iso), h = new Date(), m = new Date(h.getTime() + 864e5);
    var hora = d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === h.toDateString()) return 'Hoy ' + hora;
    if (d.toDateString() === m.toDateString()) return 'Mañana ' + hora;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' ' + hora;
  }
  function cifra(n, txt) { return el('div', { class: 'cifra' }, el('b', { text: String(n) }), el('span', { text: txt })); }
  function filaT(t, txt) { return el('div', { class: 'fila-t' }, el('span', { class: 'cuando', text: cuandoTxt(t) }), el('span', { text: txt })); }
  function pintarResumen() {
    if (resumenHecho) return;
    resumenHecho = true;
    api('/recordatorios').catch(function () { return {}; }).then(function (r) {
      var recs = (r && r.recordatorios) || [];
      var hoy = new Date().toDateString(), semana = Date.now() - 7 * 864e5;
      var pend = recs.filter(function (x) { return !x.avisado; })
        .sort(function (a, b) { return new Date(a.cuando) - new Date(b.cuando); });
      var nPlats = plats.filter(function (p) { return p.dueno_id === null || p.dueno_id === yo.user_id; }).length;
      var recHoy = pend.filter(function (x) { return new Date(x.cuando).toDateString() === hoy; }).length;
      var hechos = recs.filter(function (x) { return x.avisado && new Date(x.cuando).getTime() > semana; })
        .sort(function (a, b) { return new Date(b.cuando) - new Date(a.cuando); });
      var caja = $('resumen'); vaciar(caja);
      caja.appendChild(el('p', { class: 'etq', text: 'Resumen de hoy' }));
      caja.appendChild(el('div', { class: 'cifras' }, cifra(nPlats, 'Plataformas'), cifra(recHoy, 'Recordatorios hoy'), cifra(pend.length, 'Pendientes')));
      caja.appendChild(el('p', { class: 'etq', text: 'Próximos recordatorios' }));
      if (!pend.length) caja.appendChild(el('p', { class: 'vacio', text: 'Sin recordatorios pendientes.' }));
      pend.slice(0, 5).forEach(function (x) { caja.appendChild(filaT(x.cuando, x.texto)); });
      caja.appendChild(el('p', { class: 'etq sep', text: 'Línea de tiempo (7 días)' }));
      if (!hechos.length) caja.appendChild(el('p', { class: 'vacio', text: 'Sin recordatorios avisados esta semana.' }));
      hechos.slice(0, 8).forEach(function (x) { caja.appendChild(filaT(x.cuando, 'Recordatorio · ' + x.texto)); });
    });
  }
  $('btnNueva').addEventListener('click', function () { nueva(false); });

  function pintarCuenta() {
    var c = $('cuenta'); vaciar(c);
    [['Usuario', yo.nombre], ['Correo', yo.correo], ['Rol', esAdmin() ? 'Administrador' : 'Usuario'], ['Estado', 'Aprobado']].forEach(function (f) {
      c.appendChild(el('div', { class: 'cuenta-fila' }, el('span', { text: f[0] }), el('strong', { text: f[1] || '' })));
    });
  }

  /* ---------- Administración (los permisos reales los pone la base de datos) ---------- */
  function btn(txt, cls, fn) { return el('button', { class: 'btn mini ' + cls, text: txt, onclick: fn }); }
  function fila(titulo, sub, botones) {
    var acc = el('div', { class: 'acc' });
    (botones || []).forEach(function (b) { acc.appendChild(b); });
    return el('div', { class: 'fila' }, el('div', {}, el('strong', { text: titulo }), sub ? el('small', { text: sub }) : null), acc);
  }
  function vacioMsg(c, t) { c.appendChild(el('p', { class: 'vacio', text: t })); }
  function nombreDe(uid) {
    var u = usus.filter(function (x) { return x.user_id === uid; })[0];
    return u ? (u.nombre || u.correo) : 'Usuario';
  }
  function cambiar(u, campos, ok) { accion(api('/nexus/usuarios/' + u.user_id, 'PATCH', campos), ok); }
  function quitarUsuario(u) {
    confirmar('Eliminar usuario', '¿Quitar el acceso de "' + (u.nombre || u.correo) + '" a Nexus?').then(function (s) {
      if (s) accion(api('/nexus/usuarios/' + u.user_id, 'DELETE'), 'Acceso eliminado.');
    });
  }
  function pintarAdmin() {
    var pend = $('pend'), todos = $('usus'), glob = $('glob'), ajenas = $('ajenas');
    [pend, todos, glob, ajenas].forEach(vaciar);

    var pendientes = usus.filter(function (u) { return u.estado === 'pendiente'; });
    if (!pendientes.length) vacioMsg(pend, 'No hay usuarios pendientes.');
    pendientes.forEach(function (u) {
      pend.appendChild(fila(u.nombre || u.correo, u.correo, [
        btn('Aprobar', '', function () { cambiar(u, { estado: 'aprobado' }, 'Usuario aprobado.'); }),
        btn('Rechazar', 'mal', function () { quitarUsuario(u); })]));
    });

    var otros = usus.filter(function (u) { return u.user_id !== yo.user_id; });
    if (!otros.length) vacioMsg(todos, 'Aún no hay otros usuarios.');
    otros.forEach(function (u) {
      var admin = u.rol === 'admin', pe = u.estado === 'pendiente';
      todos.appendChild(fila(u.nombre || u.correo, (admin ? 'Administrador' : 'Usuario') + ' · ' + (pe ? 'Pendiente' : 'Aprobado'), [
        btn(admin ? 'Quitar admin' : 'Hacer admin', 'sec', function () { cambiar(u, { rol: admin ? 'usuario' : 'admin' }, 'Rol cambiado.'); }),
        btn(pe ? 'Aprobar' : 'Suspender', 'sec', function () { cambiar(u, { estado: pe ? 'aprobado' : 'pendiente' }, 'Estado cambiado.'); }),
        btn('Eliminar', 'mal', function () { quitarUsuario(u); })]));
    });

    var globales = plats.filter(function (p) { return p.dueno_id === null; });
    if (!globales.length) vacioMsg(glob, 'Aún no hay plataformas globales.');
    globales.forEach(function (p) {
      glob.appendChild(fila(p.nombre, p.url, [btn('Editar', 'sec', function () { editar(p); }), btn('Eliminar', 'mal', function () { borrar(p); })]));
    });

    var ajenasL = plats.filter(function (p) { return p.dueno_id !== null && p.dueno_id !== yo.user_id; });
    if (!ajenasL.length) vacioMsg(ajenas, 'Ningún usuario ha agregado plataformas propias.');
    ajenasL.forEach(function (p) {
      ajenas.appendChild(fila(p.nombre, p.url + ' · ' + nombreDe(p.dueno_id), [btn('Eliminar', 'mal', function () { borrar(p); })]));
    });
    pintarAsig();
  }
  function pintarAsig() {
    var s = $('selAsig'), c = $('asig'), previo = s.value;
    vaciar(s); vaciar(c);
    var normales = usus.filter(function (u) { return u.rol === 'usuario' && u.estado === 'aprobado'; });
    s.hidden = !normales.length;
    if (!normales.length) return vacioMsg(c, 'No hay usuarios normales aprobados.');
    normales.forEach(function (u) { s.appendChild(el('option', { value: u.user_id, text: u.nombre || u.correo })); });
    s.value = normales.some(function (u) { return u.user_id === previo; }) ? previo : normales[0].user_id;
    cargarAsig();
  }
  function cargarAsig() {
    var uid = $('selAsig').value, c = $('asig');
    var globales = plats.filter(function (p) { return p.dueno_id === null; });
    if (!uid) return;
    api('/nexus/asignaciones/' + uid).then(function (ids) {
      vaciar(c);
      if (!globales.length) return vacioMsg(c, 'No hay plataformas globales para asignar.');
      globales.forEach(function (p) {
        var chk = el('input', { type: 'checkbox' });
        chk.checked = ids.indexOf(p.id) >= 0;
        chk.addEventListener('change', function () {
          api('/nexus/asignaciones/' + uid + '/' + p.id, chk.checked ? 'PUT' : 'DELETE', chk.checked ? {} : undefined)
            .catch(function (e) { chk.checked = !chk.checked; fallo(e); });
        });
        c.appendChild(el('div', { class: 'fila' }, el('strong', { text: p.nombre }),
          el('label', {}, chk, document.createTextNode('Visible para este usuario'))));
      });
    }).catch(fallo);
  }
  $('selAsig').addEventListener('change', cargarAsig);
  $('btnGlobal').addEventListener('click', function () { nueva(true); });

  iniciar();
})();
