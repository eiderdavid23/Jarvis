/* Botones bajo cada respuesta de Jarvis (copiar, compartir, escuchar, me gusta, no me gusta, repetir)
   y botones de copiar/ampliar en los bloques de código. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var IC = {
    copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    compartir: '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    voz: '<path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
    parar: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
    gusta: '<path d="M7 11v9H4v-9h3z"/><path d="M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10H19a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 18 20H7"/>',
    nogusta: '<path d="M17 13V4h3v9h-3z"/><path d="M17 13l-4 7c-1.5 0-2.5-1-2.5-2.5V14H5a2 2 0 0 1-2-2.3l1-6A2 2 0 0 1 6 4h11"/>',
    repetir: '<path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/>',
    expandir: '<path d="M14 4h6v6"/><path d="M10 20H4v-6"/><path d="M20 4l-7 7"/><path d="M4 20l7-7"/>',
    cerrar: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>'
  };
  function icono(n) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = IC[n];
    return s;
  }
  function cambiar(b, n) { b.replaceChild(icono(n), b.firstChild); }
  function boton(n, titulo, clic) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'accBtn'; b.title = titulo; b.setAttribute('aria-label', titulo);
    b.appendChild(icono(n));
    b.addEventListener('click', function (e) { e.stopPropagation(); clic(b); });
    return b;
  }
  function copiar(txt, b) {
    var listo = function () { cambiar(b, 'ok'); setTimeout(function () { cambiar(b, 'copiar'); }, 1500); };
    var viejo = function () {
      var t = document.createElement('textarea');
      t.value = txt; t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); listo(); } catch (e) {}
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(listo, viejo);
    else viejo();
  }
  function etiqueta(l) { return l ? l.charAt(0).toUpperCase() + l.slice(1) : 'Código'; }
  function cabecera(et, cod, extra) {
    var cab = document.createElement('div'); cab.className = 'codCab';
    var s = document.createElement('span'); s.textContent = et;
    var acc = document.createElement('div'); acc.className = 'codAcc';
    acc.appendChild(boton('copiar', 'Copiar código', function (b) { copiar(cod, b); }));
    if (extra) acc.appendChild(extra);
    cab.appendChild(s); cab.appendChild(acc);
    return cab;
  }
  function ampliar(cod, et) {
    var v = document.createElement('div'); v.className = 'codAmplio';
    v.appendChild(cabecera(et, cod, boton('cerrar', 'Cerrar', function () { v.remove(); })));
    var pre = document.createElement('pre'), c = document.createElement('code');
    c.textContent = cod; pre.appendChild(c); v.appendChild(pre);
    document.body.appendChild(v);
  }
  function bloques(b) {
    b.querySelectorAll('pre').forEach(function (pre) {
      var cod = pre.textContent, et = etiqueta(pre.getAttribute('data-lang'));
      var caja = document.createElement('div'); caja.className = 'codBloque';
      pre.parentNode.insertBefore(caja, pre);
      caja.appendChild(cabecera(et, cod, boton('expandir', 'Ampliar', function () { ampliar(cod, et); })));
      caja.appendChild(pre);
    });
  }

  var turno = 0;
  function escuchar(b, txt) {
    if (b.classList.contains('activo')) { detenerHabla(); return; }
    var mi = ++turno;
    detenerHabla();
    document.querySelectorAll('.accBtn.activo').forEach(function (x) { x.classList.remove('activo'); cambiar(x, 'voz'); });
    b.classList.add('activo'); cambiar(b, 'parar');
    var fin = function () { if (turno === mi) { b.classList.remove('activo'); cambiar(b, 'voz'); } };
    hablar(txt).then(fin, fin);
  }
  function compartir(txt, b) {
    if (navigator.share) navigator.share({ text: txt }).catch(function () {});
    else copiar(txt, b);
  }
  function marcar(b, otro) {
    var on = !b.classList.contains('marcado');
    b.classList.toggle('marcado', on);
    if (on && otro) otro.classList.remove('marcado');
  }
  function repetir(fila) {
    if (procesando) return;
    var filas = chatInner.querySelectorAll('.fila.jarvis');
    if (filas[filas.length - 1] !== fila) { avisoAdj('Solo puedo repetir la última respuesta, señor.'); return; }
    var prev = fila.previousElementSibling;
    while (prev && !prev.classList.contains('user')) prev = prev.previousElementSibling;
    if (!prev || prev.querySelector('.adjMsg')) { avisoAdj('No puedo repetir un mensaje con archivos adjuntos, señor.'); return; }
    var msg = prev.dataset.raw || '';
    if (!msg) return;
    detenerHabla();
    while (prev.nextSibling) prev.nextSibling.remove();
    prev.remove();
    texto.value = msg;
    enviarMensaje();
  }
  window.accionesMsg = function (fila, b, raw) {
    bloques(b);
    var bar = document.createElement('div'); bar.className = 'accMsg';
    var gusta = boton('gusta', 'Buena respuesta', function (x) { marcar(x, nogusta); });
    var nogusta = boton('nogusta', 'Mala respuesta', function (x) { marcar(x, gusta); });
    bar.appendChild(boton('copiar', 'Copiar', function (x) { copiar(raw, x); }));
    bar.appendChild(boton('compartir', 'Compartir', function (x) { compartir(raw, x); }));
    bar.appendChild(boton('voz', 'Escuchar', function (x) { escuchar(x, raw); }));
    bar.appendChild(gusta);
    bar.appendChild(nogusta);
    bar.appendChild(boton('repetir', 'Repetir respuesta', function () { repetir(fila); }));
    b.appendChild(bar);
  };
})();
