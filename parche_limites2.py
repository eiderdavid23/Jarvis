"""Parche 2 de limites: contador propio de llamadas por minuto + botones a las paginas oficiales de limites.
Requiere haber aplicado antes parche_limites.py.
Uso (dentro de ~/jarvis):  python3 parche_limites2.py
Cambia server.py y public/index.html; si un ancla falla no escribe nada."""
import shutil
import sys

arch = {}


def leer(a):
    if a not in arch:
        arch[a] = open(a, encoding='utf-8').read()
    return arch[a]


def cambiar(a, viejo, nuevo, nombre):
    t = leer(a)
    if t.count(viejo) != 1:
        sys.exit(f'[ERROR] {a}: ancla "{nombre}" aparece {t.count(viejo)} veces. No cambie nada.')
    arch[a] = t.replace(viejo, nuevo)


S, H = 'server.py', 'public/index.html'
if '_explicar_429' not in leer(S) or 'jarvisLimites' not in leer(H):
    sys.exit('[ERROR] Aplique primero parche_limites.py. No cambie nada.')

# ================= SERVIDOR: hora de cada llamada real a la IA =================
cambiar(S, "    try:\n        acc = g.setdefault('uso_pendiente', {}).setdefault(proveedor, [0, 0, 0])\n",
        "    try:\n        import time as _t\n"
        "        g.setdefault('marcas_llamadas', {}).setdefault(proveedor, []).append(_t.time())\n"
        "        acc = g.setdefault('uso_pendiente', {}).setdefault(proveedor, [0, 0, 0])\n", 'contar_uso')

cambiar(S, 'def llamar_groq(cuerpo, cfg_groq, api_key):\n',
        "def _marcas_llamadas():\n"
        '    """Hace cuantos segundos se hizo cada llamada de este mensaje (para el contador por minuto)."""\n'
        "    import time as _t\n"
        "    ahora = _t.time()\n"
        "    m = g.get('marcas_llamadas') or {}\n"
        "    return {p: [round(ahora - x, 1) for x in lst] for p, lst in m.items()} or None\n\n\n"
        'def llamar_groq(cuerpo, cfg_groq, api_key):\n', 'helper')

cambiar(S, "                        'limites_groq': g.get('limites_groq')})\n",
        "                        'limites_groq': g.get('limites_groq'),\n"
        "                        'marcas_llamadas': _marcas_llamadas()})\n", 'respuesta')

cambiar(S, "            return jsonify(dict({'respuesta': msg429}, **extra429)), 429\n",
        "            extra429 = dict(extra429, marcas_llamadas=_marcas_llamadas())\n"
        "            return jsonify(dict({'respuesta': msg429}, **extra429)), 429\n", 'respuesta 429')

# ================= PANTALLA: HTML =================
BOTON = ('<a href="%s" target="_blank" rel="noopener" class="btnPanel secundario" '
         'style="color:#00e5ff; border-color:#00e5ff55; text-decoration:none; display:inline-block; margin:8px 0 2px;">%s &rarr;</a>\n')
cambiar(H, '<p id="usoLimGemini" style="font-size:11px; margin:6px 0 0;"></p>\n',
        '<p id="usoLimGemini" style="font-size:11px; margin:6px 0 0;"></p>\n'
        '          <p style="font-size:11px; margin:6px 0 0;">Llamadas en el último minuto (cuenta de Jarvis): '
        '<span id="usoMinGemini">0</span> de\n'
        '            <input type="number" id="usoRpmGemini" class="campoMeta" min="1" value="15"> por minuto</p>\n'
        '          ' + BOTON % ('https://aistudio.google.com/rate-limit', 'Ver límites oficiales en Google AI Studio'),
        'html gemini')
cambiar(H, '<p id="usoLimGroq" style="font-size:11px; margin:6px 0 0;"></p>\n',
        '<p id="usoLimGroq" style="font-size:11px; margin:6px 0 0;"></p>\n'
        '          <p style="font-size:11px; margin:6px 0 0;">Llamadas en el último minuto (cuenta de Jarvis): '
        '<span id="usoMinGroq">0</span></p>\n'
        '          ' + BOTON % ('https://console.groq.com/settings/limits', 'Ver límites oficiales en Groq'),
        'html groq')

# ================= PANTALLA: JS =================
JS = '''/* Llamadas por minuto: cuenta de Jarvis (cada llamada real a la IA, con la hora a la que se hizo). */
const MARCAS = { gemini: [], groq: [] };
try {
  const mm = JSON.parse(localStorage.getItem('jarvisMarcas') || 'null');
  if (mm) { MARCAS.gemini = mm.gemini || []; MARCAS.groq = mm.groq || []; }
} catch (e) {}
function anotarMarcas(m) {
  if (!m) return;
  const ahora = Date.now();
  ['gemini', 'groq'].forEach(function (p) {
    (m[p] || []).forEach(function (hace) { MARCAS[p].push(ahora - hace * 1000); });
    MARCAS[p] = MARCAS[p].filter(function (t) { return ahora - t < 300000; });
  });
  try { localStorage.setItem('jarvisMarcas', JSON.stringify(MARCAS)); } catch (e) {}
}
function pintarMinuto() {
  const ahora = Date.now();
  ['Gemini', 'Groq'].forEach(function (N) {
    const el = document.getElementById('usoMin' + N);
    if (!el) return;
    const n = MARCAS[N.toLowerCase()].filter(function (t) { return ahora - t < 60000; }).length;
    el.textContent = n;
    if (N === 'Gemini') {
      const rpm = document.getElementById('usoRpmGemini');
      if (rpm && document.activeElement !== rpm) rpm.value = localStorage.getItem('jarvisRpmGemini') || 15;
      el.style.color = rpm && n >= parseInt(rpm.value, 10) ? '#ff6b6b' : '';
    }
  });
}
const rpmGemini = document.getElementById('usoRpmGemini');
if (rpmGemini) rpmGemini.addEventListener('change', function () {
  const v = parseInt(rpmGemini.value, 10);
  if (v > 0) localStorage.setItem('jarvisRpmGemini', v);
  pintarMinuto();
});
setInterval(function () {
  if (document.hidden) return;
  const tab = document.getElementById('tabUso');
  if (tab && tab.classList.contains('activo')) pintarMinuto();
}, 2000);
'''
cambiar(H, 'function pintarUso(p) {\n', JS + 'function pintarUso(p) {\n', 'js minuto')
cambiar(H, "  pintarUso('groq');\n  pintarLimites();\n", "  pintarUso('groq');\n  pintarLimites();\n  pintarMinuto();\n", 'actualizarUsoUI')
cambiar(H, "  recibir(data) {\n    if (!data) return;\n",
        "  recibir(data) {\n    if (!data) return;\n    anotarMarcas(data.marcas_llamadas);\n", 'recibir')

for a in arch:
    shutil.copyfile(a, a + '.bak2')
    open(a, 'w', encoding='utf-8').write(arch[a])
print('Listo. Cambiados:', ', '.join(arch), '(copias .bak2)')
