"""Parche: el menu de mantener presionado un mensaje ya no se cierra solo al soltar el dedo.
Uso (dentro de ~/jarvis):  python3 parche_menu_mensaje.py
No escribe nada si algun ancla no coincide; deja copia en menu_mensaje.js.bak"""
import shutil
import sys

A = 'public/menu_mensaje.js'
t = open(A, encoding='utf-8').read()


def cambiar(viejo, nuevo, nombre):
    global t
    if t.count(viejo) != 1:
        sys.exit(f'[ERROR] ancla "{nombre}" aparece {t.count(viejo)} veces. No cambie nada.')
    t = t.replace(viejo, nuevo)


# 1) Estado de proteccion + funciones
cambiar(
    "  var menu = null, fondo = null, pulsada = null;\n  function cerrarMenu() {\n",
    "  var menu = null, fondo = null, pulsada = null;\n"
    "  /* Al abrir el menu el dedo sigue apretado: el clic y el 'contextmenu' del soltar caen sobre el\n"
    "     fondo y lo cerraban al instante. Se ignoran hasta que se suelta el dedo. */\n"
    "  var protegido = false, finProt = null;\n"
    "  function protegir() {\n"
    "    protegido = true;\n"
    "    clearTimeout(finProt);\n"
    "    finProt = setTimeout(function () { protegido = false; }, 5000);\n"
    "  }\n"
    "  function soltado() {\n"
    "    if (!protegido) return;\n"
    "    clearTimeout(finProt);\n"
    "    finProt = setTimeout(function () { protegido = false; }, 450);\n"
    "  }\n"
    "  document.addEventListener('touchend', soltado, true);\n"
    "  document.addEventListener('touchcancel', soltado, true);\n"
    "  function cerrarMenu() {\n"
    "    protegido = false; clearTimeout(finProt);\n",
    'estado')

# 2) El fondo no cierra mientras esta protegido
cambiar(
    "    fondo.addEventListener('click', cerrarMenu);\n"
    "    fondo.addEventListener('contextmenu', function (e) { e.preventDefault(); cerrarMenu(); });\n",
    "    fondo.addEventListener('click', function (e) { if (protegido) { e.preventDefault(); return; } cerrarMenu(); });\n"
    "    fondo.addEventListener('contextmenu', function (e) { e.preventDefault(); if (!protegido) cerrarMenu(); });\n",
    'fondo')

# 3) Activar la proteccion al abrir
cambiar(
    "    document.body.appendChild(fondo); document.body.appendChild(menu);\n",
    "    document.body.appendChild(fondo); document.body.appendChild(menu);\n    protegir();\n",
    'abrir')

shutil.copyfile(A, A + '.bak')
open(A, 'w', encoding='utf-8').write(t)
print('Listo: public/menu_mensaje.js actualizado (copia en menu_mensaje.js.bak).')
