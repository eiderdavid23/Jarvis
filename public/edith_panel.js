/* Panel de Edith: HUD aparte para las ordenes de PC, TV y celular (controlar_pc,
   controlar_tv, controlar_pantalla, ver_pantalla). Se engancha a los "pasos en vivo"
   que ya manda el servidor (pasos.js) sin tocar ese archivo: envuelve
   window.jarvisPasos.crear y mira el texto de cada paso.
   Se puede fijar (siempre visible, en espera) o dejar que aparezca y desaparezca solo,
   igual que la barra lateral se fija con sidebar_fija.js. */
(function () {
  if (!window.jarvisPasos || typeof window.jarvisPasos.crear !== 'function') return;

  var CLAVE = 'jarvisEdithFija';
  var NS = 'http://www.w3.org/2000/svg';
  var OCULTAR_MS = 2600;

  function svg(html) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = html;
    return s;
  }
  var ICO = {
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 21h6M12 17v4"/>',
    pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    cel: '<rect x="7" y="2.5" width="10" height="19" rx="2.3"/><path d="M11 18.5h2"/>',
    chincheta: '<path d="M12 2l3 3-2 2 3 3-5 5-1 5-5-5 5-5 3 3 2-2-3-3z"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7"/>'
  };

  function quiereFija() {
    try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; }
  }
  function guardar(v) {
    try { localStorage.setItem(CLAVE, v ? '1' : '0'); } catch (e) {}
  }

  /* ---------- construir el HUD una sola vez ---------- */
  var hud = document.createElement('div');
  hud.className = 'edithHUD';
  hud.innerHTML =
    '<div class="edithCab">' +
      '<span class="edithPunto"></span>' +
      '<span class="edithNombre">EDITH</span>' +
      '<span class="edithEstado">En espera</span>' +
      '<button type="button" class="edithFijar" aria-label="Fijar panel de Edith" title="Fijar panel de Edith"></button>' +
    '</div>' +
    '<div class="edithCuerpo"><div class="edithLineaBox"><div class="edithLinea"></div></div></div>';
  document.body.appendChild(hud);

  var btnFijar = hud.querySelector('.edithFijar');
  btnFijar.appendChild(svg(ICO.chincheta));
  var estadoEl = hud.querySelector('.edithEstado');
  var lineaEl = hud.querySelector('.edithLinea');

  var fija = quiereFija();
  var ocultarTimer = null;

  function pintarLinea(icono, texto) {
    lineaEl.innerHTML = '';
    var ic = document.createElement('span');
    ic.className = 'edithIco';
    ic.appendChild(svg(ICO[icono] || ICO.cel));
    lineaEl.appendChild(ic);
    lineaEl.appendChild(document.createTextNode(texto));
  }

  function mostrarFija() {
    hud.classList.remove('oculto', 'conAccion', 'trabajando', 'hecho');
    hud.classList.add('visible', 'fija');
    estadoEl.textContent = 'En espera';
  }
  function ocultarDelTodo() {
    hud.classList.remove('visible', 'conAccion', 'trabajando', 'hecho');
  }
  function aplicarFija() {
    hud.classList.toggle('fija', fija);
    btnFijar.setAttribute('aria-pressed', fija ? 'true' : 'false');
    if (ocultarTimer) { clearTimeout(ocultarTimer); ocultarTimer = null; }
    if (fija) mostrarFija(); else if (!hud.classList.contains('trabajando')) ocultarDelTodo();
  }
  btnFijar.addEventListener('click', function () {
    fija = !fija;
    guardar(fija);
    aplicarFija();
  });
  aplicarFija();

  /* ---------- detectar que Edith entro en accion ---------- */
  var MAPA = [
    { re: /^usando tu tv/i, icono: 'tv', dispositivo: 'tu TV' },
    { re: /^usando tu pc/i, icono: 'pc', dispositivo: 'tu PC' },
    { re: /^usando tu celular/i, icono: 'cel', dispositivo: 'tu celular' },
    { re: /^mirando la pantalla/i, icono: 'cel', dispositivo: 'tu celular' }
  ];

  function detectar(texto) {
    var t = String(texto || '');
    for (var i = 0; i < MAPA.length; i++) {
      if (MAPA[i].re.test(t)) return MAPA[i];
    }
    return null;
  }

  function activar(info) {
    if (ocultarTimer) { clearTimeout(ocultarTimer); ocultarTimer = null; }
    hud.classList.remove('hecho');
    hud.classList.add('visible', 'conAccion', 'trabajando');
    estadoEl.textContent = 'Ejecutando';
    pintarLinea(info.icono, 'Trabajando en ' + info.dispositivo + '…');
    hud.setAttribute('data-activo', '1');
  }

  function cerrar() {
    if (hud.getAttribute('data-activo') !== '1') return;
    hud.removeAttribute('data-activo');
    hud.classList.remove('trabajando');
    hud.classList.add('hecho');
    estadoEl.textContent = 'Listo';
    pintarLinea('ok', 'Orden enviada.');
    ocultarTimer = setTimeout(function () {
      if (fija) { mostrarFija(); } else { ocultarDelTodo(); }
    }, OCULTAR_MS);
  }

  /* ---------- enganche a los pasos en vivo (sin tocar pasos.js) ---------- */
  var crearOriginal = window.jarvisPasos.crear;
  window.jarvisPasos.crear = function (antesDe) {
    var panel = crearOriginal(antesDe);
    var agregarOriginal = panel.agregar;
    var terminarOriginal = panel.terminar;
    panel.agregar = function (texto) {
      var info = detectar(texto);
      if (info) activar(info);
      return agregarOriginal.call(panel, texto);
    };
    panel.terminar = function () {
      cerrar();
      return terminarOriginal.call(panel);
    };
    return panel;
  };

  window.jarvisEdith = { activo: function () { return hud.getAttribute('data-activo') === '1'; } };
})();
