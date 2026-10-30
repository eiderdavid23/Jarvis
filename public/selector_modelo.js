/* Selector de modelo estilo Claude: la píldora junto al "+" muestra el modelo y el nivel,
   y al tocarla abre "Selecciona un modelo" (Automático, modelos, Esfuerzo y Más modelos).
   Guarda la elección en localStorage: jarvisModelo ('auto' o 'proveedor|modelo') y
   jarvisCambioAuto ('0' = no saltar al siguiente cuando se agote). La lista viene de GET /modelos. */
(function () {
  var K = 'jarvisModelo', KA = 'jarvisCambioAuto';
  var cat = [], expandido = false, hoja = null, cargando = null;

  function ver(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function poner(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function actual() { return ver(K) || 'auto'; }
  function buscarActual() {
    var a = actual();
    if (a === 'auto') return null;
    return cat.filter(function (m) { return m.id === a; })[0] ||
           cat.filter(function (m) { return m.prov === a; })[0] || null;
  }
  function esActual(m) {
    var a = actual();
    if (m.id === 'auto') return a === 'auto' || !buscarActual();
    var b = buscarActual();
    return !!b && b.id === m.id;
  }
  function pintarPildora() {
    var s = document.querySelector('#pildora > span');
    if (!s) return;
    var m = buscarActual();
    s.textContent = actual() === 'auto' || !m ? 'Automático' : m.nombre;
  }
  function cargar() {
    if (cat.length) return Promise.resolve();
    if (cargando) return cargando;
    cargando = fetch('/modelos').then(function (r) { return r.json(); }).then(function (d) {
      cat = (d && d.modelos) || [];
    }).catch(function () { /* sin lista: solo Automático */ }).then(function () {
      cargando = null;
      pintarPildora();
    });
    return cargando;
  }

  function fila(lista, m) {
    var b = el('button', 'filaNivel' + (esActual(m) ? ' on' : ''));
    b.type = 'button';
    var t = el('span', 'nivTxt');
    t.appendChild(document.createTextNode(m.nombre));
    if (m.proveedor) t.appendChild(el('i', 'smTag', m.proveedor));
    if (m.nota) t.appendChild(el('small', null, m.nota));
    b.appendChild(t);
    b.appendChild(el('span', 'nivOk'));
    b.addEventListener('click', function () {
      poner(K, m.id);
      pintarPildora();
      cerrarHojas();
    });
    lista.appendChild(b);
  }

  function filaAccion(texto, derecha, tag, alTocar) {
    var b = el('button', 'smFila');
    b.type = 'button';
    b.appendChild(el('span', null, texto));
    var d = el('span', 'smDer');
    if (tag) d.appendChild(el('i', 'smTag', tag));
    if (derecha) d.appendChild(document.createTextNode(derecha));
    d.appendChild(document.createTextNode(' ›'));
    b.appendChild(d);
    b.addEventListener('click', alTocar);
    return b;
  }

  function construir() {
    if (!hoja) {
      hoja = el('div', 'hoja');
      hoja.id = 'hojaModelo';
      document.body.appendChild(hoja);
    }
    hoja.textContent = '';
    hoja.appendChild(el('div', 'hojaAgarre'));
    hoja.appendChild(el('p', 'hojaTit', 'Selecciona un modelo'));

    var lista = el('div', 'smLista');
    fila(lista, { id: 'auto', nombre: 'Automático', proveedor: '',
                  nota: 'Prueba los modelos gratis en orden y salta al siguiente cuando uno se agota' });
    cat.filter(function (m) { return m.principal; }).forEach(function (m) { fila(lista, m); });
    if (expandido) cat.filter(function (m) { return !m.principal; }).forEach(function (m) { fila(lista, m); });
    hoja.appendChild(lista);

    if (actual() !== 'auto' && buscarActual()) {
      var sw = el('button', 'smFila');
      sw.type = 'button';
      sw.appendChild(el('span', null, 'Cambiar al siguiente si se agota'));
      var rueda = el('span', 'smSw' + (ver(KA) === '0' ? '' : ' on'));
      sw.appendChild(rueda);
      sw.addEventListener('click', function () {
        var on = ver(KA) === '0';
        poner(KA, on ? '1' : '0');
        rueda.classList.toggle('on', on);
      });
      hoja.appendChild(sw);
    }

    var nivel = document.getElementById('pildoraNivel');
    hoja.appendChild(filaAccion('Esfuerzo', nivel ? nivel.textContent : 'Medio', 'Recomendado', function () {
      cerrarHojas();
      setTimeout(function () { abrirHoja('hojaNivel'); }, 140);
    }));

    var otros = cat.filter(function (m) { return !m.principal; }).length;
    if (otros) {
      hoja.appendChild(filaAccion(expandido ? 'Menos modelos' : 'Más modelos', '', '', function () {
        expandido = !expandido;
        construir();
      }));
    }
    hoja.appendChild(el('p', 'smNota',
      cat.length ? 'Solo se usan los proveedores con llave conectada (Ajustes → Llave IA).'
                 : 'No pude cargar la lista de modelos. Revisa tu conexión.'));
  }

  function abrir() {
    cargar().then(function () {
      construir();
      abrirHoja('hojaModelo');
    });
  }

  var pil = document.getElementById('pildora');
  if (pil) {
    // en fase de captura, para abrir esta hoja en lugar de la del nivel de pensamiento
    pil.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      abrir();
    }, true);
  }
  pintarPildora();
  cargar();

  window.selectorModelo = { refrescar: function () { pintarPildora(); if (hoja) construir(); } };
})();
