/* Tarjeta de archivo para los add-ons de Minecraft (.mcaddon) dentro del chat. */
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.tarjetaAd{align-self:stretch;margin:0 0 6px 44px;max-width:420px;border:1px solid var(--linea,rgba(0,229,255,.2));' +
    'border-radius:16px;background:var(--panel,#0b111b);overflow:hidden;animation:subir .38s both}' +
    '.tarjetaAd .adFila{display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;width:100%;' +
    'background:none;border:0;font:inherit;color:var(--texto,#e6f7fb);text-align:left}' +
    '.tarjetaAd .adFila:active{background:rgba(127,127,127,.12)}' +
    '.tarjetaAd .adIcono{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;' +
    'background:rgba(0,229,255,.12);color:var(--cian,#00e5ff)}' +
    '.tarjetaAd .adTxt{flex:1;min-width:0;line-height:1.3}' +
    '.tarjetaAd .adTxt b{display:block;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.tarjetaAd .adTxt small{font-size:12px;color:var(--suave,#8fb4bf)}' +
    '.tarjetaAd .adBajar{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;' +
    'background:var(--cian,#00e5ff);color:#06121a}' +
    '.tarjetaAd details{border-top:1px solid var(--linea,rgba(0,229,255,.2));padding:8px 14px;font-size:12px;color:var(--suave,#8fb4bf)}' +
    '.tarjetaAd summary{cursor:pointer;list-style:none}' +
    '.tarjetaAd pre{margin:8px 0 0;font:11px/1.6 ui-monospace,monospace;white-space:pre-wrap;word-break:break-all;max-height:110px;overflow:auto}' +
    '.tarjetaAd .adPie{padding:0 14px 10px;font-size:11px;color:var(--suave,#8fb4bf)}';
  document.head.appendChild(css);

  var SVG_CAJA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>';
  var SVG_BAJAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';

  function bytes(b64) {
    var bin = atob(b64);
    var u8 = new Uint8Array(bin.length);
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

  function descargar(a) {
    if (a.url) {
      var url = location.origin + a.url;
      var cap = window.Capacitor;
      var B = cap && cap.Plugins && cap.Plugins.Browser;
      if (cap && cap.isNativePlatform && cap.isNativePlatform() && B) { B.open({ url: url }); return; }
      enlace(url, a.archivo);
      return;
    }
    if (!a.datos) return;
    var blob = new Blob([bytes(a.datos)], { type: 'application/octet-stream' });
    var u = URL.createObjectURL(blob);
    enlace(u, a.archivo);
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }

  function tarjeta(a) {
    var caja = document.createElement('div');
    caja.className = 'tarjetaAd';
    var fila = document.createElement('button');
    fila.type = 'button';
    fila.className = 'adFila';
    var ic = document.createElement('span');
    ic.className = 'adIcono';
    ic.innerHTML = SVG_CAJA;
    var tx = document.createElement('span');
    tx.className = 'adTxt';
    var b = document.createElement('b');
    b.textContent = a.archivo;
    var sm = document.createElement('small');
    sm.textContent = 'Add-on de Minecraft \u00b7 MCADDON \u00b7 ' + Math.max(1, Math.round(a.bytes / 1024)) + ' KB';
    tx.appendChild(b);
    tx.appendChild(sm);
    var bj = document.createElement('span');
    bj.className = 'adBajar';
    bj.innerHTML = SVG_BAJAR;
    fila.appendChild(ic);
    fila.appendChild(tx);
    fila.appendChild(bj);
    fila.addEventListener('click', function () { descargar(a); });
    caja.appendChild(fila);
    var det = document.createElement('details');
    var sum = document.createElement('summary');
    sum.textContent = 'Ver archivos (' + a.n + ')';
    var pre = document.createElement('pre');
    pre.textContent = (a.rutas || []).join('\n');
    det.appendChild(sum);
    det.appendChild(pre);
    caja.appendChild(det);
    var pie = document.createElement('div');
    pie.className = 'adPie';
    pie.textContent = 'Toca para descargar y luego abre el archivo: se importa en Minecraft Bedrock.';
    caja.appendChild(pie);
    return caja;
  }

  window.mostrarAddonMc = function (lista) {
    if (!Array.isArray(lista) || !lista.length) return;
    var cont = document.getElementById('chatInner');
    if (!cont) return;
    lista.forEach(function (a) {
      if (a && (a.url || a.datos)) cont.appendChild(tarjeta(a));
    });
    if (typeof bajarChat === 'function') bajarChat();
  };
})();
