"""Supabase: login (correo y Google), verificacion de sesion y chats/mensajes.
Todo se hace con el token del usuario, asi que la RLS de Supabase protege los datos."""
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import urlencode, urlparse

import requests
from flask import Blueprint, request, jsonify, g, redirect

from servidor import config

bp = Blueprint('supa', __name__)


class SupaError(Exception):
    pass


def _cabeceras(token=None, extra=None):
    h = {'apikey': config.SUPABASE_KEY, 'Content-Type': 'application/json'}
    if token:
        h['Authorization'] = 'Bearer ' + token
    if extra:
        h.update(extra)
    return h


def _mensaje_error(r):
    try:
        d = r.json()
    except ValueError:
        return r.text[:200]
    return d.get('msg') or d.get('error_description') or d.get('message') or str(d)[:200]


# ---------------------------------------------------------------- login
def _auth(ruta, cuerpo, params=None):
    if not config.SUPABASE_URL or not config.SUPABASE_KEY:
        return jsonify({'error': 'Supabase no esta configurado en el servidor'}), 500
    try:
        r = requests.post(config.SUPABASE_URL + '/auth/v1/' + ruta, headers=_cabeceras(),
                          params=params, json=cuerpo, timeout=15)
    except requests.exceptions.RequestException:
        return jsonify({'error': 'No logro conectar con Supabase'}), 503
    if r.status_code >= 500 or r.status_code == 429:
        return jsonify({'error': 'Supabase ocupado, intente de nuevo'}), 503
    if r.status_code >= 400:
        return jsonify({'error': _mensaje_error(r)}), 400
    d = r.json()
    if 'access_token' not in d:
        return jsonify({'confirmar_correo': True})
    return jsonify({
        'access_token': d['access_token'],
        'refresh_token': d.get('refresh_token'),
        'expires_in': d.get('expires_in'),
        'email': (d.get('user') or {}).get('email'),
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
    rt = (request.get_json(silent=True) or {}).get('refresh_token') or ''
    if not rt:
        return jsonify({'error': 'Falta refresh_token'}), 400
    return _auth('token', {'refresh_token': rt}, {'grant_type': 'refresh_token'})


@bp.route('/auth/google')
def google():
    if not config.SUPABASE_URL:
        return jsonify({'error': 'Supabase no esta configurado en el servidor'}), 500
    destino = request.args.get('redirect', '')
    if destino != 'com.david.jarvis://auth' and urlparse(destino).netloc != request.host:
        destino = request.host_url
    return redirect(config.SUPABASE_URL + '/auth/v1/authorize?' +
                    urlencode({'provider': 'google', 'redirect_to': destino}))


def requiere_login(f):
    """Decorador: valida el token y deja g.token, g.usuario_id, g.email y g.nombre."""
    @wraps(f)
    def envoltura(*a, **k):
        auth = request.headers.get('Authorization', '')
        token = auth[7:].strip() if auth.lower().startswith('bearer ') else ''
        if not token:
            return jsonify({'error': 'sin sesion', 'respuesta': 'Debe iniciar sesion, señor.'}), 401
        try:
            r = requests.get(config.SUPABASE_URL + '/auth/v1/user', headers=_cabeceras(token), timeout=15)
        except requests.exceptions.RequestException:
            return jsonify({'error': 'No logro conectar con Supabase'}), 503
        if r.status_code in (401, 403):
            return jsonify({'error': 'sesion invalida', 'respuesta': 'Su sesion expiro, señor.'}), 401
        if r.status_code != 200:
            return jsonify({'error': 'supabase ocupado',
                            'respuesta': 'No logro verificar su sesion ahora mismo, señor.'}), 503
        u = r.json()
        meta = u.get('user_metadata') or {}
        g.token = token
        g.usuario_id = u.get('id')
        g.email = u.get('email')
        g.nombre = (meta.get('full_name') or meta.get('name') or '').strip()
        return f(*a, **k)
    return envoltura


@bp.route('/auth/yo', methods=['GET'])
@requiere_login
def perfil():
    return jsonify({'email': g.email, 'nombre': g.nombre})


# ---------------------------------------------------------------- base de datos
def rest(metodo, tabla, params=None, cuerpo=None, extra=None, timeout=15):
    """Llamada a la API REST de Supabase con el token del usuario (RLS)."""
    try:
        r = requests.request(metodo, config.SUPABASE_URL + '/rest/v1/' + tabla,
                             headers=_cabeceras(g.token, extra), params=params, json=cuerpo, timeout=timeout)
    except requests.exceptions.RequestException as e:
        raise SupaError('sin conexion con Supabase: ' + str(e))
    if r.status_code >= 400:
        raise SupaError(f'Supabase {r.status_code}: {_mensaje_error(r)}')
    return r.json() if r.text else None


@bp.errorhandler(SupaError)
def _error_supa(e):
    return jsonify({'error': str(e)}), 502


def listar_chats():
    try:
        return rest('GET', 'chats', {'select': 'id,titulo,actualizado,fijado',
                                     'order': 'fijado.desc,actualizado.desc', 'limit': '100'})
    except SupaError:
        return rest('GET', 'chats', {'select': 'id,titulo,actualizado',
                                     'order': 'actualizado.desc', 'limit': '100'})


def crear_chat(titulo='Nuevo chat'):
    return rest('POST', 'chats', cuerpo={'titulo': titulo},
                extra={'Prefer': 'return=representation'})[0]


def renombrar_chat(chat_id, titulo):
    t = ' '.join(titulo.split())[:40] or 'Nuevo chat'
    rest('PATCH', 'chats', {'id': 'eq.' + str(chat_id)}, {'titulo': t})


def borrar_chat(chat_id):
    rest('DELETE', 'chats', {'id': 'eq.' + str(chat_id)})


def titulo_de(chat_id):
    filas = rest('GET', 'chats', {'id': 'eq.' + str(chat_id), 'select': 'titulo', 'limit': '1'})
    return filas[0]['titulo'] if filas else ''


def ultimos_mensajes(chat_id, limite=30):
    filas = rest('GET', 'mensajes', {'chat_id': 'eq.' + str(chat_id), 'select': 'rol,texto,creado',
                                     'order': 'creado.desc', 'limit': str(limite)})
    return [{'role': 'user' if f['rol'] == 'user' else 'assistant', 'texto': f['texto']}
            for f in reversed(filas)]


def guardar_intercambio(chat_id, mensaje, respuesta):
    t = datetime.now(timezone.utc)
    rest('POST', 'mensajes', cuerpo=[
        {'chat_id': str(chat_id), 'rol': 'user', 'texto': mensaje, 'creado': t.isoformat()},
        {'chat_id': str(chat_id), 'rol': 'jarvis', 'texto': respuesta,
         'creado': (t + timedelta(milliseconds=1)).isoformat()},
    ])


# ---------------------------------------------------------------- rutas de chats
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
    return jsonify(rest('GET', 'mensajes', {'chat_id': 'eq.' + str(chat_id), 'select': 'rol,texto,creado',
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
    rest('PATCH', 'chats', {'id': 'eq.' + str(chat_id)}, campos)
    return jsonify({'ok': True})
