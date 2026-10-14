import asyncio
import os

import edge_tts

FRASE = ('Buenas tardes, señor. Todos los sistemas funcionan con normalidad. '
         'Aunque debo admitir que su sentido de la puntualidad sigue siendo... ambicioso.')
LUGARES = ('es-ES', 'es-MX', 'es-CO', 'es-AR', 'es-US', 'es-CL')


def carpeta():
    base = os.path.expanduser('~/storage/downloads')
    if not os.path.isdir(base):
        base = os.path.expanduser('~')
    d = os.path.join(base, 'voces_jarvis')
    os.makedirs(d, exist_ok=True)
    return d


async def main():
    voces = await edge_tts.list_voices()
    elegidas = [v for v in voces if v['Gender'] == 'Male'
                and (v['Locale'] in LUGARES or 'Multilingual' in v['ShortName'])]
    elegidas.sort(key=lambda v: v['ShortName'])
    d = carpeta()
    print('Guardando en', d)
    for v in elegidas:
        nombre = v['ShortName']
        try:
            await edge_tts.Communicate(FRASE, nombre, pitch='-6Hz').save(os.path.join(d, nombre + '.mp3'))
            print('ok', nombre)
        except Exception as e:
            print('fallo', nombre, str(e)[:60])


asyncio.run(main())
