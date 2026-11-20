from flask import Blueprint, request, jsonify

import supa

bp = Blueprint('memorias', __name__)


def _fallo(e):
    print('[MEMORIAS]', e)
    return jsonify({'error': 'No pude usar su memoria.'}), 502


@bp.route('/memorias', methods=['GET'])
@supa.requiere_login
def listar():
    try:
        filas = supa._rest('GET', 'memorias', {'select': 'clave,valor,actualizado',
                                               'order': 'actualizado.desc', 'limit': '200'})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify(filas or [])


@bp.route('/memorias', methods=['DELETE'])
@supa.requiere_login
def borrar():
    data = request.get_json(silent=True) or {}
    try:
        if data.get('todo') is True:
            supa._rest('DELETE', 'memorias', {'clave': 'not.is.null'})
            return jsonify({'ok': True})
        clave = str(data.get('clave') or '').strip().lower()[:60]
        if not clave:
            return jsonify({'error': 'falta la clave'}), 400
        supa._rest('DELETE', 'memorias', {'clave': 'eq.' + clave})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})
