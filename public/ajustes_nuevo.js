/* Ajustes estilo Claude: iconos en el menu, flecha para volver y vista menu/detalle en celular */
(function () {
  var overlay = document.getElementById('overlayAjustes');
  var panel = document.getElementById('panelAjustes');
  var tabs = document.querySelectorAll('.tabAjuste');
  var header = document.getElementById('panelHeader');
  if (!overlay || !panel || !header || !tabs.length) return;

  var ICONOS = {
    llave: '<path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    voz: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>',
    tema: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    uso: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    acerca: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
  };
  var SUBS = {
    llave: 'Conecta Gemini o Groq',
    voz: 'Tono, velocidad y voz premium',
    tema: 'Claro, oscuro o automático',
    uso: 'Solicitudes de hoy',
    acerca: 'Qué es Jarvis y con qué funciona'
  };
  function svg(inner, clase) {
    return '<svg class="' + clase + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  tabs.forEach(function (b) {
    var txt = b.textContent.trim();
    b.dataset.titulo = txt;
    b.innerHTML = svg(ICONOS[b.dataset.tab] || ICONOS.acerca, 'tabIco')
      + '<span class="tabTxt"><b>' + txt + '</b><small>' + (SUBS[b.dataset.tab] || '') + '</small></span>'
      + svg('<path d="M9 6l6 6-6 6"/>', 'tabFlecha');
  });

  var menu = document.getElementById('tabsAjustes');
  var perfil = document.createElement('div');
  perfil.className = 'ajPerfil';
  perfil.innerHTML = '<div class="ajAv"></div><div class="ajDatos"><b></b><small></small></div>';
  menu.insertBefore(perfil, menu.firstChild);
  function pintarPerfil() {
    var mail = '', nom = '';
    try { mail = localStorage.getItem('jarvisCorreo') || ''; nom = localStorage.getItem('jarvisNombre') || ''; } catch (e) {}
    if (!nom) nom = mail ? mail.split('@')[0] : 'Invitado';
    nom = nom.charAt(0).toUpperCase() + nom.slice(1);
    perfil.querySelector('.ajAv').textContent = nom.charAt(0);
    perfil.querySelector('b').textContent = nom;
    perfil.querySelector('small').textContent = mail;
  }
  pintarPerfil();

  var titulo = header.querySelector('span');
  var cerrar = document.getElementById('btnCerrarPanel');
  var atras = document.createElement('button');
  atras.id = 'ajBack';
  atras.type = 'button';
  atras.setAttribute('aria-label', 'Volver');
  atras.innerHTML = svg('<path d="M15 6l-6 6 6 6"/>', '');
  header.insertBefore(atras, header.firstChild);
  titulo.textContent = 'Ajustes';

  var movil = window.matchMedia('(max-width: 819px)');
  function vista(v, nombre) {
    panel.dataset.vista = v;
    titulo.textContent = (v === 'detalle' && nombre) ? nombre : 'Ajustes';
  }
  function irMenu() { vista('menu'); }
  function activa() {
    var a = document.querySelector('.tabAjuste.activo');
    return a ? a.dataset.titulo : '';
  }

  tabs.forEach(function (b) {
    b.addEventListener('click', function () { vista('detalle', b.dataset.titulo); });
  });
  atras.addEventListener('click', irMenu);
  vista('menu');

  /* Al abrir Ajustes en celular se empieza en el menu; en pantalla grande el titulo no cambia */
  new MutationObserver(function () {
    if (overlay.classList.contains('abierto')) { pintarPerfil(); if (movil.matches) irMenu(); }
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  movil.addEventListener && movil.addEventListener('change', function () {
    if (!movil.matches) titulo.textContent = 'Ajustes'; else irMenu();
  });

  /* Para el boton Atras de la app Android y la tecla Escape: true si solo volvio al menu */
  window.ajustesAtras = function () {
    if (movil.matches && panel.dataset.vista === 'detalle') { irMenu(); return true; }
    return false;
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('abierto') && window.ajustesAtras()) {
      e.stopImmediatePropagation();
    }
  }, true);
})();
