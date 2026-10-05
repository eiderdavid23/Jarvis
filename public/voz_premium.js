/* Voz premium (ElevenLabs): se usa en respuestas cortas. Se puede apagar desde Ajustes > Voz. */
(function () {
  var K = 'jarvisVozPremium';
  var LIMITE = 400; // letras por respuesta
  var base = window.jarvisVoz = window.jarvisVoz || {};

  base.premium = function (partes) {
    if (localStorage.getItem(K) === '0') return false;
    var n = 0;
    (partes || []).forEach(function (p) { n += String(p).length; });
    return n > 0 && n <= LIMITE;
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
  var info = h('p', '', 'Voz más natural de Jarvis para respuestas cortas.');
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
  var primera = destino.querySelector('.card');
  if (primera && primera.nextSibling !== undefined) primera.parentNode.insertBefore(card, primera.nextSibling);
  else destino.appendChild(card);
})();
