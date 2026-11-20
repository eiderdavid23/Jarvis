/* Boton de descarga para los archivos que entrega crear_archivo */
(function () {
  window.mostrarArchivo = function (lista) {
    (Array.isArray(lista) ? lista : []).forEach(function (a) {
      if (!a || !a.contenido) return;
      var caja = document.createElement('div');
      caja.className = 'tarjetaImg';
      caja.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 14px;';
      var nom = document.createElement('span');
      nom.textContent = a.nombre || 'archivo';
      nom.style.cssText = 'flex:1;font-family:ui-monospace,monospace;font-size:13px;overflow:hidden;text-overflow:ellipsis;';
      var b = document.createElement('a');
      b.textContent = 'Descargar';
      b.style.cssText = 'color:var(--cian);font-size:13px;font-weight:600;text-decoration:none;flex:none;';
      b.download = a.nombre || 'archivo';
      var blob = new Blob([a.contenido], { type: 'text/plain;charset=utf-8' });
      b.href = URL.createObjectURL(blob);
      caja.appendChild(nom);
      caja.appendChild(b);
      document.getElementById('chatInner').appendChild(caja);
      if (window.bajarChat) window.bajarChat();
    });
  };
})();
