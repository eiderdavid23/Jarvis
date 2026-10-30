"""Parche: limites reales en el panel de Uso y errores 429 explicados.
 - Groq: el servidor lee las cabeceras x-ratelimit-* y el panel muestra cuantos tokens por minuto
   y cuantas peticiones por dia le quedan de verdad.
 - 429 de Groq o Gemini: el mensaje dice cual limite fue (minuto o dia), cuanto es y cuando se libera.
Uso (dentro de ~/jarvis):  python3 parche_limites.py
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

# ================= SERVIDOR =================
FUNCIONES = '''def _segundos(txt):
    """'2m59.56s', '7.66s', '1h2m', '250ms' o '54' -> segundos (float), o None."""
    import re
    txt = (txt or '').strip()
    if not txt:
        return None
    try:
        return float(txt)
    except ValueError:
        pass
    partes = re.findall(r'([0-9.]+)(ms|h|m|s)', txt)
    if not partes:
        return None
    mult = {'h': 3600.0, 'm': 60.0, 's': 1.0, 'ms': 0.001}
    try:
        return sum(float(n) * mult[u] for n, u in partes)
    except ValueError:
        return None


def _hms(seg):
    seg = int(round(max(0, seg or 0)))
    if seg >= 3600:
        return f'{seg // 3600} h {(seg % 3600) // 60} min'
    if seg >= 60:
        return f'{seg // 60} min {seg % 60} s'
    return f'{seg} s'


def _n(x):
    return f'{int(x):,}'.replace(',', '.')


def _guardar_limites_groq(resp):
    """Groq manda en cada respuesta cuanto le queda: tokens por MINUTO y peticiones por DIA."""
    h = resp.headers

    def ent(k):
        try:
            return int(h.get(k))
        except (TypeError, ValueError):
            return None
    datos = {
        'tokens_limite': ent('x-ratelimit-limit-tokens'),
        'tokens_quedan': ent('x-ratelimit-remaining-tokens'),
        'tokens_reinicio_s': _segundos(h.get('x-ratelimit-reset-tokens')),
        'peticiones_limite': ent('x-ratelimit-limit-requests'),
        'peticiones_quedan': ent('x-ratelimit-remaining-requests'),
        'peticiones_reinicio_s': _segundos(h.get('x-ratelimit-reset-requests')),
    }
    if any(v is not None for v in datos.values()):
        g.limites_groq = datos


def _explicar_429(resp):
    """Devuelve (mensaje, datos_extra) para un 429 de Groq o de Gemini."""
    import re
    try:
        texto = resp.text or ''
    except Exception:
        texto = ''
    url = str(getattr(getattr(resp, 'request', None), 'url', '') or '')
    if 'groq.com' in url:
        try:
            _guardar_limites_groq(resp)
        except Exception:
            pass
        espera = _segundos(resp.headers.get('retry-after'))
        if espera is None:
            m = re.search(r'try again in ([0-9hms.]+)', texto)
            espera = _segundos(m.group(1)) if m else None
        cuando = ' Vuelva a intentarlo en unos ' + _hms(espera) + '.' if espera is not None else ' Vuelva a intentarlo en un minuto.'
        m = re.search(r'Limit (\\d+), Used (\\d+), Requested (\\d+)', texto)
        lim, usado, pedido = (int(x) for x in m.groups()) if m else (None, None, None)
        if 'tokens per minute' in texto and lim:
            msg = ('Señor, Groq llegó a su límite gratis por minuto (' + _n(lim) + ' tokens; usados ' + _n(usado)
                   + ', esta petición pedía ' + _n(pedido) + ').')
            if pedido > lim:
                msg += ' Esta petición sola ya supera ese límite.'
        elif 'requests per day' in texto:
            msg = 'Señor, Groq llegó a su límite gratis de peticiones por día.'
        elif 'tokens per day' in texto:
            msg = 'Señor, Groq llegó a su límite gratis de tokens por día.'
        else:
            msg = 'Señor, Groq dice que hay demasiadas peticiones.'
        extra = {'limites_groq': g.get('limites_groq')} if g.get('limites_groq') else {}
        return msg + cuando, extra
    if 'googleapis.com' in url or 'generativelanguage' in texto:
        lim = re.search(r'limit:\\s*(\\d+)', texto)
        mod = re.search(r'model:\\s*([A-Za-z0-9.\\-]+)', texto)
        met = re.search(r'metric:\\s*(\\S+?),', texto)
        esp = re.search(r'retry in ([0-9hms.]+)', texto, re.I) or re.search(r'"retryDelay":\\s*"([0-9.]+s)"', texto)
        espera = _segundos(esp.group(1)) if esp else None
        if 'PerDay' in texto or (espera or 0) > 120:
            tipo = 'dia'
        elif 'PerMinute' in texto or espera is not None:
            tipo = 'minuto'
        else:
            tipo = ''
        unidad = 'tokens' if met and 'token' in met.group(1).lower() else 'peticiones'
        msg = 'Señor, Gemini llegó a su límite gratis' + {'dia': ' por día', 'minuto': ' por minuto', '': ''}[tipo]
        if lim:
            msg += ' (' + lim.group(1) + ' ' + unidad + (' para ' + mod.group(1) if mod else '') + ')'
        msg += '.' + (' Se libera en unos ' + _hms(espera) + '.' if espera is not None else ' Intente más tarde.')
        extra = {}
        if lim:
            extra['limite_gemini'] = {'limite': int(lim.group(1)), 'unidad': unidad, 'tipo': tipo,
                                      'modelo': mod.group(1) if mod else '', 'reinicio_s': espera}
        return msg, extra
    return 'Señor, el proveedor de IA dice que hay demasiadas peticiones. Intente de nuevo en un minuto.', {}


'''
cambiar(S, 'def llamar_groq(cuerpo, cfg_groq, api_key):\n', FUNCIONES + 'def llamar_groq(cuerpo, cfg_groq, api_key):\n', 'funciones')

cambiar(S, "    contar_uso('groq', resp)\n    return resp\n",
        "    try:\n        _guardar_limites_groq(resp)\n    except Exception as e:\n"
        "        print('[LIMITES] No pude leer las cabeceras de Groq:', e)\n"
        "    contar_uso('groq', resp)\n    return resp\n", 'llamar_groq')

cambiar(S, "                        'mapa_mc': acciones.get('mapa_mc')})\n",
        "                        'mapa_mc': acciones.get('mapa_mc'),\n"
        "                        'limites_groq': g.get('limites_groq')})\n", 'respuesta chat')

# Mensaje del 429 (si ya se aplico el parche de Mistral, se reemplaza su version simple)
MISTRAL_429 = (
    "        if codigo == 429:\n"
    "            espera = (e.response.headers.get('retry-after') or '').strip()\n"
    "            extra = f' Vuelva a intentarlo en unos {espera} segundos.' if espera.isdigit() else ' Intente de nuevo en un minuto.'\n"
    "            return jsonify({'respuesta': 'Señor, el proveedor de IA dice que se agotó el límite de uso gratuito por ahora.' + extra}), 429\n")
if MISTRAL_429 in leer(S):
    arch[S] = arch[S].replace(MISTRAL_429, '')
cambiar(S, "        codigo = e.response.status_code if e.response is not None else '?'\n",
        "        codigo = e.response.status_code if e.response is not None else '?'\n"
        "        if codigo == 429:\n"
        "            try:\n"
        "                msg429, extra429 = _explicar_429(e.response)\n"
        "            except Exception:\n"
        "                msg429, extra429 = 'Señor, el proveedor de IA dice que hay demasiadas peticiones. Intente de nuevo en un minuto.', {}\n"
        "            return jsonify(dict({'respuesta': msg429}, **extra429)), 429\n", 'mensaje 429')

# ================= PANTALLA =================
cambiar(H, '<p style="font-size:10px; opacity:0.6; margin:6px 0 0;">1000/',
        '<p id="usoLimGroq" style="font-size:11px; margin:6px 0 0;"></p>\n'
        '          <p style="font-size:10px; opacity:0.6; margin:6px 0 0;">1000/', 'html groq')
cambiar(H, '<p style="font-size:10px; opacity:0.6; margin:6px 0 0;">500/',
        '<p id="usoLimGemini" style="font-size:11px; margin:6px 0 0;"></p>\n'
        '          <p style="font-size:10px; opacity:0.6; margin:6px 0 0;">500/', 'html gemini')

JS = '''/* Limites reales: Groq los manda en cada respuesta; Gemini solo avisa cuando se pasa (error 429). */
const LIM = { groq: null, gemini: null };
try {
  LIM.groq = JSON.parse(localStorage.getItem('jarvisLimGroq') || 'null');
  LIM.gemini = JSON.parse(localStorage.getItem('jarvisLimGemini') || 'null');
} catch (e) {}
function nfLim(n) { return Number(n).toLocaleString('es'); }
function durLim(s) {
  s = Math.max(0, Math.round(s));
  if (s >= 3600) return Math.floor(s / 3600) + ' h ' + Math.floor((s % 3600) / 60) + ' min';
  if (s >= 60) return Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
  return s + ' s';
}
function lineaLim(nombre, limite, quedan, reinicio, t) {
  if (limite == null || quedan == null) return '';
  const renovado = reinicio != null && t >= reinicio;
  const q = renovado ? limite : quedan;
  return nombre + ': quedan ' + nfLim(q) + ' de ' + nfLim(limite)
    + (renovado || reinicio == null ? '' : ' (se renueva en ' + durLim(reinicio - t) + ')');
}
function pintarLimites() {
  const eg = document.getElementById('usoLimGroq');
  if (eg) {
    const d = LIM.groq;
    if (!d) {
      eg.textContent = 'Límites reales de Groq: aparecerán después de su próximo mensaje con Groq.';
    } else {
      const t = (Date.now() - d.recibido) / 1000;
      const partes = [
        lineaLim('Tokens por minuto', d.tokens_limite, d.tokens_quedan, d.tokens_reinicio_s, t),
        lineaLim('Peticiones por día', d.peticiones_limite, d.peticiones_quedan, d.peticiones_reinicio_s, t)
      ].filter(Boolean);
      eg.textContent = partes.length
        ? 'Límites reales de Groq (dato de hace ' + durLim(t) + '): ' + partes.join(' · ')
        : 'Groq no devolvió datos de límite en la última respuesta.';
    }
  }
  const em = document.getElementById('usoLimGemini');
  if (em) {
    const d = LIM.gemini;
    if (!d) {
      em.textContent = 'Google no informa sus límites por la API: la meta de arriba la fija usted. Si Google corta, aquí queda el límite real que indique.';
    } else {
      const cuando = d.fecha ? new Date(d.fecha).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '';
      em.textContent = 'Último límite real que avisó Google: ' + nfLim(d.limite) + ' ' + d.unidad
        + (d.tipo === 'dia' ? ' por día' : d.tipo === 'minuto' ? ' por minuto' : '')
        + (d.modelo ? ' (' + d.modelo + ')' : '') + (cuando ? ', ' + cuando : '') + '.';
    }
  }
}
window.jarvisLimites = {
  recibir(data) {
    if (!data) return;
    if (data.limites_groq) {
      LIM.groq = Object.assign({}, data.limites_groq, { recibido: Date.now() });
      try { localStorage.setItem('jarvisLimGroq', JSON.stringify(LIM.groq)); } catch (e) {}
    }
    if (data.limite_gemini) {
      LIM.gemini = Object.assign({}, data.limite_gemini, { fecha: new Date().toISOString() });
      try { localStorage.setItem('jarvisLimGemini', JSON.stringify(LIM.gemini)); } catch (e) {}
    }
    pintarLimites();
  }
};
'''
cambiar(H, 'function pintarUso(p) {\n', JS + 'function pintarUso(p) {\n', 'js limites')
cambiar(H, "function actualizarUsoUI() {\n  pintarUso('gemini');\n  pintarUso('groq');\n",
        "function actualizarUsoUI() {\n  pintarUso('gemini');\n  pintarUso('groq');\n  pintarLimites();\n", 'actualizarUsoUI')
cambiar(H, "    const data = leido.data;\n    escribiendo.remove();\n",
        "    const data = leido.data;\n    if (window.jarvisLimites) window.jarvisLimites.recibir(data);\n    escribiendo.remove();\n", 'recibir')

for a in arch:
    shutil.copyfile(a, a + '.bak')
    open(a, 'w', encoding='utf-8').write(arch[a])
print('Listo. Cambiados:', ', '.join(arch), '(copias .bak)')
