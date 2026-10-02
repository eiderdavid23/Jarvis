import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import requests
from flask import Blueprint, request, jsonify, g

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
    return _auth('signup', {'email': email, 'password': pw})


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
        g.token = token
        g.usuario_id = r.json().get('id')
        return f(*a, **k)
    return envoltura


# ---------- Base de datos (REST, con el token del usuario => RLS) ----------

def _rest(metodo, tabla, params=None, cuerpo=None, extra=None):
    try:
        r = requests.request(metodo, _url() + '/rest/v1/' + tabla,
                             headers=_headers(g.token, extra),
                             params=params, json=cuerpo, timeout=15)
    except requests.exceptions.RequestException as e:
        raise SupaError('sin conexion con Supabase: ' + str(e))
    if r.status_code >= 400:
        raise SupaError(f'Supabase {r.status_code}: {_msg_error(r)}')
    return r.json() if r.text else None


def listar_chats():
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
