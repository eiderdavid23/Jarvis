/* Tareas automaticas: ejecuta las tareas que llegan a su hora mientras Jarvis esta abierto
   (en pantalla o en segundo plano). Con la app cerrada las dispara la APK. */
(function () {
  var lista = [], cargado = false, corriendo = false;
  function h(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function api(url, metodo, cuerpo) {
    var o = { method: metodo || 'GET' };
    if (cuerpo) { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(cuerpo); }
    return fetch(url, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'error');
        return d;
      });
    });
  }
  function zona() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
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
  function cargar() {
    return api('/tareas').then(function (d) {
      lista = d.tareas || []; cargado = true; revisar();
    }).catch(function () {});
  }
  function cartel(t, res) {
    var b = h('div', 'recAviso');
    b.appendChild(h('strong', '', res.ok ? 'Tarea automática' : 'Tarea automática fallida'));
    b.appendChild(h('span', '', t.titulo + ': ' + String(res.texto || '').slice(0, 160)));
    var x = h('button', '', 'Listo'); x.type = 'button';
    x.addEventListener('click', function () { b.remove(); });
    b.appendChild(x);
    document.body.appendChild(b);
  }
  function ejecutar(t) {
    corriendo = true;
    api('/tareas/' + t.id + '/reclamar', 'POST').then(function (d) {
      /* /chat?tarea=1: auth.js le pone la sesion pero NO lo mete en el chat que tengas abierto */
      return fetch('/chat?tarea=1', { method: 'POST', headers: cabeceras(),
        body: JSON.stringify({ mensaje: d.mensaje, zona_horaria: zona() }) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            return { ok: r.ok, texto: j.respuesta || j.error || '' };
          });
        })
        .catch(function () { return { ok: false, texto: 'No pude hablar con Jarvis.' }; })
        .then(function (res) {
          return api('/tareas/' + t.id + '/resultado', 'POST', { ok: res.ok, resultado: res.texto })
            .catch(function () {}).then(function () { cartel(t, res); });
        });
    }).catch(function () {}).then(function () { corriendo = false; cargar(); });
  }
  function revisar() {
    if (corriendo) return;
    var ahora = Date.now();
    var t = lista.filter(function (x) {
      return x.estado === 'pendiente' && new Date(x.cuando).getTime() <= ahora;
    })[0];
    if (t) ejecutar(t);
  }
  function tick() {
    if (!localStorage.getItem('jarvisAcceso')) return;
    if (!cargado) cargar(); else revisar();
  }
  setInterval(tick, 15000);
  setInterval(function () { if (localStorage.getItem('jarvisAcceso')) cargar(); }, 120000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  window.jarvisTareas = { recargar: cargar };
  setTimeout(tick, 2000);
})();
