"""Crea PDF con el diseno de Jarvis (pdf_estilo.py) a partir de bloques que escribe el modelo.
Devuelve el PDF en base64 para que el chat lo muestre como tarjeta de descarga (igual que los add-ons)."""
import base64
import io
import json
import re
import unicodedata
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib.units import cm
from reportlab.platypus import (HRFlowable, ListFlowable, ListItem, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer)

import pdf_estilo as est

MAX_BLOQUES, MAX_LETRAS, MAX_BYTES = 150, 60000, 3000000
MESES = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
         'octubre', 'noviembre', 'diciembre')
CAMBIOS = {'\u2011': '-', '\u2212': '-', '\u2192': '->', '\u2190': '<-', '\u2264': '<=', '\u2265': '>=',
           '\u2260': '!=', '\u2248': '~', '\u00a0': ' ', '\u200b': '', '\u2713': 'v', '\u2714': 'v'}
RE_COD = re.compile(r'`([^`\n]+)`')
RE_NEG = re.compile(r'\*\*(?=\S)(.+?)(?<=\S)\*\*')
RE_CUR = re.compile(r'(?<![\*\w])\*(?=\S)(.+?)(?<=\S)\*(?![\*\w])')


def limpiar(t):
    """Deja solo lo que las fuentes del PDF saben dibujar (Latin-1 y comillas, rayas y vinetas de Windows)."""
    t = unicodedata.normalize('NFC', str(t or ''))
    for a, b in CAMBIOS.items():
        t = t.replace(a, b)
    return t.encode('cp1252', 'ignore').decode('cp1252')


def marcar(t):
    t = escape(limpiar(t)).strip()
    t = RE_COD.sub(r'<font name="Courier" color="#0b1e3a">\1</font>', t)
    t = RE_NEG.sub(r'<b>\1</b>', t)
    t = RE_CUR.sub(r'<i>\1</i>', t)
    return t.replace('\n', '<br/>')


def par(texto, estilo):
    try:
        return Paragraph(marcar(texto), est.ESTILOS[estilo])
    except Exception:
        return Paragraph(escape(limpiar(texto)).replace('\n', '<br/>'), est.ESTILOS[estilo])


def _texto(b, i):
    t = str(b.get('texto') or '').strip()
    if not t:
        raise ValueError(f'bloque {i} ({b.get("tipo")}): falta "texto"')
    return t


def _lista(b, i, numerada):
    items = [str(x).strip() for x in (b.get('items') or []) if str(x).strip()]
    if not items:
        raise ValueError(f'bloque {i} (lista): faltan los "items"')
    cola = dict(bulletType='1', bulletFormat='%s.', bulletFontName='Helvetica-Bold') if numerada \
        else dict(bulletType='bullet', start='\u2022')
    return ListFlowable([ListItem(par(x, 'item'), leftIndent=16) for x in items], leftIndent=16,
                        bulletColor=est.CIAN, bulletFontSize=9, **cola)


def _tabla(b, i):
    filas = []
    for f in (b.get('filas') or []):
        celdas = f if isinstance(f, list) else str(f).split(' | ')
        filas.append([marcar(c) for c in celdas])
    if len(filas) < 2:
        raise ValueError(f'bloque {i} (tabla): pon el encabezado y al menos una fila en "filas"')
    return est.tabla(filas, lambda c, e: Paragraph(c, est.ESTILOS[e]))


def _bloque(b, i):
    tipo = str(b.get('tipo') or 'parrafo').lower()
    if tipo in ('seccion', 'subseccion', 'parrafo'):
        return [par(_texto(b, i), tipo)]
    if tipo in ('lista', 'numerada'):
        return [_lista(b, i, tipo == 'numerada'), Spacer(1, 6)]
    if tipo == 'tabla':
        return [_tabla(b, i), Spacer(1, 10)]
    if tipo == 'nota':
        return [est.nota(par(_texto(b, i), 'nota')), Spacer(1, 10)]
    if tipo == 'codigo':
        return [est.codigo(limpiar(_texto(b, i))), Spacer(1, 10)]
    if tipo == 'separador':
        return [HRFlowable(width='100%', thickness=0.6, color=est.LINEA, spaceBefore=6, spaceAfter=8)]
    if tipo == 'salto':
        return [PageBreak()]
    raise ValueError(f'bloque {i}: tipo "{tipo}" no valido (usa seccion, subseccion, parrafo, lista, numerada, tabla, nota, codigo, separador, salto)')


def _fecha(zona):
    try:
        from zoneinfo import ZoneInfo
        h = datetime.now(ZoneInfo(zona or 'UTC'))
    except Exception:
        h = datetime.utcnow()
    return f'{h.day} de {MESES[h.month - 1]} de {h.year}'


def _slug(t):
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')[:40] or 'documento'


def crear(args, zona='UTC'):
    """Devuelve (resultado_para_el_modelo, pdf_para_el_chat o None)."""
    titulo = ' '.join(str(args.get('titulo') or '').split())[:120]
    sub = ' '.join(str(args.get('subtitulo') or '').split())[:200]
    bloques = args.get('bloques')
    if isinstance(bloques, str):
        try:
            bloques = json.loads(bloques)
        except ValueError:
            bloques = None
    if not titulo:
        return {'ok': False, 'error': 'falta el titulo'}, None
    if not isinstance(bloques, list) or not bloques:
        return {'ok': False, 'error': 'faltan los bloques del documento'}, None
    if len(bloques) > MAX_BLOQUES or len(json.dumps(bloques, ensure_ascii=False)) > MAX_LETRAS:
        return {'ok': False, 'error': 'el documento es demasiado largo; resumelo o dividelo en dos PDF'}, None
    historia = [par(titulo, 'titulo')]
    if sub:
        historia.append(par(sub, 'subtitulo'))
    historia += [HRFlowable(width=3 * cm, thickness=2, color=est.ORO, hAlign='LEFT', spaceBefore=4, spaceAfter=6),
                 par('Jarvis · ' + _fecha(zona), 'meta'), Spacer(1, 14)]
    try:
        for i, b in enumerate(bloques, 1):
            if not isinstance(b, dict):
                raise ValueError(f'bloque {i}: debe ser un objeto con "tipo"')
            historia += _bloque(b, i)
        memoria = io.BytesIO()
        SimpleDocTemplate(memoria, pagesize=est.A4, leftMargin=est.MARGEN, rightMargin=est.MARGEN,
                          topMargin=2.2 * cm, bottomMargin=2.4 * cm, title=limpiar(titulo),
                          author='Jarvis').build(historia, canvasmaker=est.LienzoNumerado)
    except ValueError as e:
        return {'ok': False, 'error': str(e) + '. Corrigelo y vuelve a llamar.'}, None
    except Exception as e:
        print('[PDF]', e)
        return {'ok': False, 'error': 'no pude armar el PDF: ' + str(e)[:150]}, None
    datos = memoria.getvalue()
    if len(datos) > MAX_BYTES:
        return {'ok': False, 'error': 'el PDF pasa de 3 MB; acortalo'}, None
    try:
        from pypdf import PdfReader
        paginas = len(PdfReader(io.BytesIO(datos)).pages)
    except Exception:
        paginas = 0
    pdf = {'nombre': titulo, 'archivo': _slug(titulo) + '.pdf', 'bytes': len(datos), 'paginas': paginas,
           'datos': base64.b64encode(datos).decode()}
    return {'ok': True, 'paginas': paginas,
            'mensaje': 'El PDF ya aparece en el chat como tarjeta de descarga. Di en una o dos frases que esta '
                       'listo y de que trata. No pegues su contenido en el chat.'}, pdf


HERRAMIENTA = {
    'name': 'crear_pdf',
    'description': (
        'Crea un PDF con el diseno propio de Jarvis (portada con titulo, secciones, listas, tablas, notas, codigo y '
        'pie con paginas) que el usuario descarga desde una tarjeta en el chat. Usar cuando pida un PDF, informe, '
        'resumen, guia, carta, curriculum, apuntes, cotizacion o documento para descargar o imprimir. TU escribes '
        'TODO el contenido real y completo (nada de marcadores ni "aqui iria"); el servidor pone el diseno, asi que '
        'no hables de colores ni tipografia. En los textos puedes usar **negrita**, *cursiva* y `codigo`. Sin '
        'imagenes ni emojis. Si el usuario no dijo de que trata, preguntaselo antes. Si la herramienta devuelve un '
        'error, corrigelo y vuelve a llamarla.'
    ),
    'parameters': {
        'type': 'object',
        'properties': {
            'titulo': {'type': 'string', 'description': 'Titulo del documento (maximo 120 letras)'},
            'subtitulo': {'type': 'string', 'description': 'Frase corta bajo el titulo (opcional)'},
            'bloques': {
                'type': 'array',
                'description': 'El documento en orden. Maximo 150 bloques.',
                'items': {
                    'type': 'object',
                    'properties': {
                        'tipo': {'type': 'string', 'description': 'seccion (titulo grande), subseccion, parrafo, lista (vinetas), numerada, tabla, nota (recuadro destacado), codigo, separador o salto (nueva pagina)'},
                        'texto': {'type': 'string', 'description': 'Para seccion, subseccion, parrafo, nota y codigo'},
                        'items': {'type': 'array', 'items': {'type': 'string'}, 'description': 'Para lista y numerada: un texto por punto'},
                        'filas': {'type': 'array', 'items': {'type': 'string'}, 'description': 'Para tabla: cada fila es un texto con las celdas separadas por " | ". La primera fila es el encabezado.'}
                    },
                    'required': ['tipo']
                }
            }
        },
        'required': ['titulo', 'bloques']
    }
}
