/* Ajustes directos (v1.50, solo web): los satelites de la orbita abren SOLO su seccion
   (Manos, TV y PC, Llaves de IA...) en vez de la lista completa de Ajustes.
   El satelite Ajustes sigue abriendo todo. Para volver atras: quitar sus lineas de index.html. */
(function () {
  'use strict';
  var MAPA = { tema: 'apariencia', llave: 'cerebro', voz: 'voz', memoria: 'memoria',
               herramientas: 'herramientas', manos: 'permisos', uso: 'rendimiento', acerca: 'acerca' };
  var overlay = document.getElementById('overlayAjustes');
  var api = window.inicioOrbital;
  if (!overlay || !api) return;

  function titulo() { return document.querySelector('#panelHeader span'); }

  function limpiar() {
    document.body.classList.remove('ajy-solo');
    var c = document.querySelectorAll('#ajyLista .ajySolo');
    for (var i = 0; i < c.length; i++) c[i].classList.remove('ajySolo');
    var t = titulo();
    if (t && t.textContent !== 'Ajustes') t.textContent = 'Ajustes';
  }

  function directo(tab) {
    var id = MAPA[tab];
    var lista = document.getElementById('ajyLista');
    var ay = window.ajustesYarvex;
    var card = (lista && id) ? lista.querySelector('.ajyCard[data-id="' + id + '"]') : null;
    if (!card || !ay) {
      if (tab === 'manos' && api.aviso) { api.aviso('Manos solo funciona en la app de Android'); return; }
      if (typeof abrirAjustes === 'function') abrirAjustes();
      return;
    }
    limpiar();
    if (typeof abrirAjustes === 'function') abrirAjustes();
    if (!card.classList.contains('abierta')) ay.abrirTarjeta(id, false);
    card.classList.add('ajySolo');
    document.body.classList.add('ajy-solo');
    setTimeout(function () {
      var t = titulo(), n = card.querySelector('.ajyTxt b');
      if (t && n) t.textContent = n.textContent;
      lista.scrollTop = 0;
    }, 60);
  }

  /* Al cerrar Ajustes, todo vuelve a la lista completa */
  new MutationObserver(function () {
    if (!overlay.classList.contains('abierto')) limpiar();
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });

  api.acciones.manos = function () { directo('manos'); };
  api.abrirAjustesTab = directo;
})();
