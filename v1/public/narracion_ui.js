/* Interruptor de narracion tecnica en vivo */
(function () {
  function on() { try { return localStorage.getItem('jarvisNarracion') !== '0'; } catch (e) { return true; } }
  window.narracionOn = on;
  function montar() {
    const cont = document.getElementById('tabHerramientas');
    if (!cont || document.getElementById('filaNarracion')) return;
    const d = document.createElement('div');
    d.className = 'filaSwitch';
    d.id = 'filaNarracion';
    d.style.marginTop = '16px';
    d.innerHTML = '<span>Narración técnica en vivo<br>' +
      '<small style="opacity:.6">Muestra cada paso con su URL y su código</small></span>' +
      '<input type="checkbox" id="chkNarracion">';
    cont.appendChild(d);
    const chk = d.querySelector('#chkNarracion');
    chk.checked = on();
    chk.addEventListener('change', () => {
      try { localStorage.setItem('jarvisNarracion', chk.checked ? '1' : '0'); } catch (e) {}
    });
  }
  const t = setInterval(() => {
    if (document.getElementById('tabHerramientas')) { montar(); clearInterval(t); }
  }, 400);
})();
