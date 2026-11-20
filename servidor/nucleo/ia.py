"""IA: solo Gemini y Groq. Prueba los modelos en orden y pasa al siguiente si uno
se agota (429), no existe (404), falla (5xx) o no responde a tiempo."""
import requests

from servidor import config


class IAError(Exception):
    """Ningun modelo pudo responder."""


def _gemini(modelo, sistema, turnos, llave):
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent'
    contenidos = [{'role': 'user' if t['role'] == 'user' else 'model', 'parts': [{'text': t['texto']}]}
                  for t in turnos]
    cuerpo = {'system_instruction': {'parts': [{'text': sistema}]}, 'contents': contenidos,
              'generationConfig': {'maxOutputTokens': 4096}}
    r = requests.post(url, params={'key': llave}, json=cuerpo, timeout=config.TIEMPO_IA)
    r.raise_for_status()
    cand = (r.json().get('candidates') or [{}])[0]
    partes = (cand.get('content') or {}).get('parts') or []
    texto = ''.join(p.get('text', '') for p in partes if not p.get('thought'))
    if not texto.strip():
        raise requests.exceptions.HTTPError('respuesta vacia')
    return texto.strip()


def _groq(modelo, sistema, turnos, llave):
    mensajes = [{'role': 'system', 'content': sistema}]
    mensajes += [{'role': t['role'], 'content': t['texto']} for t in turnos]
    r = requests.post('https://api.groq.com/openai/v1/chat/completions',
                      headers={'Authorization': 'Bearer ' + llave},
                      json={'model': modelo, 'messages': mensajes, 'max_tokens': 4096},
                      timeout=config.TIEMPO_IA)
    r.raise_for_status()
    texto = (((r.json().get('choices') or [{}])[0]).get('message') or {}).get('content') or ''
    if not texto.strip():
        raise requests.exceptions.HTTPError('respuesta vacia')
    return texto.strip()


def llaves_de(cabeceras):
    """Llave del navegador (cabecera) o, si no hay, la del servidor (.env)."""
    return {
        'gemini': (cabeceras.get('X-Gemini-Key') or '').strip() or config.GEMINI_API_KEY,
        'groq': (cabeceras.get('X-Groq-Key') or '').strip() or config.GROQ_API_KEY,
    }


def _cadena(llaves):
    lista = []
    if llaves.get('gemini'):
        lista.append(('gemini', config.GEMINI_MODELO))
        if config.GEMINI_RESPALDO and config.GEMINI_RESPALDO != config.GEMINI_MODELO:
            lista.append(('gemini', config.GEMINI_RESPALDO))
    if llaves.get('groq'):
        lista.append(('groq', config.GROQ_MODELO))
    return lista


def responder(sistema, turnos, llaves):
    """Devuelve (texto, 'proveedor|modelo'). Lanza IAError si todos fallan."""
    cadena = _cadena(llaves)
    if not cadena:
        raise IAError('Falta una llave de Gemini o de Groq. Conéctela en Ajustes, señor.')
    fallos = []
    for prov, modelo in cadena:
        try:
            funcion = _gemini if prov == 'gemini' else _groq
            return funcion(modelo, sistema, turnos, llaves[prov]), f'{prov}|{modelo}'
        except requests.exceptions.RequestException as e:
            codigo = getattr(getattr(e, 'response', None), 'status_code', None)
            fallos.append(f'{modelo}: {codigo or e.__class__.__name__}')
            print('[IA]', modelo, 'fallo:', codigo or e.__class__.__name__)
    raise IAError('Señor, ningún modelo pudo responder ahora (' + '; '.join(fallos) + '). Intente en un momento.')
