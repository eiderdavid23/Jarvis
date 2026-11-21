/* Ajustes estilo Yarvex (v1.47, solo web).
   Convierte el menu de Ajustes en tarjetas plegables (Cuenta, Apariencia, Cerebro, Voz, Memoria,
   Herramientas, Manos, Rendimiento, Modulos, Recordatorios, Acerca de) y deja la barra lateral limpia.
   Las vistas de siempre (#tabLlave, #tabVoz...) se MUEVEN adentro de las tarjetas: no se copian,
   asi que sus botones y sus ids siguen funcionando igual. Si algo falla aqui, Ajustes queda como estaba. */
(function () {
  'use strict';
  var overlay = document.getElementById('overlayAjustes');
  var panel = document.getElementById('panelAjustes');
  var menu = document.getElementById('tabsAjustes');
  if (!overlay || !panel || !menu || document.getElementById('ajyLista')) return;

  var NS = 'http://www.w3.org/2000/svg';
  var IC = {
    cuenta: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    apariencia: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
    cerebro: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'],
    voz: ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v4', 'M8 23h8'],
    memoria: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
    herramientas: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
    permisos: ['M18.4 6.6a9 9 0 1 1-12.8 0', 'M12 2v10'],
    rendimiento: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
    modulos: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
    recordatorios: ['M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
    acerca: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01']
  };

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }
  function svg(paths, w, cls) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('width', w); s.setAttribute('height', w);
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    if (cls) s.setAttribute('class', cls);
    paths.forEach(function (d) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); s.appendChild(p);
    });
    return s;
  }
  function cerrar() { if (typeof cerrarAjustes === 'function') cerrarAjustes(); }

  var lista = el('div', '');
  lista.id = 'ajyLista';
  var tarjetas = {};   // id -> { raiz, cuerpo, sub }
  var porTab = {};     // data-tab del menu viejo -> id de tarjeta

  function nombreCuenta() {
    var mail = '', nom = '';
    try { mail = localStorage.getItem('jarvisCorreo') || ''; nom = localStorage.getItem('jarvisNombre') || ''; } catch (e) {}
    if (!nom) nom = mail ? mail.split('@')[0] : 'Invitado';
    nom = nom.charAt(0).toUpperCase() + nom.slice(1);
    return { nom: nom, mail: mail };
  }

  function abrirTarjeta(id, desplazar) {
    Object.keys(tarjetas).forEach(function (k) {
      var t = tarjetas[k];
      if (!t.cuerpo) return;
      var abre = k === id && !t.raiz.classList.contains('abierta');
      t.raiz.classList.toggle('abierta', abre);
      t.cuerpo.hidden = !abre;
      t.cab.setAttribute('aria-expanded', abre ? 'true' : 'false');
      if (abre && t.alAbrir) { try { t.alAbrir(); } catch (e) { console.error('ajustes yarvex:', e); } }
    });
    if (desplazar !== false && tarjetas[id]) {
      setTimeout(function () { tarjetas[id].raiz.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 60);
    }
  }

  function crearTarjeta(def) {
    var raiz = el('div', 'ajyCard');
    raiz.dataset.id = def.id;
    var cab = el('button', 'ajyCab');
    cab.type = 'button';
    var ico = el('span', 'ajyIco');
    ico.appendChild(svg(IC[def.ic], 22));
    var txt = el('span', 'ajyTxt');
    txt.appendChild(el('b', '', def.t));
    var sub = el('small', '', def.s || '');
    txt.appendChild(sub);
    cab.appendChild(ico); cab.appendChild(txt);
    var flecha = def.accion
      ? svg(['M9 6l6 6-6 6'], 20, 'ajyFlecha')
      : svg(['M6 9l6 6 6-6'], 20, 'ajyFlecha');
    cab.appendChild(flecha);
    raiz.appendChild(cab);
    var t = { raiz: raiz, cab: cab, sub: sub, cuerpo: null, alAbrir: def.alAbrir };
    if (def.accion) {
      raiz.dataset.accion = '1';
      cab.addEventListener('click', def.accion);
    } else {
      t.cuerpo = el('div', 'ajyCuerpo');
      t.cuerpo.hidden = true;
      raiz.appendChild(t.cuerpo);
      cab.setAttribute('aria-expanded', 'false');
      cab.addEventListener('click', function () { abrirTarjeta(def.id); });
    }
    tarjetas[def.id] = t;
    if (def.tab) porTab[def.tab] = def.id;
    lista.appendChild(raiz);
    return t;
  }

  function moverVista(t, idVista) {
    var v = document.getElementById(idVista);
    if (v && t.cuerpo) t.cuerpo.appendChild(v);
  }

  /* ---- Cuenta ---- */
  var cuenta = crearTarjeta({ id: 'cuenta', ic: 'cuenta', t: 'Cuenta', s: '' });
  var perfil = el('div', 'ajyPerfil');
  var av = el('div', 'ajyAv');
  var datos = el('div', '');
  var pNom = el('b'); var pMail = el('small');
  datos.appendChild(pNom); datos.appendChild(pMail);
  perfil.appendChild(av); perfil.appendChild(datos);
  var salir = el('button', 'ajyFila salir', 'Cerrar sesión');
  salir.type = 'button';
  salir.addEventListener('click', function () {
    cerrar();
    var s = document.getElementById('syBtn');
    if (s) s.click();
  });
  cuenta.cuerpo.appendChild(perfil);
  cuenta.cuerpo.appendChild(salir);
  function pintarCuenta() {
    var c = nombreCuenta();
    av.textContent = c.nom.charAt(0);
    pNom.textContent = c.nom;
    pMail.textContent = c.mail;
    cuenta.sub.textContent = c.mail || c.nom;
  }

  /* ---- Tarjetas con las vistas de siempre ---- */
  var DEFS = [
    { id: 'apariencia', ic: 'apariencia', t: 'Apariencia', s: 'Claro, oscuro o automático', tab: 'tema', vista: 'tabTema' },
    { id: 'cerebro', ic: 'cerebro', t: 'Cerebro', s: 'Llaves de IA y modelos', tab: 'llave', vista: 'tabLlave' },
    { id: 'voz', ic: 'voz', t: 'Voz', s: 'Tono, velocidad y voz premium', tab: 'voz', vista: 'tabVoz' },
    { id: 'memoria', ic: 'memoria', t: 'Memoria', s: 'Lo que Jarvis recuerda de ti', tab: 'memoria', vista: 'tabMemoria' },
    { id: 'herramientas', ic: 'herramientas', t: 'Herramientas', s: 'Qué puede usar Jarvis', tab: 'herramientas', vista: 'tabHerramientas' },
    { id: 'permisos', ic: 'permisos', t: 'Manos de Jarvis', s: 'Que Jarvis use tu pantalla', tab: 'manos', vista: 'tabManos' }
  ];
  DEFS.forEach(function (d) {
    if (!document.getElementById(d.vista)) return;   // p. ej. Manos solo existe en la APK
    moverVista(crearTarjeta(d), d.vista);
  });

  var rend = crearTarjeta({ id: 'rendimiento', ic: 'rendimiento', t: 'Rendimiento', s: 'Solicitudes de hoy', tab: 'uso' });
  moverVista(rend, 'tabUso');

  /* ---- Modulos (la lista sale de modulos.js) ---- */
  var mods = crearTarjeta({ id: 'modulos', ic: 'modulos', t: 'Módulos', s: 'Plataformas, tareas y más', alAbrir: pintarModulos });
  function pintarModulos() {
    mods.cuerpo.textContent = '';
    var M = window.modulosJarvis;
    if (!M || !M.lista || !M.lista.length) { mods.cuerpo.appendChild(el('p', 'ajyVacio', 'No hay módulos disponibles.')); return; }
    M.lista.forEach(function (m) {
      var b = el('button', 'ajyFila');
      b.type = 'button';
      b.appendChild(svg(m.icono || IC.modulos, 20));
      b.appendChild(document.createTextNode(m.nombre));
      b.addEventListener('click', function () { cerrar(); M.abrir(m.id); });
      mods.cuerpo.appendChild(b);
    });
  }

  /* ---- Recordatorios (abre el panel de siempre) ---- */
  crearTarjeta({
    id: 'recordatorios', ic: 'recordatorios', t: 'Recordatorios', s: 'Tus avisos pendientes',
    accion: function () {
      cerrar();
      var b = document.getElementById('sbRecordatorios');
      if (b) b.click();
    }
  });

  /* ---- Acerca de ---- */
  var acerca = crearTarjeta({ id: 'acerca', ic: 'acerca', t: 'Acerca de', s: 'Qué es Jarvis y con qué funciona', tab: 'acerca' });
  moverVista(acerca, 'tabAcerca');

  /* ---- Montar ---- */
  panel.appendChild(lista);
  panel.dataset.ajy = '1';

  /* Si otro script abre una pestana vieja (por ejemplo desde la orbita), se abre su tarjeta */
  document.querySelectorAll('.tabAjuste').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = porTab[b.dataset.tab];
      if (id) abrirTarjeta(id);
    });
  });

  /* El titulo siempre dice AJUSTES (ajustes_nuevo.js lo cambia al tocar una pestana vieja) */
  var titulo = document.querySelector('#panelHeader span');
  function fijarTitulo() { if (titulo && titulo.textContent !== 'Ajustes') titulo.textContent = 'Ajustes'; }
  new MutationObserver(fijarTitulo).observe(panel, { attributes: true, attributeFilter: ['data-vista'] });
  fijarTitulo();

  document.body.classList.add('ajy-limpio');

  new MutationObserver(function () {
    if (overlay.classList.contains('abierto')) pintarCuenta();
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  pintarCuenta();

  window.ajustesYarvex = { abrirTarjeta: abrirTarjeta };
})();
