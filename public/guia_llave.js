/* Guía paso a paso para conseguir y pegar la llave de IA */
(function () {
  const PROV = {
    gemini: { nombre: 'Google', url: 'https://aistudio.google.com/apikey', clave: 'jarvisGeminiKey',
              sitio: 'Google AI Studio', boton: 'Create API key' },
    groq: { nombre: 'Groq', url: 'https://console.groq.com/keys', clave: 'jarvisGroqKey',
            sitio: 'Groq Console', boton: 'Create API Key' }
  };
  const MOTIVOS = {
    formato: 'Esa llave no parece completa. Copia todo el texto, sin espacios.',
    invalida: 'Esa llave no fue aceptada. Cópiala otra vez desde el sitio.',
    red: 'No pude conectarme. Revisa tu internet e intenta de nuevo.',
    ocupado: 'El servicio está ocupado. Intenta de nuevo en un minuto.',
    google: 'El servicio no respondió bien. Intenta de nuevo en un momento.'
  };
  let caja = null;
  let prov = 'gemini';
  let pendiente = '';

  function crear() {
    caja = document.createElement('div');
    caja.className = 'glFondo';
    caja.innerHTML =
      '<div class="glHoja" role="dialog" aria-modal="true">' +
      '<h2>Conecta tu llave gratis</h2>' +
      '<p class="glIntro"></p>' +
      '<div class="glPaso"><span class="glNum">1</span><div class="glTxt"><b>Abre <span class="glSitio"></span></b>' +
      '<br><a class="glBtn prim glAbrir" target="_blank" rel="noopener">Abrir página →</a></div></div>' +
      '<div class="glPaso"><span class="glNum">2</span><div class="glTxt"><b>Inicia sesión</b> y toca ' +
      '«<span class="glBoton"></span>». Luego toca el icono de copiar junto a tu llave.</div></div>' +
      '<div class="glPaso"><span class="glNum">3</span><div class="glTxt"><b>Vuelve aquí y pégala</b>' +
      '<div class="glFila"><input class="glCampo" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Pega tu llave aquí">' +
      '<button type="button" class="glBtn glPegar">Pegar</button></div></div></div>' +
      '<div class="glEstado"></div>' +
      '<button type="button" class="glBtn prim glGuardar" style="width:100%">Probar y guardar</button>' +
      '<p class="glPie">La llave se guarda solo en este dispositivo y se usa únicamente para hablar con la IA a través de Jarvis. No la compartas con nadie.</p>' +
      '<button type="button" class="glCerrar">Ahora no</button></div>';
    document.body.appendChild(caja);
    caja.addEventListener('click', (e) => { if (e.target === caja) cerrar(); });
    caja.querySelector('.glCerrar').addEventListener('click', cerrar);
    caja.querySelector('.glPegar').addEventListener('click', pegar);
    caja.querySelector('.glGuardar').addEventListener('click', guardar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && caja.classList.contains('abierto')) cerrar(); });
  }

  function estado(clase, txt) {
    const e = caja.querySelector('.glEstado');
    e.className = 'glEstado' + (clase ? ' ' + clase : '');
    e.textContent = txt || '';
  }

  function abrir(proveedor, mensajePendiente) {
    prov = PROV[proveedor] ? proveedor : 'gemini';
    pendiente = mensajePendiente || '';
    if (!caja) crear();
    const p = PROV[prov];
    caja.querySelector('.glIntro').textContent = 'Jarvis usa la inteligencia artificial de ' + p.nombre +
      '. Necesitas una llave personal: es gratuita y toma unos 2 minutos.';
    caja.querySelector('.glSitio').textContent = p.sitio;
    caja.querySelector('.glAbrir').href = p.url;
    caja.querySelector('.glBoton').textContent = p.boton;
    caja.querySelector('.glCampo').value = '';
    caja.querySelector('.glGuardar').disabled = false;
    estado('', '');
    caja.classList.add('abierto');
  }

  function cerrar() { if (caja) caja.classList.remove('abierto'); }

  async function pegar() {
    const campo = caja.querySelector('.glCampo');
    try {
      const t = await navigator.clipboard.readText();
      if (t && t.trim()) { campo.value = t.trim(); estado('', ''); return; }
    } catch (e) { /* sin permiso del portapapeles */ }
    campo.focus();
    estado('', 'Mantén pulsado el cuadro y elige «Pegar».');
  }

  function reenviar() {
    if (!pendiente) return;
    const msg = pendiente;
    pendiente = '';
    const intento = (n) => {
      try {
        if (typeof procesando !== 'undefined' && procesando && n < 20) { setTimeout(() => intento(n + 1), 500); return; }
        texto.value = msg;
        enviarMensaje(false);
      } catch (e) { /* si no se puede, el usuario reenvía a mano */ }
    };
    intento(0);
  }

  async function guardar() {
    const boton = caja.querySelector('.glGuardar');
    const llave = caja.querySelector('.glCampo').value.replace(/\s+/g, '');
    if (!llave) { estado('err', 'Pega primero tu llave.'); return; }
    boton.disabled = true;
    estado('', 'Probando tu llave…');
    try {
      const res = await fetch('/llave/probar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedor: prov, llave: llave })
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) { estado('err', 'Tu sesión expiró. Vuelve a entrar e inténtalo otra vez.'); boton.disabled = false; return; }
      if (!d.ok) { estado('err', MOTIVOS[d.motivo] || MOTIVOS.google); boton.disabled = false; return; }
    } catch (e) {
      estado('err', MOTIVOS.red);
      boton.disabled = false;
      return;
    }
    localStorage.setItem(PROV[prov].clave, llave);
    localStorage.setItem('jarvisProveedor', prov);
    try { actualizarBadgesLlaves(); actualizarProveedorUI(); } catch (e) { /* solo refresca Ajustes */ }
    estado('ok', '✓ Llave lista');
    setTimeout(() => { cerrar(); reenviar(); }, 700);
  }

  window.jarvisGuiaLlave = { abrir: abrir, cerrar: cerrar };
})();
