"""Chat: recibe un mensaje, lo responde con la IA y guarda el intercambio."""
from flask import Blueprint, request, jsonify, g

from servidor.nucleo import ia, supa
from servidor.modulos.chat import personalidad

bp = Blueprint('chat', __name__)


@bp.route('/chat', methods=['POST'])
@supa.requiere_login
def chat():
    data = request.get_json(silent=True) or {}
    mensaje = (data.get('mensaje') or '').strip()
    if not mensaje:
        return jsonify({'error': 'mensaje vacio', 'respuesta': 'No recibí ningún mensaje, señor.'}), 400

    chat_id = data.get('chat_id') or supa.crear_chat()['id']
    historial = supa.ultimos_mensajes(chat_id)
    turnos = historial + [{'role': 'user', 'texto': mensaje}]

    try:
        texto, modelo = ia.responder(personalidad.sistema(g.nombre), turnos, ia.llaves_de(request.headers))
    except ia.IAError as e:
        return jsonify({'error': 'ia', 'respuesta': str(e), 'chat_id': chat_id}), 503

    supa.guardar_intercambio(chat_id, mensaje, texto)
    if not historial:
        supa.renombrar_chat(chat_id, mensaje)
    return jsonify({'respuesta': texto, 'chat_id': chat_id, 'modelo': modelo})
