import io, re
from collections import Counter
from pypdf import PdfReader
from fpdf import FPDF

def _fuente(nombre):
    n = nombre.split("+")[-1].lower()
    if any(k in n for k in ("times", "serif", "georgia", "cambria", "garamond")):
        return "Times"
    if any(k in n for k in ("courier", "consolas", "mono")):
        return "Courier"
    return "Helvetica"

def extraer_estilo(pdf_bytes):
    e = {"fuente": "Helvetica", "acento": (200, 155, 70), "oscuro": (50, 45, 40),
         "titulo": (30, 80, 130), "gris": (242, 242, 242), "ancho": 210, "alto": 297}
    try:
        r = PdfReader(io.BytesIO(pdf_bytes))
        mb = r.pages[0].mediabox
        e["ancho"] = round(float(mb.width) * 25.4 / 72, 1)
        e["alto"] = round(float(mb.height) * 25.4 / 72, 1)
    except Exception:
        return e
    fuentes, colores = Counter(), Counter()
    for pag in r.pages[:8]:
        try:
            for f in pag["/Resources"]["/Font"].values():
                fuentes[str(f.get_object().get("/BaseFont", ""))] += 1
        except Exception:
            pass
        try:
            cont = pag.get_contents()
            if cont is None:
                continue
            data = cont.get_data().decode("latin-1")
            for m in re.finditer(r"([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg", data):
                colores[tuple(round(float(x) * 255) for x in m.groups())] += 1
        except Exception:
            pass
    if fuentes:
        e["fuente"] = _fuente(fuentes.most_common(1)[0][0])
    vivos = [(c, n) for c, n in colores.most_common() if max(c) - min(c) > 40]
    if vivos:
        e["acento"] = vivos[0][0]
        oscuros = [c for c, n in vivos if sum(c) < 400]
        e["titulo"] = oscuros[0] if oscuros else vivos[0][0]
    for c, n in colores.most_common():
        if max(c) < 80:
            e["oscuro"] = c
            break
    for c, n in colores.most_common():
        if min(c) >= 225 and max(c) <= 250 and max(c) - min(c) <= 10:
            e["gris"] = c
            break
    return e

def _limpio(t):
    for a, b in (("–", "-"), ("—", "-"), ("“", '"'), ("”", '"'), ("‘", "'"), ("’", "'"), ("•", "-"), ("…", "...")):
        t = t.replace(a, b)
    return t.encode("latin-1", "replace").decode("latin-1")

class PDFEstilo(FPDF):
    def __init__(self, e):
        super().__init__(unit="mm", format=(e["ancho"], e["alto"]))
        self.e = e
        self.set_auto_page_break(True, margin=22)
        self.set_margins(18, 22, 18)

    def header(self):
        self.set_fill_color(*self.e["acento"])
        self.rect(0, 0, self.w, 6, "F")

    def footer(self):
        self.set_fill_color(*self.e["acento"])
        self.rect(0, self.h - 14, self.w, 4, "F")
        self.set_fill_color(*self.e["oscuro"])
        self.rect(0, self.h - 10, self.w, 10, "F")
        self.set_y(-9)
        self.set_font(self.e["fuente"], "", 9)
        self.set_text_color(255, 255, 255)
        self.cell(0, 6, str(self.page_no()), align="R")

def generar_pdf_con_estilo(texto, e):
    f = e["fuente"]
    pdf = PDFEstilo(e)
    pdf.add_page()
    primera = True
    for linea in _limpio(texto).splitlines():
        s = linea.strip()
        if not s:
            pdf.ln(3)
            continue
        pdf.set_x(pdf.l_margin)
        if s.startswith("#") or primera:
            nivel = len(s) - len(s.lstrip("#"))
            s = s.lstrip("#").strip()
            tam = 20 if primera else {1: 18, 2: 15}.get(nivel, 13)
            pdf.set_font(f, "B", tam)
            pdf.set_text_color(*e["titulo"])
            pdf.multi_cell(0, tam * 0.5, s)
            pdf.ln(2)
            primera = False
        elif s[:1] in "-*":
            pdf.set_font(f, "", 11)
            pdf.set_text_color(0, 0, 0)
            pdf.set_x(pdf.l_margin + 5)
            pdf.multi_cell(0, 6, "-  " + s[1:].strip().replace("**", ""))
        elif re.match(r"^\d+(\.\d+)+", s):
            pdf.set_font(f, "B", 11)
            pdf.set_text_color(0, 0, 0)
            pdf.set_fill_color(*e["gris"])
            pdf.multi_cell(0, 6.5, s.replace("**", ""), fill=True)
        else:
            pdf.set_font(f, "", 11)
            pdf.set_text_color(0, 0, 0)
            pdf.multi_cell(0, 6, s.replace("**", ""))
    return bytes(pdf.output())
