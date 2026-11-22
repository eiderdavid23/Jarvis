/* Modo local: sin internet (o si lo eliges en el selector) el chat responde con el modelo que corre
   en el celular (plugin LlamaLocal, solo en la APK). Va ANTES de cancelar.js para que Detener funcione. */
(function () {
  var cap = window.Capacitor;
  var nativo = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var L = nativo ? ((cap.Plugins || {}).LlamaLocal || (cap.registerPlugin && cap.registerPlugin('LlamaLocal'))) : null;
  var fetchBase = window.fetch;
  var K_AUTO = 'jarvisLocalAuto', K_ID = 'jarvisLocalId';
  var historial = [], encendiendo = null, avisoEl = null, avisoT = null;

  function ver(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function poner(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function json(o) {
    return new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  function aviso(txt) {
    if (!document.body) return;
    if (!avisoEl) {
      avisoEl = document.createElement('div');
      avisoEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);' +
        'bottom:calc(110px + env(safe-area-inset-bottom,0px));z-index:9500;max-width:86%;' +
        'padding:10px 16px;border-radius:14px;border:1px solid rgba(0,229,255,.35);' +
        'background:var(--panel,#0b111b);color:var(--texto,#d9f7ff);font:500 13px system-ui,sans-serif;' +
        'line-height:1.4;text-align:center;display:none';
      document.body.appendChild(avisoEl);
    }
    avisoEl.textContent = txt;
    avisoEl.style.display = 'block';
    clearTimeout(avisoT);
    avisoT = setTimeout(function () { avisoEl.style.display = 'none'; }, 6000);
  }

  /* Respuestas sin IA (no gastan RAM ni tiempo): saludos, gracias, hora y fecha. */
  function plano(t) {
    return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ').trim().replace(/\s+/g, ' ');
  }
  function reglas(msg) {
    var t = plano(msg).replace(/^((oye|ok|jarvis) )+/, '').replace(/( (jarvis|por favor))+$/, '');
    var d = new Date(), h = d.getHours();
    var momento = h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)$/.test(t)) return momento + ', señor. Modo local activo.';
    if (/^(gracias|muchas gracias|ok gracias)$/.test(t)) return 'A sus órdenes, señor.';
    if (/^(como estas|como te va|todo bien)$/.test(t)) return 'Operativo, señor. Sin internet, pero operativo.';
    if (/^(quien eres|que eres)$/.test(t)) return 'Jarvis, su asistente, señor. Ahora mismo corro en su celular, sin conexión.';
    if (/^(que hora es|la hora|dime la hora|que horas son)$/.test(t)) {
      return 'Son las ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) + ', señor.';
    }
    if (/^(que dia es( hoy)?|que fecha es( hoy)?|fecha|dia de hoy)$/.test(t)) {
      return 'Hoy es ' + d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ', señor.';
    }
    return null;
  }

  /* Modelo local: elige el guardado o el mayor que le quepa a la RAM, y lo enciende si hace falta. */
  function elegir(e) {
    var gb = e.ramTotalMb / 1024;
    var bajados = e.modelos.filter(function (m) { return m.descargado; });
    var guardado = bajados.filter(function (m) { return m.id === ver(K_ID); })[0];
    if (guardado) return guardado;
    var cabe = bajados.filter(function (m) { return gb >= m.ramMinGb; });
    return cabe.length ? cabe[cabe.length - 1] : (bajados[0] || null);
  }
  function asegurar() {
    if (encendiendo) return encendiendo;
    encendiendo = L.estado().then(function (e) {
      if (!e.binario) throw new Error('Esta APK no trae el motor del modelo local.');
      if (e.activo) { if (e.modelo) poner(K_ID, e.modelo); return true; }
      var m = elegir(e);
      if (!m) throw new Error('No hay un modelo local descargado. Descárguelo en Ajustes → Modelos IA.');
      aviso('Encendiendo ' + m.nombre + '... puede tardar un minuto.');
      return L.iniciar({ id: m.id, ctx: 4096, hilos: 4 }).then(function () { poner(K_ID, m.id); return true; });
    }).then(function (v) { encendiendo = null; return v; }, function (e) { encendiendo = null; throw e; });
    return encendiendo;
  }
  function sistema() {
    var d = new Date();
    return 'Eres Jarvis, el asistente de IA personal del usuario, a quien llamas «señor». Hablas como el Jarvis de Iron Man: ' +
      'sereno, técnico y con humor seco. Estás en modo local: corres en su celular, sin internet. ' +
      'Responde siempre en español, en 1 a 3 frases cortas y directas: contesta primero lo que te preguntan (cuentas, dudas, ideas). No inventes datos. ' +
      'Solo si te piden algo que necesite conexión (buscar en la web, noticias, clima, recordatorios, controlar apps), dile con sobriedad que eso espera a que vuelva el internet. Si no lo piden, no menciones el internet. ' +
      'Hoy es ' + d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' y son las ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) + '.';
  }
  function guardar(u, a) {
    historial.push({ role: 'user', content: u }, { role: 'assistant', content: a });
    historial = historial.slice(-12);
  }
  function responder(msg) {
    var r = reglas(msg);
    if (r) { guardar(msg, r); return Promise.resolve(r); }
    return asegurar().then(function () {
      var mensajes = [{ role: 'system', content: sistema() }].concat(historial.slice(-8), [{ role: 'user', content: msg }]);
      return L.chat({ mensajes: mensajes, maxTokens: 400, temperatura: 0.4, pensar: false });
    }).then(function (r2) {
      var t = (r2.texto || '').replace(/^null/, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 'No logré formular una respuesta, señor.';
      guardar(msg, t);
      return t;
    });
  }

  /* Devuelve una Response falsa con la misma forma que /chat, asi el resto de la app no nota la diferencia. */
  function cancelado() { return new DOMException('Cancelado', 'AbortError'); }
  function enLocal(texto, adj, sg) {
    return new Promise(function (ok, no) {
      var parado = false;
      if (sg) {
        if (sg.aborted) { no(cancelado()); return; }
        sg.addEventListener('abort', function () {
          parado = true;
          try { L.detenerChat(); } catch (e) { /* sin chat en curso */ }
          no(cancelado());
        });
      }
      if (adj) { ok(json({ respuesta: 'El modelo local no lee adjuntos, señor. Eso necesita conexión.', modo_local: true })); return; }
      responder(texto).then(function (t) {
        if (!parado) ok(json({ respuesta: t, modo_local: true }));
      }).catch(function (e) {
        if (!parado) ok(json({ respuesta: 'Sin conexión, señor. ' + ((e && e.message) || 'El modelo local no respondió.'), modo_local: true }));
      });
    });
  }

  function leer(opts) {
    try {
      var b = JSON.parse(opts.body);
      return { texto: String(b.mensaje || ''), adj: !!(b.adjuntos && b.adjuntos.length) };
    } catch (e) { return { texto: '', adj: false }; }
  }
  function sinLocal(opts) {
    return Object.assign({}, opts, { headers: Object.assign({}, opts.headers, { 'X-Modelo': '' }) });
  }
  function sonda() {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, 4000);
    return fetchBase.call(window, '/manifest.json', { cache: 'no-store', signal: c.signal })
      .then(function (r) { clearTimeout(t); return r.ok; }, function () { clearTimeout(t); return false; });
  }

  window.fetch = function (url, opts) {
    if (url !== '/chat' || !opts || opts.method !== 'POST') return fetchBase.apply(this, arguments);
    var m = leer(opts), sg = opts.signal, manual = ver('jarvisModelo') === 'local';
    if (!L) return fetchBase.call(this, url, manual ? sinLocal(opts) : opts);
    if (manual || navigator.onLine === false) return enLocal(m.texto, m.adj, sg);
    if (ver(K_AUTO) === '0') return fetchBase.apply(this, arguments);
    /* Automatico: si la conexion falla o el servidor no contesta, responde el modelo local. */
    var corte = new AbortController(), cortado = false, llego = false;
    if (sg) sg.addEventListener('abort', function () { corte.abort(); });
    var espera = setTimeout(function () {
      sonda().then(function (vive) { if (!vive && !llego) { cortado = true; corte.abort(); } });
    }, 12000);
    return fetchBase.call(this, url, Object.assign({}, opts, { signal: corte.signal })).then(function (res) {
      llego = true;
      clearTimeout(espera);
      if (res.status === 502 || res.status === 503 || res.status === 504) return enLocal(m.texto, m.adj, sg);
      return res;
    }, function (e) {
      clearTimeout(espera);
      if (sg && sg.aborted && !cortado) throw e;
      return enLocal(m.texto, m.adj, sg);
    });
  };

  window.modoLocal = {
    disponible: function () { return !!L; },
    auto: function () { return ver(K_AUTO) !== '0'; },
    ponerAuto: function (on) { poner(K_AUTO, on ? '1' : '0'); }
  };
})();
