"""Activar y desactivar funciones de Jarvis con la voz o el chat, sin gastar IA.
Ejemplo: "Jarvis, desactiva el modo escucha" / "activa la memoria y los recordatorios".
interpretar() devuelve None si el mensaje no es una orden de este tipo (va al chat normal)."""
import re
import unicodedata

# id -> (nombre, genero, plural, tipo, frases que lo nombran, necesita palabra marcadora)
# tipo 'herramienta' = interruptor del servidor; 'app' = lo aplica la app de Android
FUNCIONES = {
    'escucha': ('Modo escucha', 'm', False, 'app',
                ['escucha', 'escucha continua', 'llamar diciendo jarvis', 'palabra de activacion',
                 'activacion por voz', 'escucha de jarvis'], False),
    'burbuja': ('Burbuja', 'f', False, 'app', ['burbuja', 'burbuja flotante', 'burbuja de jarvis'], False),
    'voz_burbuja': ('Voz de la burbuja', 'f', False, 'app',
                    ['voz de la burbuja', 'voz en la burbuja', 'habla de la burbuja'], False),
    'minecraft': ('Minecraft', 'm', False, 'herramienta', ['minecraft'], False),
    'memoria': ('Memoria', 'f', False, 'herramienta', ['memoria'], False),
    'recordatorios': ('Recordatorios', 'm', True, 'herramienta', ['recordatorios'], False),
    'tareas': ('Tareas automáticas', 'f', True, 'herramienta',
               ['tareas', 'tareas automaticas', 'agentes', 'agentes automaticos'], False),
    'imagenes': ('Imágenes', 'f', True, 'herramienta',
                 ['imagenes', 'generacion de imagenes', 'generar imagenes', 'crear imagenes'], False),
    'personas': ('Búsqueda de personas', 'f', False, 'herramienta',
                 ['buscar personas', 'busqueda de personas', 'buscador de personas'], False),
    'web': ('Búsqueda en la web', 'f', False, 'herramienta',
            ['web', 'internet', 'busqueda web', 'buscar en la web', 'busqueda en la web',
             'buscar en internet', 'busqueda en internet'], False),
    'enlaces': ('Enlaces', 'm', True, 'herramienta', ['enlaces', 'abrir enlaces', 'links'], False),
    'nexus': ('Plataformas NEXUS', 'f', True, 'herramienta', ['nexus', 'plataformas', 'plataformas nexus'], False),
    'archivos': ('Archivos', 'm', True, 'herramienta', ['archivos', 'leer archivos', 'lectura de archivos'], False),
    'manos': ('Manos', 'f', True, 'herramienta', ['manos', 'manos de jarvis'], False),
    'telefono': ('Teléfono', 'm', False, 'herramienta', ['telefono'], True),
    'seguridad': ('Modo seguridad', 'm', False, 'seguridad',
                  ['modo seguridad', 'seguridad', 'agente de seguridad', 'modo de ciberseguridad',
                   'ciberseguridad', 'agente de ciberseguridad'], False),
}

PREFIJOS = {'oye', 'ok', 'okay', 'hola', 'jarvis', 'por', 'favor', 'porfa', 'ahora', 'entonces', 'y', 'ya',
            'puedes', 'podrias', 'podes', 'me', 'quiero', 'que', 'necesito', 'te', 'pido', 'vas', 'a', 'senor'}
RELLENO = {'el', 'la', 'los', 'las', 'lo', 'mi', 'tu', 'su', 'de', 'del', 'en', 'a', 'que', 'sea', 'modo',
           'funcion', 'herramienta', 'opcion'}
MARCADORES = {'modo', 'funcion', 'herramienta', 'opcion'}
COLA = {'por', 'favor', 'porfa', 'ahora', 'ya', 'jarvis', 'otra', 'vez', 'de', 'nuevo', 'nuevamente',
        'tambien', 'gracias', 'senor'}
ON = re.compile(r'^(?:re)?activ(?:a|ar|es|e|alo|ala|ame)$|^enciend(?:e|as|a)$|^encend(?:er)$'
                r'|^prend(?:e|as|er)$|^habilit(?:a|ar|es)$')
OFF = re.compile(r'^desactiv(?:a|ar|es|e|alo|ala|ame)$|^apag(?:a|ar|ues|ue|alo|ala)$|^deshabilit(?:a|ar|es)$')


def _plano(t):
    t = unicodedata.normalize('NFD', (t or '').lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9ñ ]+', ' ', t).split()


def _buscar(frase, marcado):
    for fid, d in FUNCIONES.items():
        if frase in d[4] and (marcado or not d[5]):
            return fid
    return None


def _parte(tokens, marcado):
    """Una parte de la orden ('la memoria', 'modo escucha por favor') -> id de funcion o None."""
    i = 0
    while i < len(tokens) and tokens[i] in RELLENO:
        marcado = marcado or tokens[i] in MARCADORES
        i += 1
    resto = tokens[i:]
    while resto:
        fid = _buscar(' '.join(resto), marcado)
        if fid:
            return fid
        if resto[-1] not in COLA:
            return None
        resto = resto[:-1]
    return None


def interpretar(texto, apagadas_header=''):
    """Devuelve {'respuesta': str, 'comandos': [{'id', 'activar', 'tipo'}]} o None."""
    tokens = _plano(texto)
    if not tokens or len(tokens) > 16:
        return None
    i = 0
    while i < len(tokens) and tokens[i] in PREFIJOS and not (ON.match(tokens[i]) or OFF.match(tokens[i])):
        i += 1
    if i >= len(tokens):
        return None
    if ON.match(tokens[i]):
        activar = True
    elif OFF.match(tokens[i]):
        activar = False
    else:
        return None
    resto = tokens[i + 1:]
    marcado = any(t in MARCADORES for t in resto[:3])
    partes, actual = [], []
    for t in resto:
        if t == 'y':
            partes.append(actual)
            actual = []
        else:
            actual.append(t)
    partes.append(actual)
    ids = []
    for p in partes:
        fid = _parte(p, marcado)
        if not fid:
            return None
        if fid not in ids:
            ids.append(fid)
    comandos = [{'id': f, 'activar': activar, 'tipo': FUNCIONES[f][3]} for f in ids]
    return {'respuesta': _respuesta(ids, activar, apagadas_header), 'comandos': comandos}


def _participio(d, activar):
    base = 'activad' if activar else 'desactivad'
    return base + ('a' if d[1] == 'f' else 'o') + ('s' if d[2] else '')


def _respuesta(ids, activar, apagadas_header):
    if len(ids) > 1:
        nombres = [FUNCIONES[f][0] for f in ids]
        unidos = ', '.join(nombres[:-1]) + ' y ' + nombres[-1]
        return 'Listo, señor. ' + ('Activé: ' if activar else 'Desactivé: ') + unidos + '.'
    f = ids[0]
    d = FUNCIONES[f]
    if d[3] == 'herramienta':
        apagada = f in [x.strip() for x in (apagadas_header or '').split(',')]
        if activar == (not apagada):
            return 'Ya ' + ('estaban ' if d[2] else 'estaba ') + _participio(d, activar) + ', señor.'
    txt = 'Listo, señor. ' + d[0] + ' ' + _participio(d, activar) + '.'
    if f == 'escucha' and not activar:
        txt += ' Para volver a activarlo, toque la burbuja y dígamelo.'
    return txt
