/* Respuesta por partes: la respuesta de Jarvis aparece bloque por bloque, como la de Claude. */
(function () {
  var TOPE_MS = 3000;

  function cerca() {
    var c = document.getElementById('chat');
    if (!c) return true;
    return c.scrollHeight - c.scrollTop - c.clientHeight < 160;
  }

  function piezas(b) {
    var lista = [];
    Array.prototype.forEach.call(b.children, function (h) {
      if (/^(UL|OL)$/.test(h.tagName) && h.children.length > 1) {
        h.classList.add('rvOculto');
        Array.prototype.forEach.call(h.children, function (li) { li.classList.add('rvOculto'); lista.push(li); });
      } else {
        h.classList.add('rvOculto');
        lista.push(h);
      }
    });
    return lista;
  }

  function pausa(el) {
    if (el.classList.contains('accMsg')) return 0;
    var n = (el.textContent || '').length;
    var ms = 140 + Math.min(n, 400) * 0.5;
    if (el.querySelector && el.querySelector('pre')) ms += 100;
    return ms;
  }

  function mostrar(b, el) {
    var p = el.parentNode;
    if (p && p !== b) p.classList.remove('rvOculto');
    el.classList.remove('rvOculto');
    el.classList.add('rvEntra');
  }

  window.jarvisRevelar = function (fila) {
    try {
      var b = fila && fila.querySelector('.burbuja.md');
      if (!b || !b.children.length) return;
      var lista = piezas(b);
      var pausas = lista.map(pausa);
      var suma = pausas.reduce(function (a, x) { return a + x; }, 0);
      var k = suma > TOPE_MS ? TOPE_MS / suma : 1;
      var i = 0, timer = null, fin = false;

      function todo() {
        if (fin) return;
        fin = true;
        clearTimeout(timer);
        for (; i < lista.length; i++) mostrar(b, lista[i]);
        document.removeEventListener('visibilitychange', alOcultar);
      }
      function alOcultar() { if (document.hidden) todo(); }
      function siguiente() {
        if (fin) return;
        if (!fila.isConnected) { fin = true; return; }
        var seguir = cerca();
        mostrar(b, lista[i]);
        var espera = pausas[i] * k;
        i++;
        if (seguir && window.bajarChat) window.bajarChat();
        if (i >= lista.length) { fin = true; document.removeEventListener('visibilitychange', alOcultar); return; }
        timer = setTimeout(siguiente, espera);
      }

      b.addEventListener('click', todo, { once: true });
      document.addEventListener('visibilitychange', alOcultar);
      siguiente();
    } catch (e) {
      if (fila) fila.querySelectorAll('.rvOculto').forEach(function (x) { x.classList.remove('rvOculto'); });
    }
  };
})();
