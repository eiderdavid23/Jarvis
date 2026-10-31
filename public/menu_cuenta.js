/* Pie del sidebar: al tocar tu nombre se abre Ajustes directo (sin menu flotante).
   "Mi memoria" vive dentro de Ajustes (#tabMemoria, #mmLista, #mmTodo). */
(function () {
  var pie = document.getElementById('sbPie');
  if (!pie) return;

  var CHEV = '<svg class="mcChev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
  function ponerChev() {
    if (pie.querySelector('.mcChev')) return;
    pie.insertAdjacentHTML('beforeend', CHEV);
  }
  ponerChev();
  new MutationObserver(ponerChev).observe(pie, { childList: true });

  pie.addEventListener('click', function (e) {
    if (e.target.closest('.syBtn')) return; /* el click de Cerrar sesion no debe reabrir Ajustes */
    if (typeof cerrarSidebar === 'function') cerrarSidebar();
    if (typeof abrirAjustes === 'function') abrirAjustes();
  });

  /* ---------- Mi memoria (dentro de Ajustes) ---------- */
  var lista = document.getElementById('mmLista');
  var btnTodo = document.getElementById('mmTodo');
  var tabMem = document.querySelector('.tabAjuste[data-tab="memoria"]');
  if (!lista || !btnTodo) return;
  var confirmando = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }
  function pintar(filas) {
    if (!filas.length) {
      lista.innerHTML = '<div class="mmVacio">Aún no recuerdo nada de usted. Cuénteme algo en un chat y lo guardaré.</div>';
      btnTodo.hidden = true;
      return;
    }
    lista.innerHTML = filas.map(function (f) {
      return '<div class="mmFila"><div class="mmTxt"><b>' + esc(String(f.clave).replace(/_/g, ' ')) + '</b><span>' + esc(f.valor) + '</span></div>'
        + '<button class="mmDel" data-clave="' + esc(f.clave) + '" aria-label="Borrar">&times;</button></div>';
    }).join('');
    btnTodo.hidden = false;
  }
  function cargar() {
    reiniciarTodo();
    lista.innerHTML = '<div class="mmVacio">Cargando…</div>';
    btnTodo.hidden = true;
    fetch('/memorias').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(pintar)
      .catch(function () { lista.innerHTML = '<div class="mmVacio">No pude cargar su memoria. Intente de nuevo.</div>'; });
  }
  function borrar(cuerpo) {
    return fetch('/memorias', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { if (!r.ok) throw 0; });
  }
  lista.addEventListener('click', function (e) {
    var b = e.target.closest('.mmDel');
    if (!b) return;
    var fila = b.closest('.mmFila');
    borrar({ clave: b.dataset.clave }).then(function () {
      fila.remove();
      if (!lista.querySelector('.mmFila')) pintar([]);
    }).catch(cargar);
  });

  function reiniciarTodo() {
    clearTimeout(confirmando);
    confirmando = null;
    btnTodo.textContent = 'Borrar todo';
  }
  btnTodo.addEventListener('click', function () {
    if (!confirmando) {
      btnTodo.textContent = 'Toque otra vez para confirmar';
      confirmando = setTimeout(reiniciarTodo, 3500);
      return;
    }
    reiniciarTodo();
    borrar({ todo: true }).then(function () { pintar([]); }).catch(cargar);
  });
  if (tabMem) tabMem.addEventListener('click', cargar);
})();
