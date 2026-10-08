import re
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, g

import supa

bp = Blueprint('recs', __name__)
CAMPOS = 'id,texto,cuando,avisado'
RE_ID = re.compile(r'[0-9a-fA-F-]{36}')


def _fallo(e):
    print('[RECORDATORIOS]', e)
    return jsonify({'error': 'No pude usar los recordatorios. Revise que supabase_recordatorios.sql este ejecutado.'}), 502


@bp.route('/recordatorios', methods=['GET'])
@supa.requiere_login
def listar():
    try:
        filas = supa._rest('GET', 'recordatorios', {'select': CAMPOS, 'order': 'cuando.asc', 'limit': '200'}) or []
    except supa.SupaError as e:
        return _fallo(e)
    r = jsonify({'recordatorios': filas})
    r.headers['Cache-Control'] = 'no-store'
    return r


@bp.route('/recordatorios', methods=['POST'])
@supa.requiere_login
def crear():
    data = request.get_json(silent=True) or {}
    texto = str(data.get('texto') or '').strip()
    if not texto or len(texto) > 300:
        return jsonify({'error': 'texto invalido'}), 400
    try:
        cuando = datetime.fromisoformat(str(data.get('cuando') or '').replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'error': 'fecha invalida'}), 400
    if cuando.tzinfo is None:
        return jsonify({'error': 'fecha invalida'}), 400
    try:
        filas = supa._rest('POST', 'recordatorios', {'select': CAMPOS}, {
            'usuario_id': g.usuario_id, 'texto': texto,
            'cuando': cuando.astimezone(timezone.utc).isoformat()
        }, {'Prefer': 'return=representation'})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'recordatorio': (filas or [None])[0]})


@bp.route('/recordatorios/<rid>', methods=['PATCH'])
@supa.requiere_login
def marcar(rid):
    if not RE_ID.fullmatch(rid):
        return jsonify({'error': 'id invalido'}), 400
    data = request.get_json(silent=True) or {}
    try:
        supa._rest('PATCH', 'recordatorios', {'id': 'eq.' + rid}, {'avisado': bool(data.get('avisado'))})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})


@bp.route('/recordatorios/<rid>', methods=['DELETE'])
@supa.requiere_login
def borrar(rid):
    if not RE_ID.fullmatch(rid):
        return jsonify({'error': 'id invalido'}), 400
    try:
        supa._rest('DELETE', 'recordatorios', {'id': 'eq.' + rid})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})
