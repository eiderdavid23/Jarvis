"""Buscar estructuras de Minecraft (aldeas, templos, monumentos...) a partir de la semilla.

El calculo lo hace el motor abierto SeedFinder (Pedro Vinicius), basado en cubiomes y en
la matematica de Bedrock. Por defecto se usa su API publica gratuita (60 consultas por
minuto por IP); con la variable SEEDFINDER_URL se puede apuntar a un servidor propio.
"""
import math
import os
import re
import time
import unicodedata

import requests

URL_BASE = os.environ.get('SEEDFINDER_URL', 'https://www.mineseedfinder.com').rstrip('/')
MAX_RADIO_BLOQUES = 16000
CACHE_SEG = 600
_cache = {}

# id del motor -> nombre en espanol
NOMBRES = {
    1: 'templo del desierto', 2: 'templo de la jungla', 3: 'choza de bruja', 4: 'iglú',
    5: 'aldea', 6: 'ruina oceánica', 7: 'naufragio', 8: 'monumento oceánico',
    9: 'mansión del bosque', 10: 'avanzada de saqueadores', 11: 'portal en ruinas',
    12: 'portal en ruinas (Nether)', 13: 'ciudad ancestral', 14: 'tesoro enterrado',
    15: 'mina abandonada', 23: 'ruinas de sendero', 24: 'cámara de pruebas',
}
# nombre que devuelve el motor -> id
ID_POR_NOMBRE = {
    'desert_pyramid': 1, 'jungle_pyramid': 2, 'swamp_hut': 3, 'igloo': 4, 'village': 5,
    'ocean_ruin': 6, 'shipwreck': 7, 'monument': 8, 'mansion': 9, 'pillager_outpost': 10,
    'ruined_portal': 11, 'ruined_portal_nether': 12, 'ancient_city': 13,
    'buried_treasure': 14, 'mineshaft': 15, 'trail_ruins': 23, 'trial_chambers': 24,
}
# En la propia validacion del motor estos tipos dan falsos positivos conocidos.
AVISO_DUDOSO = {7, 9, 10, 23}

ALIAS = {
    1: ['templo del desierto', 'piramide del desierto', 'piramide', 'desert pyramid', 'desert temple'],
    2: ['templo de la jungla', 'templo de jungla', 'jungle temple', 'jungle pyramid'],
    3: ['choza de bruja', 'choza de la bruja', 'casa de bruja', 'swamp hut', 'witch hut'],
    4: ['iglu', 'igloo'],
    5: ['aldea', 'pueblo', 'village'],
    6: ['ruina oceanica', 'ruinas oceanicas', 'ruina submarina', 'ocean ruin'],
    7: ['naufragio', 'barco hundido', 'shipwreck'],
    8: ['monumento oceanico', 'monumento', 'ocean monument'],
    9: ['mansion', 'mansion del bosque', 'woodland mansion'],
    10: ['avanzada de saqueadores', 'avanzada', 'puesto de saqueadores', 'pillager outpost', 'outpost'],
    11: ['portal en ruinas', 'portal en ruina', 'ruined portal', 'portal'],
    12: ['portal en ruinas del nether', 'portal del nether en ruinas', 'ruined portal nether'],
    13: ['ciudad ancestral', 'ciudad antigua', 'ancient city'],
    14: ['tesoro enterrado', 'tesoro', 'buried treasure'],
    15: ['mina abandonada', 'mina', 'mineshaft'],
    23: ['ruinas de sendero', 'ruinas del sendero', 'trail ruins'],
    24: ['camara de pruebas', 'camaras de pruebas', 'trial chambers', 'trial chamber'],
}

DIRECCIONES = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste']


def _norm(s):
    s = unicodedata.normalize('NFD', str(s).lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').strip()


def _tipos_desde_texto(texto):
    """'aldea, monumento y mansion' -> ([5, 8, 9], [palabras que no se entendieron])."""
    partes = [p for p in re.split(r'[,;/]|\sy\s|\se\s|\so\s', _norm(texto)) if p.strip()]
    ids, malos = [], []
    for p in partes:
        p = p.strip()
        p = re.sub(r'^(las?|los|un|una|unas|unos)\s+', '', p)
        candidatos = {p, p.rstrip('s'), p.replace('es ', ' ').rstrip('s')}
        hallado = None
        for i, alias in ALIAS.items():
            if any(c in alias for c in candidatos):
                hallado = i
                break
        if hallado is None:
            for i, alias in ALIAS.items():
                if any(len(a) >= 4 and (a in p or p in a) and len(p) >= 4 for a in alias):
                    hallado = i
                    break
        if hallado is None:
            malos.append(p)
        elif hallado not in ids:
            ids.append(hallado)
    return ids, malos


def _entero(valor, defecto=None):
    if valor is None or valor == '':
        return defecto
    if isinstance(valor, (int, float)):
        return int(valor)
    limpio = re.sub(r'[^0-9\-]', '', str(valor))
    if limpio in ('', '-'):
        return defecto
    return int(limpio)


def _direccion(dx, dz):
    # En Minecraft +X es este y +Z es sur, asi que el norte es -Z.
    ang = (math.degrees(math.atan2(dx, -dz)) + 360) % 360
    return DIRECCIONES[int((ang + 22.5) // 45) % 8]


def _consultar(edicion, semilla, x, z, radio_chunks, ids):
    clave = (edicion, semilla, round(x / 16), round(z / 16), radio_chunks, tuple(sorted(ids)))
    hit = _cache.get(clave)
    if hit and time.time() - hit[0] < CACHE_SEG:
        return hit[1], None
    params = {'seed': semilla, 'x': x, 'z': z, 'radius': radio_chunks, 'max': 400,
              'types': ','.join(str(i) for i in ids)}
    try:
        r = requests.get(f'{URL_BASE}/scan/{edicion}', params=params, timeout=25)
    except requests.exceptions.Timeout:
        return None, 'El buscador de estructuras tardó demasiado en responder. Prueba con un radio más chico.'
    except requests.exceptions.RequestException:
        return None, 'No pude conectar con el buscador de estructuras en este momento.'
    if r.status_code == 429:
        return None, 'El buscador gratuito está saturado ahora mismo; intenta de nuevo en un minuto.'
    try:
        datos = r.json()
    except ValueError:
        return None, f'El buscador respondió algo ilegible (código {r.status_code}).'
    if r.status_code != 200:
        return None, 'El buscador no pudo con esa consulta: ' + str(datos.get('error') or r.status_code)
    resultados = datos.get('results') or []
    _cache[clave] = (time.time(), resultados)
    if len(_cache) > 60:
        _cache.pop(next(iter(_cache)))
    return resultados, None


def buscar(argumentos):
    """Herramienta buscar_estructuras_minecraft.
    Devuelve (resultado para el modelo, datos del mapa para el navegador o None)."""
    semilla = _entero(argumentos.get('semilla'))
    if semilla is None:
        return {'ok': False, 'error': 'falta la semilla del mundo (en Bedrock: Ajustes del mundo, Semilla).'}, None
    edicion = 'java' if _norm(argumentos.get('edicion') or 'bedrock').startswith('j') else 'bedrock'

    ids, malos = _tipos_desde_texto(argumentos.get('tipos') or 'aldea')
    if malos or not ids:
        validos = ', '.join(NOMBRES[i] for i in sorted(NOMBRES))
        return {'ok': False, 'error': 'no entendí estos tipos: ' + ', '.join(malos or ['(vacío)']),
                'tipos_validos': validos}, None

    x = _entero(argumentos.get('x'))
    z = _entero(argumentos.get('z'))
    sin_posicion = x is None or z is None
    x, z = x or 0, z or 0
    radio = max(200, min(MAX_RADIO_BLOQUES, _entero(argumentos.get('radio'), 3000)))
    por_tipo = max(1, min(10, _entero(argumentos.get('cantidad'), 3 if len(ids) > 1 else 5)))

    brutos, error = _consultar(edicion, semilla, x, z, math.ceil(radio / 16), ids)
    if error:
        return {'ok': False, 'error': error}, None

    estructuras, contados = [], {}
    for e in brutos:
        i = ID_POR_NOMBRE.get(e.get('name'))
        if i is None or i not in ids:
            continue
        dx, dz = e['x'] - x, e['z'] - z
        dist = math.hypot(dx, dz)
        if dist > radio:
            continue
        estructuras.append({'id': i, 'tipo': NOMBRES[i], 'x': e['x'], 'z': e['z'],
                            'distancia': int(round(dist)), 'direccion': _direccion(dx, dz)})
    estructuras.sort(key=lambda s: s['distancia'])
    elegidas = []
    for s in estructuras:
        if contados.get(s['id'], 0) >= por_tipo:
            continue
        contados[s['id']] = contados.get(s['id'], 0) + 1
        elegidas.append(s)
        if len(elegidas) >= 15:
            break
    for n, s in enumerate(elegidas, 1):
        s['n'] = n

    resumen_pos = f'jugador en X {x}, Z {z}' + (' (no dijo su posición; se usó el centro 0, 0)' if sin_posicion else '')
    if not elegidas:
        return {'ok': True, 'resultados': [], 'jugador': resumen_pos,
                'mensaje': f'No hay ninguna de esas estructuras en {radio} bloques. Sugiere ampliar el radio o moverse.'}, None

    dudosas = sorted({NOMBRES[s['id']] for s in elegidas if s['id'] in AVISO_DUDOSO})
    mapa = {'edicion': edicion, 'semilla': semilla, 'jugador': {'x': x, 'z': z}, 'radio': radio,
            'estructuras': elegidas}
    resultado = {
        'ok': True, 'edicion': edicion, 'jugador': resumen_pos, 'resultados': elegidas,
        'mensaje': ('El mapa y la lista ya se muestran al usuario en el chat. Responde breve: la más cercana, '
                    'su dirección y distancia en bloques, sin repetir toda la lista. Solo hay X y Z (la altura '
                    'se ve en el juego). Norte es -Z y este es +X.'),
    }
    if dudosas:
        resultado['aviso'] = ('Para ' + ', '.join(dudosas) + ' el motor puede dar falsos positivos; '
                              'dilo en una frase corta.')
    return resultado, mapa
