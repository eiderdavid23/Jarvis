import shutil
for r in ('public/nexus.html', 'public/nexus.js', 'public/nexus.css', 'CONTEXTO_JARVIS.md'):
    shutil.copy(r, r + '.bak')

def cambiar(s, viejo, nuevo, donde):
    assert s.count(viejo) == 1, donde + ': ancla no encontrada o repetida: ' + viejo[:50]
    return s.replace(viejo, nuevo)

# ---------- 1. nexus.html: caja del resumen ----------
h = open('public/nexus.html', encoding='utf-8').read()
h = cambiar(h, '<section id="v-inicio" class="vista">\n',
    '<section id="v-inicio" class="vista">\n        <div id="resumen" class="resumen"></div>\n', 'nexus.html')
open('public/nexus.html', 'w', encoding='utf-8').write(h)
print('nexus.html: caja del resumen')

# ---------- 2. nexus.js: resumen del dia y linea de tiempo ----------
j = open('public/nexus.js', encoding='utf-8').read()
j = cambiar(j, "pintarInicio(); pintarCuenta();", "pintarInicio(); pintarResumen(); pintarCuenta();", 'nexus.js')
FUNC = r"""  /* ---------- Inicio: resumen del día y línea de tiempo ---------- */
  var resumenHecho = false;
  function cuandoTxt(iso) {
    var d = new Date(iso), h = new Date(), m = new Date(h.getTime() + 864e5);
    var hora = d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === h.toDateString()) return 'Hoy ' + hora;
    if (d.toDateString() === m.toDateString()) return 'Mañana ' + hora;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' ' + hora;
  }
  function cifra(n, txt) { return el('div', { class: 'cifra' }, el('b', { text: String(n) }), el('span', { text: txt })); }
  function filaT(t, txt) { return el('div', { class: 'fila-t' }, el('span', { class: 'cuando', text: cuandoTxt(t) }), el('span', { text: txt })); }
  function pintarResumen() {
    if (resumenHecho) return;
    resumenHecho = true;
    Promise.all([
      api('/recordatorios').catch(function () { return {}; }),
      api('/chats').catch(function () { return []; })
    ]).then(function (r) {
      var recs = (r[0] && r[0].recordatorios) || [], chats = Array.isArray(r[1]) ? r[1] : [];
      var hoy = new Date().toDateString(), semana = Date.now() - 7 * 864e5;
      var pend = recs.filter(function (x) { return !x.avisado; })
        .sort(function (a, b) { return new Date(a.cuando) - new Date(b.cuando); });
      var nPlats = plats.filter(function (p) { return p.dueno_id === null || p.dueno_id === yo.user_id; }).length;
      var recHoy = pend.filter(function (x) { return new Date(x.cuando).toDateString() === hoy; }).length;
      var chatsHoy = chats.filter(function (c) { return c.actualizado && new Date(c.actualizado).toDateString() === hoy; }).length;
      var linea = [];
      chats.forEach(function (c) {
        if (c.actualizado && new Date(c.actualizado).getTime() > semana) linea.push({ t: c.actualizado, txt: 'Chat · ' + (c.titulo || 'Sin título') });
      });
      recs.forEach(function (x) {
        if (x.avisado && new Date(x.cuando).getTime() > semana) linea.push({ t: x.cuando, txt: 'Recordatorio · ' + x.texto });
      });
      linea.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
      var caja = $('resumen'); vaciar(caja);
      caja.appendChild(el('p', { class: 'etq', text: 'Resumen de hoy' }));
      caja.appendChild(el('div', { class: 'cifras' }, cifra(nPlats, 'Plataformas'), cifra(recHoy, 'Recordatorios hoy'), cifra(chatsHoy, 'Chats hoy')));
      caja.appendChild(el('p', { class: 'etq' , text: 'Próximos recordatorios' }));
      if (!pend.length) caja.appendChild(el('p', { class: 'vacio', text: 'Sin recordatorios pendientes.' }));
      pend.slice(0, 5).forEach(function (x) { caja.appendChild(filaT(x.cuando, x.texto)); });
      caja.appendChild(el('p', { class: 'etq sep', text: 'Línea de tiempo (7 días)' }));
      if (!linea.length) caja.appendChild(el('p', { class: 'vacio', text: 'Sin actividad esta semana.' }));
      linea.slice(0, 8).forEach(function (x) { caja.appendChild(filaT(x.t, x.txt)); });
    });
  }
"""
j = cambiar(j, "  $('btnNueva').addEventListener('click', function () { nueva(false); });", FUNC + "  $('btnNueva').addEventListener('click', function () { nueva(false); });", 'nexus.js')
open('public/nexus.js', 'w', encoding='utf-8').write(j)
print('nexus.js: resumen del dia')

# ---------- 3. nexus.css ----------
c = open('public/nexus.css', encoding='utf-8').read()
assert '.cifras' not in c, 'nexus.css ya tiene el estilo del resumen'
c = c.rstrip('\n') + """
.resumen { margin-bottom: 30px; }
.cifras { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
.cifra { background: var(--panel); border: 1px solid var(--linea); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 2px; }
.cifra b { font: 500 26px 'Newsreader', Georgia, serif; color: var(--cian); }
.cifra span { color: var(--suave); font-size: 12px; }
.fila-t { display: flex; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--linea); font-size: 14px; }
.fila-t .cuando { flex: 0 0 96px; color: var(--suave); font-size: 13px; }
.fila-t span:last-child { min-width: 0; overflow-wrap: anywhere; }
"""
open('public/nexus.css', 'w', encoding='utf-8').write(c)
print('nexus.css: estilos del resumen')

# ---------- 4. contexto ----------
L = open('CONTEXTO_JARVIS.md', encoding='utf-8').read().split('\n')
k = next(i for i, l in enumerate(L) if l.startswith('## 4.')) - 1
while k >= 0 and L[k].strip() in ('', '---'):
    k -= 1
L.insert(k + 1, '- **30 oct 2026**: NEXUS paso 6a, resumen del día y línea de tiempo arriba del Inicio de `/nexus` (solo `nexus.js`, `nexus.css` y `nexus.html`, '
    'sin servidor ni SQL nuevos). Usa `GET /recordatorios` y `GET /chats` con la sesión de Jarvis: tres cifras (plataformas, recordatorios de hoy, chats de hoy), '
    'los 5 próximos recordatorios sin avisar y la actividad de los últimos 7 días (chats y recordatorios ya avisados). Si una de las dos consultas falla, '
    'esa parte sale vacía sin romper la página. Se carga una vez por apertura. Falta el paso 6b: automatizaciones.')
L = [l.replace('paso 6 resumen diario, línea de tiempo y automatizaciones', 'paso 6b automatizaciones (6a resumen y línea de tiempo ya hecho)') for l in L]
open('CONTEXTO_JARVIS.md', 'w', encoding='utf-8').write('\n'.join(L))
print('Contexto actualizado')
