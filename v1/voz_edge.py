import asyncio
import os
import time

VOZ = os.environ.get('EDGE_VOZ', 'es-AR-TomasNeural')
TONO = os.environ.get('EDGE_TONO', '-4Hz')
MAX_LETRAS = 600
_bloqueado_hasta = 0.0


async def _sintetizar(texto, vel):
    import edge_tts
    pct = int(os.environ.get('EDGE_VEL', '8'))  # ritmo fijo: ignora el ajuste de velocidad de la app
    com = edge_tts.Communicate(texto, VOZ, rate='%+d%%' % pct, pitch=TONO)
    partes = []
    async for trozo in com.stream():
        if trozo['type'] == 'audio':
            partes.append(trozo['data'])
    return b''.join(partes)


def generar(texto, vel=1.0):
    """Audio mp3 con la voz de edge-tts, o None para volver a la voz de siempre."""
    global _bloqueado_hasta
    if os.environ.get('VOZ_EDGE', '1') == '0' or time.time() < _bloqueado_hasta:
        return None
    if not texto or len(texto) > MAX_LETRAS:
        return None
    try:
        audio = asyncio.run(asyncio.wait_for(_sintetizar(texto, vel), timeout=12))
        if audio:
            return audio
    except Exception as e:
        print('[EDGE] en pausa 2 min:', e)
    _bloqueado_hasta = time.time() + 120
    return None
