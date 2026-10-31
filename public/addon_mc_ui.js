/* Tarjeta de descarga de add-ons de Minecraft (.mcaddon) dentro del chat. */
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.tarjetaAd{align-self:stretch;margin:0 0 4px 44px;padding:12px;border:1px solid var(--borde,rgba(0,229,255,.25));' +
    'border-radius:16px;background:var(--panel,rgba(8,16,26,.85));max-width:420px;animation:subir .38s both}' +
    '.tarjetaAd h4{margin:0 0 2px;font-size:14px;font-weight:600;color:var(--texto,#e6f7fb)}' +
    '.tarjetaAd .adSub{font-size:12px;color:var(--suave,#8fb4bf);margin-bottom:8px}' +
    '.tarjetaAd .adRutas{font:11px/1.5 ui-monospace,monospace;color:var(--suave,#8fb4bf);margin:0 0 10px;' +
    'max-height:84px;overflow:auto;white-space:pre-wrap;word-break:break-all}' +
    '.tarjetaAd .adBtns{display:flex;gap:8px;flex-wrap:wrap}' +
    '.tarjetaAd button{font:600 14px system-ui,sans-serif;padding:10px 16px;border-radius:12px;cursor:pointer;' +
    'border:1.5px solid var(--cian,#00e5ff);background:transparent;color:var(--cian,#00e5ff)}' +
    '.tarjetaAd button.pri{background:var(--cian,#00e5ff);color:#06121a}';
  document.head.appendChild(css);

  function bytes(b64) {
    var bin = atob(b64);
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function tarjeta(a) {
    var u8 = bytes(a.datos);
    var blob = new Blob([u8], { type: 'application/octet-stream' });
    var caja = document.createElement('div');
    caja.className = 'tarjetaAd';
    var h = document.createElement('h4');
    h.textContent = 'Add-on: ' + a.nombre;
    var sub = document.createElement('div');
    sub.className = 'adSub';
    sub.textContent = a.archivo + ' \u00b7 ' + a.n + ' archivos \u00b7 ' + Math.max(1, Math.round(a.bytes / 1024)) + ' KB \u00b7 Bedrock';
    var rutas = document.createElement('pre');
    rutas.className = 'adRutas';
    rutas.textContent = (a.rutas || []).join('\n');
    var fila = document.createElement('div');
    fila.className = 'adBtns';
    var bajar = document.createElement('button');
    bajar.type = 'button';
    bajar.className = 'pri';
    bajar.textContent = 'Descargar y abrir en Minecraft';
    bajar.addEventListener('click', function () {
      var url = URL.createObjectURL(blob);
      var l = document.createElement('a');
      l.href = url;
      l.download = a.archivo;
      document.body.appendChild(l);
      l.click();
      l.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    });
    fila.appendChild(bajar);
    try {
      var f = new File([u8], a.archivo, { type: 'application/octet-stream' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        var comp = document.createElement('button');
        comp.type = 'button';
        comp.textContent = 'Compartir';
        comp.addEventListener('click', function () {
          navigator.share({ files: [f], title: a.nombre }).catch(function () {});
        });
        fila.appendChild(comp);
      }
    } catch (e) {}
    caja.appendChild(h);
    caja.appendChild(sub);
    caja.appendChild(rutas);
    caja.appendChild(fila);
    return caja;
  }

  window.mostrarAddonMc = function (lista) {
    if (!Array.isArray(lista) || !lista.length) return;
    var cont = document.getElementById('chatInner');
    if (!cont) return;
    lista.forEach(function (a) {
      if (a && a.datos) cont.appendChild(tarjeta(a));
    });
    if (typeof bajarChat === 'function') bajarChat();
  };
})();
