/* Panel de Edith: HUD aparte (con su propia esferita dorada) para las ordenes de
   PC, TV y celular (controlar_pc, controlar_tv, controlar_pantalla, ver_pantalla).
   Se engancha a los "pasos en vivo" que ya manda el servidor (pasos.js) sin tocar
   ese archivo: envuelve window.jarvisPasos.crear y mira el texto de cada paso.
   Ademas: si escribis una frase para "activar" a Edith (sin pedirle ninguna accion
   real), se muestra una demo de unos segundos para poder verla sin tener un
   dispositivo (TV/PC/celular) vinculado todavia. */
(function () {
  if (!window.jarvisPasos || typeof window.jarvisPasos.crear !== 'function') return;

  var CLAVE = 'jarvisEdithFija';
  var NS = 'http://www.w3.org/2000/svg';
  var OCULTAR_MS = 2600;
  var DEMO_MS = 2200;

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

  /* ---------- construir el HUD una sola vez (siempre va al DOM) ---------- */
  var hud = document.createElement('div');
  hud.className = 'edithHUD';
  hud.innerHTML =
    '<div class="edithCab">' +
      '<span class="edithEsfera"></span>' +
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

  function enReposo() {
    hud.classList.remove('conAccion', 'trabajando', 'hecho');
    estadoEl.textContent = 'En espera';
    pintarLinea('cel', 'Edith lista.');
  }

  function aplicarFija() {
    hud.classList.toggle('fija', fija);
    btnFijar.setAttribute('aria-pressed', fija ? 'true' : 'false');
  }
  btnFijar.addEventListener('click', function () {
    fija = !fija;
    guardar(fija);
    aplicarFija();
  });

  aplicarFija();
  enReposo();

  /* ---------- detectar que Edith entro en accion de verdad ---------- */
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
    hud.classList.add('conAccion', 'trabajando');
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
    ocultarTimer = setTimeout(enReposo, OCULTAR_MS);
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

  /* ---------- demo: "activa a Edith" sin tener un dispositivo vinculado ----------
     Es solo visual (no llama a ninguna herramienta real): sirve para ver la
     esferita y el panel funcionando mientras no tengas una TV/PC/celular conectado. */
  var FRASE_DEMO = /\bedith\b/i;
  var FRASE_ACCION = /activ|prend|enci/i;
  function esPedidoDeDemo(msj) {
    return FRASE_DEMO.test(msj) && FRASE_ACCION.test(msj);
  }
  function demo() {
    activar({ icono: 'tv', dispositivo: 'modo demo (sin dispositivo real)' });
    setTimeout(cerrar, DEMO_MS);
  }
  function revisarEnvio() {
    var campo = document.getElementById('texto');
    if (campo && esPedidoDeDemo(campo.value)) demo();
  }
  var campoTexto = document.getElementById('texto');
  var btnAccion = document.getElementById('btnAccion');
  if (campoTexto) {
    campoTexto.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) revisarEnvio();
    });
  }
  if (btnAccion) btnAccion.addEventListener('click', revisarEnvio);

  window.jarvisEdith = { activo: function () { return hud.getAttribute('data-activo') === '1'; }, demo: demo };
})();
