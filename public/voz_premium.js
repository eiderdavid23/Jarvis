/* Voz premium (ElevenLabs): se usa en respuestas cortas. Se puede apagar desde Ajustes > Voz. */
(function () {
  var K = 'jarvisVozPremium';
  var KL = 'jarvisVozPremiumLimite';
  function limite() {   // letras maximas por respuesta; 0 = sin limite
    var v = parseInt(localStorage.getItem(KL), 10);
    return (v === 0 || v > 0) ? v : 1500;
  }
  var base = window.jarvisVoz = window.jarvisVoz || {};

  base.premium = function (partes) {
    if (localStorage.getItem(K) === '0') return false;
    var n = 0;
    (partes || []).forEach(function (p) { n += String(p).length; });
    var lim = limite();
    return n > 0 && (lim === 0 || n <= lim);
  };
  /* La voz premium ya viene grave: se reproduce sin cambiar tono ni velocidad. */
  base.normal = function (audio) {
    audio.preservesPitch = true;
    audio.webkitPreservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
  };

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
  cab.appendChild(h('strong', '', 'Voz premium'));
  card.appendChild(cab);
  var info = h('p', '', 'Voz más natural de Jarvis. Si una respuesta pasa del largo máximo, habla con la voz de siempre. Cada letra gasta créditos de ElevenLabs.');
  info.style.cssText = 'font-size:11px;opacity:.7;margin:0 0 10px';
  card.appendChild(info);
  var fila = h('label', 'filaSwitch');
  fila.appendChild(h('span', '', 'Activada'));
  var chk = h('input');
  chk.type = 'checkbox';
  chk.checked = localStorage.getItem(K) !== '0';
  chk.addEventListener('change', function () { localStorage.setItem(K, chk.checked ? '1' : '0'); });
  fila.appendChild(chk);
  card.appendChild(fila);
  var fila2 = h('label', 'filaSwitch');
  fila2.appendChild(h('span', '', 'Largo máximo'));
  var sel = h('select');
  [['Corto (400 letras)', 400], ['Medio (1.500)', 1500], ['Largo (4.000)', 4000], ['Sin límite', 0]].forEach(function (o) {
    var op = h('option', '', o[0]);
    op.value = String(o[1]);
    sel.appendChild(op);
  });
  sel.value = String(limite());
  if (sel.value !== String(limite())) sel.value = '1500';
  sel.addEventListener('change', function () { localStorage.setItem(KL, sel.value); });
  fila2.appendChild(sel);
  card.appendChild(fila2);
  var primera = destino.querySelector('.card');
  if (primera && primera.nextSibling !== undefined) primera.parentNode.insertBefore(card, primera.nextSibling);
  else destino.appendChild(card);
})();
