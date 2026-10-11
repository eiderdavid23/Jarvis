/* Panel Herramientas: activa o desactiva lo que Jarvis puede usar.
   Lo apagado se guarda en este dispositivo y se manda al servidor en cada mensaje. */
(function () {
  var GRUPOS = [
    { id: 'minecraft', nombre: 'Minecraft', desc: 'Ubicar aldeas y estructuras con la semilla' },
    { id: 'memoria', nombre: 'Memoria', desc: 'Recordar datos tuyos entre chats' },
    { id: 'recordatorios', nombre: 'Recordatorios', desc: 'Crear, listar y borrar por chat' },
    { id: 'imagenes', nombre: 'Imágenes', desc: 'Generar imágenes con IA' },
    { id: 'personas', nombre: 'Buscar personas', desc: 'Información pública en la web y redes' },
    { id: 'enlaces', nombre: 'Abrir enlaces', desc: 'Abrir sitios en el navegador' },
    { id: 'archivos', nombre: 'Archivos', desc: 'Leer adjuntos y archivos del proyecto' },
    { id: 'telefono', nombre: 'Teléfono', desc: 'Linterna, vibración y batería (solo Termux)' }
  ];
  var CLAVE = 'jarvisHerramientasOff';

  function leer() {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function guardar(lista) {
    try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (e) {}
  }

  // index.html la usa para mandar el header X-Herramientas-Off
  window.herramientasOff = function () { return leer().join(','); };

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
      chk.addEventListener('change', function () {
        var lista = leer().filter(function (x) { return x !== g.id; });
        if (!chk.checked) lista.push(g.id);
        guardar(lista);
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
