/* Ajustes estilo Claude: filas agrupadas en tarjetas, todo adentro (Mi memoria, Modo de color, Cerrar sesion...).
   Reorganiza los botones que ya existen y agrega las filas que faltan. Corre despues de ajustes_nuevo.js. */
(function () {
  var menu = document.getElementById('tabsAjustes');
  var overlay = document.getElementById('overlayAjustes');
  if (!menu || !overlay) return;

  function svg(inner, clase) {
    return '<svg class="' + clase + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var IC = {
    tema: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    lapiz: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    globo: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    ayuda: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'
  };
  var FLECHA = svg('<path d="M9 6l6 6-6 6"/>', 'tabFlecha');

  /* Todos los textos son fijos de este archivo (nada del usuario entra por innerHTML) */
  function fila(ac, icono, titulo, sub, pronto) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ajFila' + (pronto ? ' pronto' : '') + (ac === 'salir' ? ' salir' : '');
    b.dataset.ac = ac;
    if (pronto) b.setAttribute('aria-disabled', 'true');
    b.innerHTML = svg(IC[icono], 'tabIco')
      + '<span class="tabTxt"><b>' + titulo + '</b><small>' + (sub || '') + '</small></span>'
      + (pronto ? '<span class="chipPronto">Pronto</span>' : (ac === 'salir' ? '' : FLECHA));
    return b;
  }
  function tab(n) { return menu.querySelector('.tabAjuste[data-tab="' + n + '"]'); }

  /* "Tema" pasa a ser una fila que abre la ventanita Modo de color (la vista tabTema sigue existiendo, oculta) */
  var tabTemaBtn = tab('tema');
  if (tabTemaBtn) tabTemaBtn.remove();
  var rowTema = fila('tema', 'tema', 'Modo de color', '');

  var GRUPOS = [
    [tab('llave'), tab('herramientas'), tab('manos')],
    [tab('memoria'), fila('instrucciones', 'lapiz', 'Instrucciones personalizadas', '', true), fila('idioma', 'globo', 'Idioma', '', true)],
    [tab('voz'), rowTema, tab('uso')],
    [fila('ayuda', 'ayuda', 'Ayuda', '', true), tab('acerca')],
    [fila('salir', 'salir', 'Cerrar sesión', '')]
  ];
  GRUPOS.forEach(function (g) {
    var d = document.createElement('div');
    d.className = 'ajGrupo';
    g.forEach(function (x) { if (x) d.appendChild(x); });
    if (d.children.length) menu.appendChild(d);
  });

  /* Subtitulo de Modo de color = valor actual */
  var NOMBRES = { sistema: 'Sistema', claro: 'Claro', oscuro: 'Oscuro' };
  function pintarTema() {
    var p = typeof window.preferenciaTema === 'function' ? window.preferenciaTema() : 'sistema';
    var sm = rowTema.querySelector('small');
    if (sm) sm.textContent = NOMBRES[p] || 'Sistema';
  }
  pintarTema();
  new MutationObserver(pintarTema).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  var vTema = document.getElementById('tabTema');
  if (vTema) new MutationObserver(pintarTema).observe(vTema, { subtree: true, childList: true, characterData: true });

  menu.addEventListener('click', function (e) {
    var b = e.target.closest('.ajFila');
    if (!b || b.classList.contains('pronto')) return;
    if (b.dataset.ac === 'tema') {
      var f = document.querySelector('#tabTema .ajFilaSel');
      if (f) f.click();
    } else if (b.dataset.ac === 'salir') {
      if (typeof cerrarAjustes === 'function') cerrarAjustes();
      var s = document.getElementById('syBtn');
      if (s) s.click();
    }
  });
})();
