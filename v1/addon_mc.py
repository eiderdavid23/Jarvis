"""Add-ons de Minecraft Bedrock: arma un .mcaddon (zip con paquete de comportamiento BP y,
si hace falta, de recursos RP) a partir de archivos que escribe el modelo.
El servidor crea los manifest (UUID estable por nombre) y valida rutas, JSON y tamanos."""
import base64
import io
import json
import re
import unicodedata
import uuid
import zipfile

ESPACIO = uuid.UUID('6f1c2a54-3b7e-4c0e-9a55-1d7b5e0a7c21')
RAICES = {
    'bp': ('entities', 'items', 'recipes', 'loot_tables', 'trading', 'spawn_rules', 'functions', 'blocks', 'texts'),
    'rp': ('entity', 'models', 'animations', 'animation_controllers', 'render_controllers', 'texts',
           'textures', 'attachables', 'particles'),
}
EXT = ('.json', '.lang', '.mcfunction')
MAX_ARCHIVOS = 40
MAX_ARCHIVO = 60000
MAX_TOTAL = 300000
MIN_MOTOR = [1, 21, 0]


def _slug(t):
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
    return re.sub(r'[^A-Za-z0-9]+', '_', t).strip('_')[:40] or 'addon'


def _manifest(nombre, desc, pack, dep_rp):
    cabecera = {'name': nombre + (' BP' if pack == 'bp' else ' RP'), 'description': desc,
                'uuid': str(uuid.uuid5(ESPACIO, nombre + pack + 'h')), 'version': [1, 0, 0],
                'min_engine_version': MIN_MOTOR}
    m = {'format_version': 2, 'header': cabecera,
         'modules': [{'type': 'data' if pack == 'bp' else 'resources',
                      'uuid': str(uuid.uuid5(ESPACIO, nombre + pack + 'm')), 'version': [1, 0, 0]}]}
    if pack == 'bp' and dep_rp:
        m['dependencies'] = [{'uuid': str(uuid.uuid5(ESPACIO, nombre + 'rp' + 'h')), 'version': [1, 0, 0]}]
    return json.dumps(m, indent=2, ensure_ascii=False)


def crear(args):
    """Devuelve (resultado_para_el_modelo, addon_para_el_chat o None)."""
    nombre = ' '.join(str(args.get('nombre') or '').split())[:40]
    desc = ' '.join(str(args.get('descripcion') or nombre).split())[:120]
    archivos = args.get('archivos')
    if not nombre:
        return {'ok': False, 'error': 'falta el nombre del add-on'}, None
    if not isinstance(archivos, list) or not archivos:
        return {'ok': False, 'error': 'faltan los archivos del add-on'}, None
    if len(archivos) > MAX_ARCHIVOS:
        return {'ok': False, 'error': f'maximo {MAX_ARCHIVOS} archivos; simplifica el add-on'}, None
    paquetes = {'bp': {}, 'rp': {}}
    total = 0
    for i, a in enumerate(archivos, 1):
        a = a if isinstance(a, dict) else {}
        pack = str(a.get('pack') or '').lower()
        ruta = str(a.get('ruta') or '').strip().replace('\\', '/')
        txt = a.get('contenido')
        if pack not in paquetes:
            return {'ok': False, 'error': f'archivo {i}: pack debe ser "bp" o "rp"'}, None
        partes = ruta.split('/')
        if (not ruta or ruta.startswith('/') or '..' in partes or '' in partes or len(ruta) > 120
                or not re.match(r'^[A-Za-z0-9_./-]+$', ruta)):
            return {'ok': False, 'error': f'archivo {i}: ruta no valida "{ruta[:60]}"'}, None
        if partes[0] not in RAICES[pack] or len(partes) < 2:
            return {'ok': False, 'error': f'archivo {i} ({ruta}): en {pack} solo se permiten carpetas: '
                                          + ', '.join(RAICES[pack]) + '. El manifest lo crea el servidor.'}, None
        if not ruta.endswith(EXT):
            return {'ok': False, 'error': f'archivo {i} ({ruta}): solo .json, .lang o .mcfunction (sin imagenes ni sonidos)'}, None
        if not isinstance(txt, str) or not txt.strip():
            return {'ok': False, 'error': f'archivo {i} ({ruta}): contenido vacio'}, None
        if len(txt) > MAX_ARCHIVO:
            return {'ok': False, 'error': f'archivo {i} ({ruta}): pasa de {MAX_ARCHIVO} letras'}, None
        if ruta in paquetes[pack]:
            return {'ok': False, 'error': f'archivo repetido: {pack}/{ruta}'}, None
        if ruta.endswith('.json'):
            try:
                json.loads(txt)
            except ValueError as e:
                return {'ok': False, 'error': f'archivo {i} ({ruta}): JSON invalido ({str(e)[:80]}). Corrigelo y vuelve a llamar.'}, None
        total += len(txt)
        paquetes[pack][ruta] = txt
    if total > MAX_TOTAL:
        return {'ok': False, 'error': 'el add-on es demasiado grande; simplificalo'}, None
    if not paquetes['bp'] and not paquetes['rp']:
        return {'ok': False, 'error': 'no hay archivos validos'}, None

    memoria = io.BytesIO()
    with zipfile.ZipFile(memoria, 'w', zipfile.ZIP_DEFLATED) as z:
        for pack, carpeta in (('bp', nombre + ' BP'), ('rp', nombre + ' RP')):
            if not paquetes[pack]:
                continue
            z.writestr(carpeta + '/manifest.json', _manifest(nombre, desc, pack, bool(paquetes['rp'])))
            for ruta, txt in paquetes[pack].items():
                z.writestr(carpeta + '/' + ruta, txt)
    datos = memoria.getvalue()
    n = len(paquetes['bp']) + len(paquetes['rp'])
    addon = {'nombre': nombre, 'archivo': _slug(nombre) + '.mcaddon', 'bytes': len(datos), 'n': n,
             'rutas': [p + '/' + r for p in ('bp', 'rp') for r in paquetes[p]],
             'datos': base64.b64encode(datos).decode()}
    return {'ok': True, 'archivos': n,
            'mensaje': 'El add-on ya aparece en el chat como un boton de descarga; al tocarlo se abre en Minecraft. '
                       'Explica en pocas lineas que hace y recuerda activar los paquetes en el mundo '
                       '(Ajustes del mundo > Paquetes de comportamiento y de recursos) y, si usas entidades o '
                       'items nuevos, las Funciones experimentales que pida el contenido. No pegues el JSON en el chat.'}, addon
