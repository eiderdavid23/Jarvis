def parchar(ruta, cambios):
    s = open(ruta, encoding='utf-8').read()
    for viejo, nuevo in cambios:
        assert s.count(viejo) == 1, ruta + ': no encontre ' + viejo[:50]
        s = s.replace(viejo, nuevo)
    open(ruta, 'w', encoding='utf-8').write(s)

parchar('public/pasos.js', [
    ("    let total = 0;\n",
     "    let total = 0;\n    let soloPensar = true;\n"
     "    const t0 = (window.jarvisPasos && window.jarvisPasos.t0) || Date.now();\n"),
    ("        total++;\n",
     "        total++;\n        if (texto !== 'Pensando') soloPensar = false;\n"),
    ("        tit.textContent = 'Resumen · ' + total + (total === 1 ? ' paso' : ' pasos');\n",
     "        const seg = Math.max(1, Math.round((Date.now() - t0) / 1000));\n"
     "        if (soloPensar) caja.classList.add('simple');\n"
     "        tit.textContent = soloPensar ? 'Pensó durante ' + seg + ' s'\n"
     "          : 'Resumen · ' + total + (total === 1 ? ' paso' : ' pasos');\n"),
    ("    let final = null;\n    function linea(l) {\n",
     "    let final = null;\n    let vioPaso = false;\n"
     "    window.jarvisPasos.t0 = Date.now();\n"
     "    const lento = setTimeout(() => {\n"
     "      if (!vioPaso && !final && alPaso) alPaso('Pensando');\n    }, 1500);\n"
     "    function linea(l) {\n"),
    ("      if (o.t === 'paso' && alPaso) alPaso(o.texto);\n",
     "      if (o.t === 'paso' && alPaso) { vioPaso = true; alPaso(o.texto); }\n"),
    ("    linea(resto + dec.decode());\n",
     "    linea(resto + dec.decode());\n    clearTimeout(lento);\n"),
])

parchar('public/pasos.css', [
    (".pasosBox { margin-left: 34px; font-size: 14px;", ".pasosBox { margin-left: 34px; font-size: 15px;"),
    ("  flex: none; width: 12px; height: 12px; border-radius: 50%;\n"
     "  border: 2px solid var(--linea); border-top-color: var(--cian);\n"
     "  animation: pasosGiro .9s linear infinite;\n",
     "  flex: none; width: 17px; height: 17px; border-radius: 50%;\n"
     "  background: conic-gradient(from 0deg, transparent 0 25%, var(--cian));\n"
     "  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));\n"
     "  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));\n"
     "  animation: pasosGiro .8s linear infinite;\n"),
    ("  animation: none; border: 0; width: 7px; height: 7px; background: var(--suave); opacity: .6;\n",
     "  animation: none; -webkit-mask: none; mask: none; width: 7px; height: 7px;\n"
     "  background: var(--suave); opacity: .6;\n"),
])
open('public/pasos.css', 'a', encoding='utf-8').write(
    '.pasosBox.simple .pasosFlecha { display: none; }\n'
    '.pasosBox.simple .pasosLista { display: none !important; }\n')
print('Pasos mejorados')
