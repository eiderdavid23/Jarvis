def cambiar(ruta, viejo, nuevo):
    s = open(ruta, encoding='utf-8').read()
    assert s.count(viejo) == 1, 'No encontre (o esta repetido) en ' + ruta + ': ' + viejo[:50]
    open(ruta, 'w', encoding='utf-8').write(s.replace(viejo, nuevo))

M = 'public/markdown.js'
cambiar(M, "        var cod = []; i++;\n",
        "        var lang = (l.match(/^\\s*```\\s*([\\w+#-]*)/) || [])[1] || '';\n        var cod = []; i++;\n")
cambiar(M, "out += '<pre><code>' + esc(cod.join('\\n')) + '</code></pre>';",
        "out += '<pre' + (lang ? ' data-lang=\"' + esc(lang) + '\"' : '') + '><code>' + esc(cod.join('\\n')) + '</code></pre>';")

H = 'public/index.html'
cambiar(H, "  fila.className = 'fila ' + clase;\n",
        "  fila.className = 'fila ' + clase;\n  fila.dataset.raw = txt || '';\n")
cambiar(H, "  fila.appendChild(b);\n  chatInner.appendChild(fila);\n  bajarChat();\n  return fila;",
        "  fila.appendChild(b);\n  if (clase === 'jarvis' && window.accionesMsg) window.accionesMsg(fila, b, txt);\n  chatInner.appendChild(fila);\n  bajarChat();\n  return fila;")
cambiar(H, '<link rel="stylesheet" href="/splash.css">',
        '<link rel="stylesheet" href="/splash.css">\n<link rel="stylesheet" href="/acciones_msg.css">')
cambiar(H, '<script src="/markdown.js"></script>',
        '<script src="/markdown.js"></script>\n<script src="/acciones_msg.js"></script>')
print('Listo: parche aplicado')
