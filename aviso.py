import os
import re
import hmac
from flask import Blueprint, request, Response

bp = Blueprint('aviso', __name__)


def _es_numero(texto):
    return len(re.sub(r'\D', '', texto)) >= 6 and not re.search(r'[A-Za-z\u00c0-\u00ff]', texto)


def _texto(frase):
    return Response(frase, mimetype='text/plain; charset=utf-8')


@bp.route('/aviso', methods=['GET', 'POST'])
def aviso():
    token = os.environ.get('AVISO_TOKEN', '')
    recibido = request.headers.get('X-Aviso-Token') or request.values.get('token', '')
    if not token or not hmac.compare_digest(recibido, token):
        return Response('no autorizado', status=401, mimetype='text/plain')

    tipo = (request.values.get('tipo') or '').strip().lower()
    nombre = (request.values.get('nombre') or '').strip()[:60]
    origen = (request.values.get('app') or '').strip().lower()
    desconocido = (not nombre) or _es_numero(nombre)

    if tipo == 'llamada':
        if desconocido:
            return _texto('Señor, está llamando un número desconocido. ¿Quiere que lo bloquee?')
        return _texto(f'Señor, está llamando {nombre}.')

    if tipo == 'mensaje':
        por = ' por WhatsApp' if 'whatsapp' in origen else ''
        if desconocido:
            return _texto(f'Señor, tiene un mensaje{por} de un número desconocido.')
        return _texto(f'Señor, tiene un mensaje{por} de {nombre}.')

    return Response('tipo invalido', status=400, mimetype='text/plain')
