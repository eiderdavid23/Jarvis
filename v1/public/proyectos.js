/* Proyectos del sidebar: carpetas que agrupan chats, con instrucciones opcionales para Jarvis. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var IC = {
    carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    flecha: '<path d="M9 6l6 6-6 6"/>',
    mas: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    puntos: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
    lapiz: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    texto: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    basura: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/>'
  };
  function icono(n) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    if (n === 'puntos') { s.setAttribute('fill', 'currentColor'); }
    else {
      s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
      s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    }
    s.innerHTML = IC[n];
    return s;
  }
  function h(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto) e.textContent = texto;
    return e;
  }
  var KA = 'jarvisProyAbiertos';
  var proys = [], ultimos = { chats: [], crearFila: null }, caja = null, tit = null;
  var abiertos = new Set();
  try { abiertos = new Set(JSON.parse(localStorage.getItem(KA) || '[]')); } catch (e) {}
  function guardarAbiertos() { try { localStorage.setItem(KA, JSON.stringify(Array.from(abiertos))); } catch (e) {} }
  function recargar() { if (window.recargarChats) window.recargarChats(); }
  function json(cuerpo) { return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }; }

  function aviso(texto) {
    var a = h('div', 'proyAviso', texto);
    document.body.appendChild(a);
    setTimeout(function () { a.classList.add('v'); }, 20);
    setTimeout(function () { a.classList.remove('v'); setTimeout(function () { a.remove(); }, 400); }, 2600);
  }
  function cerrarMenu() { document.querySelectorAll('.chatMenu, .chatMenuFondo').forEach(function (e) { e.remove(); }); }
  function menu(btn, items) {
    cerrarMenu();
    var fondo = h('div', 'chatMenuFondo'), m = h('div', 'chatMenu');
    fondo.addEventListener('click', cerrarMenu);
    items.forEach(function (it) {
      var b = h('button', it[2]); b.type = 'button';
      b.appendChild(icono(it[0])); b.appendChild(document.createTextNode(it[1]));
      b.addEventListener('click', function (e) { e.stopPropagation(); cerrarMenu(); it[3](); });
      m.appendChild(b);
    });
    document.body.appendChild(fondo); document.body.appendChild(m);
    var r = btn.getBoundingClientRect(), w = m.offsetWidth, alto = m.offsetHeight;
    var top = r.bottom + 4;
    if (top + alto > innerHeight - 8) top = Math.max(8, r.top - alto - 4);
    m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
    m.style.top = top + 'px';
  }

  /* ---------- ventana para crear / editar ---------- */
  function cerrarEditor() { var o = document.getElementById('proyOv'); if (o) o.remove(); }
  function editor(p, campos) {
    campos = campos || ['nombre', 'instrucciones'];
    cerrarEditor();
    var ov = h('div', 'proyOv'), card = h('div', 'proyCard'), inN = null, inI = null;
    ov.id = 'proyOv';
    var solo = campos.length === 1 ? campos[0] : '';
    card.appendChild(h('h3', '', !p ? 'Nuevo proyecto' : (solo === 'nombre' ? 'Cambiar nombre' : 'Instrucciones del proyecto')));
    if (campos.indexOf('nombre') >= 0) {
      inN = h('input', 'proyInp'); inN.maxLength = 40; inN.placeholder = 'Nombre del proyecto';
      inN.value = p ? p.nombre : ''; card.appendChild(inN);
    }
    if (campos.indexOf('instrucciones') >= 0) {
      card.appendChild(h('p', 'proyAyuda', 'Opcional. Jarvis las sigue en todos los chats de este proyecto.'));
      inI = h('textarea', 'proyInp'); inI.rows = 5; inI.maxLength = 2000;
      inI.placeholder = 'Ej.: Este proyecto es de mi plataforma, responde como asistente de soporte.';
      inI.value = p ? (p.instrucciones || '') : ''; card.appendChild(inI);
    }
    var msg = h('p', 'proyMsg'), bt = h('div', 'proyBtns');
    var no = h('button', 'proyNo', 'Cancelar'), ok = h('button', 'proyOk', p ? 'Guardar' : 'Crear');
    no.type = 'button'; ok.type = 'button';
    no.addEventListener('click', cerrarEditor);
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrarEditor(); });
    ok.addEventListener('click', function () {
      var cuerpo = {};
      if (inN) {
        var n = inN.value.replace(/\s+/g, ' ').trim();
        if (!n) { msg.textContent = 'Póngale un nombre al proyecto, señor.'; return; }
        cuerpo.nombre = n;
      }
      if (inI) cuerpo.instrucciones = inI.value.trim();
      ok.disabled = true;
      fetch(p ? '/proyectos/' + p.id : '/proyectos', Object.assign({ method: p ? 'PATCH' : 'POST' }, json(cuerpo)))
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
        .then(function (x) {
          if (!x.r.ok) throw new Error(x.d.error || 'error');
          if (!p && x.d.id) { abiertos.add(x.d.id); guardarAbiertos(); }
          cerrarEditor(); recargar();
        })
        .catch(function (e) { msg.textContent = 'No pude guardar: ' + e.message; ok.disabled = false; });
    });
    bt.appendChild(no); bt.appendChild(ok); card.appendChild(msg); card.appendChild(bt);
    ov.appendChild(card); document.body.appendChild(ov);
    (inN || inI).focus();
  }

  /* ---------- acciones ---------- */
  function nuevoAqui(p) {
    var b = document.getElementById('sbNuevo');
    if (b) b.click();
    window.proyectoNuevoId = p.id;
    abiertos.add(p.id); guardarAbiertos(); render();
    aviso('Nuevo chat en «' + p.nombre + '»');
  }
  async function borrar(p) {
    if (!window.confirmarJarvis) return;
    var quiere = await window.confirmarJarvis({
      titulo: '¿Eliminar este proyecto?', nombre: p.nombre,
      texto: 'se elimina el proyecto, pero sus chats se conservan.', cancelar: 'Conservar', aceptar: 'Eliminar'
    });
    if (!quiere) return;
    fetch('/proyectos/' + p.id, { method: 'DELETE' }).then(function (r) {
      if (!r.ok) return;
      abiertos.delete(p.id); guardarAbiertos();
      if (window.proyectoNuevoId === p.id) window.proyectoNuevoId = null;
      recargar();
    }).catch(function () {});
  }
  function mover(c, pid) {
    fetch('/chats/' + c.id, Object.assign({ method: 'PATCH' }, json({ proyecto_id: pid }))).then(function (r) {
      if (!r.ok) return;
      if (pid) { abiertos.add(pid); guardarAbiertos(); }
      recargar();
    }).catch(function () {});
  }
  function elegir(c, btn) {
    if (!proys.length) { menu(btn, [['mas', 'Crear un proyecto', '', function () { editor(null); }]]); return; }
    menu(btn, proys.map(function (p) {
      return ['carpeta', p.nombre, '', function () { mover(c, p.id); }];
    }));
  }
  function menuProyecto(p, btn) {
    menu(btn, [
      ['lapiz', 'Cambiar nombre', '', function () { editor(p, ['nombre']); }],
      ['texto', 'Instrucciones', '', function () { editor(p, ['instrucciones']); }],
      ['chat', 'Nuevo chat aquí', '', function () { nuevoAqui(p); }],
      ['basura', 'Eliminar', 'peligro', function () { borrar(p); }]
    ]);
  }

  /* ---------- dibujar la sección ---------- */
  function montar() {
    if (caja && caja.isConnected) return true;
    var lista = document.getElementById('listaChats');
    var tChats = lista && lista.previousElementSibling;
    if (!tChats) return false;
    tit = h('div', 'sbSeccion proyTit');
    tit.appendChild(h('span', '', 'Proyectos'));
    var b = h('button', 'proyNuevo'); b.type = 'button'; b.setAttribute('aria-label', 'Crear proyecto');
    b.appendChild(icono('mas'));
    b.addEventListener('click', function () { editor(null); });
    tit.appendChild(b);
    caja = h('div'); caja.id = 'listaProyectos';
    tChats.parentNode.insertBefore(tit, tChats);
    tChats.parentNode.insertBefore(caja, tChats);
    return true;
  }
  function render() {
    if (!caja) return;
    caja.innerHTML = '';
    if (!proys.length) { caja.appendChild(h('div', 'sbVacio', 'Aún no hay proyectos, señor.')); return; }
    proys.forEach(function (p) {
      var hijos = ultimos.chats.filter(function (c) { return c.proyecto_id === p.id; });
      var abierto = abiertos.has(p.id);
      var fila = h('div', 'sbItem proyItem' + (abierto ? ' abierto' : ''));
      var fl = h('span', 'proyFlecha'); fl.appendChild(icono('flecha'));
      fila.appendChild(fl); fila.appendChild(icono('carpeta'));
      fila.appendChild(h('span', 'chatTit proyNom', p.nombre));
      if (hijos.length) fila.appendChild(h('span', 'proyCuenta', String(hijos.length)));
      var mas = h('button', 'chatMas'); mas.type = 'button'; mas.setAttribute('aria-label', 'Opciones del proyecto');
      mas.appendChild(icono('puntos'));
      mas.addEventListener('click', function (e) { e.stopPropagation(); menuProyecto(p, mas); });
      fila.appendChild(mas);
      fila.addEventListener('click', function () {
        if (abiertos.has(p.id)) abiertos.delete(p.id); else abiertos.add(p.id);
        guardarAbiertos(); render();
        if (window.marcarChatActivo) window.marcarChatActivo();
      });
      caja.appendChild(fila);
      if (abierto) {
        var cont = h('div', 'proyHijos');
        if (!hijos.length) cont.appendChild(h('div', 'sbVacio', 'Sin chats todavía.'));
        hijos.forEach(function (c) { cont.appendChild(ultimos.crearFila(c)); });
        caja.appendChild(cont);
      }
    });
  }
  /* Recibe todos los chats; dibuja los proyectos y devuelve los chats que quedan sueltos. */
  async function pintar(chats, crearFila) {
    if (!montar()) return chats;
    var datos = null;
    try { var r = await fetch('/proyectos'); if (r.ok) datos = await r.json(); } catch (e) {}
    if (!Array.isArray(datos)) { tit.style.display = 'none'; caja.style.display = 'none'; proys = []; return chats; }
    tit.style.display = ''; caja.style.display = '';
    proys = datos; ultimos = { chats: chats, crearFila: crearFila };
    render();
    var ids = new Set(proys.map(function (p) { return p.id; }));
    return chats.filter(function (c) { return !c.proyecto_id || !ids.has(c.proyecto_id); });
  }
  ['btnNuevoTop', 'sbNuevo'].forEach(function (id) {
    var e = document.getElementById(id);
    if (e) e.addEventListener('click', function () { window.proyectoNuevoId = null; });
  });
  window.proyectosJarvis = { pintar: pintar, elegir: elegir };
})();
