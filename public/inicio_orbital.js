/* Inicio orbital de Jarvis (v1.38, solo web).
   El orbe es el nucleo y alrededor van 8 satelites. Los que abren una hoja
   (Conectores, Automatizaciones, Musica, Gestos) se definen en inicio_orbital_hojas.js. */
(function () {
  'use strict';
  var body = document.body;
  var raiz = document.documentElement;

  var SATS = [
    { id: 'chat', nombre: 'Chat', ang: -90,
      icono: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'] },
    { id: 'gestos', nombre: 'Gestos', ang: -45,
      icono: ['M18 11V6a2 2 0 0 0-4 0', 'M14 10V4a2 2 0 0 0-4 0v2', 'M10 10.5V6a2 2 0 0 0-4 0v8',
              'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'] },
    { id: 'musica', nombre: 'Música', ang: 0,
      icono: ['M9 18V5l12-2v13', 'M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0', 'M15 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0'] },
    { id: 'automatizaciones', nombre: 'Automatizaciones', ang: 45,
      icono: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'] },
    { id: 'voz', nombre: 'Voz', ang: 90,
      icono: ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v4', 'M8 23h8'] },
    { id: 'conectores', nombre: 'Conectores', ang: 135,
      icono: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
              'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'] },
    { id: 'ajustes', nombre: 'Ajustes', ang: 180,
      icono: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'] },
    { id: 'manos', nombre: 'Manos', ang: 225,
      icono: ['M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.13 1.58a2 2 0 0 0-1.43 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z'] }
  ];

  var acciones = {};
  var api = { acciones: acciones, suprimir: 0 };
  var centro, anillos, estadoEl, subEl, tAviso = 0;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }
  function icono(paths, w) {
    var NS = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('width', w); s.setAttribute('height', w);
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    paths.forEach(function (d) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); s.appendChild(p);
    });
    return s;
  }

  /* Anillos decorativos que giran (radio 100 = la orbita de los satelites) */
  function girar(dur, de, a) {
    return '<animateTransform attributeName="transform" type="rotate" from="' + de + '" to="' + a +
           '" dur="' + dur + 's" repeatCount="indefinite"/>';
  }
  function dibujarAnillos() {
    anillos.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-130 -130 260 260">' +
      '<circle r="100" fill="none" stroke="rgba(0,229,255,.17)" stroke-width=".8"/>' +
      '<g>' + girar(90, 0, 360) +
      '<circle r="118" fill="none" stroke="rgba(0,229,255,.24)" stroke-width="1" stroke-dasharray="1 7"/></g>' +
      '<g>' + girar(40, 360, 0) +
      '<circle r="78" fill="none" stroke="rgba(120,200,220,.5)" stroke-width="1.6" stroke-linecap="round" ' +
      'stroke-dasharray="110 40 60 90 30 160"/></g>' +
      '<g>' + girar(60, 0, 360) +
      '<circle r="64" fill="none" stroke="rgba(0,229,255,.2)" stroke-width="2" stroke-dasharray="2 5"/></g>' +
      '<circle r="52" fill="none" stroke="rgba(0,229,255,.1)" stroke-width=".8"/>' +
      '</svg>';
  }

  /* Medidas: el centro y el radio dependen del tamano de la pantalla */
  function medir() {
    var W = window.innerWidth, H = window.innerHeight;
    var arriba = 92, abajo = 124;
    var libre = H - arriba - abajo;
    var R = Math.max(80, Math.min(W * 0.34, (libre - 100) / 2, 150));
    var cy = Math.round(arriba + libre / 2 + 4);
    var G = parseFloat(getComputedStyle(raiz).getPropertyValue('--orbG')) || 240;
    raiz.style.setProperty('--oiCy', cy + 'px');
    raiz.style.setProperty('--oiEsc', ((R * 1.05) / G).toFixed(4));
    var S = R * 2.6;
    anillos.style.width = S + 'px'; anillos.style.height = S + 'px';
    anillos.style.left = (-S / 2) + 'px'; anillos.style.top = (-S / 2) + 'px';
    SATS.forEach(function (s) {
      var a = s.ang * Math.PI / 180;
      s.nodo.style.left = (R * Math.cos(a)).toFixed(1) + 'px';
      s.nodo.style.top = (R * Math.sin(a)).toFixed(1) + 'px';
    });
  }

  function aviso(txt) {
    subEl.textContent = txt;
    clearTimeout(tAviso);
    tAviso = setTimeout(function () { subEl.textContent = 'Toca el núcleo para activar'; }, 2800);
  }

  function pulsar(id) {
    var f = acciones[id];
    if (typeof f !== 'function') { aviso('Esta función llega en la siguiente parte'); return; }
    try { f(); } catch (e) { console.error('inicio orbital:', e); }
  }

  /* Ajustes en una pestana concreta */
  function abrirAjustesTab(tab) {
    if (typeof abrirAjustes === 'function') abrirAjustes();
    var b = document.querySelector('.tabAjuste[data-tab="' + tab + '"]');
    if (b) b.click();
  }
  api.abrirAjustesTab = abrirAjustesTab;
  api.aviso = aviso;

  acciones.chat = function () {
    if (typeof cambiarModo === 'function') cambiarModo('chat');
    setTimeout(function () {
      var t = document.getElementById('texto');
      if (t) t.focus();
    }, 350);
  };
  acciones.voz = function () {
    if (typeof recognition !== 'undefined' && !recognition) { aviso('Este navegador no tiene reconocimiento de voz'); return; }
    if (typeof entrarVoz === 'function') entrarVoz();
  };
  acciones.ajustes = function () { if (typeof abrirAjustes === 'function') abrirAjustes(); };
  acciones.manos = function () { abrirAjustesTab('manos'); };

  function construir() {
    var cont = el('div', '');
    cont.id = 'inicioOrbital';
    centro = el('div', ''); centro.id = 'oiCentro';
    anillos = el('div', ''); anillos.id = 'oiAnillos';
    centro.appendChild(anillos);
    dibujarAnillos();
    SATS.forEach(function (s, i) {
      var n = el('div', 'oiSat');
      n.style.setProperty('--d', (i * 0.06).toFixed(2) + 's');
      var b = el('button', 'oiBtn');
      b.type = 'button';
      b.setAttribute('aria-label', s.nombre);
      b.appendChild(icono(s.icono, 24));
      b.addEventListener('click', function () { pulsar(s.id); });
      n.appendChild(b);
      n.appendChild(el('span', 'oiEt', s.nombre));
      centro.appendChild(n);
      s.nodo = n;
    });
    cont.appendChild(centro);
    body.appendChild(cont);

    var est = el('div', '');
    est.id = 'oiEstado';
    estadoEl = el('b', '', 'DESCONECTADO');
    subEl = el('small', '', 'Toca el núcleo para activar');
    est.appendChild(estadoEl); est.appendChild(subEl);
    body.appendChild(est);

    var orb = document.getElementById('orbWrap');
    if (orb) {
      var eraActivo = false;
      /* captura: antes del click de index.html, que detiene la voz si estaba hablando */
      orb.addEventListener('click', function () {
        eraActivo = (typeof hablando !== 'undefined' && hablando) || (typeof vozActiva !== 'undefined' && vozActiva);
      }, true);
      orb.addEventListener('click', function () {
        if (api.suprimir) { api.suprimir = 0; return; }
        if (body.classList.contains('m-inicio')) pulsar('voz');
        else if (body.classList.contains('m-chat') && !eraActivo && typeof cambiarModo === 'function') cambiarModo('inicio');
      });
    }
    medir();
    var t = 0;
    window.addEventListener('resize', function () {
      cancelAnimationFrame(t);
      t = requestAnimationFrame(medir);
    });
    requestAnimationFrame(function () { requestAnimationFrame(medir); });
  }

  window.inicioOrbital = api;
  construir();
})();
