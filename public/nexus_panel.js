/* Abre y cierra el panel de Jarvis en NEXUS23. Jarvis va en un iframe del mismo dominio,
   así comparte la sesión (localStorage) y no hay que iniciar sesión otra vez. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var btn = $('btnJarvis'), panel = $('panelJarvis'), marco = $('pjFrame');
  if (!btn || !panel || !marco) return;
  if (document.documentElement.classList.contains('modo-modulo')) return;
  var K = 'nexusPanelAbierto';
  function ancho() { return window.matchMedia('(min-width: 900px)').matches; }
  function sesion() { try { return !!localStorage.getItem('jarvisAcceso'); } catch (e) { return false; } }

  function abrir() {
    if (!marco.getAttribute('src')) marco.setAttribute('src', '/?panel=1');
    panel.hidden = false;
    document.body.classList.add('con-panel');
    btn.setAttribute('aria-expanded', 'true');
    try { if (ancho()) localStorage.setItem(K, '1'); } catch (e) {}
  }
  function cerrar() {
    panel.hidden = true;
    document.body.classList.remove('con-panel');
    btn.setAttribute('aria-expanded', 'false');
    try { localStorage.removeItem(K); } catch (e) {}
  }

  btn.addEventListener('click', function () { if (panel.hidden) abrir(); else cerrar(); });
  $('pjCerrar').addEventListener('click', cerrar);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) cerrar(); });
  try { if (ancho() && sesion() && localStorage.getItem(K) === '1') abrir(); } catch (e) {}
})();
