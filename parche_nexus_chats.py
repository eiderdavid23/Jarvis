import shutil
for r in ('public/nexus.js', 'public/nexus.css', 'CONTEXTO_JARVIS.md'):
    shutil.copy(r, r + '.bak')

def cambiar(s, viejo, nuevo, donde):
    assert s.count(viejo) == 1, donde + ': ancla no encontrada o repetida: ' + viejo[:50]
    return s.replace(viejo, nuevo)

# ---------- 1. nexus.js: chats desplegables en la linea de tiempo ----------
j = open('public/nexus.js', encoding='utf-8').read()
j = cambiar(j, "linea.push({ t: c.actualizado, txt: 'Chat · ' + (c.titulo || 'Sin título') });",
               "linea.push({ t: c.actualizado, txt: 'Chat · ' + (c.titulo || 'Sin título'), chat: c });", 'nexus.js')
j = cambiar(j, "linea.slice(0, 8).forEach(function (x) { caja.appendChild(filaT(x.t, x.txt)); });",
               "linea.slice(0, 8).forEach(function (x) { caja.appendChild(x.chat ? filaChat(x.chat) : filaT(x.t, x.txt)); });", 'nexus.js')
FUNC = r"""  /* Chat de la línea de tiempo: un mensaje tuyo y un desplegable con toda la conversación. */
  function limpiarMsg(t) { return String(t || '').replace(/\[ACCION:[^\]]*\]/g, '').trim(); }
  function filaChat(c) {
    var prev = el('span', { class: 'prev', text: 'Cargando…' }), cuerpo = el('div', { class: 'chat-cuerpo' });
    var d = el('details', { class: 'chat-t' },
      el('summary', null,
        el('span', { class: 'cuando', text: cuandoTxt(c.actualizado) }),
        el('span', { class: 'chat-res' }, el('b', { text: 'Chat · ' + (c.titulo || 'Sin título') }), prev)),
      cuerpo);
    api('/chats/' + c.id + '/mensajes').then(function (ms) {
      ms = (Array.isArray(ms) ? ms : []).filter(function (m) { return limpiarMsg(m.texto); });
      var mio = ms.filter(function (m) { return m.rol === 'user'; });
      var ult = mio.length ? mio[mio.length - 1] : ms[ms.length - 1];
      prev.textContent = ult ? (ult.rol === 'user' ? 'Tú: ' : 'Jarvis: ') + limpiarMsg(ult.texto).replace(/\s+/g, ' ') : 'Sin mensajes.';
      if (ms.length > 60) cuerpo.appendChild(el('p', { class: 'vacio', text: 'Se muestran los últimos 60 mensajes.' }));
      ms.slice(-60).forEach(function (m) {
        var yo2 = m.rol === 'user';
        cuerpo.appendChild(el('div', { class: 'msg-t' + (yo2 ? ' yo' : '') },
          el('small', { text: yo2 ? 'Tú' : 'Jarvis' }), el('p', { text: limpiarMsg(m.texto) })));
      });
    }).catch(function () { prev.textContent = 'No pude cargar este chat.'; });
    return d;
  }
"""
j = cambiar(j, "  function pintarResumen() {", FUNC + "  function pintarResumen() {", 'nexus.js')
open('public/nexus.js', 'w', encoding='utf-8').write(j)
print('nexus.js: chats desplegables')

# ---------- 2. nexus.css ----------
c = open('public/nexus.css', encoding='utf-8').read()
assert '.chat-t' not in c, 'nexus.css ya tiene el estilo de chats'
c = c.rstrip('\n') + """
.chat-t { border-bottom: 1px solid var(--linea); font-size: 14px; }
.chat-t summary { display: flex; gap: 12px; padding: 9px 0; cursor: pointer; list-style: none; }
.chat-t summary::-webkit-details-marker { display: none; }
.chat-t summary::after { content: '▾'; margin-left: auto; color: var(--suave); }
.chat-t[open] summary::after { content: '▴'; }
.chat-t .cuando { flex: 0 0 96px; color: var(--suave); font-size: 13px; }
.chat-res { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.chat-res b { font-weight: 500; }
.chat-res .prev { color: var(--suave); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-cuerpo { padding: 4px 0 12px 108px; display: flex; flex-direction: column; gap: 8px; }
.msg-t { background: var(--panel); border: 1px solid var(--linea); border-radius: 12px; padding: 8px 12px; }
.msg-t.yo { border-color: var(--cian); }
.msg-t small { color: var(--suave); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
.msg-t p { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; }
@media (max-width: 600px) { .chat-cuerpo { padding-left: 0; } }
"""
open('public/nexus.css', 'w', encoding='utf-8').write(c)
print('nexus.css: estilos de chats')

# ---------- 3. contexto ----------
L = open('CONTEXTO_JARVIS.md', encoding='utf-8').read().split('\n')
k = next(i for i, l in enumerate(L) if l.startswith('## 4.')) - 1
while k >= 0 and L[k].strip() in ('', '---'):
    k -= 1
L.insert(k + 1, '- **30 oct 2026**: NEXUS paso 6a, ajuste: en la línea de tiempo cada chat sale como `<details>` desplegable. Cerrado muestra el título y '
    'el último mensaje del usuario (una línea); abierto, la conversación (hasta 60 mensajes, texto con `textContent`, sin las marcas `[ACCION:...]`). '
    'Cada chat visible pide `GET /chats/<id>/mensajes` al abrir `/nexus` (máximo 8 en paralelo, hasta 500 mensajes cada uno).')
open('CONTEXTO_JARVIS.md', 'w', encoding='utf-8').write('\n'.join(L))
print('Contexto actualizado')
