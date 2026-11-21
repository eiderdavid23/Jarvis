/* Pinta la respuesta mientras se escribe, con ritmo parejo (como Claude).
   El servidor manda trozos grandes y a destiempo; aqui se guardan y se van
   mostrando de a pocos caracteres para que se vea fluido. */
(function () {
  var cur = null;
  var BASE = 3;       // caracteres por tick (~100 por segundo)
  var TICK = 30;      // ms entre ticks

  function crear() {
    var e = document.querySelector('#chatInner .puntos');
    if (e && e.closest('.fila')) e.closest('.fila').remove();
    var fila = document.createElement('div');
    fila.className = 'fila jarvis';
    var av = document.createElement('div');
    av.className = 'avatar';
    var burbuja = document.createElement('div');
    burbuja.className = 'burbuja md';
    fila.appendChild(av);
    fila.appendChild(burbuja);
    document.getElementById('chatInner').appendChild(fila);
    return { fila: fila, burbuja: burbuja, visto: '', pend: '', timer: null, cerrando: false, final: '', hecho: false };
  }

  function pintar(c, txt) {
    c.burbuja.innerHTML = window.mdHtml ? window.mdHtml(txt) : txt;
    if (window.bajarChat) window.bajarChat();
  }

  function terminar(c) {
    if (c.hecho) return;
    c.hecho = true;
    clearInterval(c.timer);
    c.burbuja.innerHTML = window.mdHtml ? window.mdHtml(c.final) : c.final;
    c.fila.dataset.raw = c.final;
    if (window.accionesMsg) window.accionesMsg(c.fila, c.burbuja, c.final);
    if (window.bajarChat) window.bajarChat();
  }

  function tick(c) {
    if (c.hecho) return;
    if (document.hidden) { c.pend = ''; terminar(c); return; }
    if (!c.pend) {
      if (c.cerrando) terminar(c);
      return;
    }
    var n = Math.max(BASE, Math.ceil(c.pend.length / (c.cerrando ? 6 : 25)));
    var code = c.pend.charCodeAt(n - 1);
    if (code >= 0xD800 && code <= 0xDBFF) n++;   // no partir un emoji
    c.visto += c.pend.slice(0, n);
    c.pend = c.pend.slice(n);
    pintar(c, c.visto);
    if (!c.pend && c.cerrando) terminar(c);
  }

  function arrancar(c) {
    if (c.timer) return;
    c.timer = setInterval(function () { tick(c); }, TICK);
  }

  window.jarvisDelta = function (txt) {
    if (!txt) return;
    if (!cur) cur = crear();
    cur.pend += txt;
    arrancar(cur);
  };

  window.jarvisDeltaCerrar = function (finalTxt) {
    if (!cur) return null;
    var c = cur;
    cur = null;
    c.final = finalTxt;
    c.cerrando = true;
    arrancar(c);
    setTimeout(function () { terminar(c); }, 2500);   // seguro: nunca se queda a medias
    return c.fila;
  };

  window.jarvisDeltaLimpiar = function () {
    if (cur) { clearInterval(cur.timer); cur.hecho = true; }
    cur = null;
  };
})();
