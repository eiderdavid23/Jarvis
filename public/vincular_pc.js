/* Vincular un PC con Jarvis: crea el token que usa agente_pc.py. Funciona en la web y en la app. */
(function () {
  var css = document.createElement('style');
  css.textContent = '.pcCaja{margin:6px 12px 10px;padding:12px;border-radius:12px;border:1px solid rgba(0,229,255,.25);background:rgba(0,229,255,.05);font-size:13px}' +
    '.pcCaja b{display:block;margin-bottom:4px}.pcAyuda{opacity:.75;line-height:1.4;margin-bottom:8px}' +
    '.pcBtn{width:100%;padding:10px;margin-top:6px;border-radius:10px;border:1px solid rgba(0,229,255,.35);background:rgba(0,229,255,.1);color:inherit;font:inherit;cursor:pointer}' +
    '.pcCmd{width:100%;box-sizing:border-box;margin-top:6px;padding:8px;border-radius:8px;border:1px solid rgba(0,229,255,.25);background:rgba(0,0,0,.25);color:inherit;font:12px monospace;resize:none}';
  document.head.appendChild(css);

  function json(r) {
    return r.json().then(function (d) {
      if (!r.ok) throw new Error(d.error || d.respuesta || 'No se pudo vincular el PC.');
      return d;
    });
  }

  function montar() {
    var cont = document.getElementById('hrCont');
    if (!cont || document.getElementById('pcCaja')) return !!cont;
    var caja = document.createElement('div');
    caja.className = 'pcCaja';
    caja.id = 'pcCaja';
    var t = document.createElement('b');
    t.textContent = 'Controlar un PC';
    var ayuda = document.createElement('div');
    ayuda.className = 'pcAyuda';
    ayuda.textContent = 'Vincula tu PC para que Jarvis abra programas, vea la pantalla, ajuste el volumen o mueva archivos. Necesitas Python en el PC.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pcBtn';
    btn.textContent = 'Vincular un PC';
    var cmd = document.createElement('textarea');
    cmd.className = 'pcCmd';
    cmd.rows = 4;
    cmd.readOnly = true;
    cmd.style.display = 'none';
    var copiar = document.createElement('button');
    copiar.type = 'button';
    copiar.className = 'pcBtn';
    copiar.textContent = 'Copiar comando';
    copiar.style.display = 'none';
    var nota = document.createElement('div');
    nota.className = 'pcAyuda';
    nota.style.marginTop = '6px';

    btn.addEventListener('click', function () {
      var n = window.prompt('\u00bfC\u00f3mo quieres llamar a este PC? (ej. PC de casa)', 'PC');
      if (n === null) return;
      n = n.replace(/\s+/g, ' ').trim().slice(0, 40) || 'PC';
      btn.disabled = true;
      fetch('/manos/vincular', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: n, plataforma: 'pc' })
      }).then(json).then(function (d) {
        cmd.value = 'python agente_pc.py --url ' + location.origin + ' --token ' + d.token;
        cmd.style.display = 'block';
        copiar.style.display = 'block';
        nota.textContent = 'Copia este comando y ejec\u00fatalo en tu PC, en la carpeta donde est\u00e1 agente_pc.py. Es secreto: no lo compartas. Si lo pierdes, vuelve a vincular.';
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
        copiar.textContent = 'Copiado \u2713';
      } catch (e) {}
    });
    [t, ayuda, btn, cmd, copiar, nota].forEach(function (e) { caja.appendChild(e); });
    cont.parentNode.insertBefore(caja, cont.nextSibling);
    return true;
  }

  var intentos = 0;
  var reloj = setInterval(function () {
    if (montar() || ++intentos > 40) clearInterval(reloj);
  }, 300);
})();
