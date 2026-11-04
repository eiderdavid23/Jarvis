"""Narracion tecnica en vivo para TODAS las herramientas.

Toma las de hacking de pasos_hack y agrega las del resto de dominios.
No ejecuta nada: solo describe lo que ya paso.
"""
import re
import pasos_hack as H

MAX = 70


def _sitio(u):
    try:
        from urllib.parse import urlparse
        p = urlparse(u if '://' in str(u) else 'https://' + str(u))
        return ((p.hostname or '?').replace('www.', '') + (p.path or '/'))[:50]
    except Exception:
        return '?'


def _corta(v, n=48):
    t = re.sub(r'\s+', ' ', str(v if v is not None else '')).strip()
    return t if len(t) <= n else t[:n] + '…'


def _cuenta(t):
    return len(re.findall(r'\n', str(t or ''))) + 1


def _dispositivo(a):
    d = _corta(a.get('dispositivo') or '', 24)
    return (' en ' + d) if d else ''


def _ver_pantalla(a, r):
    if not r.get('ok'):
        return [f'Mirando la pantalla{_dispositivo(a)}', f'→ {_corta(r.get("error"))}']
    texto = str(r.get('pantalla') or r.get('texto') or '')
    return [f'Mirando la pantalla{_dispositivo(a)}',
            f'→ {_cuenta(texto)} elementos visibles · {len(texto)} caracteres']


def _controlar(a, r):
    cual = _corta(a.get('accion'), 20)
    extra = a.get('texto') or a.get('contacto') or a.get('tecla') or ''
    if a.get('x') is not None:
        extra = f'{a.get("x")},{a.get("y")}'
    linea = f'{cual}{_dispositivo(a)}' + (f': {_corta(extra, 40)}' if extra else '')
    if not r.get('ok'):
        return [linea, f'→ {_corta(r.get("error"))}']
    return [linea, f'→ ok · {len(str(r.get("pantalla") or ""))} caracteres de pantalla']


def _pc(a, r):
    return _controlar(a, r)


def _tv(a, r):
    return _controlar(a, r)


def _archivo(a, r):
    if not r.get('ok'):
        return [f'Leyendo {_corta(a.get("ruta"), 40)}', f'→ {_corta(r.get("error"))}']
    return [f'Leyendo {_corta(r.get("ruta"), 40)} (parte {r.get("parte")}/{r.get("partes")})',
            f'→ {len(str(r.get("contenido") or ""))} caracteres']


def _buscar(a, r):
    if not r.get('ok'):
        return [f'Buscando «{_corta(a.get("consulta"), 40)}»', f'→ {_corta(r.get("error"))}']
    res = r.get('resultados') or []
    return [f'Buscando «{_corta(a.get("consulta"), 40)}»',
            f'→ {len(res)} resultados: {", ".join(_corta(x.get("titulo") or x.get("url"), 26) for x in res[:3])}']


def _leer(a, r):
    if not r.get('ok'):
        return [f'GET {_sitio(a.get("url"))}', f'→ {_corta(r.get("error"))}']
    return [f'GET {_sitio(a.get("url"))}', f'→ {r.get("status")} · {len(str(r.get("texto") or ""))} caracteres']


def _abrir(a, r):
    return [f'Abriendo {_sitio(a.get("url"))}']


def _imagen(a, r):
    if not r.get('ok'):
        return [f'Generando imagen: {_corta(a.get("descripcion"), 40)}', f'→ {_corta(r.get("error"))}']
    return [f'Generando imagen: {_corta(a.get("descripcion"), 40)}', '→ lista']


def _pdf(a, r):
    return [f'Armando PDF: {_corta(a.get("titulo") or "documento", 40)}']


def _addon(a, r):
    return [f'Armando add-on: {_corta(a.get("nombre"), 30)} ({len(a.get("archivos") or [])} archivos)']


def _estructuras(a, r):
    return [f'Buscando {_corta(a.get("tipos"), 30)} · semilla {_corta(a.get("semilla"), 18)}',
            f'→ radio {a.get("radio") or 3000}']


def _persona(a, r):
    if not r.get('ok'):
        return [f'Buscando a {_corta(a.get("consulta"), 30)}', f'→ {_corta(r.get("error"))}']
    return [f'Buscando a {_corta(a.get("consulta"), 30)}',
            f'→ {len(r.get("resultados") or [])} resultados públicos']


def _recordar(a, r):
    return [f'Recordando «{_corta(a.get("tema"), 24)}»: {_corta(a.get("dato"), 40)}']


def _olvidar(a, r):
    return [f'Olvidando «{_corta(a.get("tema"), 24)}»']


def _recordatorio(a, r):
    return [f'Recordatorio {_corta(a.get("fecha_hora"), 18)}: {_corta(a.get("texto"), 40)}']


def _listar(nombre, campo):
    return lambda a, r: [f'{nombre}']
    

def _tarea(a, r):
    return [f'Tarea {_corta(a.get("fecha_hora"), 18)}: {_corta(a.get("titulo"), 40)}']


def _plataforma(a, r):
    return [f'Abriendo plataforma «{_corta(a.get("nombre"), 26)}»']


def _simple(texto):
    return lambda a, r: [texto]


PLANTILLAS = {
    'ver_pantalla': _ver_pantalla,
    'controlar_pantalla': _controlar,
    'controlar_pc': _pc,
    'controlar_tv': _tv,
    'leer_archivo': _archivo,
    'buscar_web': _buscar,
    'leer_pagina': _leer,
    'abrir_url': _abrir,
    'generar_imagen': _imagen,
    'crear_pdf': _pdf,
    'crear_addon_minecraft': _addon,
    'buscar_estructuras_minecraft': _estructuras,
    'buscar_persona': _persona,
    'guardar_recuerdo': _recordar,
    'olvidar_recuerdo': _olvidar,
    'crear_recordatorio': _recordatorio,
    'listar_recordatorios': _simple('Revisando recordatorios'),
    'borrar_recordatorio': _simple('Borrando recordatorio'),
    'crear_tarea': _tarea,
    'listar_tareas': _simple('Revisando tareas programadas'),
    'cancelar_tarea': _simple('Cancelando tarea'),
    'listar_plataformas': _simple('Revisando sus plataformas'),
    'abrir_plataforma': _plataforma,
    'encender_linterna': _simple('Encendiendo linterna'),
    'apagar_linterna': _simple('Apagando linterna'),
    'vibrar': _simple('Vibrando el teléfono'),
    'consultar_bateria': _simple('Consultando la batería'),
    'auditar_proyecto': _simple('Auditando el proyecto'),
    'anotar_paso': _simple(''),
}


INDICE = {}

CAMPOS_URL = ('url', 'dominio', 'host', 'base', 'sitio')
CAMPOS_RUTA = ('ruta', 'archivo', 'nombre', 'origen', 'destino')
CAMPOS_ACCION = ('accion', 'modo', 'metodo', 'que')
CAMPOS_TEXTO = ('consulta', 'q', 'texto', 'contacto', 'mensaje', 'datos', 'cuerpo')
CAMPOS_VALOR = ('token', 'hash', 'clave', 'usuario', 'semilla', 'puertos', 'correos')

VERBOS = {'url': 'Contactando', 'dominio': 'Resolviendo', 'host': 'Mirando',
          'ruta': 'Abriendo', 'archivo': 'Abriendo', 'consulta': 'Consultando',
          'texto': 'Usando', 'mensaje': 'Enviando', 'accion': 'Ejecutando',
          'modo': 'Ajustando', 'metodo': 'Pidiendo', 'token': 'Analizando',
          'hash': 'Rompiendo', 'usuario': 'Probando con', 'semilla': 'Calculando sobre',
          'que': 'Extrayendo'}

CUENTAS = ('status', 'total', 'total_filas', 'probadas', 'revisadas', 'registros',
           'probados', 'intentos', 'archivos', 'resultados', 'abiertos', 'vivos',
           'halladas', 'cookies', 'hits')


def indice(herramientas):
    """Guarda el esquema de las herramientas: sirve para narrar las que no tengan plantilla."""
    for h in herramientas or []:
        if isinstance(h, dict) and h.get('name'):
            INDICE[h['name']] = h


def _principal(nombre, a):
    """Campo mas representativo del argumento, primero los obligatorios."""
    esquema = (INDICE.get(nombre) or {}).get('parameters') or {}
    orden = list(esquema.get('required') or []) + [k for k in a if k not in (esquema.get('required') or [])]
    for grupo in (CAMPOS_URL, CAMPOS_RUTA, CAMPOS_ACCION, CAMPOS_TEXTO, CAMPOS_VALOR):
        for k in orden:
            if k in grupo and a.get(k) not in (None, '', []):
                return k, a.get(k)
    for k, v in a.items():
        if v not in (None, '', []):
            return k, v
    return '', ''


def _auto(nombre, a, r):
    """Linea generica a partir del esquema de la herramienta. Sirve para cualquier herramienta nueva."""
    a = a if isinstance(a, dict) else {}
    r = r if isinstance(r, dict) else {}
    clave, valor = _principal(nombre, a)
    verbo = VERBOS.get(clave) or 'Ejecutando'
    que = _sitio(valor) if clave in CAMPOS_URL else (_corta(valor, 46) or nombre.replace('_', ' '))
    linea = verbo + ' ' + que
    if r.get('ok') is False or r.get('error'):
        return [linea, '-> ' + _corta(r.get('error') or 'sin exito', 60)]
    for k in CUENTAS:
        v = r.get(k)
        if isinstance(v, list):
            return [linea, '-> ' + k.replace('_', ' ') + ': ' + str(len(v))]
        if isinstance(v, int):
            return [linea, '-> ' + k.replace('_', ' ') + ': ' + str(v)]
    return [linea]


def tiene(nombre):
    return nombre in PLANTILLAS or nombre in INDICE or H.tiene(nombre)


def narrar(nombre, argumentos, resultado):
    """Lineas para el usuario. Nunca lanza."""
    try:
        f = PLANTILLAS.get(nombre)
        if f:
            return [x for x in f(argumentos or {}, resultado if isinstance(resultado, dict) else {}) if x][:3]
        if H.tiene(nombre):
            return H.narrar(nombre, argumentos, resultado)
        return _auto(nombre, argumentos, resultado)
    except Exception:
        return [str(nombre)]
