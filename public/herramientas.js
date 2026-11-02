/* Panel Herramientas: activa o desactiva lo que Jarvis puede usar.
   Lo apagado se guarda en este dispositivo y se manda al servidor en cada mensaje. */
(function () {
  var GRUPOS = [
    { id: 'minecraft', nombre: 'Minecraft', desc: 'Ubicar aldeas y estructuras con la semilla' },
    { id: 'memoria', nombre: 'Memoria', desc: 'Recordar datos tuyos entre chats' },
    { id: 'recordatorios', nombre: 'Recordatorios', desc: 'Crear, listar y borrar por chat' },
    { id: 'imagenes', nombre: 'Imágenes', desc: 'Generar imágenes con IA' },
    { id: 'personas', nombre: 'Buscar personas', desc: 'Información pública en la web y redes' },
    { id: 'web', nombre: 'Buscar en la web', desc: 'Buscar en internet y leer páginas' },
    { id: 'enlaces', nombre: 'Abrir enlaces', desc: 'Abrir sitios en el navegador' },
    { id: 'nexus', nombre: 'Plataformas NEXUS', desc: 'Listar y abrir tus plataformas por nombre' },
    { id: 'archivos', nombre: 'Archivos', desc: 'Leer adjuntos y archivos del proyecto' },
    { id: 'manos', nombre: 'Manos', desc: 'Ver y usar la pantalla de tu celular (app Android)' },
    { id: 'telefono', nombre: 'Teléfono', desc: 'Linterna, vibración, batería y volumen del celular' }
  ];
  var CLAVE = 'jarvisHerramientasOff';

  function leer() {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  var CLAVE_TS = 'jarvisHerramientasTs';
  function guardar(lista, ts) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
      localStorage.setItem(CLAVE_TS, String(ts || Date.now()));
    } catch (e) {}
  }
  function pintarInterruptores() {
    var apagadas = leer();
    var cs = document.querySelectorAll('#hrCont input[data-id]');
    for (var i = 0; i < cs.length; i++) cs[i].checked = apagadas.indexOf(cs[i].dataset.id) === -1;
  }

  // index.html la usa para mandar el header X-Herramientas-Off
  window.herramientasOff = function () { return leer().join(','); };
  // hora del ultimo cambio (para ver si gana la pagina o la burbuja)
  window.herramientasTs = function () {
    var t = 0;
    try { t = Number(localStorage.getItem(CLAVE_TS)) || 0; } catch (e) {}
    return (!t && leer().length) ? 1 : t;
  };
  // orden por voz o chat: devuelve true si cambio algo
  window.herramientasAplicar = function (id, on) {
    var lista = leer();
    if (on === (lista.indexOf(id) === -1)) return false;
    lista = lista.filter(function (x) { return x !== id; });
    if (!on) lista.push(id);
    guardar(lista);
    pintarInterruptores();
    window.dispatchEvent(new Event('jarvis-herramientas'));
    return true;
  };
  // lo que manda la burbuja cuando su cambio es mas reciente
  window.herramientasEstablecer = function (off, ts) {
    var lista = String(off || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    guardar(lista, Number(ts) || Date.now());
    pintarInterruptores();
  };

  function construir() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar || document.getElementById('hrCont')) return;
    var apagadas = leer();

    var titulo = document.createElement('div');
    titulo.className = 'sbSeccion';
    titulo.textContent = 'Herramientas';

    var cont = document.createElement('div');
    cont.className = 'hrCont';
    cont.id = 'hrCont';

    GRUPOS.forEach(function (g) {
      var fila = document.createElement('label');
      fila.className = 'hrFila';

      var txt = document.createElement('span');
      txt.className = 'hrTxt';
      var b = document.createElement('b');
      b.textContent = g.nombre;
      var s = document.createElement('small');
      s.textContent = g.desc;
      txt.appendChild(b);
      txt.appendChild(s);

      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = apagadas.indexOf(g.id) === -1;
      chk.dataset.id = g.id;
      chk.addEventListener('change', function () {
        var lista = leer().filter(function (x) { return x !== g.id; });
        if (!chk.checked) lista.push(g.id);
        guardar(lista);
        window.dispatchEvent(new Event('jarvis-herramientas'));
      });
      var sw = document.createElement('span');
      sw.className = 'hrSw';

      fila.appendChild(txt);
      fila.appendChild(chk);
      fila.appendChild(sw);
      cont.appendChild(fila);
    });

    // Va antes de "Proximamente" (la primera .sbSeccion que no es la nuestra)
    var ref = null;
    var secciones = sidebar.querySelectorAll('.sbSeccion');
    for (var i = 0; i < secciones.length; i++) {
      if (secciones[i] !== titulo) { ref = secciones[i]; break; }
    }
    if (ref) { sidebar.insertBefore(titulo, ref); sidebar.insertBefore(cont, ref); }
    else { sidebar.appendChild(titulo); sidebar.appendChild(cont); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', construir);
  else construir();
})();
