"""Trabajos en segundo plano: el usuario deja una tarea larga y un ejecutor (agente_pc.py, la APK
o la web) la va haciendo paso a paso mientras el usuario hace otra cosa.
Estados: pendiente -> en_curso -> hecho | fallido | cancelado. Solo UN ejecutor lo toma y NO se reintenta."""
import re
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify, g

import supa

bp = Blueprint('trabajos', __name__)
TABLA = 'trabajos'
CAMPOS = 'id,titulo,instruccion,estado,pasos,resultado,dispositivo,actualizado,creado'
REP = {'Prefer': 'return=representation'}
RE_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
MAX_PASOS = 60
MIN_SIN_NOTICIAS = 20   # minutos sin avance antes de darlo por fallido (el ejecutor se cayo)


def _ahora():
    return datetime.now(timezone.utc)


def _limpio(v, largo):
    return ' '.join(str(v or '').split())[:largo]


def _fallo(e):
    print('[TRABAJOS]', e)
    t = str(e)
    if 'Supabase 404' in t or '42P01' in t or 'Could not find the table' in t:
        return jsonify({'error': 'Falta ejecutar supabase_trabajos.sql en Supabase.'}), 502
    return jsonify({'error': 'No pude usar los trabajos en segundo plano ahora mismo.'}), 502


def mensaje_de(f):
    """Lo que el ejecutor le manda a /chat para hacer el trabajo."""
    disp = f.get('dispositivo')
    donde = (' Usa el dispositivo "' + disp + '" en las herramientas de celular, PC o TV.') if disp else ''
    return ('TRABAJO EN SEGUNDO PLANO: el usuario te lo dejo y esta haciendo otra cosa, asi que no hagas preguntas. '
            'Hazlo completo con tus herramientas y al final resume en pocas frases que hiciste y que resultado quedo. '
            'Si algo falla, di cual fue el problema. Trabajo: ' + f['instruccion'] + donde)


def _limpiar_caidos():
    try:
        limite = (_ahora() - timedelta(minutes=MIN_SIN_NOTICIAS)).isoformat()
        supa._rest('PATCH', TABLA, {'estado': 'eq.en_curso', 'actualizado': 'lt.' + limite}, {
            'estado': 'fallido',
            'resultado': 'Se detuvo sin avisar (se apago el equipo o se perdio la conexion). No se reintento.'})
    except supa.SupaError as e:
        print('[TRABAJOS]', e)


def _id_ok(tid):
    return bool(RE_ID.match(tid))


@bp.route('/trabajos', methods=['GET'])
@supa.requiere_login
def listar():
    _limpiar_caidos()
    try:
        filas = supa._rest('GET', TABLA, {'select': CAMPOS, 'order': 'creado.desc', 'limit': '50'}) or []
    except supa.SupaError as e:
        return _fallo(e)
    r = jsonify({'trabajos': filas})
    r.headers['Cache-Control'] = 'no-store'
    return r


@bp.route('/trabajos', methods=['POST'])
@supa.requiere_login
def crear():
    d = request.get_json(silent=True) or {}
    instr = _limpio(d.get('instruccion'), 1500)
    titulo = _limpio(d.get('titulo'), 120) or instr[:60]
    if not instr:
        return jsonify({'error': 'Falta lo que hay que hacer.'}), 400
    try:
        f = supa._rest('POST', TABLA, {'select': CAMPOS}, {
            'usuario_id': g.usuario_id, 'titulo': titulo, 'instruccion': instr,
            'dispositivo': _limpio(d.get('dispositivo'), 80) or None}, REP)
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'trabajo': (f or [None])[0]}), 201


@bp.route('/trabajos/<tid>/reclamar', methods=['POST'])
@supa.requiere_login
def reclamar(tid):
    """El ejecutor lo toma. Solo uno lo logra, asi no se hace dos veces."""
    if not _id_ok(tid):
        return jsonify({'error': 'id invalido'}), 400
    try:
        f = supa._rest('PATCH', TABLA, {'id': 'eq.' + tid, 'estado': 'eq.pendiente', 'select': CAMPOS},
                       {'estado': 'en_curso', 'actualizado': _ahora().isoformat()}, REP)
    except supa.SupaError as e:
        return _fallo(e)
    if not f:
        return jsonify({'error': 'Otro ejecutor ya lo tomo, o ya no esta pendiente.'}), 409
    return jsonify({'trabajo': f[0], 'mensaje': mensaje_de(f[0])})


@bp.route('/trabajos/<tid>/paso', methods=['POST'])
@supa.requiere_login
def paso(tid):
    """El ejecutor reporta un avance. Responde cancelado=true si el usuario lo cancelo: hay que parar."""
    if not _id_ok(tid):
        return jsonify({'error': 'id invalido'}), 400
    d = request.get_json(silent=True) or {}
    texto = _limpio(d.get('texto'), 200)
    try:
        filas = supa._rest('GET', TABLA, {'id': 'eq.' + tid, 'select': 'estado,pasos'}) or []
        if not filas:
            return jsonify({'error': 'no existe'}), 404
        if filas[0]['estado'] != 'en_curso':
            return jsonify({'ok': True, 'cancelado': filas[0]['estado'] == 'cancelado'})
        if texto:
            pasos = (filas[0].get('pasos') or [])[-(MAX_PASOS - 1):]
            pasos.append({'t': _ahora().isoformat(), 'texto': texto})
            supa._rest('PATCH', TABLA, {'id': 'eq.' + tid, 'estado': 'eq.en_curso'},
                       {'pasos': pasos, 'actualizado': _ahora().isoformat()})
        else:
            supa._rest('PATCH', TABLA, {'id': 'eq.' + tid, 'estado': 'eq.en_curso'},
                       {'actualizado': _ahora().isoformat()})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True, 'cancelado': False})


@bp.route('/trabajos/<tid>/terminar', methods=['POST'])
@supa.requiere_login
def terminar(tid):
    if not _id_ok(tid):
        return jsonify({'error': 'id invalido'}), 400
    d = request.get_json(silent=True) or {}
    ok = bool(d.get('ok'))
    texto = _limpio(d.get('resultado'), 3000) or ('Listo.' if ok else 'Fallo.')
    try:
        supa._rest('PATCH', TABLA, {'id': 'eq.' + tid, 'estado': 'eq.en_curso'},
                   {'estado': 'hecho' if ok else 'fallido', 'resultado': texto, 'actualizado': _ahora().isoformat()})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})


@bp.route('/trabajos/<tid>/cancelar', methods=['POST'])
@supa.requiere_login
def cancelar(tid):
    """Cancela uno pendiente o en curso (el ejecutor se entera en su siguiente reporte de paso)."""
    if not _id_ok(tid):
        return jsonify({'error': 'id invalido'}), 400
    try:
        supa._rest('PATCH', TABLA, {'id': 'eq.' + tid, 'estado': 'in.(pendiente,en_curso)'},
                   {'estado': 'cancelado', 'resultado': 'Cancelado por el usuario.', 'actualizado': _ahora().isoformat()})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})


@bp.route('/trabajos/<tid>', methods=['DELETE'])
@supa.requiere_login
def borrar(tid):
    if not _id_ok(tid):
        return jsonify({'error': 'id invalido'}), 400
    try:
        supa._rest('DELETE', TABLA, {'id': 'eq.' + tid, 'estado': 'in.(hecho,fallido,cancelado)'})
    except supa.SupaError as e:
        return _fallo(e)
    return jsonify({'ok': True})
