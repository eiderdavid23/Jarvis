"""Rotacion automatica de modelos de IA gratuitos (Gemini, Groq, Mistral y OpenRouter).

Jarvis prueba los modelos en orden. Cuando uno se agota (429), no existe (404), falla (5xx),
no responde o rechaza la llave, lo marca como agotado por un rato y pasa al siguiente.
Los siguientes mensajes se saltan los marcados, sin volver a intentarlos.
server.py conecta este modulo con `rotacion_ia.srv` (el propio server.py).
Para cambiar la lista sin tocar codigo: variable MODELOS_IA con JSON, por ejemplo
[{"prov": "groq", "modelo": "openai/gpt-oss-20b", "nombre": "GPT-OSS 20B", "nota": "rapido"}].
"""
import hashlib
import json
import os
import re
import time

import requests
from flask import Blueprint, g, jsonify

srv = None   # lo asigna server.py (necesita sus herramientas, constantes y generar_gemini/groq)
bp = Blueprint('rotacion', __name__)

ORDEN = ('gemini', 'groq', 'nvidia', 'mistral', 'openrouter')
MARCA = {'gemini': 'Gemini', 'groq': 'Groq', 'mistral': 'Mistral', 'openrouter': 'OpenRouter'}
EMPRESA = {'gemini': 'Google', 'groq': 'Groq', 'mistral': 'Mistral', 'openrouter': 'OpenRouter'}
CABECERA_LLAVE = {'gemini': 'X-Gemini-Key', 'groq': 'X-Groq-Key',
                  'mistral': 'X-Mistral-Key', 'openrouter': 'X-OpenRouter-Key'}
URL_OPENAI = {'mistral': 'https://api.mistral.ai/v1/chat/completions',
              'openrouter': 'https://openrouter.ai/api/v1/chat/completions'}
NOMBRES = {
    'gemini-3.5-flash': 'Gemini 3.5 Flash', 'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
    'gemini-2.5-flash': 'Gemini 2.5 Flash', 'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
    'openai/gpt-oss-120b': 'GPT-OSS 120B', 'openai/gpt-oss-20b': 'GPT-OSS 20B',
    'meta-llama/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout',
    'mistral-small-latest': 'Mistral Small', 'open-mistral-nemo': 'Mistral Nemo',
    'openrouter/free': 'OpenRouter Free', 'poolside/laguna-s-2.1:free': 'Laguna S 2.1',
}
NOTAS = {
    'gemini-3.5-flash': 'El más capaz, con herramientas e imágenes',
    'gemini-3.5-flash-lite': 'Más ligero y con más cuota',
    'gemini-2.5-flash': 'Cuota propia, buen respaldo',
    'gemini-2.5-flash-lite': 'El más liviano de Google',
    'openai/gpt-oss-120b': 'Razonamiento rápido en Groq',
    'openai/gpt-oss-20b': 'Más liviano, cuota aparte',
    'meta-llama/llama-4-scout-17b-16e-instruct': 'Rápido, cuota aparte',
    'mistral-small-latest': 'Equilibrado y con herramientas',
    'open-mistral-nemo': 'Ligero, cuota aparte',
    'openrouter/free': 'Elige solo un modelo gratis disponible',
    'poolside/laguna-s-2.1:free': 'Gratis, para tareas con herramientas',
}


MARCA['nvidia'] = 'NVIDIA'
EMPRESA['nvidia'] = 'NVIDIA'
CABECERA_LLAVE['nvidia'] = 'X-Nvidia-Key'
URL_OPENAI['nvidia'] = 'https://integrate.api.nvidia.com/v1/chat/completions'
NOMBRES.update({'qwen/qwen3.8-27b': 'Qwen 3.8 27B',
                'qwen/qwen3-coder-480b-a35b-instruct': 'Qwen3 Coder 480B',
                'meta/llama-3.3-70b-instruct': 'Llama 3.3 70B'})
NOTAS.update({'qwen/qwen3.8-27b': 'Cuota propia en Groq',
              'qwen/qwen3-coder-480b-a35b-instruct': 'Especialista en código (NVIDIA, gratis)',
              'meta/llama-3.3-70b-instruct': 'General y estable (NVIDIA, gratis)'})


class TodosAgotados(Exception):
    """Ningun modelo pudo responder. str(e) es el mensaje listo para el usuario."""


class FalloModelo(Exception):
    """Un modelo fallo de forma que justifica pasar al siguiente (segundos de pausa y motivo)."""
    def __init__(self, segundos, motivo):
        super().__init__(motivo)
        self.segundos = segundos
        self.motivo = motivo


# ---------------------------------------------------------------- catalogo
def _entrada(prov, modelo, nombre=None, nota=None):
    return {'id': f'{prov}|{modelo}', 'prov': prov, 'proveedor': EMPRESA.get(prov, prov), 'modelo': modelo,
            'nombre': nombre or NOMBRES.get(modelo) or modelo.split('/')[-1].replace(':free', ''),
            'nota': nota if nota is not None else NOTAS.get(modelo, ''), 'principal': False}


def catalogo():
    """Lista ordenada de modelos. El primero de cada proveedor sale en la lista principal."""
    lista = []
    extra = os.environ.get('MODELOS_IA', '').strip()
    if extra:
        try:
            for f in json.loads(extra):
                if f.get('prov') in ORDEN and f.get('modelo'):
                    lista.append(_entrada(f['prov'], f['modelo'], f.get('nombre'), f.get('nota')))
        except Exception as e:
            print('[CADENA] MODELOS_IA no es un JSON valido, uso la lista por defecto:', e)
            lista = []
    if not lista:
        base = [
            ('gemini', srv.GEMINI_MODEL), ('gemini', srv.GEMINI_MODEL_RESPALDO),
            ('gemini', 'gemini-2.5-flash'), ('gemini', 'gemini-2.5-flash-lite'),
            ('groq', srv.GROQ_MODEL), ('groq', 'openai/gpt-oss-20b'), ('groq', 'qwen/qwen3.8-27b'),
            ('nvidia', 'openai/gpt-oss-120b'), ('nvidia', 'qwen/qwen3-coder-480b-a35b-instruct'),
            ('nvidia', 'meta/llama-3.3-70b-instruct'),
            ('groq', 'meta-llama/llama-4-scout-17b-16e-instruct'),
            ('mistral', os.environ.get('MISTRAL_MODEL', 'mistral-small-latest')), ('mistral', 'open-mistral-nemo'),
            ('openrouter', 'openrouter/free'), ('openrouter', 'poolside/laguna-s-2.1:free'),
        ]
        vistos = set()
        for prov, modelo in base:
            if modelo and (prov, modelo) not in vistos:
                vistos.add((prov, modelo))
                lista.append(_entrada(prov, modelo))
    lista.sort(key=lambda m: ORDEN.index(m['prov']))   # sort estable: respeta el orden dentro de cada proveedor
    vistos = set()
    for m in lista:
        if m['prov'] not in vistos:
            vistos.add(m['prov'])
            m['principal'] = True
    return lista


@bp.route('/modelos', methods=['GET'])
def api_modelos():
    return jsonify({'modelos': [{k: m[k] for k in ('id', 'prov', 'proveedor', 'nombre', 'nota', 'principal')}
                                for m in catalogo()]})


# ---------------------------------------------------------------- llaves
def reunir_llaves(cabeceras, usa_servidor):
    """{'gemini': llave, ...} con las llaves disponibles: navegador, luego cuenta, luego servidor."""
    env = {'gemini': srv.GEMINI_API_KEY, 'groq': srv.GROQ_API_KEY,
           'mistral': os.environ.get('MISTRAL_API_KEY', ''), 'openrouter': os.environ.get('OPENROUTER_API_KEY', ''),
           'nvidia': os.environ.get('NVIDIA_API_KEY', '')}
    llaves = {p: (cabeceras.get(CABECERA_LLAVE[p], '') or '').strip() for p in ORDEN}
    if not all(llaves.values()):
        try:
            import llaves_api
            cuenta = llaves_api.llaves_del_usuario() or {}
        except Exception as e:
            print('[CADENA] No pude leer las llaves de la cuenta:', e)
            cuenta = {}
        for p in ORDEN:
            if not llaves[p]:
                llaves[p] = cuenta.get(p, '') or (env[p] if usa_servidor else '')
    return {p: k for p, k in llaves.items() if k}


# ---------------------------------------------------------------- estado de agotados
_agotados = {}   # (proveedor, modelo, huella de la llave) -> (hasta, motivo)


def _huella(llave):
    return hashlib.sha1(llave.encode()).hexdigest()[:8]


def _bloqueo(m, llave):
    r = _agotados.get((m['prov'], m['modelo'], _huella(llave)))
    if r and r[0] > time.time():
        return r
    return None


def _bloquear(m, llave, segundos, motivo):
    _agotados[(m['prov'], m['modelo'], _huella(llave))] = (time.time() + segundos, motivo)


def _espera_429(resp):
    """Segundos que conviene esperar tras un 429 (cabecera Retry-After o texto del error)."""
    texto = resp.text or ''
    seg = None
    try:
        seg = float(resp.headers.get('retry-after'))
    except (TypeError, ValueError):
        pass
    if seg is None:
        f = re.search(r'retry(?:Delay)?["\s:=]+"?(\d+(?:\.\d+)?)s', texto, re.I)
        if f:
            seg = float(f.group(1))
    if seg is None:
        f = re.search(r'try again in ([0-9hms.]+)', texto, re.I)
        if f:
            seg = srv._segundos(f.group(1))
    seg = seg if seg else 90
    if re.search(r'per ?day|daily|RPD|TPD', texto, re.I):
        seg = max(seg, 3600)
    return int(min(max(seg, 5), 21600))


def _clasificar(e):
    """(segundos, motivo) si el error justifica saltar al siguiente modelo; None si no."""
    if isinstance(e, FalloModelo):
        return e.segundos, e.motivo
    if isinstance(e, (requests.exceptions.Timeout, requests.exceptions.ConnectionError)):
        return 60, 'no responde'
    if isinstance(e, requests.exceptions.HTTPError) and e.response is not None:
        c = e.response.status_code
        if c == 429:
            return _espera_429(e.response), 'cuota agotada'
        if c in (401, 403):
            return 600, 'llave rechazada'
        if c == 404:
            return 3600, 'no disponible'
        if c in (400, 413, 422):
            return 300, 'rechazó la petición'
        if c in (500, 502, 503, 504):
            return 90, 'saturado'
    return None


def _cuanto(seg):
    seg = int(seg)
    if seg < 90:
        return f'{max(seg, 1)} s'
    if seg < 5400:
        return f'{round(seg / 60)} min'
    return f'{round(seg / 3600)} h'


# ---------------------------------------------------------------- proveedores compatibles con OpenAI
def _texto_de(c):
    if isinstance(c, list):
        return ''.join(p.get('text', '') for p in c if isinstance(p, dict))
    return c or ''


def _generar_openai(prov, modelo, system_prompt, turnos, api_key, nivel):
    mensajes = [{'role': 'system', 'content': system_prompt}]
    for h in turnos:
        mensajes.append({'role': 'user' if h['role'] == 'user' else 'assistant', 'content': h['texto']})
    acciones = {'urls_abrir': [], 'busqueda': None, 'imagenes': []}
    tools = srv.construir_tools_groq()   # mismo formato OpenAI
    cab = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    if prov == 'openrouter':
        cab['HTTP-Referer'] = os.environ.get('APP_URL', 'https://jarvis-mu-ebon-12.vercel.app')
        cab['X-Title'] = 'Jarvis'
    acumulado, continuaciones = '', 0
    for _ in range(srv.MAX_VUELTAS_HERRAMIENTAS + srv.MAX_CONTINUACIONES):
        cuerpo = {'model': modelo, 'messages': mensajes, 'temperature': srv._temp(),
                  'max_tokens': max(srv.TOKENS_GROQ[nivel], 2048)}
        if tools:
            cuerpo['tools'] = tools
            cuerpo['tool_choice'] = 'auto'
        print(f'[{prov.upper()}] Llamando con modelo {modelo}...')
        resp = requests.post(URL_OPENAI[prov], headers=cab, json=cuerpo, timeout=srv.TIMEOUT_IA)
        print(f'[{prov.upper()}] Respuesta HTTP: {resp.status_code}')
        if resp.status_code != 200:
            print(f'[{prov.upper()}] Cuerpo del error: {resp.text[:1500]}')
        resp.raise_for_status()
        data = resp.json()
        if not data.get('choices'):   # OpenRouter a veces responde 200 con {"error": ...}
            raise FalloModelo(120, 'respondió con error')
        eleccion = data['choices'][0]
        msg = eleccion.get('message') or {}
        tool_calls = msg.get('tool_calls') or []
        mensajes.append({'role': 'assistant', 'content': _texto_de(msg.get('content')),
                         **({'tool_calls': tool_calls} if tool_calls else {})})
        if not tool_calls:
            aviso_guardia = '' if acumulado else srv.exigir_herramienta(acciones)
            if aviso_guardia:
                mensajes.append({'role': 'user', 'content': aviso_guardia})
                continue
            acumulado += _texto_de(msg.get('content'))
            if eleccion.get('finish_reason') == 'length':
                if continuaciones < srv.MAX_CONTINUACIONES:
                    continuaciones += 1
                    mensajes.append({'role': 'user', 'content': srv.PROMPT_CONTINUAR})
                    continue
                acumulado += srv.NOTA_CORTADA
            if not acumulado.strip():
                raise FalloModelo(60, 'respondió vacío')
            return acumulado.strip(), acciones
        for tc in tool_calls:
            nombre = tc['function']['name']
            try:
                args = json.loads(tc['function'].get('arguments') or '{}')
            except json.JSONDecodeError:
                args = {}
            print(f'[{prov.upper()}] Herramienta solicitada: {nombre}({args})')
            resultado = srv.ejecutar_herramienta(nombre, args, acciones)
            fila = {'role': 'tool', 'tool_call_id': tc['id'], 'content': json.dumps(resultado, ensure_ascii=False)}
            if prov == 'mistral':
                fila['name'] = nombre
            mensajes.append(fila)
        srv._paso_final()
    return 'Me enredé pensando demasiado en eso, señor. ¿Puede reformularlo?', acciones


def _generar_uno(m, system_prompt, turnos, llave, nivel):
    g.modelo_gemini = m['modelo'] if m['prov'] == 'gemini' else None
    g.modelo_groq = m['modelo'] if m['prov'] == 'groq' else None
    if m['prov'] == 'gemini':
        return srv.generar_gemini(system_prompt, turnos, llave, nivel)
    if m['prov'] == 'groq':
        return srv.generar_groq(system_prompt, turnos, llave, nivel)
    return _generar_openai(m['prov'], m['modelo'], system_prompt, turnos, llave, nivel)


# ---------------------------------------------------------------- cadena
# Modelos que en pruebas inventan acciones en vez de llamar herramientas: se evitan cuando piden algo del celular.
SIN_HERRAMIENTAS_FIABLES = {'openrouter/free', 'open-mistral-nemo', 'meta-llama/llama-4-scout-17b-16e-instruct'}


def _para_celular(lista):
    try:
        if not g.get('pide_celular'):
            return lista
    except RuntimeError:
        return lista
    mejores = [m for m in lista if m['modelo'] not in SIN_HERRAMIENTAS_FIABLES]
    return mejores or lista


def cadena(llaves, eleccion='auto', cambio_auto=True, solo_gemini=False):
    """Modelos a probar, en orden. eleccion: 'auto', 'prov|modelo' o solo 'prov' (valor antiguo)."""
    cat = [m for m in catalogo() if m['prov'] in llaves]
    if solo_gemini:
        cat = [m for m in cat if m['prov'] == 'gemini']
    eleccion = (eleccion or 'auto').strip()
    if eleccion != 'auto':
        fijo = [m for m in cat if m['id'] == eleccion] or [m for m in cat if m['prov'] == eleccion][:1]
        if fijo:
            return fijo + _para_celular([m for m in cat if m is not fijo[0]]) if cambio_auto else fijo
    return _para_celular(cat)


def proveedor_de_texto(llaves, eleccion, cambio_auto, solo_gemini):
    """'gemini' o 'groq': como se arman los adjuntos (Gemini ve imagenes y PDF; los demas reciben texto)."""
    c = cadena(llaves, eleccion, cambio_auto, solo_gemini)
    return 'gemini' if c and c[0]['prov'] == 'gemini' else 'groq'


def _mensaje_agotados(fallos, solo_gemini):
    if solo_gemini and not fallos:
        return 'Para analizar imágenes o PDF necesito su llave de Gemini, señor. Conéctela en Ajustes.'
    if fallos and all(f[2] == 'llave rechazada' for f in fallos):
        return 'Señor, ninguna de las llaves conectadas fue aceptada. Revíselas en Ajustes → Llave IA.'
    if len(fallos) == 1:
        m, seg, motivo = fallos[0]
        return (f'Señor, {m["nombre"]} no puede responder ahora ({motivo}); vuelve en ~{_cuanto(seg)}. '
                'Elija Automático o active "Cambiar al siguiente si se agota" en el selector de modelo.')
    por_prov = {}
    for m, seg, motivo in fallos:
        e = por_prov.setdefault(m['prov'], [0, seg, motivo])
        e[0] += 1
        e[1] = min(e[1], seg)
    lineas = ['Señor, todos los modelos gratuitos disponibles están agotados por ahora:']
    for prov, (n, seg, motivo) in por_prov.items():
        lineas.append(f'• {MARCA.get(prov, prov)} ({n} {"modelo" if n == 1 else "modelos"}): {motivo}, '
                      f'vuelve en ~{_cuanto(seg)}')
    pronto = min(f[1] for f in fallos)
    lineas.append(f'El primero en volver lo hará en ~{_cuanto(pronto)}. '
                  'Mientras tanto puede conectar otra llave en Ajustes → Llave IA.')
    if solo_gemini:
        lineas.append('Con imágenes o PDF solo puedo usar Gemini.')
    return '\n'.join(lineas)


def _pidio_abrir(args, kwargs):
    """True si el ultimo mensaje del usuario pide abrir una app: ahi se queda, no se le devuelve a la anterior."""
    try:
        import unicodedata
        turnos = kwargs['turnos'] if 'turnos' in kwargs else args[1]
        for h in reversed(turnos):
            if h.get('role') == 'user':
                t = unicodedata.normalize('NFD', str(h.get('texto', '')).lower())
                t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
                return bool(re.search(r'\b(abre|abreme|abrime|abrir|entra|entrar|lanza|lanzar)\b', t))
    except Exception:
        pass
    return False


def generar(*args, **kwargs):
    """Igual que la cadena de modelos; al terminar, si Jarvis uso el celular, devuelve al usuario a su app."""
    try:
        return _generar_cadena(*args, **kwargs)
    finally:
        try:
            if not _pidio_abrir(args, kwargs):
                srv.manos_api.volver_origen()
        except Exception as e:
            print('[MANOS] no pude pedir volver a la app:', e)


def _generar_cadena(system_prompt, turnos, llaves, nivel='medio', eleccion='auto', cambio_auto=True, solo_gemini=False):
    """Devuelve (respuesta, acciones, modelo_usado). Lanza TodosAgotados si ninguno responde."""
    lista = cadena(llaves, eleccion, cambio_auto, solo_gemini)
    fallos = []
    ahora = time.time()
    for i, m in enumerate(lista):
        llave = llaves[m['prov']]
        b = _bloqueo(m, llave)
        if b:
            fallos.append((m, b[0] - ahora, b[1]))
            continue
        try:
            texto, acciones = _generar_uno(m, system_prompt, turnos, llave, nivel)
            if fallos:
                print(f'[CADENA] Respondió {m["nombre"]} tras saltar: ' + ', '.join(f[0]['nombre'] for f in fallos))
            else:
                print(f'[CADENA] Respondió {m["nombre"]}')
            return texto, acciones, m
        except Exception as e:
            c = _clasificar(e)
            if c is None:
                raise
            seg, motivo = c
            _bloquear(m, llave, seg, motivo)
            fallos.append((m, seg, motivo))
            print(f'[CADENA] {m["nombre"]}: {motivo} (pausa {_cuanto(seg)}). Detalle: {e.__class__.__name__}')
            sig = [x for x in lista[i + 1:] if not _bloqueo(x, llaves[x['prov']])]
            if sig:
                srv._paso(f'{m["nombre"]}: {motivo}. Cambiando a {sig[0]["nombre"]}')
        finally:
            g.modelo_gemini = None
            g.modelo_groq = None
    raise TodosAgotados(_mensaje_agotados(fallos, solo_gemini))
