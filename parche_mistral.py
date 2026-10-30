"""Parche: agrega Mistral, mensaje claro para el 429 y respaldo automatico entre proveedores.
Uso (dentro de ~/jarvis):  python3 parche_mistral.py
Hace copia en server.py.bak y no toca nada si algun ancla no coincide."""
import shutil
import sys

ARCHIVO = 'server.py'
src = open(ARCHIVO, encoding='utf-8').read()


def cambiar(viejo, nuevo, nombre):
    global src
    if src.count(viejo) != 1:
        sys.exit(f'[ERROR] No encontre un unico ancla para: {nombre} (aparece {src.count(viejo)} veces). No cambie nada.')
    src = src.replace(viejo, nuevo)


# 1) Constantes de Mistral
cambiar(
    "GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'\n",
    "GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'\n"
    "MISTRAL_API_KEY = os.environ.get('MISTRAL_API_KEY', '')\n"
    "MISTRAL_MODEL = os.environ.get('MISTRAL_MODEL', 'mistral-small-latest')\n"
    "MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'\n",
    'constantes')

# 2) generar_mistral (mismo bucle de herramientas que Groq, sin reasoning_effort)
GENERAR_MISTRAL = '''def llamar_mistral(cuerpo, api_key):
    cab = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    return requests.post(MISTRAL_URL, headers=cab, json=cuerpo, timeout=TIMEOUT_IA)


def generar_mistral(system_prompt, turnos, api_key, nivel='medio'):
    mensajes = [{'role': 'system', 'content': system_prompt}]
    for h in turnos:
        rol = 'user' if h['role'] == 'user' else 'assistant'
        mensajes.append({'role': rol, 'content': h['texto']})

    acciones = {'urls_abrir': [], 'busqueda': None, 'imagenes': []}
    tools = construir_tools_groq()   # mismo formato OpenAI
    acumulado, continuaciones = '', 0
    for _ in range(MAX_VUELTAS_HERRAMIENTAS + MAX_CONTINUACIONES):
        print(f'[MISTRAL] Llamando con modelo {MISTRAL_MODEL}...')
        resp = llamar_mistral({
            'model': MISTRAL_MODEL,
            'messages': mensajes,
            'temperature': 0.7,
            'max_tokens': TOKENS_GROQ[nivel],
            **({'tools': tools, 'tool_choice': 'auto'} if tools else {})
        }, api_key)
        print(f'[MISTRAL] Respuesta HTTP: {resp.status_code}')
        if resp.status_code != 200:
            print(f'[MISTRAL] Cuerpo del error: {resp.text[:2000]}')
        resp.raise_for_status()
        eleccion = resp.json()['choices'][0]
        msg = eleccion['message']
        mensajes.append(msg)

        tool_calls = msg.get('tool_calls') or []
        if not tool_calls:
            contenido = msg.get('content') or ''
            if isinstance(contenido, list):
                contenido = ''.join(p.get('text', '') for p in contenido if isinstance(p, dict))
            acumulado += contenido
            if eleccion.get('finish_reason') == 'length':
                if continuaciones < MAX_CONTINUACIONES:
                    continuaciones += 1
                    mensajes.append({'role': 'user', 'content': PROMPT_CONTINUAR})
                    continue
                acumulado += NOTA_CORTADA
            return acumulado.strip(), acciones

        for tc in tool_calls:
            nombre = tc['function']['name']
            try:
                args = tc['function'].get('arguments') or '{}'
                args = json.loads(args) if isinstance(args, str) else args
            except json.JSONDecodeError:
                args = {}
            print(f'[MISTRAL] Herramienta solicitada: {nombre}({args})')
            resultado = ejecutar_herramienta(nombre, args, acciones)
            mensajes.append({
                'role': 'tool',
                'name': nombre,
                'tool_call_id': tc['id'],
                'content': json.dumps(resultado, ensure_ascii=False)
            })
        _paso_final()

    return 'Me enredé pensando demasiado en eso, señor. ¿Puede reformularlo?', acciones


'''
cambiar('def resumir_conversacion(resumen_previo, mensajes, proveedor, api_key):\n',
        GENERAR_MISTRAL + 'def resumir_conversacion(resumen_previo, mensajes, proveedor, api_key):\n',
        'generar_mistral')

# 3) Resumen con Mistral
cambiar(
    "    if proveedor == 'groq':\n        resp = requests.post(\n            GROQ_URL,\n",
    "    if proveedor == 'mistral':\n"
    "        resp = requests.post(\n"
    "            MISTRAL_URL,\n"
    "            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},\n"
    "            json={'model': MISTRAL_MODEL,\n"
    "                  'messages': [{'role': 'system', 'content': PROMPT_RESUMEN},\n"
    "                               {'role': 'user', 'content': entrada}],\n"
    "                  'temperature': 0.3, 'max_tokens': 900},\n"
    "            timeout=30\n"
    "        )\n"
    "        resp.raise_for_status()\n"
    "        texto = resp.json()['choices'][0]['message'].get('content') or ''\n"
    "    elif proveedor == 'groq':\n        resp = requests.post(\n            GROQ_URL,\n",
    'resumen')

# 4) Respaldo automatico entre proveedores (antes de _chat_interno)
RESPALDO = '''def _generador(proveedor):
    return {'groq': generar_groq, 'mistral': generar_mistral}.get(proveedor, generar_gemini)


CABECERA_LLAVE = {'gemini': 'X-Gemini-Key', 'groq': 'X-Groq-Key', 'mistral': 'X-Mistral-Key'}


def _llave_servidor(proveedor, usa_servidor):
    if not usa_servidor:
        return ''
    return {'gemini': GEMINI_API_KEY, 'groq': GROQ_API_KEY, 'mistral': MISTRAL_API_KEY}.get(proveedor, '')


def _generar_con_respaldo(proveedor, system_prompt, turnos, api_key, nivel, usa_servidor, hay_adjuntos):
    """Si el proveedor elegido da 429 o error 5xx, prueba los otros que tengan llave (navegador, cuenta o servidor).
    No hay respaldo si el mensaje trae adjuntos (cada proveedor los lee distinto)."""
    try:
        return _generador(proveedor)(system_prompt, turnos, api_key, nivel)
    except requests.exceptions.HTTPError as e:
        codigo = e.response.status_code if e.response is not None else 0
        if codigo not in (429, 500, 502, 503, 504) or hay_adjuntos:
            raise
        primer_error = e
    try:
        cuenta = llaves_api.llaves_del_usuario() or {}
    except Exception:
        cuenta = {}
    for alterno in ('mistral', 'groq', 'gemini'):
        if alterno == proveedor:
            continue
        llave = (request.headers.get(CABECERA_LLAVE[alterno], '').strip()
                 or cuenta.get(alterno, '') or _llave_servidor(alterno, usa_servidor))
        if not llave:
            continue
        print(f'[RESPALDO] {proveedor} fallo con {codigo}; pruebo {alterno}.')
        try:
            return _generador(alterno)(system_prompt, turnos, llave, nivel)
        except requests.exceptions.RequestException as e2:
            print(f'[RESPALDO] {alterno} tambien fallo:', e2.__class__.__name__)
    raise primer_error


'''
cambiar('@supa.requiere_login\ndef _chat_interno():\n',
        RESPALDO + '@supa.requiere_login\ndef _chat_interno():\n', 'respaldo')

