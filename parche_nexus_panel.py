import shutil
for r in ('public/index.html', 'public/nexus.html', 'CONTEXTO_JARVIS.md'):
    shutil.copy(r, r + '.bak')

def cambiar(s, viejo, nuevo, donde):
    assert s.count(viejo) == 1, donde + ': ancla no encontrada o repetida: ' + viejo[:50]
    return s.replace(viejo, nuevo)

# ---------- 1. index.html: modo panel (?panel=1) ----------
s = open('public/index.html', encoding='utf-8').read()
s = cambiar(s, '</head>\n<body class="cargando m-inicio est-reposo">',
    '<script>try { if (/[?&]panel=1/.test(location.search)) document.documentElement.classList.add("modo-panel"); } catch (e) {}</script>\n'
    '<link rel="stylesheet" href="/modo_panel.css">\n'
    '</head>\n<body class="cargando m-inicio est-reposo">', 'index.html')
open('public/index.html', 'w', encoding='utf-8').write(s)
print('index.html: modo panel')

# ---------- 2. nexus.html: boton Jarvis + panel ----------
h = open('public/nexus.html', encoding='utf-8').read()
h = cambiar(h, '<a class="ir" href="/">Jarvis</a>',
    '<button id="btnJarvis" class="ir" type="button" aria-expanded="false">Jarvis</button>', 'nexus.html')
h = cambiar(h, '<link rel="stylesheet" href="/nexus.css">',
    '<link rel="stylesheet" href="/nexus.css">\n<link rel="stylesheet" href="/nexus_panel.css">', 'nexus.html')
h = cambiar(h, '<div id="modal" class="modal" hidden>',
    '<aside id="panelJarvis" class="panelj" hidden>\n'
    '  <div class="pj-barra"><span>Jarvis</span><a class="pj-full" href="/">Abrir completo</a>'
    '<button id="pjCerrar" class="pj-x" type="button" aria-label="Cerrar panel">✕</button></div>\n'
    '  <iframe id="pjFrame" title="Jarvis" allow="microphone; autoplay; clipboard-write"></iframe>\n'
    '</aside>\n\n<div id="modal" class="modal" hidden>', 'nexus.html')
h = cambiar(h, '<script src="/nexus.js"></script>',
    '<script src="/nexus.js"></script>\n<script src="/nexus_panel.js"></script>', 'nexus.html')
open('public/nexus.html', 'w', encoding='utf-8').write(h)
print('nexus.html: panel de Jarvis')

# ---------- 3. contexto ----------
L = open('CONTEXTO_JARVIS.md', encoding='utf-8').read().split('\n')
j = next(i for i, l in enumerate(L) if l.startswith('## 4.')) - 1
while j >= 0 and L[j].strip() in ('', '---'):
    j -= 1
L.insert(j + 1, '- **30 oct 2026**: NEXUS paso 5, panel de Jarvis en `/nexus`. El botón "Jarvis" de la barra abre un panel con Jarvis en un iframe '
    'del mismo dominio (`/?panel=1`), así comparte la sesión de `localStorage`. En pantalla ancha (900 px o más) es una columna de 400 px a la derecha '
    'y se recuerda abierto (`nexusPanelAbierto`); en el celular es un cajón a pantalla completa con ✕ y "Abrir completo". '
    'Con `?panel=1`, `index.html` agrega la clase `modo-panel` a `<html>` y `modo_panel.css` oculta sidebar, menú y splash. '
    'Archivos: `nexus_panel.js`, `nexus_panel.css`, `modo_panel.css`.')
L = [l.replace('paso 5 modo panel de Jarvis a la derecha, paso 6', 'paso 6') for l in L]
open('CONTEXTO_JARVIS.md', 'w', encoding='utf-8').write('\n'.join(L))
print('Contexto actualizado')
