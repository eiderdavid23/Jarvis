(function () {
  var script = document.currentScript;
  if (!script || window.__jarvisWidget) return;
  var botId = script.getAttribute('data-bot');
  if (!botId) { console.warn('Jarvis widget: falta data-bot'); return; }
  window.__jarvisWidget = true;

  var base = new URL(script.src).origin;
  var lado = script.getAttribute('data-pos') === 'left' ? 'left' : 'right';
  var cfg = null, historial = [], ocupado = false, abierto = false;

  var host = document.createElement('div');
  host.style.cssText = 'all:initial;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;position:fixed;z-index:2147483000;bottom:0;' + lado + ':0;';
  var raiz = host.attachShadow({ mode: 'open' });

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function colorTexto(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#1a1a1a' : '#fff';
  }

  function estilos(color) {
    var s = el('style');
    s.textContent =
      ':host{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
      '*{box-sizing:border-box}' +
      '.burbuja{position:fixed;bottom:16px;' + lado + ':16px;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;' +
      'background:' + color + ';color:' + colorTexto(color) + ';box-shadow:0 4px 14px rgba(0,0,0,.3);font-size:26px;line-height:1}' +
      '.panel{position:fixed;bottom:84px;' + lado + ':16px;width:340px;max-width:calc(100vw - 32px);height:480px;' +
      'max-height:calc(100vh - 110px);background:#fff;color:#1a1a1a;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.3);' +
      'display:none;flex-direction:column;overflow:hidden}' +
      '.panel.abierto{display:flex}' +
      '.cab{background:' + color + ';color:' + colorTexto(color) + ';padding:12px 14px;font-weight:600;display:flex;justify-content:space-between;align-items:center}' +
      '.cab button{background:none;border:0;color:inherit;font-size:20px;cursor:pointer;line-height:1}' +
      '.msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f5f6f8}' +
      '.m{max-width:85%;padding:8px 11px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}' +
      '.m.b{background:#fff;border:1px solid #e3e5e8;align-self:flex-start}' +
      '.m.u{background:' + color + ';color:' + colorTexto(color) + ';align-self:flex-end}' +
      '.m a{color:inherit;text-decoration:underline}' +
      '.chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;max-height:96px;overflow-y:auto;border-top:1px solid #e3e5e8;background:#fff}' +
      '.chip{border:1px solid ' + color + ';background:#fff;color:#1a1a1a;border-radius:16px;padding:5px 10px;font-size:13px;cursor:pointer}' +
      '.chip:disabled{opacity:.5;cursor:default}' +
      '.pie{display:flex;gap:6px;padding:8px 12px;border-top:1px solid #e3e5e8;background:#fff}' +
      '.pie input{flex:1;border:1px solid #cfd3d8;border-radius:18px;padding:8px 12px;font-size:16px;outline:none;color:#1a1a1a;background:#fff}' +
      '.pie button{border:0;border-radius:18px;padding:0 14px;cursor:pointer;background:' + color + ';color:' + colorTexto(color) + ';font-size:14px}' +
      '.pie button:disabled{opacity:.5;cursor:default}' +
      '.marca{text-align:center;font-size:11px;color:#8a8f98;padding:0 0 6px;background:#fff}';
    return s;
  }

  function agregarTexto(contenedor, texto) {
    var partes = String(texto).split(/(https?:\/\/[^\s]+)/g);
    partes.forEach(function (p) {
      if (/^https?:\/\//.test(p)) {
        var a = el('a', '', p);
        a.href = p; a.target = '_blank'; a.rel = 'noopener noreferrer';
        contenedor.appendChild(a);
      } else if (p) {
        contenedor.appendChild(document.createTextNode(p));
      }
    });
  }

  function construir() {
    raiz.appendChild(estilos(cfg.color));

    var burbuja = el('button', 'burbuja', '💬');
    burbuja.setAttribute('aria-label', 'Abrir chat de soporte');
    var panel = el('div', 'panel');
    var cab = el('div', 'cab');
    cab.appendChild(el('span', '', cfg.nombre));
    var cerrar = el('button', '', '×');
    cerrar.setAttribute('aria-label', 'Cerrar chat');
    cab.appendChild(cerrar);
    var msgs = el('div', 'msgs');
    var chips = el('div', 'chips');
    var pie = el('div', 'pie');
    var campo = el('input');
    campo.type = 'text'; campo.maxLength = 300; campo.placeholder = 'Escribe tu pregunta...';
    var enviar = el('button', '', 'Enviar');
    pie.appendChild(campo); pie.appendChild(enviar);
    panel.appendChild(cab); panel.appendChild(msgs);
    if (cfg.botones.length) panel.appendChild(chips);
    panel.appendChild(pie);
    panel.appendChild(el('div', 'marca', 'Asistente con tecnología de Jarvis'));
    raiz.appendChild(burbuja); raiz.appendChild(panel);

    function burbujaMsg(quien, texto) {
      var m = el('div', 'm ' + quien);
      agregarTexto(m, texto);
      msgs.appendChild(m);
      msgs.scrollTop = msgs.scrollHeight;
      return m;
    }

    function bloquear(v) {
      ocupado = v; campo.disabled = v; enviar.disabled = v;
      Array.prototype.forEach.call(chips.children, function (c) { c.disabled = v; });
    }

    function pedir(cuerpo, textoUsuario) {
      if (ocupado) return;
      burbujaMsg('u', textoUsuario);
      var escribiendo = burbujaMsg('b', '...');
      bloquear(true);
      cuerpo.bot = botId;
      fetch(base + '/widget/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo)
      }).then(function (r) { return r.json(); }).then(function (d) {
        var texto = d.respuesta || d.error || 'No pude responder.';
        escribiendo.textContent = '';
        agregarTexto(escribiendo, texto);
        historial.push({ r: 'u', t: textoUsuario }, { r: 'b', t: texto });
        historial = historial.slice(-4);
      }).catch(function () {
        escribiendo.textContent = 'No pude conectarme. Intenta de nuevo en un momento.';
      }).then(function () { bloquear(false); msgs.scrollTop = msgs.scrollHeight; });
    }

    function enviarTexto() {
      var t = campo.value.trim();
      if (!t || ocupado) return;
      campo.value = '';
      pedir({ mensaje: t, historial: historial }, t);
    }

    cfg.botones.forEach(function (b) {
      var c = el('button', 'chip', b.p);
      c.addEventListener('click', function () { pedir({ boton: b.i }, b.p); });
      chips.appendChild(c);
    });

    function alternar(v) {
      abierto = v;
      panel.classList.toggle('abierto', v);
      burbuja.textContent = v ? '×' : '💬';
      if (v && !msgs.children.length) burbujaMsg('b', cfg.saludo);
      if (v) campo.focus();
    }
    burbuja.addEventListener('click', function () { alternar(!abierto); });
    cerrar.addEventListener('click', function () { alternar(false); });
    enviar.addEventListener('click', enviarTexto);
    campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') enviarTexto(); });
    raiz.addEventListener('keydown', function (e) { if (e.key === 'Escape') alternar(false); });
  }

  function iniciar() {
    fetch(base + '/widget/config/' + encodeURIComponent(botId))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.nombre) return;
        cfg = d; cfg.botones = d.botones || [];
        document.body.appendChild(host);
        construir();
      })
      .catch(function () {});
  }

  if (document.body) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);
})();
