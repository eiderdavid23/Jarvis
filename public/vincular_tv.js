/* Vincular una TV (Android TV) con Jarvis: crea el token que usa agente_tv.py en Termux. */
(function () {
  var css = document.createElement('style');
  css.textContent = '.tvCaja{margin:6px 12px 10px;padding:12px;border-radius:12px;border:1px solid rgba(0,229,255,.25);background:rgba(0,229,255,.05);font-size:13px}' +
    '.tvCaja b{display:block;margin-bottom:4px}.tvAyuda{opacity:.75;line-height:1.4;margin-bottom:8px}' +
    '.tvBtn{width:100%;padding:10px;margin-top:6px;border-radius:10px;border:1px solid rgba(0,229,255,.35);background:rgba(0,229,255,.1);color:inherit;font:inherit;cursor:pointer}' +
    '.tvCmd{width:100%;box-sizing:border-box;margin-top:6px;padding:8px;border-radius:8px;border:1px solid rgba(0,229,255,.25);background:rgba(0,0,0,.25);color:inherit;font:12px monospace;resize:none}';
  document.head.appendChild(css);

  function json(r) {
    return r.json().then(function (d) {
      if (!r.ok) throw new Error(d.error || d.respuesta || 'No se pudo vincular la TV.');
      return d;
    });
  }

  function montar() {
    var antes = document.getElementById('pcCaja') || document.getElementById('hrCont');
    if (!antes || document.getElementById('tvCaja')) return !!antes;
    var caja = document.createElement('div');
    caja.className = 'tvCaja';
    caja.id = 'tvCaja';
    var t = document.createElement('b');
    t.textContent = 'Controlar una TV';
    var ayuda = document.createElement('div');
    ayuda.className = 'tvAyuda';
    ayuda.textContent = 'Para una Android TV o Google TV. Jarvis sube o baja el volumen, abre apps, pulsa el control y enciende o apaga. Necesitas Termux con agente_tv.py en un celular conectado al mismo WiFi que la TV.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tvBtn';
    btn.textContent = 'Vincular una TV';
    var cmd = document.createElement('textarea');
    cmd.className = 'tvCmd';
    cmd.rows = 4;
    cmd.readOnly = true;
    cmd.style.display = 'none';
    var copiar = document.createElement('button');
    copiar.type = 'button';
    copiar.className = 'tvBtn';
    copiar.textContent = 'Copiar comando';
    copiar.style.display = 'none';
    var nota = document.createElement('div');
    nota.className = 'tvAyuda';
    nota.style.marginTop = '6px';

    btn.addEventListener('click', function () {
      var n = window.prompt('¿Cómo quieres llamar a esta TV? (ej. TV de la sala)', 'TV');
      if (n === null) return;
      n = n.replace(/\s+/g, ' ').trim().slice(0, 40) || 'TV';
      var ip = window.prompt('IP de la TV en tu WiFi (ej. 10.0.0.43). Está en Ajustes de la TV > Red.', '');
      if (ip === null) return;
      ip = ip.trim();
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
        nota.textContent = 'Esa IP no parece válida. Debe ser como 10.0.0.43.';
        return;
      }
      btn.disabled = true;
      fetch('/manos/vincular', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: n, plataforma: 'tv' })
      }).then(json).then(function (d) {
        cmd.value = 'python agente_tv.py --ip ' + ip + ' --url ' + location.origin + ' --token ' + d.token;
        cmd.style.display = 'block';
        copiar.style.display = 'block';
        nota.textContent = 'Primero, una sola vez: python agente_tv.py --ip ' + ip + ' --emparejar (te sale un código en la TV). Luego ejecuta este comando en Termux. Es secreto: no lo compartas. Si lo pierdes, vuelve a vincular.';
        btn.disabled = false;
      }).catch(function (e) {
        nota.textContent = e.message;
        btn.disabled = false;
      });
    });
    copiar.addEventListener('click', function () {
      cmd.select();
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(cmd.value);
        else document.execCommand('copy');
        copiar.textContent = 'Copiado ✓';
      } catch (e) {}
    });
    [t, ayuda, btn, cmd, copiar, nota].forEach(function (e) { caja.appendChild(e); });
    antes.parentNode.insertBefore(caja, antes.nextSibling);
    return true;
  }

  var intentos = 0;
  var reloj = setInterval(function () {
    if (montar() || ++intentos > 40) clearInterval(reloj);
  }, 300);
})();
