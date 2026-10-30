import shutil
for r in ('public/nexus.js', 'public/nexus.css', 'CONTEXTO_JARVIS.md'):
    shutil.copy(r, r + '.bak')

# ---------- 1. nexus.js: quitar los chats del resumen ----------
j = open('public/nexus.js', encoding='utf-8').read()
a = j.find("  /* Chat de la línea de tiempo:")
b = j.find("  $('btnNueva').addEventListener('click'")
assert a != -1 and b > a, 'nexus.js: no encontre el bloque de chats (aplicaste parche_nexus_chats.py?)'
NUEVO = r"""  function pintarResumen() {
    if (resumenHecho) return;
    resumenHecho = true;
    api('/recordatorios').catch(function () { return {}; }).then(function (r) {
      var recs = (r && r.recordatorios) || [];
      var hoy = new Date().toDateString(), semana = Date.now() - 7 * 864e5;
      var pend = recs.filter(function (x) { return !x.avisado; })
        .sort(function (a, b) { return new Date(a.cuando) - new Date(b.cuando); });
      var nPlats = plats.filter(function (p) { return p.dueno_id === null || p.dueno_id === yo.user_id; }).length;
      var recHoy = pend.filter(function (x) { return new Date(x.cuando).toDateString() === hoy; }).length;
      var hechos = recs.filter(function (x) { return x.avisado && new Date(x.cuando).getTime() > semana; })
        .sort(function (a, b) { return new Date(b.cuando) - new Date(a.cuando); });
      var caja = $('resumen'); vaciar(caja);
      caja.appendChild(el('p', { class: 'etq', text: 'Resumen de hoy' }));
      caja.appendChild(el('div', { class: 'cifras' }, cifra(nPlats, 'Plataformas'), cifra(recHoy, 'Recordatorios hoy'), cifra(pend.length, 'Pendientes')));
      caja.appendChild(el('p', { class: 'etq', text: 'Próximos recordatorios' }));
      if (!pend.length) caja.appendChild(el('p', { class: 'vacio', text: 'Sin recordatorios pendientes.' }));
      pend.slice(0, 5).forEach(function (x) { caja.appendChild(filaT(x.cuando, x.texto)); });
      caja.appendChild(el('p', { class: 'etq sep', text: 'Línea de tiempo (7 días)' }));
      if (!hechos.length) caja.appendChild(el('p', { class: 'vacio', text: 'Sin recordatorios avisados esta semana.' }));
      hechos.slice(0, 8).forEach(function (x) { caja.appendChild(filaT(x.cuando, 'Recordatorio · ' + x.texto)); });
    });
  }
"""
j = j[:a] + NUEVO + j[b:]
open('public/nexus.js', 'w', encoding='utf-8').write(j)
print('nexus.js: chats quitados del resumen')

# ---------- 2. nexus.css: quitar el estilo de los chats ----------
c = open('public/nexus.css', encoding='utf-8').read()
x = c.find('\n.chat-t { border-bottom')
fin = '@media (max-width: 600px) { .chat-cuerpo { padding-left: 0; } }\n'
y = c.find(fin)
assert x != -1 and y > x, 'nexus.css: no encontre el estilo de chats'
c = c[:x] + c[y + len(fin):]
open('public/nexus.css', 'w', encoding='utf-8').write(c)
print('nexus.css: estilo de chats quitado')

# ---------- 3. contexto ----------
L = open('CONTEXTO_JARVIS.md', encoding='utf-8').read().split('\n')
k = next(i for i, l in enumerate(L) if l.startswith('## 4.')) - 1
while k >= 0 and L[k].strip() in ('', '---'):
    k -= 1
L.insert(k + 1, '- **30 oct 2026**: NEXUS paso 6a, cambio: se quitaron los chats del resumen de `/nexus` (el historial de chats se ve en Jarvis). '
    'Ahora el resumen usa solo `GET /recordatorios`: cifras de plataformas, recordatorios de hoy y pendientes; próximos 5; y la línea de tiempo '
    'con los recordatorios ya avisados de los últimos 7 días.')
open('CONTEXTO_JARVIS.md', 'w', encoding='utf-8').write('\n'.join(L))
print('Contexto actualizado')
