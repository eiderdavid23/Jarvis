/* Tarjeta de descarga para los PDF que crea Jarvis (herramienta crear_pdf). */
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.tarjetaPdf{align-self:stretch;margin:0 0 6px 44px;max-width:420px;border:1px solid var(--linea,rgba(0,229,255,.2));' +
    'border-radius:16px;background:var(--panel,#0b111b);overflow:hidden;animation:subir .38s both}' +
    '.tarjetaPdf .pdFila{display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;width:100%;' +
    'background:none;border:0;font:inherit;color:var(--texto,#e6f7fb);text-align:left}' +
    '.tarjetaPdf .pdFila:active{background:rgba(127,127,127,.12)}' +
    '.tarjetaPdf .pdIcono{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;' +
    'background:rgba(212,160,23,.16);color:#d4a017}' +
    '.tarjetaPdf .pdTxt{flex:1;min-width:0;line-height:1.3}' +
    '.tarjetaPdf .pdTxt b{display:block;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.tarjetaPdf .pdTxt small{font-size:12px;color:var(--suave,#8fb4bf)}' +
    '.tarjetaPdf .pdBajar{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;' +
    'background:var(--cian,#00e5ff);color:#06121a}';
  document.head.appendChild(css);

  var SVG_DOC = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>' +
    '<path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';
  var SVG_BAJAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';

  function bytes(b64) {
    var bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function enlace(url, nombre) {
    var l = document.createElement('a');
    l.href = url;
    l.download = nombre;
    document.body.appendChild(l);
    l.click();
    l.remove();
  }

  function descargar(p) {
    if (p.url) {
      var url = location.origin + p.url, cap = window.Capacitor;
      var B = cap && cap.Plugins && cap.Plugins.Browser;
      if (cap && cap.isNativePlatform && cap.isNativePlatform() && B) { B.open({ url: url }); return; }
      enlace(url, p.archivo);
      return;
    }
    if (!p.datos) return;
    var u = URL.createObjectURL(new Blob([bytes(p.datos)], { type: 'application/pdf' }));
    enlace(u, p.archivo);
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }

  function el(tag, clase, html) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (html) e.innerHTML = html;
    return e;
  }

  function tarjeta(p) {
    var caja = el('div', 'tarjetaPdf');
    var fila = el('button', 'pdFila');
    fila.type = 'button';
    var tx = el('span', 'pdTxt');
    var b = el('b');
    b.textContent = p.archivo;
    var sm = el('small');
    var pag = p.paginas ? p.paginas + (p.paginas === 1 ? ' página' : ' páginas') + ' \u00b7 ' : '';
    sm.textContent = 'PDF \u00b7 ' + pag + Math.max(1, Math.round(p.bytes / 1024)) + ' KB';
    tx.appendChild(b);
    tx.appendChild(sm);
    fila.appendChild(el('span', 'pdIcono', SVG_DOC));
    fila.appendChild(tx);
    fila.appendChild(el('span', 'pdBajar', SVG_BAJAR));
    fila.addEventListener('click', function () { descargar(p); });
    caja.appendChild(fila);
    return caja;
  }

  window.mostrarPdf = function (lista) {
    if (!Array.isArray(lista) || !lista.length) return;
    var cont = document.getElementById('chatInner');
    if (!cont) return;
    lista.forEach(function (p) {
      if (p && (p.url || p.datos)) cont.appendChild(tarjeta(p));
    });
    if (typeof bajarChat === 'function') bajarChat();
  };
})();
