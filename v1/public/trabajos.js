/* Trabajos en segundo plano: toma los trabajos pendientes y los hace por etapas, llamando a /chat
   varias veces (cada llamada es corta, asi no choca con el limite de tiempo del servidor).
   Funciona mientras Jarvis este abierto en una pestana (aunque este oculta o en otra ventana). */
(function () {
  'use strict';
  var MAX_RONDAS = 12;
  var REGLAS = ' | REGLAS: trabaja por etapas; en cada respuesta haz una etapa y termina con UNA linea aparte que diga '
    + 'ESTADO: CONTINUA (si aun falta trabajo), ESTADO: TERMINADO (si ya acabaste; resume lo hecho) o ESTADO: FALLIDO '
    + '(si no se puede; di por que). No crees otro trabajo en segundo plano ni otra tarea automatica.';
  var CONTINUAR = 'Continua con la siguiente etapa del trabajo. Recuerda cerrar con la linea ESTADO.';
  var lista = [], cargado = false, corriendo = false;

  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function zona() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }
  function cabeceras() {
    return {
      'Content-Type': 'application/json',
      'X-Proveedor': ls('jarvisProveedor') || 'gemini',
      'X-Gemini-Key': ls('jarvisGeminiKey'),
      'X-Groq-Key': ls('jarvisGroqKey'),
      'X-Mistral-Key': ls('jarvisMistralKey'),
      'X-OpenRouter-Key': ls('jarvisOpenRouterKey'),
      'X-Nvidia-Key': ls('jarvisNvidiaKey'),
      'X-Modelo': ls('jarvisModelo'),
      'X-Cambio-Auto': ls('jarvisCambioAuto') === '0' ? '0' : '1',
      'X-Herramientas-Off': (window.herramientasOff ? window.herramientasOff() : '')
    };
  }
  function api(url, metodo, cuerpo) {
    var o = { method: metodo || 'GET' };
    if (cuerpo) { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(cuerpo); }
    return fetch(url, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || 'error'); e.estado = r.status; throw e; }
        return d;
      });
    });
  }
  function cartel(t, ok, texto) {
    var b = document.createElement('div');
    b.className = 'recAviso';
    var s = document.createElement('strong');
    s.textContent = ok ? 'Trabajo terminado' : 'Trabajo sin terminar';
    var p = document.createElement('span');
    p.textContent = t.titulo + ': ' + String(texto || '').slice(0, 160);
    var x = document.createElement('button');
    x.type = 'button'; x.textContent = 'Listo';
    x.addEventListener('click', function () { b.remove(); });
    b.appendChild(s); b.appendChild(p); b.appendChild(x);
    document.body.appendChild(b);
  }
  /* Separa el texto de la linea ESTADO: ... */
  function estadoDe(texto) {
    var m = String(texto || '').match(/ESTADO:\s*(CONTINUA|TERMINADO|FALLIDO)/ig);
    var est = '';
    if (m && m.length) est = m[m.length - 1].replace(/ESTADO:\s*/i, '').toUpperCase();
    var limpio = String(texto || '').replace(/^.*ESTADO:\s*(CONTINUA|TERMINADO|FALLIDO).*$/igm, '').trim();
    return { estado: est, texto: limpio };
  }
  function primeraLinea(t) {
    var l = String(t || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean)[0] || 'Sin texto';
    return l.replace(/[*#`_]/g, '').slice(0, 170);
  }
  function terminar(t, ok, texto) {
    return api('/trabajos/' + t.id + '/terminar', 'POST', { ok: ok, resultado: texto }).catch(function () {});
  }

  async function ejecutar(t) {
    corriendo = true;
    try {
      var d;
      try { d = await api('/trabajos/' + t.id + '/reclamar', 'POST'); } catch (e) { return; }
      var chatId = '', ultimo = '';
      try {
        for (var ronda = 1; ronda <= MAX_RONDAS; ronda++) {
          var cuerpo = { mensaje: ronda === 1 ? d.mensaje + REGLAS : CONTINUAR, zona_horaria: zona() };
          if (chatId) cuerpo.chat_id = chatId;
          var r = await fetch('/chat?tarea=1', { method: 'POST', headers: cabeceras(), body: JSON.stringify(cuerpo) });
          var j = await r.json().catch(function () { return {}; });
          if (!r.ok) {
            var msg = j.respuesta || j.error || 'Jarvis no pudo seguir.';
            await terminar(t, false, msg); cartel(t, false, msg); return;
          }
          chatId = j.chat_id || chatId;
          var est = estadoDe(j.respuesta);
          ultimo = est.texto || ultimo;
          var p = await api('/trabajos/' + t.id + '/paso', 'POST', { texto: 'Etapa ' + ronda + ': ' + primeraLinea(est.texto) });
          if (p.cancelado) return;
          if (est.estado === 'TERMINADO') { await terminar(t, true, ultimo); cartel(t, true, ultimo); return; }
          if (est.estado === 'FALLIDO') { await terminar(t, false, ultimo); cartel(t, false, ultimo); return; }
        }
        var fin = 'Se agotaron las etapas (' + MAX_RONDAS + ') sin terminar. Lo ultimo: ' + ultimo;
        await terminar(t, false, fin); cartel(t, false, fin);
      } catch (e) {
        var caida = 'Se interrumpio: ' + (e && e.message ? e.message : 'error de conexion');
        await terminar(t, false, caida); cartel(t, false, caida);
      }
    } finally {
      corriendo = false;
      cargar();
    }
  }
  function revisar() {
    if (corriendo) return;
    var t = lista.filter(function (x) { return x.estado === 'pendiente'; })[0];
    if (t) ejecutar(t);
  }
  function cargar() {
    return api('/trabajos').then(function (d) {
      lista = d.trabajos || []; cargado = true; revisar();
    }).catch(function () {});
  }
  function tick() {
    if (!ls('jarvisAcceso')) return;
    cargar();
  }
  setInterval(tick, 8000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  window.jarvisTrabajos = { recargar: cargar };
  setTimeout(tick, 2500);
})();
