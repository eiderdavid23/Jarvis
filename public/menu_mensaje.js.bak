/* Mantener presionado un mensaje: hora, Copiar mensaje y Seleccionar texto. */
(function () {
  var chatEl = document.getElementById('chat'), inner = document.getElementById('chatInner');
  if (!chatEl || !inner) return;
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var IC = {
    copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    texto: '<path d="M5 4h14v16H5z"/><path d="M8.5 9h7"/><path d="M8.5 13h7"/><path d="M8.5 17h4"/>'
  };
  function icono(n) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = IC[n];
    return s;
  }

  /* Hora de cada mensaje: los del historial traen "creado"; los nuevos se sellan al aparecer. */
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1 && n.classList.contains('fila') && !n.dataset.creado) n.dataset.creado = new Date().toISOString();
      });
    });
  }).observe(inner, { childList: true });

  function hora(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return '';
    var h = d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === new Date().toDateString()) return h;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ', ' + h;
  }
  function aviso(t) { if (typeof avisoAdj === 'function') avisoAdj(t); }
  function copiar(txt) {
    var viejo = function () {
      var t = document.createElement('textarea');
      t.value = txt; t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); aviso('Mensaje copiado'); } catch (e) {}
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { aviso('Mensaje copiado'); }, viejo);
    } else viejo();
  }
  function textoDe(fila) {
    var b = fila.querySelector('.burbuja');
    return fila.dataset.raw || (b ? b.innerText : '') || '';
  }

  var menu = null, fondo = null, pulsada = null;
  function cerrarMenu() {
    if (menu) { menu.remove(); menu = null; }
    if (fondo) { fondo.remove(); fondo = null; }
    if (pulsada) { pulsada.classList.remove('msgPulsado'); pulsada = null; }
  }
  function seleccionar(txt) {
    var v = document.createElement('div'); v.id = 'selTexto';
    var cab = document.createElement('div'); cab.className = 'stCab';
    var tit = document.createElement('b'); tit.textContent = 'Seleccionar texto';
    var bc = document.createElement('button'); bc.type = 'button'; bc.textContent = 'Copiar todo';
    bc.addEventListener('click', function () { copiar(txt); });
    var bx = document.createElement('button'); bx.type = 'button'; bx.textContent = 'Cerrar';
    bx.addEventListener('click', function () { v.remove(); });
    var der = document.createElement('div'); der.style.cssText = 'display:flex;gap:8px';
    der.appendChild(bc); der.appendChild(bx);
    cab.appendChild(tit); cab.appendChild(der);
    var cu = document.createElement('div'); cu.className = 'stCuerpo'; cu.textContent = txt;
    v.appendChild(cab); v.appendChild(cu);
    document.body.appendChild(v);
  }
  function abrirMenu(fila, x, y) {
    cerrarMenu();
    var b = fila.querySelector('.burbuja');
    if (b) { b.classList.add('msgPulsado'); pulsada = b; }
    var txt = textoDe(fila);
    fondo = document.createElement('div'); fondo.id = 'msgMenuFondo';
    fondo.addEventListener('click', cerrarMenu);
    fondo.addEventListener('contextmenu', function (e) { e.preventDefault(); cerrarMenu(); });
    menu = document.createElement('div'); menu.id = 'msgMenu';
    var h = hora(fila.dataset.creado);
    if (h) { var eh = document.createElement('div'); eh.className = 'mmHora'; eh.textContent = h; menu.appendChild(eh); }
    var b1 = document.createElement('button'); b1.type = 'button';
    b1.appendChild(icono('copiar')); b1.appendChild(document.createTextNode('Copiar mensaje'));
    b1.addEventListener('click', function () { cerrarMenu(); copiar(txt); });
    var b2 = document.createElement('button'); b2.type = 'button';
    b2.appendChild(icono('texto')); b2.appendChild(document.createTextNode('Seleccionar texto'));
    b2.addEventListener('click', function () { cerrarMenu(); seleccionar(txt); });
    menu.appendChild(b1); menu.appendChild(b2);
    document.body.appendChild(fondo); document.body.appendChild(menu);
    var w = menu.offsetWidth, hh = menu.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.max(12, Math.min(x - w / 2, vw - w - 12));
    var top = y + 14;
    if (top + hh > vh - 12) top = Math.max(12, y - hh - 14);
    menu.style.left = left + 'px'; menu.style.top = top + 'px';
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
  }

  function filaDe(t) {
    if (!t || !t.closest) return null;
    var b = t.closest('#chat .burbuja');
    if (!b || t.closest('a, button, .accMsg') || b.querySelector('.puntos')) return null;
    return b.closest('.fila');
  }
  var timer = null, x0 = 0, y0 = 0, ultimo = 0;
  function cancelar() { if (timer) { clearTimeout(timer); timer = null; } }
  chatEl.addEventListener('touchstart', function (e) {
    cancelar();
    var f = filaDe(e.target), t = e.touches[0];
    if (!f || e.touches.length !== 1) return;
    x0 = t.clientX; y0 = t.clientY;
    timer = setTimeout(function () { timer = null; ultimo = Date.now(); abrirMenu(f, x0, y0); }, 450);
  }, { passive: true });
  chatEl.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (timer && (Math.abs(t.clientX - x0) > 10 || Math.abs(t.clientY - y0) > 10)) cancelar();
  }, { passive: true });
  chatEl.addEventListener('touchend', cancelar, { passive: true });
  chatEl.addEventListener('touchcancel', cancelar, { passive: true });
  chatEl.addEventListener('scroll', cancelar, { passive: true });
  /* El clic derecho y la pulsacion larga de algunos navegadores lanzan "contextmenu". */
  chatEl.addEventListener('contextmenu', function (e) {
    if (!coarse) return;
    var f = filaDe(e.target);
    if (!f) return;
    e.preventDefault();
    if (Date.now() - ultimo > 700) { ultimo = Date.now(); abrirMenu(f, e.clientX, e.clientY); }
  });
})();
