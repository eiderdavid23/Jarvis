"""Diseno unico de los PDF de Jarvis (reportlab): paleta tinta/cian/oro, titulos en serif, pie con paginas."""
import textwrap

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Preformatted, Table, TableStyle

TINTA, CIAN, ORO = colors.HexColor('#0b1e3a'), colors.HexColor('#0891b2'), colors.HexColor('#b8892b')
TEXTO, SUAVE = colors.HexColor('#1f2937'), colors.HexColor('#6b7280')
LINEA, FONDO = colors.HexColor('#d5dde5'), colors.HexColor('#f3f7fa')
MARGEN = 2.2 * cm
ANCHO = A4[0] - 2 * MARGEN - 12   # menos el relleno de 6 pt a cada lado del marco


def _e(nombre, **kw):
    base = dict(fontName='Helvetica', fontSize=10, leading=15, textColor=TEXTO)
    base.update(kw)
    return ParagraphStyle(nombre, **base)


ESTILOS = {
    'titulo': _e('titulo', fontName='Times-Bold', fontSize=26, leading=30, textColor=TINTA, spaceAfter=4),
    'subtitulo': _e('subtitulo', fontSize=12, leading=17, textColor=SUAVE, spaceAfter=4),
    'meta': _e('meta', fontSize=8.5, leading=12, textColor=SUAVE),
    'seccion': _e('seccion', fontName='Times-Bold', fontSize=16, leading=20, textColor=TINTA,
                  spaceBefore=16, spaceAfter=6, keepWithNext=1),
    'subseccion': _e('subseccion', fontName='Helvetica-Bold', fontSize=11.5, leading=15, textColor=CIAN,
                     spaceBefore=10, spaceAfter=3, keepWithNext=1),
    'parrafo': _e('parrafo', spaceAfter=7),
    'item': _e('item', spaceAfter=3),
    'celda': _e('celda', fontSize=9, leading=12.5),
    'celda_h': _e('celda_h', fontName='Helvetica-Bold', fontSize=9, leading=12.5, textColor=colors.white),
    'nota': _e('nota', fontSize=9.5, leading=14, textColor=TINTA),
}


class LienzoNumerado(canvas.Canvas):
    """Franja superior y pie con 'Pagina X de Y' (hace falta conocer el total antes de dibujar)."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._estados = []

    def showPage(self):
        self._estados.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._estados)
        for estado in self._estados:
            self.__dict__.update(estado)
            self._marco(total)
            super().showPage()
        super().save()

    def _marco(self, total):
        ancho, alto = A4
        self.setFillColor(TINTA)
        self.rect(0, alto - 0.45 * cm, ancho, 0.45 * cm, stroke=0, fill=1)
        self.setFillColor(ORO)
        self.rect(MARGEN, alto - 0.45 * cm, 2.2 * cm, 0.45 * cm, stroke=0, fill=1)
        self.setStrokeColor(LINEA)
        self.setLineWidth(0.6)
        self.line(MARGEN, 1.7 * cm, ancho - MARGEN, 1.7 * cm)
        self.setFont('Helvetica', 8)
        self.setFillColor(SUAVE)
        self.drawString(MARGEN, 1.2 * cm, 'Jarvis')
        self.drawRightString(ancho - MARGEN, 1.2 * cm, 'Página %d de %d' % (self._pageNumber, total))


def tabla(filas, par):
    """filas: lista de listas de textos ya marcados; la primera es el encabezado."""
    n = max(len(f) for f in filas)
    filas = [f + [''] * (n - len(f)) for f in filas]
    pesos = [min(max(len(f[c]) for f in filas), 40) + 6 for c in range(n)]
    anchos = [ANCHO * p / sum(pesos) for p in pesos]
    datos = [[par(c, 'celda_h' if i == 0 else 'celda') for c in f] for i, f in enumerate(filas)]
    t = Table(datos, colWidths=anchos, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TINTA), ('LINEBELOW', (0, 0), (-1, 0), 1.4, ORO),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, FONDO]),
        ('GRID', (0, 0), (-1, -1), 0.5, LINEA), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
    return t


def nota(parrafo):
    t = Table([[parrafo]], colWidths=[ANCHO])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), FONDO), ('LINEBEFORE', (0, 0), (0, -1), 3, CIAN),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    return t


def codigo(texto):
    lineas = []
    for l in texto.expandtabs(4).split('\n'):
        lineas.extend(textwrap.wrap(l, 88, drop_whitespace=False, replace_whitespace=False) or [''])
    trozos = ['\n'.join(lineas[i:i + 25]) for i in range(0, len(lineas), 25)]
    pre = ParagraphStyle('cod', fontName='Courier', fontSize=8, leading=11, textColor=TINTA)
    t = Table([[Preformatted(c, pre)] for c in trozos], colWidths=[ANCHO])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#eef1f5')),
        ('BOX', (0, 0), (-1, -1), 0.5, LINEA), ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    return t
