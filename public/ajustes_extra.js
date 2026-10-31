/* Ajustes: Herramientas y Manos de Jarvis viven aqui (antes estaban en el sidebar).
   herramientas.js y manos.js siguen creando sus cajas; este archivo las mueve a su seccion. */
(function () {
  var vH = document.getElementById('tabHerramientas');
  var vM = document.getElementById('tabManos');
  var tabM = document.querySelector('.tabAjuste[data-tab="manos"]');
  var cap = window.Capacitor;
  var nativa = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

  // Las Manos solo existen en la APK: fuera de ella no hay seccion
  if (!nativa) {
    if (tabM) tabM.remove();
    if (vM) vM.remove();
    vM = null;
  }

  var css = document.createElement('style');
  css.textContent = '#tabHerramientas .hrCont{padding:0}#tabManos .mnCaja{margin:0}#tabManos .mnCaja>b{display:none}';
  document.head.appendChild(css);

  function mover() {
    var h = document.getElementById('hrCont');
    if (h && vH && h.parentNode !== vH) {
      var t = h.previousElementSibling;
      if (t && t.classList.contains('sbSeccion') && t.textContent.trim() === 'Herramientas') t.remove();
      vH.appendChild(h);
    }
    var c = document.getElementById('mnCaja');
    if (c && vM && c.parentNode !== vM) vM.appendChild(c);
  }

  mover();
  // herramientas.js arma su caja al terminar de cargar la pagina y manos.js la suya despues
  var ob = new MutationObserver(mover);
  [document.getElementById('sidebar'), vH].forEach(function (n) {
    if (n) ob.observe(n, { childList: true });
  });
})();
