/* Ajustes de la voz de Jarvis: tono (mas grave), velocidad y voz del navegador. Se guarda en este dispositivo. */
(function () {
  var K = { tono: 'jarvisTono', vel: 'jarvisVel', voz: 'jarvisVozNav' };
  var PRESETS = [
    { nombre: 'Mayordomo', tono: 0.88, vel: 0.95 },
    { nombre: 'Más grave', tono: 0.82, vel: 0.92 },
    { nombre: 'Normal', tono: 1, vel: 1 }
  ];
  function num(clave, defecto, min, max) {
    var v = parseFloat(localStorage.getItem(clave));
    return isNaN(v) ? defecto : Math.max(min, Math.min(max, v));
  }
  function tono() { return num(K.tono, 0.88, 0.78, 1); }
  function vel() { return num(K.vel, 0.95, 0.85, 1.15); }
  function pitchNav() { return Math.max(0.1, Math.min(2, 1 - (1 - tono()) * 2.5)); }
  function vozNav() {
    var uri = localStorage.getItem(K.voz);
    if (!uri || !('speechSynthesis' in window)) return null;
    return speechSynthesis.getVoices().find(function (v) { return v.voiceURI === uri; }) || null;
  }
  /* El audio del servidor se baja de tono con la velocidad de reproduccion (el servidor ya lo compensa). */
  function aplicar(audio) {
    var r = tono();
    audio.preservesPitch = false;
    audio.webkitPreservesPitch = false;
    audio.mozPreservesPitch = false;
    audio.defaultPlaybackRate = r;
    audio.playbackRate = r;
  }
  window.jarvisVoz = { tono: tono, vel: vel, pitchNav: pitchNav, vozNav: vozNav, aplicar: aplicar };

  var destino = document.getElementById('tabVoz');
  if (!destino) return;

  function h(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }
  var card = h('div', 'card');
  var cab = h('div', 'cardHead');
  cab.appendChild(h('strong', '', 'Tono y estilo'));
  card.appendChild(cab);
  var ayuda = h('p', '', 'Ajusta cómo suena Jarvis. Toca "Probar voz" después de cada cambio.');
  ayuda.style.cssText = 'font-size:11px;opacity:.7;margin:0 0 10px';
  card.appendChild(ayuda);

  var filaPre = h('div', 'filaBtns');
  filaPre.style.marginBottom = '12px';
  card.appendChild(filaPre);

  function deslizador(titulo, min, max, paso, ini, izq, der) {
    var w = h('div');
    w.style.marginBottom = '10px';
    var t = h('div', '', titulo);
    t.style.cssText = 'font-size:12px;margin-bottom:4px';
    var r = h('input');
    r.type = 'range'; r.min = min; r.max = max; r.step = paso; r.value = ini;
    r.style.cssText = 'width:100%;accent-color:#00e5ff';
    var p = h('div');
    p.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;opacity:.7';
    p.appendChild(h('span', '', izq));
    p.appendChild(h('span', '', der));
    w.appendChild(t); w.appendChild(r); w.appendChild(p);
    card.appendChild(w);
    return r;
  }
  var rTono = deslizador('Tono', 0.78, 1, 0.01, tono(), 'Más grave', 'Normal');
  var rVel = deslizador('Velocidad', 0.85, 1.15, 0.01, vel(), 'Más pausada', 'Más rápida');

  var selTitulo = h('div', '', 'Voz del navegador (si no hay voz del servidor)');
  selTitulo.style.cssText = 'font-size:12px;margin:6px 0 4px';
  var sel = h('select', 'campoTexto');
  card.appendChild(selTitulo);
  card.appendChild(sel);

  function llenarVoces() {
    if (!('speechSynthesis' in window)) return;
    var actual = localStorage.getItem(K.voz) || '';
    sel.textContent = '';
    var auto = h('option', '', 'Automática');
    auto.value = '';
    sel.appendChild(auto);
    speechSynthesis.getVoices().filter(function (v) { return /^es/i.test(v.lang); }).forEach(function (v) {
      var o = h('option', '', v.name + ' (' + v.lang + ')');
      o.value = v.voiceURI;
      sel.appendChild(o);
    });
    sel.value = actual;
    if (sel.value !== actual) sel.value = '';
  }
  llenarVoces();
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', llenarVoces);

  var filaBtns = h('div', 'filaBtns');
  var probar = h('button', 'btnPanel', 'Probar voz');
  var restablecer = h('button', 'btnPanel secundario', 'Restablecer');
  filaBtns.appendChild(probar); filaBtns.appendChild(restablecer);
  card.appendChild(filaBtns);
  destino.appendChild(card);

  function guardar() {
    localStorage.setItem(K.tono, rTono.value);
    localStorage.setItem(K.vel, rVel.value);
  }
  PRESETS.forEach(function (p) {
    var b = h('button', 'btnPanel secundario', p.nombre);
    b.style.cssText = 'color:#00e5ff;border-color:#00e5ff55';
    b.addEventListener('click', function () { rTono.value = p.tono; rVel.value = p.vel; guardar(); });
    filaPre.appendChild(b);
  });
  rTono.addEventListener('input', guardar);
  rVel.addEventListener('input', guardar);
  sel.addEventListener('change', function () { localStorage.setItem(K.voz, sel.value); });
  restablecer.addEventListener('click', function () {
    rTono.value = 0.88; rVel.value = 0.95; sel.value = '';
    localStorage.removeItem(K.voz);
    guardar();
  });
  probar.addEventListener('click', function () {
    if (typeof detenerHabla === 'function') detenerHabla();
    if (typeof hablar === 'function') hablar('Buenos días, señor. Todos los sistemas están listos para servirle.');
  });
})();
