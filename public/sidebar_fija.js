/* Barra lateral fija (escritorio) + buscador de chats.
   - Pantalla grande: la barra queda anclada a la izquierda; el boton de panel (o el de arriba, si esta plegada) la abre y cierra.
     La eleccion se guarda en este dispositivo. En celular no cambia nada.
   - Buscador: filtra los chats por titulo (sin importar mayusculas ni tildes). Atajo: Ctrl+K. */
(function () {
  var sb = document.getElementById('sidebar');
  if (!sb) return;
  var body = document.body;
  var CLAVE = 'jarvisSbFija';
  var NS = 'http://www.w3.org/2000/svg';
  var enPanel = document.documentElement.classList.contains('modo-panel');

  function svg(html, clase) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('width', '20');
    s.setAttribute('height', '20');
    if (clase) s.setAttribute('class', clase);
    s.innerHTML = html;
    return s;
  }

  /* ================= Barra fija ================= */
  var mq = window.matchMedia ? window.matchMedia('(min-width: 900px) and (min-height: 600px)') : null;
  var btnCerrar = document.getElementById('btnCerrarSidebar');
  var btnMenu = document.getElementById('btnMenu');

  if (btnCerrar) {
    btnCerrar.appendChild(svg('<rect x="3" y="4" width="18" height="16" rx="3"/><line x1="9.5" y1="4" x2="9.5" y2="20"/>', 'icoPanel'));
  }

  function quiereFija() {
    try { return localStorage.getItem(CLAVE) !== '0'; } catch (e) { return true; }
  }
  function guardar(v) {
    try { localStorage.setItem(CLAVE, v ? '1' : '0'); } catch (e) {}
  }
  function titulos(esc, fija) {
    if (btnCerrar) {
      if (esc) btnCerrar.setAttribute('title', 'Cerrar barra lateral'); else btnCerrar.removeAttribute('title');
      btnCerrar.setAttribute('aria-label', esc ? 'Cerrar barra lateral' : 'Cerrar menú');
    }
    if (btnMenu) {
      if (esc && !fija) btnMenu.setAttribute('title', 'Abrir barra lateral'); else btnMenu.removeAttribute('title');
    }
  }
  function aplicar() {
    var esc = !enPanel && !!mq && mq.matches;
    var fija = esc && quiereFija();
    body.classList.toggle('sb-esc', esc);
    body.classList.toggle('sb-fijo', fija);
    if (esc) body.classList.remove('sb-abierto');
    titulos(esc, fija);
  }
  function alternar() {
    if (!body.classList.contains('sb-esc')) return;
    guardar(!body.classList.contains('sb-fijo'));
    aplicar();
  }

  /* sin animacion al cargar la pagina: solo se anima cuando se abre o cierra la barra */
  body.classList.add('sb-quieto');
  aplicar();
  requestAnimationFrame(function () { requestAnimationFrame(function () { body.classList.remove('sb-quieto'); }); });
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', aplicar); else if (mq.addListener) mq.addListener(aplicar);
  }
  /* Estos botones ya abren y cierran el panel en celular; en escritorio, ademas, pliegan la barra fija */
  if (btnCerrar) btnCerrar.addEventListener('click', alternar);
  if (btnMenu) btnMenu.addEventListener('click', alternar);

  /* ================= Buscador de chats ================= */
  var nuevo = document.getElementById('sbNuevo');
  var datos = { chats: [], crearFila: null };
  var consulta = '';

  var caja = document.createElement('div');
  caja.id = 'sbBuscaCaja';
  caja.appendChild(svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'));
  var campo = document.createElement('input');
  campo.id = 'sbBusca';
  campo.type = 'text';
  campo.placeholder = 'Buscar chats';
  campo.setAttribute('autocomplete', 'off');
  campo.setAttribute('autocapitalize', 'off');
  campo.setAttribute('spellcheck', 'false');
  campo.setAttribute('enterkeyhint', 'search');
  campo.setAttribute('aria-label', 'Buscar chats');
  caja.appendChild(campo);
  var limpiar = document.createElement('button');
  limpiar.id = 'sbBuscaX';
  limpiar.type = 'button';
  limpiar.setAttribute('aria-label', 'Borrar búsqueda');
  limpiar.appendChild(svg('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'));
  caja.appendChild(limpiar);

  var res = document.createElement('div');
  res.id = 'sbResultados';
  res.hidden = true;

  if (nuevo && nuevo.parentNode === sb) {
    sb.insertBefore(caja, nuevo.nextSibling);
    sb.insertBefore(res, caja.nextSibling);
  } else {
    sb.insertBefore(caja, sb.children[1] || null);
    sb.insertBefore(res, caja.nextSibling);
  }

  /* minusculas y sin tildes, letra por letra para que las posiciones coincidan con el texto original */
  function norm(s) {
    var o = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      var x = c.normalize ? c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : c.toLowerCase();
      o += x.length === 1 ? x : c;
    }
    return o;
  }
  function palabras(q) {
    return norm(q).split(/\s+/).filter(Boolean);
  }
  function pintarTitulo(el, texto, toks) {
    var n = norm(texto);
    var marcas = [];
    toks.forEach(function (t) {
      var i = n.indexOf(t);
      if (i >= 0) marcas.push([i, i + t.length]);
    });
    marcas.sort(function (a, b) { return a[0] - b[0]; });
    var fusion = [];
    marcas.forEach(function (m) {
      var u = fusion[fusion.length - 1];
      if (u && m[0] <= u[1]) u[1] = Math.max(u[1], m[1]); else fusion.push([m[0], m[1]]);
    });
    el.textContent = '';
    var pos = 0;
    fusion.forEach(function (m) {
      if (m[0] > pos) el.appendChild(document.createTextNode(texto.slice(pos, m[0])));
      var mk = document.createElement('mark');
      mk.textContent = texto.slice(m[0], m[1]);
      el.appendChild(mk);
      pos = m[1];
    });
    if (pos < texto.length) el.appendChild(document.createTextNode(texto.slice(pos)));
  }

  function dibujar() {
    res.textContent = '';
    var toks = palabras(consulta);
    if (!toks.length) return;
    var halladas = datos.chats.filter(function (c) {
      var t = norm(String(c.titulo || ''));
      return toks.every(function (k) { return t.indexOf(k) >= 0; });
    });
    var tit = document.createElement('div');
    tit.className = 'sbResTit';
    tit.textContent = halladas.length ? (halladas.length === 1 ? '1 resultado' : halladas.length + ' resultados') : 'Resultados';
    res.appendChild(tit);
    if (!halladas.length) {
      var v = document.createElement('div');
      v.className = 'sbVacio';
      v.textContent = datos.chats.length ? 'No encontré chats con «' + consulta.trim() + '», señor.' : 'Aún no hay chats, señor.';
      res.appendChild(v);
      return;
    }
    halladas.slice(0, 60).forEach(function (c) {
      var fila = datos.crearFila ? datos.crearFila(c) : null;
      if (!fila) return;
      var t = fila.querySelector('.chatTit');
      if (t) pintarTitulo(t, String(c.titulo || ''), toks);
      res.appendChild(fila);
    });
    if (typeof window.marcarChatActivo === 'function') window.marcarChatActivo();
  }

  function actualizar() {
    consulta = campo.value;
    var hay = palabras(consulta).length > 0;
    caja.classList.toggle('conTexto', campo.value.length > 0);
    sb.classList.toggle('sbBuscando', hay);
    res.hidden = !hay;
    if (hay) dibujar(); else res.textContent = '';
  }
  campo.addEventListener('input', actualizar);
  limpiar.addEventListener('click', function () { campo.value = ''; actualizar(); campo.focus(); });
  campo.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && campo.value) {
      e.stopPropagation();
      campo.value = '';
      actualizar();
    }
  });

  /* Atajo Ctrl+K (o Cmd+K): abre la barra si esta plegada y pone el cursor en el buscador */
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || (e.key !== 'k' && e.key !== 'K')) return;
    if (enPanel) return;
    e.preventDefault();
    if (body.classList.contains('sb-esc')) {
      if (!body.classList.contains('sb-fijo')) { guardar(true); aplicar(); }
    } else if (typeof window.abrirSidebar === 'function') {
      window.abrirSidebar();
    } else {
      body.classList.add('sb-abierto');
    }
    setTimeout(function () { campo.focus(); campo.select(); }, 50);
  });

  /* La lista de chats se pide al servidor cada vez que cambia: la interceptamos para tener los datos
     y para usar la misma fila (con su menu de tres puntos) en los resultados. */
  var pj = window.proyectosJarvis;
  if (pj && typeof pj.pintar === 'function') {
    var pintarOrig = pj.pintar;
    pj.pintar = function (chats, crearFila) {
      datos.chats = Array.isArray(chats) ? chats : [];
      datos.crearFila = crearFila;
      var r = pintarOrig.apply(this, arguments);
      if (consulta) {
        if (r && typeof r.then === 'function') r.then(dibujar, dibujar); else dibujar();
      }
      return r;
    };
  }
})();
