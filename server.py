import os
import re
import json
import tempfile
import traceback
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

load_dotenv()
from flask import Flask, request, jsonify, send_from_directory, Response, g

from comandos_dispositivo import encender_linterna, apagar_linterna, vibrar, estado_bateria
import supa

app = Flask(__name__, static_folder='public', static_url_path='')
app.register_blueprint(supa.bp)

# --- Modelo local (llama-server corriendo en el mismo Termux) ---
MODELO_LOCAL_URL = os.environ.get('MODELO_LOCAL_URL', 'http://localhost:8081/v1/chat/completions')

# --- Gemini (API en la nube) ---
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-3.5-flash-lite')
GEMINI_URL = f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent'

# --- Groq (respaldo si Gemini se queda sin cuota) ---
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_MODEL = os.environ.get('GROQ_MODEL', 'openai/gpt-oss-120b')
GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

# --- Voz (Piper), igual que antes ---
BASE_DIR = os.path.dirname(__file__)
PIPER_BIN = os.path.expanduser(os.environ.get('PIPER_BIN', os.path.join(BASE_DIR, 'piper', 'piper')))
PIPER_LIB = os.path.expanduser(os.environ.get('PIPER_LIB', os.path.join(BASE_DIR, 'piper')))
PIPER_VOICE = os.path.expanduser(os.environ.get('PIPER_VOICE', os.path.join(BASE_DIR, 'piper_voices', 'es_ES-davefx-medium.onnx')))


def limpiar_texto_para_voz(texto):
    texto = re.sub(r'[*_#`]', '', texto)
    texto = re.sub(r'^\s*[-•]\s+', '', texto, flags=re.MULTILINE)
    return texto.strip()


def generar_audio(texto):
    import subprocess
    texto = limpiar_texto_para_voz(texto)
    tmp_path = None
    try:
        tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tmp_path = tmp.name
        tmp.close()
        env = dict(os.environ)
        env['LD_LIBRARY_PATH'] = PIPER_LIB
        subprocess.run(
            [PIPER_BIN, '-m', PIPER_VOICE, '--output_file', tmp_path],
            input=texto, text=True, env=env, timeout=60, check=True, capture_output=True
        )
        with open(tmp_path, 'rb') as f:
            return f.read()
    except Exception as e:
        print('Error generando audio con Piper:', e)
        traceback.print_exc()
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


# =========================================================================
# HERRAMIENTAS (function calling)
# Una sola fuente de verdad: de aqui se arma el formato que pide Gemini
# y el formato que pide Groq (son distintos, pero el contenido es el mismo).
# =========================================================================

HERRAMIENTAS = [
    {
        'name': 'abrir_url',
        'description': (
            'Abre una pagina web, app web o enlace en el navegador del usuario. '
            'Usar cuando el usuario pida abrir YouTube, Google Maps, WhatsApp Web, '
            'una busqueda, o cualquier sitio.'
        ),
        'parameters': {
            'type': 'object',
            'properties': {
                'url': {'type': 'string', 'description': 'URL completa a abrir, incluyendo https://'}
            },
            'required': ['url']
        }
    },
    {
        'name': 'encender_linterna',
        'description': 'Enciende la linterna fisica del telefono del usuario.',
        'parameters': {'type': 'object', 'properties': {}}
    },
    {
        'name': 'apagar_linterna',
        'description': 'Apaga la linterna fisica del telefono del usuario.',
        'parameters': {'type': 'object', 'properties': {}}
    },
    {
        'name': 'vibrar',
        'description': 'Hace vibrar el telefono del usuario brevemente, para llamar su atencion.',
        'parameters': {'type': 'object', 'properties': {}}
    },
    {
        'name': 'consultar_bateria',
        'description': (
            'Consulta el porcentaje REAL de bateria del telefono del usuario y si '
            'esta cargando en este momento. Usar siempre que pregunten por la '
            'bateria - nunca inventar el dato sin llamar a esta herramienta.'
        ),
        'parameters': {'type': 'object', 'properties': {}}
    },
    {
        'name': 'guardar_recuerdo',
        'description': (
            'Guarda un dato importante y permanente sobre el usuario (su nombre, '
            'proyectos, preferencias, datos personales relevantes) para recordarlo '
            'siempre en conversaciones futuras. No usar para cosas triviales de un '
            'solo mensaje.'
        ),
        'parameters': {
            'type': 'object',
            'properties': {
                'tema': {'type': 'string', 'description': 'Tema corto en minusculas, ej: nombre, ciudad, mascota. Si el tema ya existe, se actualiza en vez de duplicarse'},
                'dato': {'type': 'string', 'description': 'El dato a recordar, en una frase corta y clara'}
            },
            'required': ['tema', 'dato']
        }
    },
    {
        'name': 'olvidar_recuerdo',
        'description': 'Borra un dato guardado del usuario cuando el pida que lo olvides. Usa el mismo tema con el que se guardo.',
        'parameters': {
            'type': 'object',
            'properties': {
                'tema': {'type': 'string', 'description': 'El tema a olvidar'}
            },
            'required': ['tema']
        }
    },
]


def ejecutar_herramienta(nombre, argumentos, acciones_frontend):
    """Ejecuta una herramienta real y devuelve un dict con el resultado para el modelo.
    acciones_frontend se va llenando con cosas que el NAVEGADOR debe hacer
    (como abrir una pestana), porque el backend no puede hacerlo directamente.
    """
    if nombre == 'abrir_url':
        url = (argumentos.get('url') or '').strip()
        if not url:
            return {'ok': False, 'error': 'no se dio una url'}
        acciones_frontend['urls_abrir'].append(url)
        return {'ok': True, 'mensaje': f'Se abrira {url} en una pestana nueva del navegador del usuario.'}

    if nombre == 'encender_linterna':
        ok = encender_linterna()
        return {'ok': ok}

    if nombre == 'apagar_linterna':
        ok = apagar_linterna()
        return {'ok': ok}

    if nombre == 'vibrar':
        ok = vibrar()
        return {'ok': ok}

    if nombre == 'consultar_bateria':
        bateria = estado_bateria()
        if bateria:
            return {'ok': True, 'porcentaje': bateria['porcentaje'], 'cargando': bateria['cargando']}
        return {'ok': False, 'error': 'no se pudo leer la bateria en este momento'}

    if nombre == 'guardar_recuerdo':
        tema = (argumentos.get('tema') or '').strip()
        dato = (argumentos.get('dato') or '').strip()
        if not tema or not dato:
            return {'ok': False, 'error': 'falta tema o dato'}
        try:
            supa.guardar_recuerdo(tema, dato)
            return {'ok': True}
        except supa.SupaError as e:
            return {'ok': False, 'error': str(e)}

    if nombre == 'olvidar_recuerdo':
        tema = (argumentos.get('tema') or '').strip()
        if not tema:
            return {'ok': False, 'error': 'falta el tema'}
        try:
            supa.olvidar_recuerdo(tema)
            return {'ok': True}
        except supa.SupaError as e:
            return {'ok': False, 'error': str(e)}

    return {'ok': False, 'error': f'herramienta desconocida: {nombre}'}


def construir_tools_gemini():
    return [{'functionDeclarations': HERRAMIENTAS}]


def construir_tools_groq():
    return [{'type': 'function', 'function': h} for h in HERRAMIENTAS]


MAX_VUELTAS_HERRAMIENTAS = 5


def generar_gemini(system_prompt, turnos, api_key):
    contenidos = []
    for h in turnos:
        rol = 'user' if h['role'] == 'user' else 'model'
        contenidos.append({'role': rol, 'parts': [{'text': h['texto']}]})

    acciones = {'urls_abrir': []}

    for _ in range(MAX_VUELTAS_HERRAMIENTAS):
        print(f'[GEMINI] Llamando a {GEMINI_URL} con modelo {GEMINI_MODEL}...')
        resp = requests.post(
            GEMINI_URL,
            params={'key': api_key},
            json={
                'system_instruction': {'parts': [{'text': system_prompt}]},
                'contents': contenidos,
                'tools': construir_tools_gemini(),
                'generationConfig': {'temperature': 0.7, 'maxOutputTokens': 500}
            },
            timeout=30
        )
        print(f'[GEMINI] Respuesta HTTP: {resp.status_code}')
        if resp.status_code != 200:
            print(f'[GEMINI] Cuerpo del error: {resp.text[:2000]}')
        resp.raise_for_status()
        data = resp.json()

        contenido_modelo = data['candidates'][0]['content']
        contenidos.append(contenido_modelo)

        partes = contenido_modelo.get('parts', [])
        llamadas = [p['functionCall'] for p in partes if 'functionCall' in p]

        if not llamadas:
            texto = ''.join(p.get('text', '') for p in partes)
            return texto.strip(), acciones

        partes_respuesta = []
        for llamada in llamadas:
            nombre = llamada.get('name', '')
            args = llamada.get('args', {}) or {}
            print(f'[GEMINI] Herramienta solicitada: {nombre}({args})')
            resultado = ejecutar_herramienta(nombre, args, acciones)
            partes_respuesta.append({'functionResponse': {'name': nombre, 'response': resultado}})

        contenidos.append({'role': 'user', 'parts': partes_respuesta})

    return 'Me enrede pensando demasiado en eso, señor. ¿Puede reformularlo?', acciones


def generar_groq(system_prompt, turnos, api_key):
    mensajes = [{'role': 'system', 'content': system_prompt}]
    for h in turnos:
        rol = 'user' if h['role'] == 'user' else 'assistant'
        mensajes.append({'role': rol, 'content': h['texto']})

    acciones = {'urls_abrir': []}
    tools = construir_tools_groq()

    for _ in range(MAX_VUELTAS_HERRAMIENTAS):
        print(f'[GROQ] Llamando a {GROQ_URL} con modelo {GROQ_MODEL}...')
        resp = requests.post(
            GROQ_URL,
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={
                'model': GROQ_MODEL,
                'messages': mensajes,
                'temperature': 0.7,
                'max_tokens': 500,
                'tools': tools,
                'tool_choice': 'auto'
            },
            timeout=30
        )
        print(f'[GROQ] Respuesta HTTP: {resp.status_code}')
        if resp.status_code != 200:
            print(f'[GROQ] Cuerpo del error: {resp.text[:2000]}')
        resp.raise_for_status()
        data = resp.json()

        msg = data['choices'][0]['message']
        mensajes.append(msg)

        tool_calls = msg.get('tool_calls') or []
        if not tool_calls:
            return (msg.get('content') or '').strip(), acciones

        for tc in tool_calls:
            nombre = tc['function']['name']
            try:
                args = json.loads(tc['function'].get('arguments') or '{}')
            except json.JSONDecodeError:
                args = {}
            print(f'[GROQ] Herramienta solicitada: {nombre}({args})')
            resultado = ejecutar_herramienta(nombre, args, acciones)
            mensajes.append({
                'role': 'tool',
                'tool_call_id': tc['id'],
                'content': json.dumps(resultado, ensure_ascii=False)
            })

    return 'Me enrede pensando demasiado en eso, señor. ¿Puede reformularlo?', acciones


# --- Modelo local (llama-server): sin herramientas por ahora, modo simple ---
def generar_local(system_prompt, turnos):
    mensajes = [{'role': 'system', 'content': system_prompt}]
    for h in turnos:
        rol = 'user' if h['role'] == 'user' else 'assistant'
        mensajes.append({'role': rol, 'content': h['texto']})

    resp = requests.post(
        MODELO_LOCAL_URL,
        json={'messages': mensajes, 'temperature': 0.7, 'max_tokens': 500},
        timeout=120
    )
    resp.raise_for_status()
    data = resp.json()
    return data['choices'][0]['message']['content'].strip(), {'urls_abrir': []}


SYSTEM_PROMPT_BASE = (
    'Eres J.A.R.V.I.S., el asistente de inteligencia artificial personal del '
    'usuario. Adoptas su personalidad de las peliculas de Iron Man: extremadamente '
    'inteligente, calma casi de mayordomo britanico, sobrio y elegante, con humor '
    'seco e ironico sutil. Te diriges siempre al usuario como "señor". Das '
    'respuestas concisas salvo que se te pida detalle. Nunca dices que eres un '
    'modelo de lenguaje. '
    'Tienes herramientas reales conectadas a este telefono: abrir paginas web, '
    'encender/apagar la linterna, vibrar el telefono, consultar la bateria real '
    'y guardar datos importantes del usuario para recordarlos siempre. Usalas '
    'cuando el usuario lo pida o cuando sea evidente que corresponde, y luego '
    'responde de forma natural con el resultado real que te devuelven. Nunca '
    'inventes un dato (como el porcentaje de bateria) sin haber llamado antes '
    'a la herramienta correspondiente.'
)


@app.route('/')
def index():
    return send_from_directory('public', 'index.html')


@app.route('/voz', methods=['POST'])
def voz():
    data = request.get_json()
    texto = data.get('texto', '').strip()
    if not texto:
        return jsonify({'error': 'texto vacio'}), 400
    if len(texto) > 4000:
        return jsonify({'error': 'texto demasiado largo'}), 400
    audio_bytes = generar_audio(texto)
    if audio_bytes is None:
        return jsonify({'error': 'no se pudo generar audio'}), 500
    return Response(audio_bytes, mimetype='audio/wav')


@app.route('/chat', methods=['POST'])
@supa.requiere_login
def chat():
    try:
        data = request.get_json()
        mensaje_usuario = data.get('mensaje', '')
        zona_horaria = data.get('zona_horaria', '') or 'UTC'
        chat_id = (data.get('chat_id') or '').strip()
        if not chat_id:
            chat_id = supa.crear_chat()['id']

        proveedor = (request.headers.get('X-Proveedor', '') or 'gemini').strip().lower()
        if proveedor not in ('gemini', 'groq'):
            proveedor = 'gemini'

        llave_gemini_navegador = request.headers.get('X-Gemini-Key', '').strip()
        llave_groq_navegador = request.headers.get('X-Groq-Key', '').strip()

        if proveedor == 'groq':
            api_key = llave_groq_navegador or GROQ_API_KEY
            if not api_key:
                return jsonify({'respuesta': 'No tengo una llave de Groq configurada, señor. Agreguela en Ajustes o en el archivo .env.'}), 400
        else:
            api_key = llave_gemini_navegador or GEMINI_API_KEY
            if not api_key:
                return jsonify({'respuesta': 'No tengo una llave de Gemini configurada, señor. Agreguela en Ajustes o en el archivo .env.'}), 400

        historial = supa.mensajes_de(chat_id)

        try:
            ahora = datetime.now(ZoneInfo(zona_horaria))
        except Exception:
            ahora = datetime.now()
        fecha_hora_str = ahora.strftime('%A %d de %B de %Y, %H:%M')

        recuerdos = supa.cargar_recuerdos()
        texto_recuerdos = ''
        if recuerdos:
            texto_recuerdos = ' Datos importantes que ya sabes del usuario: ' + '; '.join(
                f"{r['clave']}: {r['valor']}" for r in recuerdos) + '.'

        nombre = (g.get('nombre') or '').split(' ')[0]
        texto_nombre = ''
        if nombre:
            texto_nombre = f' El usuario se llama {nombre}; puedes usar su nombre de vez en cuando, ademas de "señor".'
        system_prompt = SYSTEM_PROMPT_BASE + texto_nombre + f' La fecha y hora ACTUAL es: {fecha_hora_str}.' + texto_recuerdos

        turnos = list(historial[-20:])  # ultimos turnos, para no saturar el contexto del modelo chico
        turnos.append({'role': 'user', 'texto': mensaje_usuario})

        if proveedor == 'groq':
            respuesta, acciones = generar_groq(system_prompt, turnos, api_key)
        else:
            respuesta, acciones = generar_gemini(system_prompt, turnos, api_key)

        if not respuesta.strip():
            respuesta = 'Parece que mis circuitos se distrajeron un instante, señor. ¿Podría repetirlo?'

        era_nuevo = len(historial) == 0
        supa.guardar_intercambio(chat_id, mensaje_usuario, respuesta)
        if era_nuevo:
            supa.renombrar_chat(chat_id, mensaje_usuario)

        return jsonify({'respuesta': respuesta, 'chat_id': chat_id,
                        'urls_abrir': acciones.get('urls_abrir', [])})

    except requests.exceptions.Timeout as e:
        print('[ERROR] Timeout esperando respuesta del proveedor de IA:', e)
        traceback.print_exc()
        return jsonify({'respuesta': 'La IA esta tardando demasiado en responder, señor. Intente de nuevo en un momento.'}), 504

    except requests.exceptions.HTTPError as e:
        print('[ERROR] HTTPError del proveedor de IA:', e)
        if e.response is not None:
            print('[ERROR] Codigo:', e.response.status_code, '- Cuerpo:', e.response.text[:2000])
        traceback.print_exc()
        if e.response is not None and e.response.status_code in (400, 401, 403):
            return jsonify({'respuesta': 'La llave configurada parece invalida o sin permisos, señor. Revisela en Ajustes.'}), 401
        return jsonify({'respuesta': 'El proveedor de IA respondio con un error, señor.'}), 502

    except requests.exceptions.ConnectionError as e:
        print('[ERROR] ConnectionError hablando con el proveedor de IA:', e)
        traceback.print_exc()
        return jsonify({'respuesta': 'No logro conectarme en este momento, señor. Verifique la conexion a internet o la clave de API.'}), 500

    except supa.SupaError as e:
        print('[ERROR] Supabase en /chat:', e)
        return jsonify({'respuesta': 'No puedo acceder a su historial en este momento, señor.', 'error': str(e)}), 502

    except Exception as e:
        print('[ERROR] Excepcion inesperada en /chat:', e)
        traceback.print_exc()
        return jsonify({'respuesta': 'Algo ha fallado de mi lado, señor.'}), 500


import logging
logging.getLogger('werkzeug').setLevel(logging.WARNING)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f'Jarvis (motor de herramientas) corriendo en http://localhost:{port}')
    app.run(host='0.0.0.0', port=port)
