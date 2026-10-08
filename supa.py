import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import urlencode

import requests
from flask import Blueprint, request, jsonify, g, redirect

bp = Blueprint('supa', __name__)


class SupaError(Exception):
    pass


def _url():
    return os.environ.get('SUPABASE_URL', '').rstrip('/')


def _headers(token=None, extra=None):
    h = {'apikey': os.environ.get('SUPABASE_KEY', ''), 'Content-Type': 'application/json'}
    if token:
        h['Authorization'] = 'Bearer ' + token
    if extra:
        h.update(extra)
    return h


def _msg_error(r):
    try:
        d = r.json()
    except ValueError:
        return r.text[:200]
    return d.get('msg') or d.get('error_description') or d.get('message') or str(d)[:200]


def _ahora():
    return datetime.now(timezone.utc)


# ---------- Autenticacion ----------

def _auth(ruta, cuerpo, params=None):
    if not _url() or not os.environ.get('SUPABASE_KEY'):
        return jsonify({'error': 'Supabase no esta configurado en el servidor'}), 500
    try:
        r = requests.post(_url() + '/auth/v1/' + ruta, headers=_headers(),
                          params=params, json=cuerpo, timeout=15)
    except requests.exceptions.RequestException:
        return jsonify({'error': 'No logro conectar con Supabase'}), 503
    if r.status_code >= 400:
        return jsonify({'error': _msg_error(r)}), 400
    d = r.json()
    if 'access_token' not in d:
        return jsonify({'confirmar_correo': True})
    return jsonify({
        'access_token': d['access_token'],
        'refresh_token': d.get('refresh_token'),
        'expires_in': d.get('expires_in'),
        'email': (d.get('user') or {}).get('email')
    })


def _credenciales():
    d = request.get_json(silent=True) or {}
    return (d.get('email') or '').strip(), d.get('password') or ''


@bp.route('/auth/registro', methods=['POST'])
def registro():
    email, pw = _credenciales()
    if not email or len(pw) < 6:
        return jsonify({'error': 'Correo y contraseña de al menos 6 caracteres'}), 400
    nombre = ((request.get_json(silent=True) or {}).get('nombre') or '').strip()[:60]
    cuerpo = {'email': email, 'password': pw}
    if nombre:
        cuerpo['data'] = {'full_name': nombre}
    return _auth('signup', cuerpo)


@bp.route('/auth/login', methods=['POST'])
def login():
    email, pw = _credenciales()
    if not email or not pw:
        return jsonify({'error': 'Falta correo o contraseña'}), 400
    return _auth('token', {'email': email, 'password': pw}, {'grant_type': 'password'})


@bp.route('/auth/refresh', methods=['POST'])
def refrescar():
    d = request.get_json(silent=True) or {}
    rt = d.get('refresh_token') or ''
    if not rt:
        return jsonify({'error': 'Falta refresh_token'}), 400
    return _auth('token', {'refresh_token': rt}, {'grant_type': 'refresh_token'})


def requiere_login(f):
    @wraps(f)
    def envoltura(*a, **k):
        auth = request.headers.get('Authorization', '')
        token = auth[7:].strip() if auth.lower().startswith('bearer ') else ''
        if not token:
            return jsonify({'error': 'sin sesion', 'respuesta': 'Debe iniciar sesion, señor.'}), 401
        try:
            r = requests.get(_url() + '/auth/v1/user', headers=_headers(token), timeout=15)
        except requests.exceptions.RequestException:
            return jsonify({'error': 'No logro conectar con Supabase'}), 503
        if r.status_code != 200:
            return jsonify({'error': 'sesion invalida', 'respuesta': 'Su sesion expiro, señor.'}), 401
        u = r.json()
        meta = u.get('user_metadata') or {}
        g.token = token
        g.usuario_id = u.get('id')
        g.email = u.get('email')
        g.nombre = (meta.get('full_name') or meta.get('name') or '').strip()
        return f(*a, **k)
    return envoltura


# ---------- Base de datos (REST, con el token del usuario => RLS) ----------

def _rest(metodo, tabla, params=None, cuerpo=None, extra=None, timeout=15):
    try:
        r = requests.request(metodo, _url() + '/rest/v1/' + tabla,
                             headers=_headers(g.token, extra),
                             params=params, json=cuerpo, timeout=timeout)
    except requests.exceptions.RequestException as e:
        raise SupaError('sin conexion con Supabase: ' + str(e))
    if r.status_code >= 400:
        raise SupaError(f'Supabase {r.status_code}: {_msg_error(r)}')
    return r.json() if r.text else None


def listar_chats():
    try:
        return _rest('GET', 'chats', {'select': 'id,titulo,actualizado,fijado',
                                      'order': 'fijado.desc,actualizado.desc', 'limit': '100'})
    except SupaError:
        return _rest('GET', 'chats', {'select': 'id,titulo,actualizado',
                                      'order': 'actualizado.desc', 'limit': '100'})


def crear_chat(titulo='Nuevo chat'):
    return _rest('POST', 'chats', cuerpo={'titulo': titulo},
                 extra={'Prefer': 'return=representation'})[0]


def renombrar_chat(chat_id, titulo):
    t = ' '.join(titulo.split())[:40] or 'Nuevo chat'
    _rest('PATCH', 'chats', {'id': 'eq.' + str(chat_id)}, {'titulo': t})


def borrar_chat(chat_id):
    _rest('DELETE', 'chats', {'id': 'eq.' + str(chat_id)})


def mensajes_de(chat_id, limite=20):
    filas = _rest('GET', 'mensajes', {'chat_id': 'eq.' + str(chat_id), 'select': 'rol,texto',
                                      'order': 'creado.desc', 'limit': str(limite)})
    return [{'role': 'user' if f['rol'] == 'user' else 'assistant', 'texto': f['texto']}
            for f in reversed(filas)]


def datos_chat(chat_id):
    """Resumen guardado del chat. Si las columnas aun no existen, devuelve {} y todo sigue igual."""
    try:
        filas = _rest('GET', 'chats', {'id': 'eq.' + str(chat_id),
                                       'select': 'resumen,resumen_hasta', 'limit': '1'})
    except SupaError as e:
        print('[RESUMEN] No pude leer el resumen (falta correr el SQL?):', e)
        return {}
    return filas[0] if filas else {}


def mensajes_desde(chat_id, desde=None, limite=60):
    """Mensajes posteriores al ultimo resumen (o los ultimos, si aun no hay resumen)."""
    p = {'chat_id': 'eq.' + str(chat_id), 'select': 'rol,texto,creado',
         'order': 'creado.desc', 'limit': str(limite)}
    if desde:
        p['creado'] = 'gt.' + str(desde)
    filas = _rest('GET', 'mensajes', p)
    return [{'role': 'user' if f['rol'] == 'user' else 'assistant', 'texto': f['texto'],
             'creado': f['creado']} for f in reversed(filas)]


def guardar_resumen(chat_id, resumen, hasta):
    _rest('PATCH', 'chats', {'id': 'eq.' + str(chat_id)},
          {'resumen': resumen, 'resumen_hasta': hasta})


def guardar_intercambio(chat_id, mensaje, respuesta):
    t = _ahora()
    _rest('POST', 'mensajes', cuerpo=[
        {'chat_id': str(chat_id), 'rol': 'user', 'texto': mensaje,
         'creado': t.isoformat()},
        {'chat_id': str(chat_id), 'rol': 'jarvis', 'texto': respuesta,
         'creado': (t + timedelta(milliseconds=1)).isoformat()},
    ])


def cargar_recuerdos():
    return _rest('GET', 'memorias', {'select': 'clave,valor', 'order': 'actualizado.asc'})


def guardar_recuerdo(clave, valor):
    _rest('POST', 'memorias', {'on_conflict': 'user_id,clave'}, {
        'user_id': g.usuario_id, 'clave': clave.strip().lower()[:60],
        'valor': valor.strip(), 'actualizado': _ahora().isoformat()
    }, {'Prefer': 'resolution=merge-duplicates'})


def olvidar_recuerdo(clave):
    _rest('DELETE', 'memorias', {'clave': 'eq.' + clave.strip().lower()})


# ---------- Archivos del chat ----------

def guardar_archivos(chat_id, filas):
    """Guarda (o actualiza) el texto de los adjuntos de un chat, en tandas."""
    tanda, peso = [], 0

    def subir():
        if tanda:
            _rest('POST', 'archivos_chat', {'on_conflict': 'chat_id,ruta'}, list(tanda),
                  {'Prefer': 'resolution=merge-duplicates,return=minimal'}, timeout=40)
            tanda.clear()

    for f in filas:
        tanda.append({'user_id': g.usuario_id, 'chat_id': str(chat_id), 'ruta': f['ruta'],
                      'tipo': f['tipo'], 'tam': int(f['tam']), 'largo': len(f['texto']),
                      'estado': f['estado'], 'texto': f['texto']})
        peso += len(f['texto']) + 300
        if peso > 400000:
            subir()
            peso = 0
    subir()


def listar_archivos(chat_id):
    return _rest('GET', 'archivos_chat', {'chat_id': 'eq.' + str(chat_id),
                                          'select': 'ruta,tipo,tam,largo,estado',
                                          'order': 'ruta.asc', 'limit': '500'})


def leer_archivo(chat_id, ruta):
    """Devuelve (fila, candidatas). Ruta exacta primero; si no, coincidencia parcial."""
    cols = 'ruta,tipo,largo,estado,texto'
    ruta = ruta.strip()
    base = {'chat_id': 'eq.' + str(chat_id), 'select': cols, 'limit': '1'}
    f = _rest('GET', 'archivos_chat', dict(base, ruta='eq.' + ruta))
    if f:
        return f[0], []
    patron = '*' + ruta.replace('*', '').replace(',', ' ') + '*'
    c = _rest('GET', 'archivos_chat', {'chat_id': 'eq.' + str(chat_id), 'select': 'ruta',
                                       'ruta': 'ilike.' + patron, 'order': 'ruta.asc', 'limit': '10'})
    if len(c) == 1:
        f = _rest('GET', 'archivos_chat', dict(base, ruta='eq.' + c[0]['ruta']))
        return (f[0] if f else None), []
    return None, [x['ruta'] for x in c]


# ---------- Rutas de chats ----------

@bp.errorhandler(SupaError)
def _error_supa(e):
    return jsonify({'error': str(e)}), 502


@bp.route('/chats', methods=['GET'])
@requiere_login
def api_listar():
    return jsonify(listar_chats())


@bp.route('/chats', methods=['POST'])
@requiere_login
def api_crear():
    return jsonify(crear_chat())


@bp.route('/chats/<uuid:chat_id>/mensajes', methods=['GET'])
@requiere_login
def api_mensajes(chat_id):
    return jsonify(_rest('GET', 'mensajes', {
        'chat_id': 'eq.' + str(chat_id), 'select': 'rol,texto,creado',
        'order': 'creado.asc', 'limit': '500'}))


@bp.route('/chats/<uuid:chat_id>', methods=['DELETE'])
@requiere_login
def api_borrar(chat_id):
    borrar_chat(chat_id)
    return jsonify({'ok': True})


@bp.route('/chats/<uuid:chat_id>', methods=['PATCH'])
@requiere_login
def api_editar(chat_id):
    data = request.get_json(silent=True) or {}
    campos = {}
    if 'titulo' in data:
        t = ' '.join(str(data.get('titulo') or '').split())[:40]
        if not t:
            return jsonify({'error': 'titulo vacio'}), 400
        campos['titulo'] = t
    if 'fijado' in data:
        campos['fijado'] = bool(data.get('fijado'))
    if not campos:
        return jsonify({'error': 'nada que cambiar'}), 400
    try:
        _rest('PATCH', 'chats', {'id': 'eq.' + str(chat_id)}, campos)
    except SupaError as e:
        return _error_supa(e)
    return jsonify({'ok': True})


# ---------- Google y perfil ----------

@bp.route('/auth/google')
def google():
    if not _url():
        return jsonify({'error': 'Supabase no esta configurado en el servidor'}), 500
    destino = request.args.get('redirect', '')
    return redirect(_url() + '/auth/v1/authorize?' +
                    urlencode({'provider': 'google', 'redirect_to': destino}))


@bp.route('/auth/yo', methods=['GET'])
@requiere_login
def perfil():
    return jsonify({'email': g.email, 'nombre': g.nombre})
