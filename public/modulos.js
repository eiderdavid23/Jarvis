/* Modulos de Jarvis: registro unico. Para agregar uno nuevo, suma una linea a MODULOS.
   Cada modulo se abre dentro de Jarvis, con una barra "<- Jarvis" arriba. */
(function () {
  'use strict';
  var MODULOS = [
    { id: 'nexus', nombre: 'Plataformas', url: '/nexus.html?modulo=1',
      icono: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'] }
  ];
  var NS = 'http://www.w3.org/2000/svg';
  var panel = null, marco = null, titulo = null, activo = null;

  function svg(paths, w) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('width', w); s.setAttribute('height', w);
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    paths.forEach(function (d) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); s.appendChild(p);
    });
    return s;
  }

  function crearPanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'modPanel'; panel.className = 'modPanel'; panel.hidden = true;
    var barra = document.createElement('div');
    barra.className = 'modBarra';
    var volver = document.createElement('button');
    volver.type = 'button'; volver.className = 'modVolver';
    volver.appendChild(svg(['M19 12H5', 'M12 19l-7-7 7-7'], 18));
    volver.appendChild(document.createTextNode('Jarvis'));
    volver.addEventListener('click', cerrar);
    titulo = document.createElement('span');
    titulo.className = 'modTit';
    barra.appendChild(volver); barra.appendChild(titulo);
    marco = document.createElement('iframe');
    marco.className = 'modMarco';
    marco.setAttribute('allow', 'clipboard-write');
    panel.appendChild(barra); panel.appendChild(marco);
    document.body.appendChild(panel);
  }

  function abrir(id) {
    var m = null;
    MODULOS.forEach(function (x) { if (x.id === id) m = x; });
    if (!m) return;
    crearPanel();
    if (activo !== m.id) { marco.setAttribute('src', m.url); activo = m.id; }
    titulo.textContent = m.nombre;
    panel.hidden = false;
    document.body.classList.remove('sb-abierto');
    document.body.classList.add('con-modulo');
  }
  function cerrar() {
    if (!panel) return;
    panel.hidden = true;
    document.body.classList.remove('con-modulo');
  }

  function construir() {
    var sb = document.getElementById('sidebar');
    var ref = document.getElementById('sbRecordatorios');
    if (!sb || !ref || document.getElementById('modSeccion')) return;
    var tit = document.createElement('div');
    tit.className = 'sbSeccion'; tit.id = 'modSeccion'; tit.textContent = 'Módulos';
    var cont = document.createElement('div');
    cont.id = 'modLista';
    MODULOS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'sbItem';
      b.appendChild(svg(m.icono, 20));
      b.appendChild(document.createTextNode(m.nombre));
      b.addEventListener('click', function () { abrir(m.id); });
      cont.appendChild(b);
    });
    sb.insertBefore(tit, ref.nextSibling);
    sb.insertBefore(cont, tit.nextSibling);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel && !panel.hidden) cerrar();
  });
  window.modulosJarvis = { abrir: abrir, cerrar: cerrar, lista: MODULOS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', construir);
  else construir();
})();
