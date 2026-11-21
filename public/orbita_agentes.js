/* Agentes en la orbita (v1.49, solo web): globito rojo en el satelite Automatizaciones
   cuando un trabajo en segundo plano fallo, y los fallos salen arriba en su hoja.
   Lee /trabajos. Para volver atras: quitar sus lineas de index.html. */
(function () {
  'use strict';
  var LS = 'jarvisAgentesVistos';
  var fallos = [];

  function visto() {
    try { return parseInt(localStorage.getItem(LS) || '0', 10) || 0; } catch (e) { return 0; }
  }
  function marcarVisto() {
    try { localStorage.setItem(LS, String(Date.now())); } catch (e) {}
    pintar(0);
  }
  function satelite() {
    var ets = document.querySelectorAll('#inicioOrbital .oiEt');
    for (var i = 0; i < ets.length; i++) {
      if (ets[i].textContent.trim().toLowerCase() === 'automatizaciones') return ets[i].parentNode;
    }
    return null;
  }
  function pintar(n) {
    var sat = satelite();
    if (!sat) return;
    var b = sat.querySelector('.oiBadge');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'oiBadge'; sat.appendChild(b); }
    b.textContent = String(n);
  }
  function revisar() {
    fetch('/trabajos').then(function (r) { return r.ok ? r.json() : { trabajos: [] }; })
      .then(function (d) {
        var desde = Date.now() - 24 * 3600 * 1000;
        fallos = (d.trabajos || []).filter(function (t) {
          return t.estado === 'fallido' && new Date(t.actualizado).getTime() > desde;
        });
        pintar(fallos.filter(function (t) { return new Date(t.actualizado).getTime() > visto(); }).length);
      }).catch(function () {});
  }

  window.orbitaAgentes = {
    fallos: function () {
      return fallos.slice(0, 3).map(function (t) {
        return { titulo: t.titulo || 'Trabajo', resultado: (t.resultado || 'Sin detalle').slice(0, 140) };
      });
    },
    visto: marcarVisto
  };

  document.addEventListener('click', function (e) {
    var sat = satelite();
    if (sat && sat.contains(e.target) && !e.target.classList.contains('oiBadge')) marcarVisto();
  }, true);
  window.addEventListener('focus', revisar);
  setTimeout(revisar, 2500);
  setInterval(revisar, 90000);
})();
