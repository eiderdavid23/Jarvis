/* Fila "Modelos IA" en Ajustes: abre la hoja de modelos locales (descargar, RAM recomendada, peso).
   Corre despues de ajustes_claude.js y modelo_local.js. */
(function () {
  var menu = document.getElementById('tabsAjustes');
  if (!menu) return;
  var grupo = menu.querySelector('.ajGrupo');
  if (!grupo || menu.querySelector('[data-ac="modelos_ia"]')) return;

  var ICO = '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/>'
    + '<path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>';
  function svg(inner, clase) {
    return '<svg class="' + clase + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  /* Textos fijos de este archivo (nada del usuario entra por innerHTML) */
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'ajFila';
  b.dataset.ac = 'modelos_ia';
  b.innerHTML = svg(ICO, 'tabIco')
    + '<span class="tabTxt"><b>Modelos IA</b><small>Modelos que corren en tu celular, sin API</small></span>'
    + svg('<path d="M9 6l6 6-6 6"/>', 'tabFlecha');
  b.addEventListener('click', function () {
    if (typeof cerrarAjustes === 'function') cerrarAjustes();
    setTimeout(function () {
      if (window.modeloLocal) window.modeloLocal.abrir();
      else window.alert('Los modelos locales solo funcionan en la app de Android (APK).');
    }, 160);
  });
  grupo.appendChild(b);
})();
