import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

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


# ---------- Herramientas de Jarvis (las usa la IA desde el chat) ----------

def _zona(nombre):
    try:
        return ZoneInfo(nombre or 'UTC')
    except Exception:
        return ZoneInfo('UTC')


def _local(iso, zona):
    return datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(zona).strftime('%Y-%m-%d %H:%M')


def _crear_h(args, zona):
    texto = str(args.get('texto') or '').strip()[:300]
    bruto = str(args.get('fecha_hora') or '').strip().replace('T', ' ')[:16]
    if not texto:
        return {'ok': False, 'error': 'falta que recordar'}
    try:
        d = datetime.strptime(bruto, '%Y-%m-%d %H:%M').replace(tzinfo=zona)
    except ValueError:
        return {'ok': False, 'error': 'fecha_hora debe ser YYYY-MM-DD HH:MM; si falta la hora, preguntesela al usuario'}
    if d <= datetime.now(zona):
        return {'ok': False, 'error': 'esa hora ya paso; pidale al usuario otra'}
    supa._rest('POST', 'recordatorios', {}, {
        'usuario_id': g.usuario_id, 'texto': texto, 'cuando': d.astimezone(timezone.utc).isoformat()})
    return {'ok': True, 'texto': texto, 'fecha_hora': d.strftime('%Y-%m-%d %H:%M')}


def _borrar_h(args, filas, zona):
    rid = str(args.get('id') or '').strip()
    clave = str(args.get('texto') or '').strip().lower()
    if rid and RE_ID.fullmatch(rid):
        objetivo = [f for f in filas if f['id'] == rid]
    elif clave:
        coinc = [f for f in filas if clave in f['texto'].lower()]
        objetivo = [f for f in coinc if not f.get('avisado')] or coinc
    else:
        return {'ok': False, 'error': 'falta el texto o el id del recordatorio'}
    if not objetivo:
        return {'ok': False, 'error': 'no hay ningun recordatorio con ese texto'}
    if len(objetivo) > 1:
        return {'ok': False, 'error': 'hay varios; preguntele al usuario cual', 'candidatos': [
            {'id': f['id'], 'texto': f['texto'], 'fecha_hora': _local(f['cuando'], zona)} for f in objetivo[:10]]}
    supa._rest('DELETE', 'recordatorios', {'id': 'eq.' + objetivo[0]['id']})
    return {'ok': True, 'borrado': objetivo[0]['texto']}


def herramienta(nombre, args, zona_nombre):
    zona = _zona(zona_nombre)
    try:
        if nombre == 'crear_recordatorio':
            return _crear_h(args, zona)
        filas = supa._rest('GET', 'recordatorios', {'select': CAMPOS, 'order': 'cuando.asc', 'limit': '200'}) or []
        if nombre == 'listar_recordatorios':
            return {'ok': True, 'pendientes': [
                {'id': f['id'], 'texto': f['texto'], 'fecha_hora': _local(f['cuando'], zona)}
                for f in filas if not f.get('avisado')][:30]}
        return _borrar_h(args, filas, zona)
    except supa.SupaError as e:
        print('[RECORDATORIOS]', e)
        return {'ok': False, 'error': 'no pude usar los recordatorios: ' + str(e)}
