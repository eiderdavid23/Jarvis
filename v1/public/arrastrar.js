/* Arrastrar archivos al chat para adjuntarlos (usa agregarArchivos de index.html) */
(function () {
  'use strict';
  var nivel = 0;
  var velo = null;
  function tieneArchivos(e) {
    var t = e.dataTransfer && e.dataTransfer.types;
    if (!t) return false;
    for (var i = 0; i < t.length; i++) if (t[i] === 'Files') return true;
    return false;
  }
  function crearVelo() {
    if (velo) return velo;
    var st = document.createElement('style');
    st.textContent = '#arrVelo{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);pointer-events:none}'
      + '#arrVelo.on{display:flex}'
      + '#arrVelo div{border:2px dashed #3cd9f2;border-radius:22px;padding:34px 44px;color:#e6edf3;font:500 18px system-ui,sans-serif;text-align:center;background:rgba(14,21,32,.85)}'
      + '#arrVelo small{display:block;margin-top:6px;color:#8fa3b5;font-size:13px}';
    document.head.appendChild(st);
    velo = document.createElement('div');
    velo.id = 'arrVelo';
    velo.innerHTML = '<div>Suelta aquí para adjuntar<small>Imágenes, PDF, ZIP, texto o código</small></div>';
    document.body.appendChild(velo);
    return velo;
  }
  function mostrar(si) { crearVelo().classList.toggle('on', si); }

  window.addEventListener('dragenter', function (e) {
    if (!tieneArchivos(e)) return;
    e.preventDefault();
    nivel++;
    mostrar(true);
  });
  window.addEventListener('dragover', function (e) {
    if (!tieneArchivos(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', function (e) {
    if (!tieneArchivos(e)) return;
    nivel = Math.max(0, nivel - 1);
    if (nivel === 0) mostrar(false);
  });
  window.addEventListener('drop', function (e) {
    if (!tieneArchivos(e)) return;
    e.preventDefault();
    nivel = 0;
    mostrar(false);
    var lista = Array.prototype.slice.call(e.dataTransfer.files || []);
    if (!lista.length) return;
    try {
      if (typeof agregarArchivos === 'function') agregarArchivos(lista);
    } catch (err) { /* sin chat disponible */ }
  });
  window.addEventListener('blur', function () { nivel = 0; if (velo) mostrar(false); });
})();
