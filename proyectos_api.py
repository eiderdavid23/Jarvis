import re

from flask import Blueprint, request, jsonify

import supa

bp = Blueprint('proyectos', __name__)
CAMPOS = 'id,nombre,instrucciones'
RE_ID = re.compile(r'^[0-9a-fA-F-]{36}$')


def _fallo(e):
    print('[PROYECTOS]', e)
    return jsonify({'error': 'No pude usar los proyectos. Revise que supabase_proyectos.sql este ejecutado.'}), 502


def _nombre(valor):
    return ' '.join(str(valor or '').split())[:40]


def instrucciones_del_chat(chat_id):
    """Instrucciones del proyecto al que pertenece el chat ('' si no tiene o si falla). Una sola consulta."""
    try:
        filas = supa._rest('GET', 'chats', {'id': 'eq.' + str(chat_id),
                                            'select': 'proyectos(instrucciones)', 'limit': '1'})
    except supa.SupaError as e:
        print('[PROYECTOS] No pude leer las instrucciones del chat:', e)
        return ''
    if not filas:
        return ''
    proy = filas[0].get('proyectos') or {}
    return (proy.get('instrucciones') or '').strip()


@bp.route('/proyectos', methods=['GET'])
@supa.requiere_login
def listar():
    try:
        return jsonify(supa._rest('GET', 'proyectos', {'select': CAMPOS, 'order': 'creado.asc', 'limit': '100'}))
    except supa.SupaError as e:
        return _fallo(e)


@bp.route('/proyectos', methods=['POST'])
@supa.requiere_login
def crear():
    data = request.get_json(silent=True) or {}
    nombre = _nombre(data.get('nombre'))
    if not nombre:
        return jsonify({'error': 'nombre vacio'}), 400
    instr = str(data.get('instrucciones') or '').strip()[:2000]
    try:
        fila = supa._rest('POST', 'proyectos', cuerpo={'nombre': nombre, 'instrucciones': instr},
                          extra={'Prefer': 'return=representation'})[0]
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify(fila)


@bp.route('/proyectos/<uuid:proyecto_id>', methods=['PATCH'])
@supa.requiere_login
def editar(proyecto_id):
    data = request.get_json(silent=True) or {}
    campos = {}
    if 'nombre' in data:
        n = _nombre(data.get('nombre'))
        if not n:
            return jsonify({'error': 'nombre vacio'}), 400
        campos['nombre'] = n
    if 'instrucciones' in data:
        campos['instrucciones'] = str(data.get('instrucciones') or '').strip()[:2000]
    if not campos:
        return jsonify({'error': 'nada que cambiar'}), 400
    try:
        supa._rest('PATCH', 'proyectos', {'id': 'eq.' + str(proyecto_id)}, campos)
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})


@bp.route('/proyectos/<uuid:proyecto_id>', methods=['DELETE'])
@supa.requiere_login
def borrar(proyecto_id):
    try:
        supa._rest('DELETE', 'proyectos', {'id': 'eq.' + str(proyecto_id)})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})
