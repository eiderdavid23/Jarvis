/* Pinta la respuesta mientras se escribe */
(function () {
  var fila = null, burbuja = null, buf = '';
  function crear() {
    var e = document.querySelector('#chatInner .puntos');
    if (e && e.closest('.fila')) e.closest('.fila').remove();
    fila = document.createElement('div');
    fila.className = 'fila jarvis';
    var av = document.createElement('div');
    av.className = 'avatar';
    burbuja = document.createElement('div');
    burbuja.className = 'burbuja md';
    fila.appendChild(av);
    fila.appendChild(burbuja);
    document.getElementById('chatInner').appendChild(fila);
  }
  window.jarvisDelta = function (txt) {
    if (!txt) return;
    if (!fila) crear();
    buf += txt;
    burbuja.innerHTML = window.mdHtml ? window.mdHtml(buf) : buf;
    if (window.bajarChat) window.bajarChat();
  };
  window.jarvisDeltaCerrar = function (finalTxt) {
    if (!fila) return null;
    burbuja.innerHTML = window.mdHtml ? window.mdHtml(finalTxt) : finalTxt;
    fila.dataset.raw = finalTxt;
    if (window.accionesMsg) window.accionesMsg(fila, burbuja, finalTxt);
    var f = fila;
    fila = null; burbuja = null; buf = '';
    return f;
  };
  window.jarvisDeltaLimpiar = function () { fila = null; burbuja = null; buf = ''; };
})();
