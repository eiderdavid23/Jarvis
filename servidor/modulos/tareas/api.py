"""Tareas automaticas: crear, listar, marcar y cancelar. Tabla tareas_auto (RLS por usuario)."""
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify

from servidor.nucleo import supa

bp = Blueprint('tareas', __name__)
DEVOLVER = {'Prefer': 'return=representation'}


@bp.route('/tareas', methods=['GET'])
@supa.requiere_login
def listar():
    return jsonify(supa.rest('GET', 'tareas_auto', {
        'select': 'id,titulo,instruccion,cuando,estado,resultado',
        'order': 'cuando.asc', 'limit': '100'}))


@bp.route('/tareas', methods=['POST'])
@supa.requiere_login
def crear():
    d = request.get_json(silent=True) or {}
    titulo = ' '.join(str(d.get('titulo') or '').split())[:120]
    instruccion = str(d.get('instruccion') or '').strip()[:800]
    cuando = str(d.get('cuando') or '').strip()
    if not titulo or not instruccion or not cuando:
        return jsonify({'error': 'Faltan el título, la instrucción o la hora'}), 400
    fila = supa.rest('POST', 'tareas_auto', cuerpo={
        'titulo': titulo, 'instruccion': instruccion, 'cuando': cuando}, extra=DEVOLVER)
    return jsonify(fila[0])


@bp.route('/tareas/<uuid:tarea_id>', methods=['PATCH'])
@supa.requiere_login
def marcar(tarea_id):
    d = request.get_json(silent=True) or {}
    estado = d.get('estado')
    if estado not in ('en_curso', 'hecha', 'fallida'):
        return jsonify({'error': 'estado no valido'}), 400
    filtro = {'id': 'eq.' + str(tarea_id)}
    if estado == 'en_curso':
        filtro['estado'] = 'eq.pendiente'  # solo la primera vez: se ejecuta una sola vez
    cuerpo = {'estado': estado}
    if d.get('resultado'):
        cuerpo['resultado'] = str(d['resultado'])[:600]
    if estado != 'en_curso':
        cuerpo['ejecutado'] = datetime.now(timezone.utc).isoformat()
    filas = supa.rest('PATCH', 'tareas_auto', filtro, cuerpo, extra=DEVOLVER)
    return jsonify({'ok': bool(filas)})


@bp.route('/tareas/<uuid:tarea_id>', methods=['DELETE'])
@supa.requiere_login
def borrar(tarea_id):
    supa.rest('DELETE', 'tareas_auto', {'id': 'eq.' + str(tarea_id)})
    return jsonify({'ok': True})
