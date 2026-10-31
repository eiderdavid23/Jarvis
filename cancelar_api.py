"""Cancelar funciones en curso: corta las ordenes de las Manos y el bucle de herramientas.
El boton Detener del frontend llama a /manos/cancelar; el celular consulta /manos/d/orden/<id>."""
import time

from flask import Blueprint, request, jsonify, g

import supa
import manos_api

bp = Blueprint('cancelar', __name__)
_CANCELADO = {}   # usuario_id -> momento de su ultima cancelacion (solo en memoria de esta instancia)


def ahora():
    return time.time()


def cancelado(uid, desde):
    """True si el usuario cancelo despues de 'desde' (inicio del mensaje que se esta atendiendo)."""
    t = _CANCELADO.get(uid)
    return bool(uid and t and desde and t >= desde)


def _vencer_ordenes():
    """Marca como vencidas las ordenes pendientes o en curso del usuario. Devuelve cuantas."""
    try:
        f = supa._rest('PATCH', 'manos_ordenes',
                       {'usuario_id': 'eq.' + str(g.usuario_id), 'estado': 'in.(pendiente,enviada)'},
                       cuerpo={'estado': 'vencida', 'resultado': 'cancelada por el usuario'},
                       extra=manos_api.REP)
    except supa.SupaError as e:
        print('[CANCELAR]', e)
        return 0
    return len(f or [])


@bp.route('/manos/cancelar', methods=['POST'])
@supa.requiere_login
def cancelar():
    _CANCELADO[g.usuario_id] = ahora()
    return jsonify({'ok': True, 'ordenes': _vencer_ordenes()})


@bp.route('/manos/d/orden/<oid>', methods=['GET'])
def d_orden(oid):
    """El celular (solo con su token) pregunta en que estado esta la orden que esta ejecutando."""
    h = manos_api._token_celular()
    if not h:
        return jsonify({'error': 'sin token'}), 401
    if not manos_api.UUID.match(oid):
        return jsonify({'error': 'Orden no valida.'}), 400
    try:
        e = manos_api._rpc('manos_orden_estado', {'p_hash': h, 'p_orden': oid})
    except supa.SupaError as ex:
        return manos_api._fallo(ex)
    return jsonify({'estado': e})
