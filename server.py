import os
import re
import io
import json
import base64
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


def generar_audio(texto, tono=1.0, vel=1.0):
    import subprocess
    texto = limpiar_texto_para_voz(texto)
    tmp_path = None
    try:
        tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tmp_path = tmp.name
        tmp.close()
        env = dict(os.environ)
        env['LD_LIBRARY_PATH'] = PIPER_LIB
        largo = max(0.5, min(1.5, tono / vel))
        base = [PIPER_BIN, '-m', PIPER_VOICE, '--output_file', tmp_path]
        try:
            subprocess.run(base + ['--length_scale', '%.3f' % largo],
                           input=texto, text=True, env=env, timeout=60, check=True, capture_output=True)
        except subprocess.CalledProcessError:
            subprocess.run(base, input=texto, text=True, env=env, timeout=60, check=True, capture_output=True)
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
            'Usar cuando el usuario pida abrir un sitio o buscar algo DENTRO de un sitio '
            '(Mercado Libre, Amazon, YouTube, Google Maps, WhatsApp Web...): en ese caso la '
            'URL debe ser la de resultados de busqueda de ese sitio. Si el usuario pidio '
            'BUSCAR algo en un sitio, antes de llamarla pide confirmacion y espera su '
            'respuesta; si solo pidio abrir el sitio, abrelo sin preguntar.'
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
        'name': 'buscar_persona',
        'description': (
            'Busca informacion publica sobre una PERSONA en la web y en redes sociales '
            '(Instagram, Facebook, TikTok, X, LinkedIn). Usar SOLO cuando el usuario pida '
            'buscar, investigar o consultar sobre alguien. NUNCA para productos, compras, '
            'tiendas ni busquedas dentro de un sitio (Mercado Libre, Amazon, YouTube...): '
            'para eso usa abrir_url. Solo devuelve '
            'paginas publicas. Despues de usarla, di en que sitios encontraste algo '
            '(Google, Instagram, Facebook...) y resume lo mas relevante.'
        ),
        'parameters': {
            'type': 'object',
            'properties': {
                'consulta': {'type': 'string', 'description': 'Nombre de la persona a buscar, con el contexto que dio el usuario (ciudad, trabajo, etc.)'},
                'redes': {'type': 'array', 'items': {'type': 'string'}, 'description': 'Redes a incluir: instagram, facebook, tiktok, x, linkedin. Si el usuario no dice, omitir y se usan instagram, facebook y linkedin.'}
            },
            'required': ['consulta']
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
    {
        'name': 'generar_imagen',
        'description': (
            'Genera una imagen NUEVA con IA a partir de una descripcion y la muestra en el chat. '
            'Usar cuando el usuario pida crear, dibujar, generar o disenar una imagen, foto, '
            'logo, ilustracion o arte. No usar para buscar imagenes que ya existen. Si el pedido '
            'es vago, inventa detalles razonables en vez de preguntar. Si el usuario pide una '
            'imagen, llama a esta herramienta de inmediato, sin avisar antes.'
        ),
        'parameters': {
            'type': 'object',
            'properties': {
                'descripcion': {'type': 'string', 'description': 'Descripcion detallada de la imagen: sujeto, estilo, colores, ambiente y formato'}
            },
            'required': ['descripcion']
        }
    },
]


TAVILY_API_KEY = os.environ.get('TAVILY_API_KEY', '')
REDES_DOMINIOS = {
    'instagram': 'instagram.com', 'facebook': 'facebook.com', 'tiktok': 'tiktok.com',
    'x': 'x.com', 'twitter': 'x.com', 'linkedin': 'linkedin.com',
}
REDES_NOMBRE = {
    'instagram.com': 'Instagram', 'facebook.com': 'Facebook', 'tiktok.com': 'TikTok',
    'x.com': 'X', 'linkedin.com': 'LinkedIn',
}


def _tavily(consulta, dominios=None, max_resultados=4):
    cuerpo = {'query': consulta, 'max_results': max_resultados, 'search_depth': 'basic'}
    if dominios:
        cuerpo['include_domains'] = dominios
    r = requests.post('https://api.tavily.com/search', json=cuerpo, timeout=20,
                      headers={'Authorization': 'Bearer ' + TAVILY_API_KEY})
    r.raise_for_status()
    return r.json().get('results', [])


def buscar_persona(consulta, redes=None):
    """Devuelve (lista_de_resultados, error). Cada resultado: red, titulo, url, extracto."""
    if not TAVILY_API_KEY:
        return [], 'Falta TAVILY_API_KEY (llave gratis en tavily.com) en el .env o en Vercel.'
    dominios = []
    for r in (redes or ['instagram', 'facebook', 'linkedin']):
        d = REDES_DOMINIOS.get(str(r).strip().lower())
        if d and d not in dominios:
            dominios.append(d)
    resultados, vistos = [], set()

    def agregar(lista, red_forzada=None):
        for x in lista:
            url = x.get('url') or ''
            if not url or url in vistos:
                continue
            vistos.add(url)
            red = red_forzada
            if not red:
                red = 'Google'
                for d, n in REDES_NOMBRE.items():
                    if d in url:
                        red = n
            resultados.append({'red': red, 'titulo': (x.get('title') or url)[:120], 'url': url,
                               'extracto': (x.get('content') or '')[:220]})

    try:
        agregar(_tavily(consulta, None, 4))
        for d in dominios:
            try:
                agregar(_tavily(consulta, [d], 2), REDES_NOMBRE.get(d))
            except Exception as e:
                print(f'[BUSQUEDA] Fallo en {d}:', e)
    except Exception as e:
        print('[BUSQUEDA] Error:', e)
        return [], 'La busqueda fallo en este momento.'
    return resultados, None


IMAGEN_MODELO = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image')
IMAGEN_URL = f'https://generativelanguage.googleapis.com/v1beta/models/{IMAGEN_MODELO}:generateContent'


CF_ACCOUNT_ID = os.environ.get('CF_ACCOUNT_ID', '').strip()
CF_API_TOKEN = os.environ.get('CF_API_TOKEN', '').strip()
CF_IMAGEN_MODELO = os.environ.get('CF_IMAGE_MODEL', '@cf/black-forest-labs/flux-1-schnell')


def generar_imagen_cloudflare(descripcion):
    """Devuelve (imagen, error) usando Cloudflare Workers AI."""
    url = f'https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/{CF_IMAGEN_MODELO}'
    try:
        r = requests.post(url, headers={'Authorization': 'Bearer ' + CF_API_TOKEN},
                          json={'prompt': descripcion[:2000], 'steps': 4}, timeout=50)
    except requests.exceptions.Timeout:
        return None, 'La imagen tardo demasiado en generarse.'
    except requests.exceptions.RequestException:
        return None, 'No pude conectar con el generador de imagenes.'
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code != 200 or not data.get('success', True):
        print('[IMAGEN] Cloudflare error', r.status_code, r.text[:500])
        if r.status_code == 429:
            return None, 'Se acabo la cuota diaria de imagenes de Cloudflare.'
        if r.status_code in (401, 403):
            return None, 'El token de Cloudflare no es valido o no tiene permiso de Workers AI.'
        errores = data.get('errors') or [{}]
        return None, f"Cloudflare respondio con error {r.status_code}: {str(errores[0].get('message', ''))[:200]}"
    imagen = (data.get('result') or {}).get('image')
    if not imagen:
        return None, 'El generador no devolvio una imagen (puede que la descripcion fuera bloqueada).'
    if len(imagen) > 3500000:
        return None, 'La imagen salio demasiado pesada para enviarla.'
    return {'mime': 'image/jpeg', 'datos': imagen}, None


def generar_imagen(descripcion, api_key):
    """Devuelve (imagen, error). imagen = {'mime': ..., 'datos': base64}."""
    if CF_ACCOUNT_ID and CF_API_TOKEN:
        return generar_imagen_cloudflare(descripcion)
    cuerpo = {
        'contents': [{'parts': [{'text': descripcion}]}],
        'generationConfig': {'responseModalities': ['TEXT', 'IMAGE']}
    }
    try:
        r = requests.post(IMAGEN_URL, params={'key': api_key}, json=cuerpo, timeout=50)
    except requests.exceptions.Timeout:
        return None, 'La imagen tardo demasiado en generarse.'
    except requests.exceptions.RequestException:
        return None, 'No pude conectar con el generador de imagenes.'
    if r.status_code != 200:
        print('[IMAGEN] Error', r.status_code, r.text[:500])
        if r.status_code == 429:
            return None, 'Se acabo la cuota de imagenes por ahora.'
        try:
            detalle = r.json().get('error', {}).get('message', '')
        except ValueError:
            detalle = ''
        return None, f'El generador de imagenes respondio con error {r.status_code}: {detalle[:200]}'
    sin_imagen = 'El generador no devolvio una imagen (puede que la descripcion fuera bloqueada).'
    try:
        partes = r.json()['candidates'][0]['content'].get('parts', [])
    except (ValueError, KeyError, IndexError):
        return None, sin_imagen
    for p in partes:
        im = p.get('inlineData') or p.get('inline_data')
        if im and im.get('data'):
            if len(im['data']) > 3500000:
                return None, 'La imagen salio demasiado pesada para enviarla.'
            return {'mime': im.get('mimeType') or im.get('mime_type') or 'image/png', 'datos': im['data']}, None
    return None, sin_imagen


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

    if nombre == 'buscar_persona':
        consulta = (argumentos.get('consulta') or '').strip()
        if not consulta:
            return {'ok': False, 'error': 'falta la consulta'}
        resultados, error = buscar_persona(consulta, argumentos.get('redes'))
        if error:
            return {'ok': False, 'error': error}
        if not resultados:
            return {'ok': True, 'resultados': [], 'mensaje': 'No se encontro nada publico.'}
        acciones_frontend['busqueda'] = {'consulta': consulta, 'resultados': resultados}
        return {'ok': True, 'resultados': resultados,
                'mensaje': 'Los resultados ya se muestran al usuario en un panel; el primero se abre solo.'}

    if nombre == 'generar_imagen':
        descripcion = (argumentos.get('descripcion') or '').strip()
        if not descripcion:
            return {'ok': False, 'error': 'falta la descripcion de la imagen'}
        llave = acciones_frontend.get('_llave')
        if not llave and not (CF_ACCOUNT_ID and CF_API_TOKEN):
            return {'ok': False, 'error': 'Con Groq no se pueden generar imagenes; hay que cambiar a Gemini en Ajustes.'}
        if acciones_frontend.get('imagenes'):
            return {'ok': False, 'error': 'ya se genero una imagen en este mensaje; que el usuario pida la siguiente aparte.'}
        imagen, error = generar_imagen(descripcion, llave)
        if error:
            return {'ok': False, 'error': error}
        acciones_frontend['imagenes'].append(imagen)
        return {'ok': True, 'mensaje': 'La imagen ya se muestra al usuario en el chat. Comenta brevemente, sin describirla en detalle.'}

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

# =========================================================================
# ADJUNTOS Y NIVEL DE PENSAMIENTO
# =========================================================================
MAX_ADJUNTOS = 5
MAX_TOTAL_ADJUNTOS = 3300000   # caracteres base64 sumados (Vercel limita el cuerpo a ~4.5 MB)
MAX_TEXTO_ADJUNTO = 20000      # caracteres que se leen de cada archivo de texto o PDF
MAX_PAGINAS_PDF = 40
TIMEOUT_IA = 55

IMAGENES_OK = {'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'}
TIPOS_TEXTO = {'application/json', 'application/xml', 'application/javascript',
               'application/x-yaml', 'application/x-sh', 'application/sql', 'application/csv'}
EXT_TEXTO = {'txt', 'md', 'csv', 'tsv', 'json', 'jsonl', 'xml', 'yaml', 'yml', 'toml', 'ini',
             'cfg', 'conf', 'log', 'html', 'htm', 'css', 'scss', 'js', 'mjs', 'jsx', 'ts', 'tsx',
             'py', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift',
             'sh', 'bat', 'sql', 'r', 'lua', 'dart', 'vue', 'svelte', 'tex', 'srt'}

NIVELES = ('bajo', 'medio', 'alto')
ALIAS_NIVEL = {'low': 'bajo', 'medium': 'medio', 'high': 'alto'}
NIVEL_EN = {'bajo': 'low', 'medio': 'medium', 'alto': 'high'}
# El pensamiento cuenta dentro del limite de salida, por eso se sube segun el nivel.
TOKENS_GEMINI = {'bajo': 2048, 'medio': 4096, 'alto': 8192}
BUDGET_GEMINI = {'bajo': 1024, 'medio': 2048, 'alto': 4096}   # solo para Gemini 2.5
TOKENS_GROQ = {'bajo': 1500, 'medio': 3000, 'alto': 4500}


class AdjuntoError(Exception):
    pass


def nivel_pensamiento(valor):
    v = (valor or '').strip().lower()
    v = ALIAS_NIVEL.get(v, v)
    return v if v in NIVELES else 'medio'


def preparar_adjuntos(adjuntos):
    """Valida y clasifica los adjuntos. Lanza AdjuntoError con un mensaje para el usuario."""
    res = {'nombres': [], 'imagenes': [], 'pdfs': [], 'textos': []}
    if not adjuntos:
        return res
    if not isinstance(adjuntos, list):
        raise AdjuntoError('Los adjuntos llegaron en un formato que no entiendo, señor.')
    if len(adjuntos) > MAX_ADJUNTOS:
        raise AdjuntoError(f'Solo puedo recibir {MAX_ADJUNTOS} adjuntos por mensaje, señor.')
    total = 0
    for a in adjuntos:
        if not isinstance(a, dict):
            raise AdjuntoError('Uno de los adjuntos llego mal formado, señor.')
        nombre = re.sub(r'\s+', ' ', str(a.get('nombre') or 'archivo')).strip()[:80] or 'archivo'
        tipo = str(a.get('tipo') or '').strip().lower()
        datos = a.get('datos') or ''
        if not isinstance(datos, str) or not datos:
            raise AdjuntoError(f'El adjunto "{nombre}" llego vacio, señor.')
        if datos.startswith('data:') and ',' in datos[:200]:
            datos = datos.split(',', 1)[1]
        total += len(datos)
        if total > MAX_TOTAL_ADJUNTOS:
            raise AdjuntoError('Los adjuntos pesan demasiado juntos, señor (maximo unos 3 MB en total). Envie menos o mas livianos.')
        try:
            crudo = base64.b64decode(datos, validate=True)
        except Exception:
            raise AdjuntoError(f'No pude leer el adjunto "{nombre}", señor: llego corrupto.')
        ext = os.path.splitext(nombre)[1].lower().lstrip('.')
        if tipo == 'image/jpg':
            tipo = 'image/jpeg'
        if tipo.startswith('image/'):
            if tipo not in IMAGENES_OK:
                raise AdjuntoError(f'No admito imagenes {tipo.split("/")[1]}, señor. Use JPG, PNG o WEBP.')
            res['imagenes'].append({'nombre': nombre, 'mime': tipo, 'datos': datos})
        elif tipo == 'application/pdf' or ext == 'pdf':
            res['pdfs'].append({'nombre': nombre, 'crudo': crudo, 'datos': datos})
        elif ext in EXT_TEXTO or tipo.startswith('text/') or tipo in TIPOS_TEXTO:
            if b'\x00' in crudo[:4096]:
                raise AdjuntoError(f'"{nombre}" no parece un archivo de texto, señor.')
            res['textos'].append((nombre, crudo.decode('utf-8', errors='replace')))
        else:
            raise AdjuntoError(f'No se leer "{nombre}", señor. Admito imagenes, PDF y archivos de texto o codigo.')
        res['nombres'].append(nombre)
    return res


def texto_de_pdf(crudo):
    """Extrae el texto de un PDF con pypdf. Devuelve '' si no hay texto o no se pudo leer."""
    try:
        from pypdf import PdfReader
        lector = PdfReader(io.BytesIO(crudo))
        if lector.is_encrypted:
            try:
                lector.decrypt('')
            except Exception:
                return ''
        partes = []
        largo = 0
        for pag in lector.pages[:MAX_PAGINAS_PDF]:
            t = (pag.extract_text() or '').strip()
            if t:
                partes.append(t)
                largo += len(t)
            if largo > MAX_TEXTO_ADJUNTO:
                break
        return '\n\n'.join(partes).strip()
    except Exception as e:
        print('[PDF] No pude leer el PDF con pypdf:', e)
        return ''


def bloque_texto(nombre, contenido):
    if len(contenido) > MAX_TEXTO_ADJUNTO:
        contenido = contenido[:MAX_TEXTO_ADJUNTO] + '\n[... archivo recortado por tamaño ...]'
    return f'\n\n--- Archivo adjunto: {nombre} ---\n{contenido}\n--- Fin de {nombre} ---'


def armar_mensaje_con_adjuntos(mensaje, adj, proveedor):
    """Devuelve (texto para el modelo, partes extra para Gemini, aviso para el usuario)."""
    extra = ''
    partes = []
    aviso = ''
    for nombre, contenido in adj['textos']:
        extra += bloque_texto(nombre, contenido)
    for p in adj['pdfs']:
        if proveedor == 'groq':
            t = texto_de_pdf(p['crudo'])
            if t:
                extra += bloque_texto(p['nombre'], t)
            else:
                extra += (f'\n\n[El PDF "{p["nombre"]}" no tiene texto legible (puede ser escaneado). '
                          'Dile al usuario que no pudiste leerlo.]')
        else:
            partes.append({'inlineData': {'mimeType': 'application/pdf', 'data': p['datos']}})
    for im in adj['imagenes']:
        if proveedor != 'groq':
            partes.append({'inlineData': {'mimeType': im['mime'], 'data': im['datos']}})
    if adj['imagenes'] and proveedor == 'groq':
        nombres = ', '.join(i['nombre'] for i in adj['imagenes'])
        extra += (f'\n\n[El usuario adjunto imagenes ({nombres}) pero con este proveedor NO las puedes ver. '
                  'No finjas verlas: dile que cambie a Gemini para analizarlas.]')
        aviso = (f'Con Groq no puedo ver imagenes, señor (no vi: {nombres}). '
                 'Cambie a Gemini en Ajustes para que las analice.')
    base = mensaje or 'El usuario no escribio texto; solo envio los adjuntos.'
    return base + extra, partes, aviso


def config_gemini(nivel):
    cfg = {'temperature': 0.7, 'maxOutputTokens': TOKENS_GEMINI[nivel]}
    if '2.5' in GEMINI_MODEL:
        cfg['thinkingConfig'] = {'thinkingBudget': BUDGET_GEMINI[nivel]}
    else:
        cfg['thinkingConfig'] = {'thinkingLevel': NIVEL_EN[nivel]}
    return cfg


def dia_cuota(proveedor):
    """Dia (AAAA-MM-DD) segun el reinicio de la cuota: Gemini = medianoche del Pacifico; Groq = UTC."""
    zona = 'America/Los_Angeles' if proveedor == 'gemini' else 'UTC'
    return datetime.now(ZoneInfo(zona)).date().isoformat()


def reinicio_cuota(proveedor):
    from datetime import timedelta, timezone
    zona = ZoneInfo('America/Los_Angeles' if proveedor == 'gemini' else 'UTC')
    manana = (datetime.now(zona) + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return manana.astimezone(timezone.utc).isoformat()


def contar_uso(proveedor, resp):
    """Anota una llamada real al proveedor (solo si respondio bien). Se guarda al final de /chat."""
    if resp.status_code >= 400:
        return
    try:
        acc = g.setdefault('uso_pendiente', {}).setdefault(proveedor, [0, 0, 0])
        acc[0] += 1
        d = resp.json()
        if proveedor == 'gemini':
            m = d.get('usageMetadata') or {}
            acc[1] += int(m.get('promptTokenCount') or 0)
            acc[2] += int(m.get('candidatesTokenCount') or 0) + int(m.get('thoughtsTokenCount') or 0)
        else:
            m = d.get('usage') or {}
            acc[1] += int(m.get('prompt_tokens') or 0)
            acc[2] += int(m.get('completion_tokens') or 0)
    except Exception as e:
        print('[USO] No pude leer los tokens de la respuesta:', e)


def guardar_uso_pendiente():
    pendiente = g.pop('uso_pendiente', None)
    if not pendiente:
        return
    for prov, (n, tin, tout) in pendiente.items():
        try:
            supa._rest('POST', 'rpc/registrar_uso', cuerpo={
                'p_fecha': dia_cuota(prov), 'p_proveedor': prov,
                'p_solicitudes': n, 'p_tin': tin, 'p_tout': tout})
        except Exception as e:
            print('[USO] No pude guardar el uso en Supabase (¿ejecutaste supabase_uso.sql?):', e)


def llamar_gemini(cuerpo, gen_config, api_key):
    resp = requests.post(GEMINI_URL, params={'key': api_key}, json=cuerpo, timeout=TIMEOUT_IA)
    if resp.status_code == 400 and 'thinkingConfig' in gen_config:
        print('[GEMINI] 400 con thinkingConfig; reintento sin pensamiento extendido. Cuerpo:', resp.text[:500])
        gen_config.pop('thinkingConfig', None)
        resp = requests.post(GEMINI_URL, params={'key': api_key}, json=cuerpo, timeout=TIMEOUT_IA)
    contar_uso('gemini', resp)
    return resp


def llamar_groq(cuerpo, cfg_groq, api_key):
    cab = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    resp = requests.post(GROQ_URL, headers=cab, json=cuerpo, timeout=TIMEOUT_IA)
    if resp.status_code == 400 and 'reasoning_effort' in cuerpo:
        print('[GROQ] 400 con reasoning_effort; reintento sin nivel de razonamiento. Cuerpo:', resp.text[:500])
        cfg_groq.pop('reasoning_effort', None)
        cuerpo.pop('reasoning_effort', None)
        resp = requests.post(GROQ_URL, headers=cab, json=cuerpo, timeout=TIMEOUT_IA)
    contar_uso('groq', resp)
    return resp


def generar_gemini(system_prompt, turnos, api_key, nivel='medio'):
    contenidos = []
    for h in turnos:
        rol = 'user' if h['role'] == 'user' else 'model'
        partes_h = list(h.get('partes_gemini') or []) + [{'text': h['texto']}]
        contenidos.append({'role': rol, 'parts': partes_h})

    acciones = {'urls_abrir': [], 'busqueda': None, 'imagenes': []}
    acciones['_llave'] = api_key
    gen_config = config_gemini(nivel)

    for _ in range(MAX_VUELTAS_HERRAMIENTAS):
        print(f'[GEMINI] Llamando a {GEMINI_URL} con modelo {GEMINI_MODEL}...')
        resp = llamar_gemini({
            'system_instruction': {'parts': [{'text': system_prompt}]},
            'contents': contenidos,
            'tools': construir_tools_gemini(),
            'generationConfig': gen_config
        }, gen_config, api_key)
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


def generar_groq(system_prompt, turnos, api_key, nivel='medio'):
    mensajes = [{'role': 'system', 'content': system_prompt}]
    for h in turnos:
        rol = 'user' if h['role'] == 'user' else 'assistant'
        mensajes.append({'role': rol, 'content': h['texto']})

    acciones = {'urls_abrir': [], 'busqueda': None, 'imagenes': []}
    tools = construir_tools_groq()
    cfg_groq = {'max_tokens': TOKENS_GROQ[nivel], 'reasoning_effort': NIVEL_EN[nivel]}

    for _ in range(MAX_VUELTAS_HERRAMIENTAS):
        print(f'[GROQ] Llamando a {GROQ_URL} con modelo {GROQ_MODEL}...')
        resp = llamar_groq({
            'model': GROQ_MODEL,
            'messages': mensajes,
            'temperature': 0.7,
            'tools': tools,
            'tool_choice': 'auto',
            **cfg_groq
        }, cfg_groq, api_key)
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


# --- Resumen automatico de la charla vieja ---
MENSAJES_VIVOS = 20   # los ultimos mensajes siempre se mandan completos al modelo
UMBRAL_RESUMEN = 30   # al juntar tantos mensajes sin resumir, se resumen los mas viejos
MAX_RESUMEN = 1800    # caracteres maximos del resumen guardado

PROMPT_RESUMEN = (
    'Eres el modulo de memoria de J.A.R.V.I.S. Recibes un RESUMEN PREVIO (puede estar vacio) '
    'y MENSAJES NUEVOS de una conversacion entre un usuario y Jarvis. Devuelve un unico resumen '
    'actualizado, en español y en tercera persona, de maximo 180 palabras. Conserva: los temas '
    'tratados, los datos concretos (nombres, cifras, fechas, lugares, archivos, codigo importante), '
    'lo que el usuario pidio o decidio, lo que Jarvis le respondio o recomendo (para poder retomar '
    'frases como "eso que me dijiste") y lo que quedo pendiente. Descarta saludos y relleno. '
    'Si el resumen previo y los mensajes nuevos tratan temas distintos, conserva ambos. '
    'Responde solo con el resumen, sin titulos ni comentarios.'
)


def resumir_conversacion(resumen_previo, mensajes, proveedor, api_key):
    lineas = []
    for m in mensajes:
        quien = 'Usuario' if m['role'] == 'user' else 'Jarvis'
        lineas.append(f"{quien}: {m['texto'][:700]}")
    entrada = ''
    if resumen_previo:
        entrada += 'RESUMEN PREVIO:\n' + resumen_previo + '\n\n'
    entrada += 'MENSAJES NUEVOS:\n' + '\n'.join(lineas)

    if proveedor == 'groq':
        resp = requests.post(
            GROQ_URL,
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={
                'model': GROQ_MODEL,
                'messages': [{'role': 'system', 'content': PROMPT_RESUMEN},
                             {'role': 'user', 'content': entrada}],
                'temperature': 0.3,
                'max_tokens': 900
            },
            timeout=30
        )
        resp.raise_for_status()
        contar_uso('groq', resp)
        texto = resp.json()['choices'][0]['message'].get('content') or ''
    else:
        resp = requests.post(
            GEMINI_URL,
            params={'key': api_key},
            json={
                'system_instruction': {'parts': [{'text': PROMPT_RESUMEN}]},
                'contents': [{'role': 'user', 'parts': [{'text': entrada}]}],
                'generationConfig': {'temperature': 0.3, 'maxOutputTokens': 700}
            },
            timeout=30
        )
        resp.raise_for_status()
        contar_uso('gemini', resp)
        partes = resp.json()['candidates'][0]['content'].get('parts', [])
        texto = ''.join(p.get('text', '') for p in partes)
    return texto.strip()[:MAX_RESUMEN]


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
    'a la herramienta correspondiente. Para buscar PERSONAS usa buscar_persona: '
    'solo informacion publica, sin inventar datos que no aparezcan en los resultados. '
    'Si el usuario pide buscar un producto o algo en un sitio concreto (Mercado Libre, '
    'Amazon, YouTube, Google Maps...), NO uses buscar_persona: primero pregunta si '
    'confirma que abras ese sitio con esa busqueda (por ejemplo: ¿Abro Mercado Libre '
    'con la busqueda de control de Xbox 360, señor?) y solo cuando confirme usa abrir_url '
    'con la URL de resultados de ese sitio, sin abrir ningun otro (si ya dijo que lo '
    'abras, no vuelvas a preguntar). URLs: Mercado Libre '
    'https://listado.mercadolibre.<dominio-del-pais>/<terminos-con-guiones> (dominios: '
    'com.co, com.mx, com.ar, com.ve, cl, com.pe, com.uy, com.ec; si no sabes el pais del '
    'usuario, preguntalo una vez y guardalo con guardar_recuerdo en el tema pais); '
    'Amazon https://www.amazon.com/s?k=<terminos>; YouTube '
    'https://www.youtube.com/results?search_query=<terminos>; Google Maps '
    'https://www.google.com/maps/search/<terminos>.'
)


def texto_capacidades():
    """Lo que Jarvis sabe de si mismo. Si se agrega o quita una funcion, actualizar aqui."""
    import shutil
    en_telefono = bool(shutil.which('termux-battery-status'))
    if en_telefono:
        telefono = 'Controlas el telefono: linterna, vibracion y bateria real. '
    else:
        telefono = ('La linterna, la vibracion y la bateria solo funcionan cuando corres dentro del '
                    'telefono (Termux); en esta version en linea no estan disponibles, asi que si te '
                    'las piden explicalo sin intentarlo. ')
    if TAVILY_API_KEY:
        personas = 'Buscas informacion publica de personas en la web y en redes sociales (Instagram, Facebook, TikTok, X, LinkedIn); los resultados salen en un panel y se abre el primero. '
    else:
        personas = 'La busqueda de personas no esta activa por ahora. '
    return (
        ' SOBRE TI (usalo cuando pregunten que eres, que haces o que puedes hacer; responde breve y '
        'natural, sin recitar todo salvo que pidan detalle; no inventes funciones que no estan aqui y, '
        'si piden algo que no tienes, dilo con claridad): eres una app personal instalable creada por '
        'David. Tienes: (1) chats con memoria: cada usuario tiene su cuenta, su historial de chats en '
        'la barra lateral y sus propios recuerdos; resumes los chats largos y guardas datos permanentes '
        'por tema, que puedes guardar y olvidar cuando te lo pidan. (2) Voz: hablas tus respuestas y '
        'el modo voz permite conversar sin escribir; el usuario puede silenciarte y ajustar tono y '
        'velocidad en Ajustes. (3) Archivos: el usuario puede adjuntar fotos (con Gemini las ves; con '
        'Groq no), PDF y archivos de texto o codigo, hasta 5 y unos 3 MB en total. (4) Abrir un sitio o la '
        'busqueda dentro de un sitio (Mercado Libre, Amazon, YouTube...) en una pestana nueva, '
        'las busquedas dentro de un sitio se hacen tras pedir confirmacion. Generas imagenes nuevas '
        'con IA a partir de una descripcion (con Gemini; con Groq solo si hay Cloudflare configurado) y las muestras en el chat; '
        'no se guardan en el historial. ' + personas + telefono +
        '(5) Ajustes: llaves propias de IA, elegir entre Gemini y Groq, nivel de pensamiento Bajo, '
        'Medio o Alto, tema claro u oscuro y contador de uso de la API. Aun no tienes: buscar dentro de '
        'tus chats guardados ni recordatorios (estan en camino), tampoco leer llamadas o mensajes del telefono, '
        'ni enviar mensajes. REGLA: si el usuario pide crear, dibujar o generar una imagen, '
        'llama SIEMPRE a la herramienta generar_imagen en ese mismo turno; nunca digas que la '
        'estas generando ni que esta lista sin haberla llamado.'
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
    try:
        tono = max(0.75, min(1.1, float(data.get('tono', 1.0))))
        vel = max(0.8, min(1.25, float(data.get('vel', 1.0))))
    except (TypeError, ValueError):
        tono, vel = 1.0, 1.0
    if data.get('premium') and len(texto) <= 300:
        import voz_eleven
        audio_eleven = voz_eleven.generar(limpiar_texto_para_voz(texto), vel, request.headers.get('Authorization', ''))
        if audio_eleven:
            resp = Response(audio_eleven, mimetype='audio/mpeg')
            resp.headers['X-Voz-Motor'] = 'eleven'
            return resp
    audio_bytes = generar_audio(texto, tono, vel)
    if audio_bytes is None:
        return jsonify({'error': 'no se pudo generar audio'}), 500
    return Response(audio_bytes, mimetype='audio/wav')


@app.route('/uso', methods=['GET'])
@supa.requiere_login
def uso_api():
    fechas = {p: dia_cuota(p) for p in ('gemini', 'groq')}
    try:
        filas = supa._rest('GET', 'uso_api', {
            'select': 'fecha,proveedor,solicitudes,tokens_entrada,tokens_salida',
            'fecha': 'in.(' + ','.join(sorted(set(fechas.values()))) + ')'}) or []
    except supa.SupaError as e:
        print('[USO] No pude leer uso_api:', e)
        return jsonify({'disponible': False})
    res = {'disponible': True}
    for p, f in fechas.items():
        fila = next((x for x in filas if x.get('proveedor') == p and x.get('fecha') == f), {})
        res[p] = {'fecha': f, 'solicitudes': fila.get('solicitudes', 0),
                  'tokens_entrada': fila.get('tokens_entrada', 0),
                  'tokens_salida': fila.get('tokens_salida', 0),
                  'reinicia': reinicio_cuota(p)}
    try:
        mm = supa._rest('GET', 'metas_uso', {'select': 'proveedor,meta'}) or []
        res['metas'] = {x['proveedor']: x['meta'] for x in mm}
    except supa.SupaError as e:
        print('[USO] No pude leer metas_uso:', e)
        res['metas'] = None
    r = jsonify(res)
    r.headers['Cache-Control'] = 'no-store'
    return r


@app.route('/uso', methods=['POST'])
@supa.requiere_login
def guardar_meta_uso():
    data = request.get_json(silent=True) or {}
    proveedor = data.get('proveedor')
    try:
        meta = int(data.get('meta'))
    except (TypeError, ValueError):
        meta = 0
    if proveedor not in ('gemini', 'groq') or meta < 1 or meta > 100000000:
        return jsonify({'error': 'meta invalida'}), 400
    try:
        supa._rest('POST', 'metas_uso', {'on_conflict': 'usuario_id,proveedor'}, {
            'usuario_id': g.usuario_id, 'proveedor': proveedor, 'meta': meta,
            'actualizado': datetime.now(ZoneInfo('UTC')).isoformat()
        }, {'Prefer': 'resolution=merge-duplicates'})
    except supa.SupaError as e:
        print('[USO] No pude guardar la meta:', e)
        return jsonify({'error': 'no se pudo guardar la meta'}), 502
    return jsonify({'ok': True})


@app.route('/chat', methods=['POST'])
@supa.requiere_login
def chat():
    try:
        data = request.get_json()
        mensaje_usuario = (data.get('mensaje', '') or '').strip()
        zona_horaria = data.get('zona_horaria', '') or 'UTC'
        chat_id = (data.get('chat_id') or '').strip()
        nivel = nivel_pensamiento(request.headers.get('X-Pensamiento', ''))

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

        try:
            adj = preparar_adjuntos(data.get('adjuntos'))
        except AdjuntoError as e:
            return jsonify({'respuesta': str(e)}), 400
        if not mensaje_usuario and not adj['nombres']:
            return jsonify({'respuesta': 'No recibi ningun mensaje, señor.'}), 400

        if not chat_id:
            chat_id = supa.crear_chat()['id']

        datos = supa.datos_chat(chat_id)
        resumen_previo = (datos.get('resumen') or '').strip()
        historial = supa.mensajes_desde(chat_id, datos.get('resumen_hasta'))

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
        texto_resumen = ''
        if resumen_previo:
            texto_resumen = (' Resumen de lo hablado antes en ESTE chat (los mensajes viejos ya no se muestran; '
                             'usalo como contexto y no lo menciones salvo que ayude): ' + resumen_previo)
        system_prompt = (SYSTEM_PROMPT_BASE + texto_capacidades() + texto_nombre + f' La fecha y hora ACTUAL es: {fecha_hora_str}.'
                         + texto_recuerdos + texto_resumen)

        turnos = list(historial[-UMBRAL_RESUMEN:])  # mensajes posteriores al resumen (maximo 30)
        texto_modelo, partes_gemini, aviso = armar_mensaje_con_adjuntos(mensaje_usuario, adj, proveedor)
        turno_actual = {'role': 'user', 'texto': texto_modelo}
        if partes_gemini:
            turno_actual['partes_gemini'] = partes_gemini
        turnos.append(turno_actual)

        if proveedor == 'groq':
            respuesta, acciones = generar_groq(system_prompt, turnos, api_key, nivel)
        else:
            respuesta, acciones = generar_gemini(system_prompt, turnos, api_key, nivel)

        if not respuesta.strip():
            respuesta = 'Parece que mis circuitos se distrajeron un instante, señor. ¿Podría repetirlo?'
        if aviso:
            respuesta = aviso + '\n\n' + respuesta

        era_nuevo = len(historial) == 0 and not resumen_previo
        mensaje_guardado = mensaje_usuario
        if adj['nombres']:
            linea_adj = '📎 Adjuntos: ' + ', '.join(adj['nombres'])
            mensaje_guardado = (mensaje_usuario + '\n' + linea_adj) if mensaje_usuario else linea_adj
        supa.guardar_intercambio(chat_id, mensaje_guardado, respuesta)
        if era_nuevo:
            supa.renombrar_chat(chat_id, mensaje_usuario or ('📎 ' + adj['nombres'][0]))

        total_sin_resumir = len(historial) + 2
        if datos and total_sin_resumir >= UMBRAL_RESUMEN:
            try:
                viejos = historial[:total_sin_resumir - MENSAJES_VIVOS]
                nuevo_resumen = resumir_conversacion(resumen_previo, viejos, proveedor, api_key)
                if nuevo_resumen and viejos:
                    supa.guardar_resumen(chat_id, nuevo_resumen, viejos[-1]['creado'])
                    print(f'[RESUMEN] Chat {chat_id}: {len(viejos)} mensajes resumidos.')
            except Exception as e:
                print('[RESUMEN] No pude actualizar el resumen (el chat sigue normal):', e)

        return jsonify({'respuesta': respuesta, 'chat_id': chat_id,
                        'urls_abrir': acciones.get('urls_abrir', []),
                        'busqueda': acciones.get('busqueda'),
                        'imagenes': acciones.get('imagenes', [])})

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

    finally:
        guardar_uso_pendiente()


import logging
logging.getLogger('werkzeug').setLevel(logging.WARNING)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f'Jarvis (motor de herramientas) corriendo en http://localhost:{port}')
    app.run(host='0.0.0.0', port=port)
