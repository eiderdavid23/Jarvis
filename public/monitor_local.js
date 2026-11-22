/* Monitor en vivo del modelo local (solo APK): RAM, CPU, tokens/s y temperatura, junto a la pildora del modelo.
   Lee LlamaLocal.recursos() cada segundo y medio y solo mientras el modelo esta encendido y la app a la vista. */
(function () {
  'use strict';
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var L = (cap.Plugins || {}).LlamaLocal || (cap.registerPlugin && cap.registerPlugin('LlamaLocal'));
  if (!L || !L.recursos) return;

  var fila = null, chip = null, pop = null, d = null, timer = null, abierto = false;
  var t0 = 0, nTok = 0, tps = 0, ultTok = 0;

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function gb(mb) { return (Math.round(mb / 1024 * 10) / 10).toFixed(1); }
  function color(p) { return p >= 90 ? '#ff5a5f' : p >= 70 ? '#f5b400' : ''; }

  function crear() {
    var pil = document.getElementById('pildora');
    if (!pil) return false;
    fila = document.getElementById('filaControles');
    chip = el('button', null);
    chip.id = 'mlChip';
    chip.type = 'button';
    chip.setAttribute('aria-label', 'Recursos del modelo local');
    chip.innerHTML = '<span class="mlL">RAM <b id="mlRam">-</b></span><span class="mlB"><i id="mlRamB"></i></span>' +
      '<span class="mlL">CPU <b id="mlCpu">-</b></span><span class="mlB"><i id="mlCpuB"></i></span>';
    pil.parentNode.insertBefore(chip, pil.nextSibling);
    pop = el('div', null);
    pop.id = 'mlPop';
    document.body.appendChild(pop);
    chip.addEventListener('click', function (e) { e.stopPropagation(); abierto = !abierto; detalle(); });
    document.addEventListener('click', function () { if (abierto) { abierto = false; detalle(); } });
    return true;
  }

  function barra(id, pct) {
    var b = document.getElementById(id);
    if (!b) return;
    b.style.width = Math.max(2, Math.min(100, pct)) + '%';
    b.style.background = color(pct);
  }

  function pintar() {
    if (!chip) return;
    var on = !!(d && d.activo);
    fila.classList.toggle('mlOn', on);
    if (!on) { abierto = false; pop.style.display = 'none'; return; }
    var pRam = d.ramTotalMb ? d.ramModeloMb * 100 / d.ramTotalMb : 0;
    var gen = Date.now() - ultTok < 1500;
    chip.classList.toggle('mlGen', gen);
    document.getElementById('mlRam').textContent = gb(d.ramModeloMb) + ' GB';
    document.getElementById('mlCpu').textContent = gen && tps > 0 ? tps.toFixed(1) + ' t/s' : Math.round(d.cpuPct) + '%';
    barra('mlRamB', pRam);
    barra('mlCpuB', d.cpuPct);
    if (abierto) detalle();
  }

  function detalle() {
    if (!pop) return;
    if (!abierto || !d || !d.activo) { pop.style.display = 'none'; return; }
    var usado = d.ramTotalMb - d.ramLibreMb;
    var pSis = d.ramTotalMb ? Math.round(usado * 100 / d.ramTotalMb) : 0;
    pop.textContent = '';
    pop.appendChild(el('div', 'mlT', 'Modelo local en vivo'));
    [
      ['RAM del modelo', gb(d.ramModeloMb) + ' GB de ' + gb(d.ramTotalMb) + ' GB'],
      ['RAM del celular', gb(usado) + ' GB usados (' + pSis + '%)'],
      ['RAM libre', gb(d.ramLibreMb) + ' GB'],
      ['CPU del modelo', Math.round(d.cpuPct) + '%'],
      ['Velocidad', tps > 0 && Date.now() - ultTok < 4000 ? tps.toFixed(1) + ' tokens/s' : 'en reposo'],
      ['Temperatura', d.tempC > 0 ? d.tempC.toFixed(1) + ' \u00b0C' : 'n/d']
    ].forEach(function (f) {
      var r = el('div', 'mlF');
      r.appendChild(el('span', null, f[0]));
      r.appendChild(el('b', null, f[1]));
      pop.appendChild(r);
    });
    if (usado * 100 / d.ramTotalMb >= 90) pop.appendChild(el('div', 'mlN', 'Poca RAM libre: cierra apps o usa un modelo mas chico.'));
    else if (d.tempC >= 42) pop.appendChild(el('div', 'mlN', 'El celular esta caliente: deja descansar el modelo.'));
    pop.style.display = 'block';
    var r2 = chip.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r2.left)) + 'px';
    pop.style.top = Math.max(8, r2.top - h - 8) + 'px';
  }

  function leer() {
    if (document.hidden) return;
    L.recursos().then(function (r) { d = r; pintar(); }).catch(function () { /* sin datos */ });
  }
  function ciclo() {
    clearInterval(timer);
    timer = setInterval(leer, d && d.activo ? 1500 : 4000);
  }

  /* Tokens por segundo: se cuentan los tokens que llegan y se promedian en ventanas de ~1 s. */
  L.addListener('token', function () {
    var ahora = Date.now();
    if (ahora - ultTok > 1500) { t0 = ahora; nTok = 0; }
    nTok++;
    ultTok = ahora;
    if (ahora - t0 >= 1000) { tps = nTok * 1000 / (ahora - t0); t0 = ahora; nTok = 0; pintar(); }
  });

  function iniciar() {
    var n = 0;
    var w = setInterval(function () {
      n++;
      if (crear()) { clearInterval(w); leer(); ciclo(); setInterval(function () { var a = !!(d && d.activo); if (a !== ciclo.a) { ciclo.a = a; ciclo(); } }, 2000); }
      else if (n > 40) clearInterval(w);
    }, 500);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) leer(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
