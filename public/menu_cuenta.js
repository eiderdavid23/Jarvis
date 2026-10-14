/* Menu de cuenta (avatar o nombre) y pantalla "Mi memoria" - parte 1 de 2 */
(function () {
  var sb = document.getElementById('sidebar');
  var pie = document.getElementById('sbPie');
  if (!sb || !pie) return;

  function svg(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var IC = {
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    memoria: '<path d="M12 4a4 4 0 0 0-4-1 3.5 3.5 0 0 0-3 4 3.5 3.5 0 0 0-1 5 3.5 3.5 0 0 0 3 5 3.5 3.5 0 0 0 5 1z"/><path d="M12 4a4 4 0 0 1 4-1 3.5 3.5 0 0 1 3 4 3.5 3.5 0 0 1 1 5 3.5 3.5 0 0 1-3 5 3.5 3.5 0 0 1-5 1z"/>',
    lapiz: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    globo: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    ayuda: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'
  };
  var ITEMS = [
    ['ajustes', 'Ajustes', 'ajustes'],
    ['memoria', 'Mi memoria', 'memoria'],
    null,
    ['lapiz', 'Instrucciones personalizadas', 'pronto'],
    ['globo', 'Idioma', 'pronto'],
    ['ayuda', 'Ayuda', 'pronto'],
    null,
    ['salir', 'Cerrar sesión', 'salir']
  ];

  var html = '<div class="mcMail" id="mcMail"></div>';
  ITEMS.forEach(function (it) {
    if (!it) { html += '<div class="mcSep"></div>'; return; }
    var pronto = it[2] === 'pronto';
    html += '<button class="mcItem' + (pronto ? ' pronto' : '') + (it[2] === 'salir' ? ' salir' : '') + '" data-ac="' + it[2] + '">'
      + svg(IC[it[0]]) + '<span>' + it[1] + '</span>'
      + (pronto ? '<span class="chipPronto">Pronto</span>' : '') + '</button>';
  });

  var velo = document.createElement('div');
  velo.id = 'mcVelo';
  var menu = document.createElement('div');
  menu.id = 'menuCuenta';
  menu.innerHTML = html;
  document.body.appendChild(velo);
  document.body.appendChild(menu);

  var mm = document.createElement('div');
  mm.id = 'mmOverlay';
  mm.innerHTML = '<div id="mmPanel" role="dialog" aria-modal="true" aria-labelledby="mmTit">'
    + '<div class="mmCab"><h3 id="mmTit">Mi memoria</h3><button class="mmX" id="mmX" aria-label="Cerrar">&times;</button></div>'
    + '<div class="mmSub">Esto es lo que Jarvis recuerda de usted entre chats. Puede borrar lo que quiera.</div>'
    + '<div id="mmLista"></div>'
    + '<div class="mmPie"><button id="mmTodo" hidden>Borrar todo</button></div></div>';
  document.body.appendChild(mm);

  var CHEV = svg('<polyline points="6 15 12 9 18 15"/>').replace('<svg ', '<svg class="mcChev" ');
  function ponerChev() {
    if (pie.querySelector('.mcChev')) return;
    pie.insertAdjacentHTML('beforeend', CHEV);
  }
  ponerChev();
  new MutationObserver(ponerChev).observe(pie, { childList: true });

  function abrirMenu() {
    document.getElementById('mcMail').textContent = localStorage.getItem('jarvisCorreo') || '';
    var r = pie.getBoundingClientRect();
    menu.style.bottom = (window.innerHeight - r.top + 8) + 'px';
    document.body.classList.add('mc-abierto');
  }
  function cerrarMenu() { document.body.classList.remove('mc-abierto'); }
  pie.addEventListener('click', function () {
    if (document.body.classList.contains('mc-abierto')) cerrarMenu(); else abrirMenu();
  });
  velo.addEventListener('click', cerrarMenu);

  menu.addEventListener('click', function (e) {
    var b = e.target.closest('.mcItem');
    if (!b || b.dataset.ac === 'pronto') return;
    var ac = b.dataset.ac;
    cerrarMenu();
    if (typeof cerrarSidebar === 'function') cerrarSidebar();
    if (ac === 'ajustes' && typeof abrirAjustes === 'function') abrirAjustes();
    else if (ac === 'memoria') abrirMemoria();
    else if (ac === 'salir') { var s = document.getElementById('syBtn'); if (s) s.click(); }
  });

  var lista = document.getElementById('mmLista');
  var btnTodo = document.getElementById('mmTodo');
  var confirmando = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }
  function pintar(filas) {
    if (!filas.length) {
      lista.innerHTML = '<div class="mmVacio">Aún no recuerdo nada de usted. Cuénteme algo en un chat y lo guardaré.</div>';
      btnTodo.hidden = true;
      return;
    }
    lista.innerHTML = filas.map(function (f) {
      return '<div class="mmFila"><div class="mmTxt"><b>' + esc(String(f.clave).replace(/_/g, ' ')) + '</b><span>' + esc(f.valor) + '</span></div>'
        + '<button class="mmDel" data-clave="' + esc(f.clave) + '" aria-label="Borrar">&times;</button></div>';
    }).join('');
    btnTodo.hidden = false;
  }
  function cargar() {
    lista.innerHTML = '<div class="mmVacio">Cargando…</div>';
    btnTodo.hidden = true;
    fetch('/memorias').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(pintar)
      .catch(function () { lista.innerHTML = '<div class="mmVacio">No pude cargar su memoria. Intente de nuevo.</div>'; });
  }
  function borrar(cuerpo) {
    return fetch('/memorias', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { if (!r.ok) throw 0; });
  }
  lista.addEventListener('click', function (e) {
    var b = e.target.closest('.mmDel');
    if (!b) return;
    var fila = b.closest('.mmFila');
    borrar({ clave: b.dataset.clave }).then(function () {
      fila.remove();
      if (!lista.querySelector('.mmFila')) pintar([]);
    }).catch(cargar);
  });

  function reiniciarTodo() {
    clearTimeout(confirmando);
    confirmando = null;
    btnTodo.textContent = 'Borrar todo';
  }
  btnTodo.addEventListener('click', function () {
    if (!confirmando) {
      btnTodo.textContent = 'Toque otra vez para confirmar';
      confirmando = setTimeout(reiniciarTodo, 3500);
      return;
    }
    reiniciarTodo();
    borrar({ todo: true }).then(function () { pintar([]); }).catch(cargar);
  });
  function abrirMemoria() { reiniciarTodo(); mm.classList.add('abierto'); cargar(); }
  function cerrarMemoria() { mm.classList.remove('abierto'); reiniciarTodo(); }
  document.getElementById('mmX').addEventListener('click', cerrarMemoria);
  mm.addEventListener('click', function (e) { if (e.target === mm) cerrarMemoria(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { cerrarMenu(); cerrarMemoria(); }
  });
})();
