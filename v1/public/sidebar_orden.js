/* Sidebar ordenado: cada seccion (titulo gris) se pliega y se abre tocando el titulo.
   Herramientas y Proximamente empiezan plegadas; el estado se guarda en este dispositivo. */
(function () {
  var CLAVE = 'jarvisSbPlegadas';
  var POR_DEFECTO = { 'Herramientas': true, 'Próximamente': true };
  var NS = 'http://www.w3.org/2000/svg';

  function leer() {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
  }
  function guardar(o) {
    try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) {}
  }
  function plegada(nombre) {
    var o = leer();
    return nombre in o ? !!o[nombre] : !!POR_DEFECTO[nombre];
  }
  function contenido(titulo) {
    var r = [];
    var e = titulo.nextElementSibling;
    while (e && !e.classList.contains('sbSeccion') && !e.classList.contains('sbPie')) {
      if (e.id !== 'sbAjustes') r.push(e);
      e = e.nextElementSibling;
    }
    return r;
  }
  function aplicar(titulo) {
    var p = plegada(titulo.dataset.sbNombre);
    titulo.classList.toggle('plegada', p);
    titulo.setAttribute('aria-expanded', p ? 'false' : 'true');
    contenido(titulo).forEach(function (e) { e.classList.toggle('sbOculto', p); });
  }
  function preparar(titulo) {
    if (titulo.dataset.plegable) return;
    var copia = titulo.cloneNode(true);
    var bots = copia.querySelectorAll('button');
    for (var i = 0; i < bots.length; i++) bots[i].remove();
    titulo.dataset.sbNombre = copia.textContent.trim();
    titulo.dataset.plegable = '1';
    titulo.setAttribute('role', 'button');
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sbFlecha');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '3');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var poly = document.createElementNS(NS, 'polyline');
    poly.setAttribute('points', '9 6 15 12 9 18');
    svg.appendChild(poly);
    titulo.insertBefore(svg, titulo.firstChild);
    titulo.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      var o = leer();
      o[titulo.dataset.sbNombre] = !plegada(titulo.dataset.sbNombre);
      guardar(o);
      aplicar(titulo);
    });
  }
  function organizar() {
    var sb = document.getElementById('sidebar');
    if (!sb) return;
    var titulos = sb.querySelectorAll('.sbSeccion');
    for (var i = 0; i < titulos.length; i++) { preparar(titulos[i]); aplicar(titulos[i]); }
    // Ajustes baja al final, junto a la tarjeta de usuario
    var aj = document.getElementById('sbAjustes');
    var pie = sb.querySelector('.sbPie');
    if (aj && pie && aj.nextElementSibling !== pie) sb.insertBefore(aj, pie);
  }

  var sb = document.getElementById('sidebar');
  if (!sb) return;
  organizar();
  // Las secciones de Proyectos y Chats se crean despues: se vuelve a organizar cuando aparecen
  new MutationObserver(organizar).observe(sb, { childList: true });
})();
