"""Parche 2: Mistral en Ajustes > Llave IA (junto a Gemini y Groq), llave por cuenta y probador de llave.
Uso (dentro de ~/jarvis, despues de parche_mistral.py):  python3 parche_mistral_ajustes.py
No escribe nada si algun ancla no coincide."""
import sys

cambios = {}   # archivo -> texto nuevo


def leer(a):
    if a not in cambios:
        cambios[a] = open(a, encoding='utf-8').read()
    return cambios[a]


def cambiar(a, viejo, nuevo, nombre):
    t = leer(a)
    if t.count(viejo) != 1:
        sys.exit(f'[ERROR] {a}: ancla "{nombre}" aparece {t.count(viejo)} veces. No cambie nada.')
    cambios[a] = t.replace(viejo, nuevo)


# ---------- Servidor: llaves por cuenta ----------
cambiar('llaves_api.py', "PROVEEDORES = ('gemini', 'groq')", "PROVEEDORES = ('gemini', 'groq', 'mistral')", 'PROVEEDORES')
cambiar('supabase_llaves.sql', "check (proveedor in ('gemini', 'groq'))",
        "check (proveedor in ('gemini', 'groq', 'mistral'))", 'sql')

# ---------- Servidor: probador de llave ----------
cambiar('server.py', "if proveedor not in ('gemini', 'groq') or len(llave) < 20",
        "if proveedor not in ('gemini', 'groq', 'mistral') or len(llave) < 20", 'probar valido')
cambiar('server.py',
        "        else:\n            r = requests.get('https://api.groq.com/openai/v1/models',\n"
        "                             headers={'Authorization': 'Bearer ' + llave}, timeout=15)\n",
        "        elif proveedor == 'groq':\n            r = requests.get('https://api.groq.com/openai/v1/models',\n"
        "                             headers={'Authorization': 'Bearer ' + llave}, timeout=15)\n"
        "        else:\n            r = requests.get('https://api.mistral.ai/v1/models',\n"
        "                             headers={'Authorization': 'Bearer ' + llave}, timeout=15)\n", 'probar mistral')

# ---------- Navegador ----------
cambiar('public/llaves_cuenta.js', "groq: 'jarvisGroqKey' };", "groq: 'jarvisGroqKey', mistral: 'jarvisMistralKey' };", 'CL')
cambiar('public/guia_llave.js', "sitio: 'Groq Console', boton: 'Create API Key' }\n",
        "sitio: 'Groq Console', boton: 'Create API Key' },\n"
        "    mistral: { nombre: 'Mistral', url: 'https://console.mistral.ai/api-keys', clave: 'jarvisMistralKey',\n"
        "               sitio: 'Mistral Console', boton: 'Create new key' }\n", 'guia')

TARJETA = '''        <div class="card">
          <div class="cardHead">
            <strong>Mistral</strong>
            <span class="badge" id="badgeLlaveMistral">Sin conectar</span>
          </div>
          <input type="text" id="campoLlaveMistral" class="campoTexto campoClave" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Pega tu llave de Mistral">
          <p style="font-size:11px; opacity:0.7; margin:0 0 10px;">¿No tienes una?</p>
          <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener" class="btnPanel secundario" style="color:#00e5ff; border-color:#00e5ff55; text-decoration:none; display:inline-block; margin-bottom:12px;">Obtener llave en Mistral Console &rarr;</a>
          <div class="filaBtns">
            <button id="btnGuardarLlaveMistral" class="btnPanel">Guardar</button>
            <button id="btnVerLlaveMistral" class="btnPanel secundario" style="color:#00e5ff; border-color:#00e5ff55;">Ver</button>
            <button id="btnBorrarLlaveMistral" class="btnPanel secundario">Borrar</button>
          </div>
          <div class="filaBtns" style="margin-top:10px;">
            <button id="btnUsarMistral" class="btnPanel secundario" style="color:#35e07a; border-color:#35e07a55;">Usar esta</button>
            <span class="badge" id="badgeProveedorMistral">Inactiva</span>
          </div>
        </div>

'''
I = 'public/index.html'
cambiar(I, '        <p style="font-size:11px; opacity:0.7;">Tus llaves se guardan cifradas',
        TARJETA + '        <p style="font-size:11px; opacity:0.7;">Tus llaves se guardan cifradas', 'tarjeta')

# envio de la llave al servidor
cambiar(I, "  const llaveGroq = localStorage.getItem('jarvisGroqKey') || '';\n",
        "  const llaveGroq = localStorage.getItem('jarvisGroqKey') || '';\n"
        "  const llaveMistral = localStorage.getItem('jarvisMistralKey') || '';\n", 'llave envio')
cambiar(I, "        'X-Groq-Key': llaveGroq,\n",
        "        'X-Groq-Key': llaveGroq,\n        'X-Mistral-Key': llaveMistral,\n", 'header')

# referencias a elementos
cambiar(I, "const badgeProveedorGroq = document.getElementById('badgeProveedorGroq');\n",
        "const badgeProveedorGroq = document.getElementById('badgeProveedorGroq');\n"
        "const campoLlaveMistral = document.getElementById('campoLlaveMistral');\n"
        "const badgeLlaveMistral = document.getElementById('badgeLlaveMistral');\n"
        "const btnGuardarLlaveMistral = document.getElementById('btnGuardarLlaveMistral');\n"
        "const btnVerLlaveMistral = document.getElementById('btnVerLlaveMistral');\n"
        "const btnBorrarLlaveMistral = document.getElementById('btnBorrarLlaveMistral');\n"
        "const btnUsarMistral = document.getElementById('btnUsarMistral');\n"
        "const badgeProveedorMistral = document.getElementById('badgeProveedorMistral');\n", 'elementos')

cambiar(I, "  actualizarBadgeLlave(campoLlaveGroq, badgeLlaveGroq, 'jarvisGroqKey');\n",
        "  actualizarBadgeLlave(campoLlaveGroq, badgeLlaveGroq, 'jarvisGroqKey');\n"
        "  actualizarBadgeLlave(campoLlaveMistral, badgeLlaveMistral, 'jarvisMistralKey');\n", 'badges')

cambiar(I,
        "  const esGemini = activo === 'gemini';\n"
        "  badgeProveedorGemini.textContent = esGemini ? 'En uso' : 'Inactiva';\n"
        "  badgeProveedorGemini.classList.toggle('on', esGemini);\n"
        "  badgeProveedorGroq.textContent = !esGemini ? 'En uso' : 'Inactiva';\n"
        "  badgeProveedorGroq.classList.toggle('on', !esGemini);\n"
        "  const sb = document.getElementById('sbProveedor');\n"
        "  if (sb) sb.textContent = esGemini ? 'Gemini' : 'Groq';\n",
        "  const esGroq = activo === 'groq', esMistral = activo === 'mistral', esGemini = !esGroq && !esMistral;\n"
        "  [[badgeProveedorGemini, esGemini], [badgeProveedorGroq, esGroq], [badgeProveedorMistral, esMistral]].forEach(function (p) {\n"
        "    p[0].textContent = p[1] ? 'En uso' : 'Inactiva';\n"
        "    p[0].classList.toggle('on', p[1]);\n"
        "  });\n"
        "  const sb = document.getElementById('sbProveedor');\n"
        "  if (sb) sb.textContent = esMistral ? 'Mistral' : (esGroq ? 'Groq' : 'Gemini');\n", 'proveedor ui')

cambiar(I, "btnUsarGemini.addEventListener('click', () => {\n",
        "btnGuardarLlaveMistral.addEventListener('click', () => {\n"
        "  const valor = campoLlaveMistral.value.trim();\n"
        "  if (!valor) return;\n"
        "  localStorage.setItem('jarvisMistralKey', valor);\n"
        "  actualizarBadgesLlaves();\n"
        "  if (window.llavesCuenta) window.llavesCuenta.guardar('mistral', valor);\n"
        "});\n"
        "btnBorrarLlaveMistral.addEventListener('click', () => {\n"
        "  localStorage.removeItem('jarvisMistralKey');\n"
        "  actualizarBadgesLlaves();\n"
        "  if (window.llavesCuenta) window.llavesCuenta.borrar('mistral');\n"
        "});\n"
        "btnVerLlaveMistral.addEventListener('click', () => {\n"
        "  campoLlaveMistral.classList.toggle('campoClave');\n"
        "});\n"
        "btnUsarMistral.addEventListener('click', () => {\n"
        "  localStorage.setItem('jarvisProveedor', 'mistral');\n"
        "  actualizarProveedorUI();\n"
        "});\n\n"
        "btnUsarGemini.addEventListener('click', () => {\n", 'handlers')

for archivo, texto in cambios.items():
    open(archivo, 'w', encoding='utf-8').write(texto)
print('Listo. Archivos cambiados:', ', '.join(cambios))
print('Falta: correr en Supabase (SQL Editor) el bloque ALTER del chat para aceptar llaves de Mistral.')
