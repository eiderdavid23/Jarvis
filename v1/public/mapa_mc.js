/* Mapa de estructuras de Minecraft dentro del chat: radar con el jugador al centro (norte arriba)
   y una lista tocable. Los datos los calcula el servidor con el motor SeedFinder. */
(function () {
  var COLORES = { 5: '#4ade80', 1: '#fbbf24', 2: '#34d399', 3: '#a78bfa', 4: '#bae6fd', 6: '#38bdf8',
    7: '#60a5fa', 8: '#2dd4bf', 9: '#f87171', 10: '#fb923c', 11: '#c084fc', 12: '#e879f9',
    13: '#818cf8', 14: '#facc15', 15: '#a8a29e', 23: '#d6a77a', 24: '#f472b6' };

  var css = document.createElement('style');
  css.textContent =
    '.tarjetaMc{align-self:stretch;margin:0 0 4px 44px;padding:12px;border:1px solid var(--borde,rgba(0,229,255,.25));' +
    'border-radius:16px;background:var(--panel,rgba(8,16,26,.85));max-width:420px;animation:subir .38s both}' +
    '.tarjetaMc h4{margin:0 0 2px;font-size:14px;font-weight:600;color:var(--texto,#e6f7fb)}' +
    '.tarjetaMc .mcSub{font-size:12px;color:var(--suave,#8fb4bf);margin-bottom:8px}' +
    '.tarjetaMc canvas{display:block;width:100%;aspect-ratio:1/1;border-radius:12px}' +
    '.mcLista{margin-top:10px;display:flex;flex-direction:column;gap:6px}' +
    '.mcFila{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;cursor:pointer;' +
    'background:rgba(127,127,127,.1);border:1px solid transparent;font:inherit;color:var(--texto,#e6f7fb);text-align:left;width:100%}' +
    '.mcFila:active{border-color:var(--cian,#00e5ff)}' +
    '.mcNum{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;color:#06121a}' +
    '.mcTxt{flex:1;min-width:0;line-height:1.3}.mcTxt b{display:block;font-size:14px;font-weight:600}' +
    '.mcTxt small{font-size:12px;color:var(--suave,#8fb4bf)}' +
    '.mcCopia{flex:none;font-size:11px;color:var(--suave,#8fb4bf)}' +
    '.mcPie{margin-top:8px;font-size:11px;color:var(--suave,#8fb4bf)}';
  document.head.appendChild(css);

  function bonito(n) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0).replace('.0', '') + 'k' : String(n); }
  function nice(v) {
    var pasos = [250, 500, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000, 15000, 20000];
    for (var i = 0; i < pasos.length; i++) if (v <= pasos[i]) return pasos[i];
    return Math.ceil(v / 5000) * 5000;
  }
  function copiar(texto) {
    function respaldo() {
      var t = document.createElement('textarea');
      t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t);
      return Promise.resolve();
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).catch(respaldo);
    } catch (e) {}
    return respaldo();
  }

  function dibujar(cv, d) {
    var cs = getComputedStyle(document.body);
    var cian = (cs.getPropertyValue('--cian') || '#00e5ff').trim() || '#00e5ff';
    var suave = (cs.getPropertyValue('--suave') || '#8fb4bf').trim() || '#8fb4bf';
    var claro = document.documentElement.getAttribute('data-tema') === 'claro';
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var W = cv.clientWidth || 320;
    cv.width = W * dpr; cv.height = W * dpr;
    var c = cv.getContext('2d');
    c.scale(dpr, dpr);
    var cx = W / 2, cy = W / 2, margen = 26;
    var maxD = d.estructuras.reduce(function (m, s) { return Math.max(m, s.distancia); }, 0);
    var R = nice(Math.max(maxD * 1.1, 250));
    var k = (W / 2 - margen) / R;

    c.fillStyle = claro ? '#eef5f8' : '#07101a';
    c.fillRect(0, 0, W, W);
    c.strokeStyle = claro ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.12)';
    c.fillStyle = suave; c.font = '11px system-ui, sans-serif'; c.textAlign = 'left'; c.lineWidth = 1;
    [1 / 3, 2 / 3, 1].forEach(function (f) {
      c.beginPath(); c.arc(cx, cy, R * f * k, 0, Math.PI * 2); c.stroke();
      c.fillText(bonito(Math.round(R * f)), cx + 4, cy - R * f * k + 12);
    });
    c.beginPath(); c.moveTo(cx, cy - R * k); c.lineTo(cx, cy + R * k);
    c.moveTo(cx - R * k, cy); c.lineTo(cx + R * k, cy); c.stroke();
    c.textAlign = 'center';
    c.fillText('N', cx, 14); c.fillText('S', cx, W - 6); c.fillText('O', 10, cy + 4); c.fillText('E', W - 10, cy + 4);

    d.estructuras.forEach(function (s) {
      var px = cx + (s.x - d.jugador.x) * k, pz = cy + (s.z - d.jugador.z) * k;
      c.beginPath(); c.arc(px, pz, 11, 0, Math.PI * 2);
      c.fillStyle = COLORES[s.id] || '#e5e7eb'; c.fill();
      c.lineWidth = 2; c.strokeStyle = claro ? '#fff' : '#07101a'; c.stroke();
      c.fillStyle = '#06121a'; c.font = 'bold 12px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText(String(s.n), px, pz + 4);
    });
    c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2);
    c.fillStyle = cian; c.shadowColor = cian; c.shadowBlur = 12; c.fill(); c.shadowBlur = 0;
    c.lineWidth = 2; c.strokeStyle = claro ? '#fff' : '#07101a'; c.stroke();
  }

  window.mostrarMapaMc = function (d) {
    if (!d || !Array.isArray(d.estructuras) || !d.estructuras.length || !d.jugador) return;
    var caja = document.createElement('div');
    caja.className = 'tarjetaMc';
    var ed = d.edicion === 'java' ? 'Java' : 'Bedrock';
    caja.innerHTML = '<h4>Mapa de estructuras</h4><div class="mcSub"></div><canvas></canvas><div class="mcLista"></div>' +
      '<div class="mcPie">Predicción por semilla; en el juego puede variar un poco. Motor: SeedFinder y cubiomes.</div>';
    caja.querySelector('.mcSub').textContent = ed + ' · semilla ' + d.semilla + ' · tú en X ' + d.jugador.x + ', Z ' + d.jugador.z;
    var lista = caja.querySelector('.mcLista');
    d.estructuras.forEach(function (s) {
      var f = document.createElement('button');
      f.type = 'button'; f.className = 'mcFila';
      var n = document.createElement('span'); n.className = 'mcNum'; n.textContent = s.n;
      n.style.background = COLORES[s.id] || '#e5e7eb';
      var t = document.createElement('span'); t.className = 'mcTxt';
      var b = document.createElement('b'); b.textContent = s.tipo.charAt(0).toUpperCase() + s.tipo.slice(1);
      var sm = document.createElement('small');
      sm.textContent = 'X ' + s.x + ', Z ' + s.z + ' · a ' + s.distancia + ' bloques al ' + s.direccion;
      t.appendChild(b); t.appendChild(sm);
      var cp = document.createElement('span'); cp.className = 'mcCopia'; cp.textContent = 'copiar';
      f.appendChild(n); f.appendChild(t); f.appendChild(cp);
      f.addEventListener('click', function () {
        copiar(s.x + ' ' + s.z).then(function () {
          cp.textContent = 'copiado';
          setTimeout(function () { cp.textContent = 'copiar'; }, 1400);
        });
      });
      lista.appendChild(f);
    });
    var cont = document.getElementById('chatInner');
    if (!cont) return;
    cont.appendChild(caja);
    dibujar(caja.querySelector('canvas'), d);
    if (typeof bajarChat === 'function') bajarChat();
  };
})();
