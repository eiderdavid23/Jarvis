/* Menú ⋯ de cada chat del sidebar: Cambiar nombre, Fijar / Desfijar y Eliminar. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var IC = {
    mas: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
    carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    quitar: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 13h6"/>',
    lapiz: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    fijar: '<path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3H7l3-3z"/>',
    desfijar: '<path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3H7l3-3z"/><path d="M4 4l16 16"/>',
    basura: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/>'
  };
  function icono(n) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    if (n === 'mas') { s.setAttribute('fill', 'currentColor'); }
    else {
      s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
      s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    }
    s.innerHTML = IC[n];
    return s;
  }
  function h(tag, clase) { var e = document.createElement(tag); if (clase) e.className = clase; return e; }
  function editar(id, cuerpo) {
    return fetch('/chats/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { if (!r.ok) throw new Error('chat'); return r; });
  }
  function cerrarMenu() { document.querySelectorAll('.chatMenu, .chatMenuFondo').forEach(function (e) { e.remove(); }); }
  function renombrar(fila, c) {
    var tit = fila.querySelector('.chatTit');
    if (!tit) return;
    var inp = h('input', 'chatEdit'), listo = false;
    inp.maxLength = 40; inp.value = c.titulo;
    function fin(guardar) {
      if (listo) return;
      listo = true;
      var nuevo = inp.value.replace(/\s+/g, ' ').trim();
      inp.replaceWith(tit);
      if (!guardar || !nuevo || nuevo === c.titulo) return;
      var viejo = c.titulo;
      c.titulo = nuevo; tit.textContent = nuevo;
      editar(c.id, { titulo: nuevo }).catch(function () { c.titulo = viejo; tit.textContent = viejo; });
    }
    inp.addEventListener('click', function (e) { e.stopPropagation(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); fin(true); } else if (e.key === 'Escape') { fin(false); }
    });
    inp.addEventListener('blur', function () { fin(true); });
    tit.replaceWith(inp);
    inp.focus(); inp.select();
  }
  function abrirMenu(c, fila, btn) {
    cerrarMenu();
    var fondo = h('div', 'chatMenuFondo'), m = h('div', 'chatMenu');
    fondo.addEventListener('click', cerrarMenu);
    function op(icon, texto, clase, fn) {
      var b = h('button', clase); b.type = 'button';
      b.appendChild(icono(icon)); b.appendChild(document.createTextNode(texto));
      b.addEventListener('click', function (e) { e.stopPropagation(); cerrarMenu(); fn(); });
      m.appendChild(b);
    }
    op('lapiz', 'Cambiar nombre', '', function () { renombrar(fila, c); });
    op(c.fijado ? 'desfijar' : 'fijar', c.fijado ? 'Desfijar' : 'Fijar', '', function () {
      editar(c.id, { fijado: !c.fijado }).then(function () { if (window.recargarChats) window.recargarChats(); }).catch(function () {});
    });
    if (window.proyectosJarvis) {
      if (c.proyecto_id) {
        op('quitar', 'Quitar del proyecto', '', function () {
          editar(c.id, { proyecto_id: null }).then(function () { if (window.recargarChats) window.recargarChats(); }).catch(function () {});
        });
      } else {
        op('carpeta', 'Agregar a un proyecto', '', function () { window.proyectosJarvis.elegir(c, btn); });
      }
    }
    op('basura', 'Eliminar', 'peligro', function () { if (window.borrarChatJarvis) window.borrarChatJarvis(c.id); });
    document.body.appendChild(fondo); document.body.appendChild(m);
    var r = btn.getBoundingClientRect(), w = m.offsetWidth, alto = m.offsetHeight;
    var top = r.bottom + 4;
    if (top + alto > innerHeight - 8) top = Math.max(8, r.top - alto - 4);
    m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
    m.style.top = top + 'px';
  }
  window.menuChat = {
    decorar: function (fila, c) {
      var del = fila.querySelector('.chatDel');
      if (del) del.remove();
      if (c.fijado) { var p = h('span', 'chatPin'); p.appendChild(icono('fijar')); fila.insertBefore(p, fila.firstChild); }
      var b = h('button', 'chatMas'); b.type = 'button'; b.setAttribute('aria-label', 'Opciones del chat');
      b.appendChild(icono('mas'));
      b.addEventListener('click', function (e) { e.stopPropagation(); abrirMenu(c, fila, b); });
      fila.appendChild(b);
    }
  };
})();
