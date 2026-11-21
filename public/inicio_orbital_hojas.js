/* Hojas del inicio orbital (v1.38, solo web): Conectores, Automatizaciones,
   Musica y Gestos. Se carga despues de inicio_orbital.js. */
(function () {
  'use strict';
  var api = window.inicioOrbital;
  if (!api) return;
  var body = document.body;
  var acc = api.acciones;
  var YT = 'https://music.youtube.com/search?q=';
  var SP = 'https://open.spotify.com/search/';

  /* Gestos guardados en este celular */
  var LS = 'jarvisGestos';
  var cfg = { sacudir: false, largo: true };
  try {
    var g = JSON.parse(localStorage.getItem(LS) || '{}');
    if (typeof g.sacudir === 'boolean') cfg.sacudir = g.sacudir;
    if (typeof g.largo === 'boolean') cfg.largo = g.largo;
  } catch (e) {}
  function guardar() {
    try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {}
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }

  /* --- Hoja inferior --- */
  var velo, hoja, cuerpo, titulo;
  function crearHoja() {
    if (hoja) return;
    velo = el('div', ''); velo.id = 'oiVelo';
    hoja = el('div', ''); hoja.id = 'oiHoja';
    hoja.appendChild(el('div', 'oiAgarre'));
    titulo = el('p', 'oiTit');
    cuerpo = el('div', '');
    hoja.appendChild(titulo); hoja.appendChild(cuerpo);
    velo.addEventListener('click', cerrarHoja);
    body.appendChild(velo); body.appendChild(hoja);
  }
  function abrirHoja(tit, nodos) {
    crearHoja();
    titulo.textContent = tit;
    cuerpo.innerHTML = '';
    nodos.forEach(function (n) { cuerpo.appendChild(n); });
    velo.classList.add('abierta'); hoja.classList.add('abierta');
  }
  function cerrarHoja() {
    if (!hoja) return;
    velo.classList.remove('abierta'); hoja.classList.remove('abierta');
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') cerrarHoja();
  });

  function fila(tit, desc, fn) {
    var b = el('button', 'oiFila');
    b.type = 'button';
    var t = el('span', '', tit);
    if (desc) t.appendChild(el('small', '', desc));
    b.appendChild(t);
    b.addEventListener('click', fn);
    return b;
  }
  function interruptor(tit, desc, valor, fn) {
    var sw = el('span', 'oiSw' + (valor ? ' on' : ''));
    var b = fila(tit, desc, function () {
      var on = !sw.classList.contains('on');
      sw.classList.toggle('on', on);
      fn(on);
    });
    b.appendChild(sw);
    return b;
  }

  /* --- Atajos a lo que ya existe en Jarvis --- */
  function alChat(msg, enviar) {
    cerrarHoja();
    var t = document.getElementById('texto');
    if (!t) return;
    if (typeof cambiarModo === 'function') cambiarModo('chat');
    t.value = msg;
    if (enviar && typeof enviarMensaje === 'function') enviarMensaje(false);
    else setTimeout(function () { t.focus(); }, 350);
  }
  function modulo(id) {
    cerrarHoja();
    if (window.modulosJarvis) window.modulosJarvis.abrir(id);
  }
  function ajustes(tab) {
    cerrarHoja();
    api.abrirAjustesTab(tab);
  }

  acc.conectores = function () {
    abrirHoja('Conectores', [
      fila('TV y PC', 'Controlar tu TV o tu PC desde Jarvis', function () { ajustes('herramientas'); }),
      fila('Llaves de IA', 'Gemini, Groq y otros modelos', function () { ajustes('llave'); })
    ]);
  };
  acc.automatizaciones = function () {
    abrirHoja('Automatizaciones', [
      fila('Tareas automáticas', 'Que Jarvis haga algo solo a una hora', function () { modulo('tareas'); }),
      fila('Recordatorios', 'Ver los que tienes pendientes', function () { alChat('Muéstrame mis recordatorios', true); }),
      fila('Crear una tarea', 'La describes y Jarvis la programa', function () { alChat('Programa una tarea automática: ', false); })
    ]);
  };

  /* --- Musica: en la app de Android busca Y REPRODUCE; en el navegador solo abre la busqueda --- */
  var capM = window.Capacitor;
  var nativoM = !!(capM && capM.isNativePlatform && capM.isNativePlatform());
  var MN = nativoM ? ((capM.Plugins || {}).Manos || (capM.registerPlugin && capM.registerPlugin('Manos'))) : null;
  function buscarMusica(base, app, inp) {
    var q = inp.value.trim();
    if (!q) { inp.focus(); return; }
    cerrarHoja();
    var abrir = function () { window.open(base + encodeURIComponent(q), '_blank'); };
    if (!MN) { abrir(); return; }
    /* Si la APK es vieja (sin reproducirMusica) o no hay app de musica, cae a abrir la busqueda */
    Promise.resolve().then(function () { return MN.reproducirMusica({ q: q, app: app }); })
      .then(function (r) { if (!r || r.ok === false) abrir(); })
      .catch(abrir);
  }
  acc.musica = function () {
    var inp = el('input', 'oiInput');
    inp.type = 'text'; inp.placeholder = '¿Qué quieres escuchar?'; inp.autocomplete = 'off';
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') buscarMusica(YT, 'ytmusic', inp); });
    abrirHoja('Música', [
      inp,
      fila('YouTube Music', nativoM ? 'Busca y reproduce' : 'Busca y abre el resultado', function () { buscarMusica(YT, 'ytmusic', inp); }),
      fila('Spotify', nativoM ? 'Busca y reproduce' : 'Busca y abre el resultado', function () { buscarMusica(SP, 'spotify', inp); }),
      fila('Pídele a Jarvis', 'Que te recomiende música', function () {
        var q = inp.value.trim();
        alChat('Recomiéndame música' + (q ? ' de ' + q : ''), true);
      }),
      el('p', 'oiNota', nativoM ? 'Jarvis busca y reproduce la primera coincidencia en la app que elijas.' : 'En el navegador solo se abre la búsqueda; para que reproduzca hace falta la app de Android.')
    ]);
  };

  /* --- Gestos --- */
  var ultimoGolpe = 0, golpes = 0, ultimaSacudida = 0;
  function alMover(e) {
    var a = e.accelerationIncludingGravity;
    if (!a) return;
    var m = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    var ahora = Date.now();
    if (m < 26 || ahora - ultimoGolpe < 250) return;
    golpes = (ahora - ultimoGolpe < 900) ? golpes + 1 : 1;
    ultimoGolpe = ahora;
    if (golpes >= 3 && ahora - ultimaSacudida > 3000) {
      golpes = 0; ultimaSacudida = ahora;
      if (body.classList.contains('m-voz') || body.classList.contains('con-modulo')) return;
      if (navigator.vibrate) navigator.vibrate(60);
      acc.voz();
    }
  }
  function aplicarSacudida() {
    window.removeEventListener('devicemotion', alMover);
    if (cfg.sacudir) window.addEventListener('devicemotion', alMover);
  }
  aplicarSacudida();

  acc.gestos = function () {
    abrirHoja('Gestos', [
      interruptor('Sacudir el celular', 'Sacúdelo con fuerza y Jarvis empieza a escucharte', cfg.sacudir, function (v) {
        cfg.sacudir = v; guardar(); aplicarSacudida();
        if (v && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
          DeviceMotionEvent.requestPermission().catch(function () {});
        }
      }),
      interruptor('Mantener el núcleo', 'Mantén presionado el núcleo para abrir el chat', cfg.largo, function (v) {
        cfg.largo = v; guardar();
      }),
      el('p', 'oiNota', 'La sacudida funciona con la app abierta en pantalla.')
    ]);
  };

  /* Mantener presionado el nucleo = abrir el chat (sin disparar el toque normal) */
  var orb = document.getElementById('orbWrap');
  var tLargo = 0, x0 = 0, y0 = 0;
  function finLargo() {
    clearTimeout(tLargo);
    setTimeout(function () { api.suprimir = 0; }, 400);
  }
  if (orb) {
    orb.addEventListener('pointerdown', function (e) {
      if (!cfg.largo || !body.classList.contains('m-inicio')) return;
      x0 = e.clientX; y0 = e.clientY;
      clearTimeout(tLargo);
      tLargo = setTimeout(function () {
        api.suprimir = 1;
        if (navigator.vibrate) navigator.vibrate(30);
        acc.chat();
      }, 600);
    });
    orb.addEventListener('pointermove', function (e) {
      if (Math.hypot(e.clientX - x0, e.clientY - y0) > 12) clearTimeout(tLargo);
    });
    orb.addEventListener('pointerup', finLargo);
    orb.addEventListener('pointercancel', finLargo);
  }
})();
