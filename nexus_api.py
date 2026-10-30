import re

from flask import Blueprint, request, jsonify, g

import supa

bp = Blueprint('nexus', __name__)
CAMPOS = 'id,dueno_id,nombre,descripcion,url,creado'
PERFIL = 'user_id,rol,estado,nombre,correo,creado'
REP = {'Prefer': 'return=representation'}


def _fallo(e):
    print('[NEXUS]', e)
    t = str(e)
    if 'row-level security' in t or 'Supabase 403' in t or '42501' in t:
        return jsonify({'error': 'No tiene permiso para hacer eso, señor.'}), 403
    if 'Supabase 404' in t or '42P01' in t or 'Could not find the table' in t:
        return jsonify({'error': 'Falta ejecutar supabase_nexus.sql en Supabase.'}), 502
    return jsonify({'error': 'No pude usar Nexus ahora mismo.'}), 502


def _limpio(v, largo):
    return ' '.join(str(v or '').split())[:largo]


def _url_ok(u):
    return bool(re.match(r'^https?://\S+$', u, re.I)) and len(u) <= 500


def _vacio():
    return jsonify({'error': 'No existe o no tiene permiso.'}), 404


# ---------- Perfil y acceso ----------

@bp.route('/nexus/yo', methods=['GET'])
@supa.requiere_login
def yo():
    try:
        f = supa._rest('GET', 'nexus_perfiles', {'select': PERFIL, 'user_id': 'eq.' + g.usuario_id, 'limit': '1'})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify(f[0] if f else {'user_id': g.usuario_id, 'estado': 'sin_acceso'})


@bp.route('/nexus/solicitar', methods=['POST'])
@supa.requiere_login
def solicitar():
    try:
        supa._rest('POST', 'nexus_perfiles', {'on_conflict': 'user_id'}, {'user_id': g.usuario_id},
                   {'Prefer': 'resolution=ignore-duplicates,return=minimal'})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})


# ---------- Plataformas ----------

@bp.route('/nexus/plataformas', methods=['GET'])
@supa.requiere_login
def plataformas():
    try:
        return jsonify(supa._rest('GET', 'nexus_plataformas', {'select': CAMPOS, 'order': 'creado.asc', 'limit': '500'}))
    except supa.SupaError as e:
        return _fallo(e)


@bp.route('/nexus/plataformas', methods=['POST'])
@supa.requiere_login
def crear_plataforma():
    d = request.get_json(silent=True) or {}
    nombre, desc, url = _limpio(d.get('nombre'), 60), _limpio(d.get('descripcion'), 200), str(d.get('url') or '').strip()
    if not nombre:
        return jsonify({'error': 'Falta el nombre.'}), 400
    if not _url_ok(url):
        return jsonify({'error': 'La dirección debe empezar con http:// o https://'}), 400
    dueno = None if d.get('global') else g.usuario_id
    try:
        fila = supa._rest('POST', 'nexus_plataformas', cuerpo={'dueno_id': dueno, 'nombre': nombre,
                          'descripcion': desc, 'url': url}, extra=REP)
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify(fila[0])


@bp.route('/nexus/plataformas/<uuid:pid>', methods=['PATCH'])
@supa.requiere_login
def editar_plataforma(pid):
    d = request.get_json(silent=True) or {}
    campos = {}
    if 'nombre' in d:
        campos['nombre'] = _limpio(d['nombre'], 60)
        if not campos['nombre']:
            return jsonify({'error': 'Falta el nombre.'}), 400
    if 'descripcion' in d:
        campos['descripcion'] = _limpio(d['descripcion'], 200)
    if 'url' in d:
        campos['url'] = str(d['url'] or '').strip()
        if not _url_ok(campos['url']):
            return jsonify({'error': 'La dirección debe empezar con http:// o https://'}), 400
    if not campos:
        return jsonify({'error': 'Nada que cambiar.'}), 400
    try:
        f = supa._rest('PATCH', 'nexus_plataformas', {'id': 'eq.' + str(pid)}, campos, REP)
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify(f[0]) if f else _vacio()


@bp.route('/nexus/plataformas/<uuid:pid>', methods=['DELETE'])
@supa.requiere_login
def borrar_plataforma(pid):
    try:
        f = supa._rest('DELETE', 'nexus_plataformas', {'id': 'eq.' + str(pid)}, extra=REP)
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True}) if f else _vacio()


# ---------- Administración (los permisos reales los pone la base con RLS) ----------

@bp.route('/nexus/usuarios', methods=['GET'])
@supa.requiere_login
def usuarios():
    try:
        return jsonify(supa._rest('GET', 'nexus_perfiles', {'select': PERFIL, 'order': 'creado.asc', 'limit': '500'}))
    except supa.SupaError as e:
        return _fallo(e)


@bp.route('/nexus/usuarios/<uuid:uid>', methods=['PATCH'])
@supa.requiere_login
def editar_usuario(uid):
    if str(uid) == g.usuario_id:
        return jsonify({'error': 'No puede cambiar su propia cuenta, señor.'}), 400
    d = request.get_json(silent=True) or {}
    campos = {k: d[k] for k in ('rol', 'estado') if k in d}
    if d.get('rol') not in (None, 'admin', 'usuario') or d.get('estado') not in (None, 'pendiente', 'aprobado') or not campos:
        return jsonify({'error': 'Rol o estado no válido.'}), 400
    try:
        f = supa._rest('PATCH', 'nexus_perfiles', {'user_id': 'eq.' + str(uid)}, campos, REP)
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify(f[0]) if f else _vacio()


@bp.route('/nexus/usuarios/<uuid:uid>', methods=['DELETE'])
@supa.requiere_login
def borrar_usuario(uid):
    if str(uid) == g.usuario_id:
        return jsonify({'error': 'No puede eliminar su propia cuenta, señor.'}), 400
    try:
        f = supa._rest('DELETE', 'nexus_perfiles', {'user_id': 'eq.' + str(uid)}, extra=REP)
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True}) if f else _vacio()


@bp.route('/nexus/asignaciones/<uuid:uid>', methods=['GET'])
@supa.requiere_login
def asignaciones(uid):
    try:
        f = supa._rest('GET', 'nexus_asignaciones', {'select': 'plataforma_id', 'usuario_id': 'eq.' + str(uid)})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify([x['plataforma_id'] for x in f])


@bp.route('/nexus/asignaciones/<uuid:uid>/<uuid:pid>', methods=['PUT'])
@supa.requiere_login
def asignar(uid, pid):
    try:
        supa._rest('POST', 'nexus_asignaciones', {'on_conflict': 'usuario_id,plataforma_id'},
                   {'usuario_id': str(uid), 'plataforma_id': str(pid)},
                   {'Prefer': 'resolution=ignore-duplicates,return=minimal'})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})


@bp.route('/nexus/asignaciones/<uuid:uid>/<uuid:pid>', methods=['DELETE'])
@supa.requiere_login
def quitar(uid, pid):
    try:
        supa._rest('DELETE', 'nexus_asignaciones', {'usuario_id': 'eq.' + str(uid), 'plataforma_id': 'eq.' + str(pid)})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})
