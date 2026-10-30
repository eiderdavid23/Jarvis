import shutil
for r in ('server.py', 'CONTEXTO_JARVIS.md'):
    shutil.copy(r, r + '.bak')

s = open('server.py', encoding='utf-8').read()
a = "@app.route('/')\ndef index():\n    return send_from_directory('public', 'index.html')\n"
assert s.count(a) == 1, 'server.py: no encontre la ruta / esperada'
s = s.replace(a, a + "\n\n@app.route('/nexus')\ndef nexus_pagina():\n    return send_from_directory('public', 'nexus.html')\n")
open('server.py', 'w', encoding='utf-8').write(s)
print('server.py: ruta /nexus agregada')

L = open('CONTEXTO_JARVIS.md', encoding='utf-8').read().split('\n')
j = next(i for i, l in enumerate(L) if l.startswith('## 4.')) - 1
while j >= 0 and L[j].strip() in ('', '---'):
    j -= 1
L.insert(j + 1, '- **30 oct 2026**: NEXUS paso 3, página `/nexus` (`public/nexus.html`, `nexus.css`, `nexus.js`; ruta en '
    '`server.py`). Usa la sesión de Jarvis (`localStorage`: `jarvisAcceso` y `jarvisRefresco`; renueva con `/auth/refresh` '
    'y, si no hay sesión, manda a `/`). Pantallas: sin acceso (botón solicitar), pendiente y panel aprobado con Inicio '
    '(tarjetas con punto en línea, agregar/editar/eliminar), Administración (pendientes, usuarios, plataformas globales, '
    'asignaciones y plataformas personales de otros) y Cuenta. Todo el texto entra con `textContent` (sin XSS) y los '
    'enlaces solo si empiezan con http(s). Tema claro/oscuro igual que Jarvis. El botón "Jarvis" de la barra vuelve a `/`. '
    'Probado en Chromium sin pantalla con servidor simulado (celular y PC). Falta el panel de Jarvis a la derecha (paso 5).')
L = [l.replace('paso 3 página `/nexus`, ', '') for l in L]
open('CONTEXTO_JARVIS.md', 'w', encoding='utf-8').write('\n'.join(L))
print('Contexto actualizado')
