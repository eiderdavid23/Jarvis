/* Ventanitas emergentes estilo app de Claude: window.dialogoJarvis.elegir({titulo, opciones, actual}).
   Tambien agrega la fila "Modo de color" en Ajustes > Tema, que abre la ventanita. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var ICONOS = {
    sistema: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 5.5h3"/>',
    claro: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    oscuro: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/>'
  };
  var CHECK = '<path d="M4.5 12.5l5 5 10-11"/>';

  function icono(inner, clase) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    if (clase) s.setAttribute('class', clase);
    s.innerHTML = inner; /* solo recibe cadenas fijas de este archivo */
    return s;
  }

  var ov = document.createElement('div');
  ov.id = 'dlOverlay';
  var card = document.createElement('div');
  card.className = 'dlCard';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  var tit = document.createElement('h3');
  tit.id = 'dlTit';
  card.setAttribute('aria-labelledby', 'dlTit');
  var lista = document.createElement('div');
  lista.className = 'dlLista';
  var cerrarBtn = document.createElement('button');
  cerrarBtn.id = 'dlCerrar';
  cerrarBtn.type = 'button';
  cerrarBtn.tabIndex = -1;
  cerrarBtn.setAttribute('aria-label', 'Cerrar');
  card.appendChild(tit);
  card.appendChild(lista);
  card.appendChild(cerrarBtn);
  ov.appendChild(card);
  document.body.appendChild(ov);

  var resolver = null;
  function cerrar(valor) {
    ov.classList.remove('abierto');
    if (resolver) { var r = resolver; resolver = null; r(valor); }
  }
  cerrarBtn.addEventListener('click', function () { cerrar(null); });
  ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ov.classList.contains('abierto')) { e.stopImmediatePropagation(); cerrar(null); }
  }, true);

  /* elegir({titulo, opciones:[{valor, texto, icono}], actual}) -> Promise(valor | null) */
  function elegir(o) {
    return new Promise(function (resolve) {
      if (resolver) resolver(null);
      resolver = resolve;
      tit.textContent = o.titulo || '';
      lista.textContent = '';
      (o.opciones || []).forEach(function (op) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'dlOp' + (op.valor === o.actual ? ' on' : '');
        if (op.valor === o.actual) b.setAttribute('aria-current', 'true');
        var ic = ICONOS[op.icono || op.valor];
        if (ic) b.appendChild(icono(ic, 'dlIco'));
        var t = document.createElement('span');
        t.textContent = op.texto;
        b.appendChild(t);
        if (op.valor === o.actual) b.appendChild(icono(CHECK, 'dlCheck'));
        b.addEventListener('click', function () { cerrar(op.valor); });
        lista.appendChild(b);
      });
      ov.classList.add('abierto');
    });
  }
  window.dialogoJarvis = { elegir: elegir, ICONOS: ICONOS };

  /* ---------- Ajustes > Tema: fila "Modo de color" ---------- */
  var tabTema = document.getElementById('tabTema');
  if (!tabTema || typeof window.preferenciaTema !== 'function') return;
  var tarjeta = tabTema.querySelector('.card');
  var segmento = tabTema.querySelector('.opcionesTema');
  if (!tarjeta || !segmento) return;
  var NOMBRES = { sistema: 'Sistema', claro: 'Claro', oscuro: 'Oscuro' };

  var fila = document.createElement('button');
  fila.type = 'button';
  fila.className = 'ajFilaSel';
  var ico = document.createElement('span');
  ico.className = 'ajFilaIco';
  var txt = document.createElement('span');
  txt.className = 'ajFilaTxt';
  var b1 = document.createElement('b');
  b1.textContent = 'Modo de color';
  var sm = document.createElement('small');
  txt.appendChild(b1);
  txt.appendChild(sm);
  fila.appendChild(ico);
  fila.appendChild(txt);
  tarjeta.insertBefore(fila, segmento);
  tarjeta.classList.add('conFilaSel');

  function pintar() {
    var p = window.preferenciaTema();
    sm.textContent = NOMBRES[p] || 'Sistema';
    ico.textContent = '';
    ico.appendChild(icono(ICONOS[p] || ICONOS.sistema, ''));
  }
  fila.addEventListener('click', function () {
    elegir({
      titulo: 'Modo de color',
      actual: window.preferenciaTema(),
      opciones: [
        { valor: 'sistema', texto: 'Sistema' },
        { valor: 'claro', texto: 'Claro' },
        { valor: 'oscuro', texto: 'Oscuro' }
      ]
    }).then(function (v) {
      if (!v) return;
      var b = tabTema.querySelector('.opTema[data-tema="' + v + '"]');
      if (b) b.click(); /* usa la logica que ya existe (fijarTema + marcar) */
      pintar();
    });
  });
  pintar();
  var overlayAj = document.getElementById('overlayAjustes');
  if (overlayAj) new MutationObserver(pintar).observe(overlayAj, { attributes: true, attributeFilter: ['class'] });
})();
