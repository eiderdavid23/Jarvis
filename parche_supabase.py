ARCHIVO = 'server.py'
s = open(ARCHIVO, encoding='utf-8').read()
assert 'import supa' not in s, 'Este parche ya fue aplicado'


def reemplazar(viejo, nuevo):
    global s
    assert s.count(viejo) == 1, 'No encontre (o esta repetido): ' + viejo[:70]
    s = s.replace(viejo, nuevo)


# 1. imports, modulo supa y blueprint
reemplazar(
    'from flask import Flask, request, jsonify, send_from_directory, Response\n',
    'from flask import Flask, request, jsonify, send_from_directory, Response, g\n')
reemplazar(
    'from comandos_dispositivo import encender_linterna, apagar_linterna, vibrar, estado_bateria\n',
    'from comandos_dispositivo import encender_linterna, apagar_linterna, vibrar, estado_bateria\n'
    'import supa\n')
reemplazar(
    "app = Flask(__name__, static_folder='public', static_url_path='')\n",
    "app = Flask(__name__, static_folder='public', static_url_path='')\n"
    'app.register_blueprint(supa.bp)\n')

# 2. quitar la memoria en archivos (ahora vive en Supabase)
a = '# --- Memoria simple'
b = '# --- Voz (Piper)'
assert s.count(a) == 1 and s.count(b) == 1 and s.index(a) < s.index(b), 'No encontre el bloque de memoria'
s = s[:s.index(a)] + s[s.index(b):]

# 3. herramientas: recuerdos con tema + olvidar
reemplazar(
    "                'dato': {'type': 'string', 'description': 'El dato a recordar, en una frase corta y clara'}\n"
    "            },\n"
    "            'required': ['dato']\n"
    "        }\n"
    "    },\n"
    "]\n",
    "                'tema': {'type': 'string', 'description': 'Tema corto en minusculas, ej: nombre, ciudad, mascota. Si el tema ya existe, se actualiza en vez de duplicarse'},\n"
    "                'dato': {'type': 'string', 'description': 'El dato a recordar, en una frase corta y clara'}\n"
    "            },\n"
    "            'required': ['tema', 'dato']\n"
    "        }\n"
    "    },\n"
    "    {\n"
    "        'name': 'olvidar_recuerdo',\n"
    "        'description': 'Borra un dato guardado del usuario cuando el pida que lo olvides. Usa el mismo tema con el que se guardo.',\n"
    "        'parameters': {\n"
    "            'type': 'object',\n"
    "            'properties': {\n"
    "                'tema': {'type': 'string', 'description': 'El tema a olvidar'}\n"
    "            },\n"
    "            'required': ['tema']\n"
    "        }\n"
    "    },\n"
    "]\n")

reemplazar(
    "    if nombre == 'guardar_recuerdo':\n"
    "        dato = (argumentos.get('dato') or '').strip()\n"
    "        if dato:\n"
    "            agregar_recuerdo(dato)\n"
    "            return {'ok': True}\n"
    "        return {'ok': False, 'error': 'dato vacio'}\n",
    "    if nombre == 'guardar_recuerdo':\n"
    "        tema = (argumentos.get('tema') or '').strip()\n"
    "        dato = (argumentos.get('dato') or '').strip()\n"
    "        if not tema or not dato:\n"
    "            return {'ok': False, 'error': 'falta tema o dato'}\n"
    "        try:\n"
    "            supa.guardar_recuerdo(tema, dato)\n"
    "            return {'ok': True}\n"
    "        except supa.SupaError as e:\n"
    "            return {'ok': False, 'error': str(e)}\n"
    "\n"
    "    if nombre == 'olvidar_recuerdo':\n"
    "        tema = (argumentos.get('tema') or '').strip()\n"
    "        if not tema:\n"
    "            return {'ok': False, 'error': 'falta el tema'}\n"
    "        try:\n"
    "            supa.olvidar_recuerdo(tema)\n"
    "            return {'ok': True}\n"
    "        except supa.SupaError as e:\n"
    "            return {'ok': False, 'error': str(e)}\n")

# 4. /chat: login, chat_id, historial y recuerdos desde Supabase
reemplazar(
    "@app.route('/chat', methods=['POST'])\ndef chat():\n",
    "@app.route('/chat', methods=['POST'])\n@supa.requiere_login\ndef chat():\n")
reemplazar(
    "        zona_horaria = data.get('zona_horaria', '') or 'UTC'\n",
    "        zona_horaria = data.get('zona_horaria', '') or 'UTC'\n"
    "        chat_id = (data.get('chat_id') or '').strip()\n"
    "        if not chat_id:\n"
    "            chat_id = supa.crear_chat()['id']\n")
reemplazar(
    "        historial = cargar_memoria()\n",
    "        historial = supa.mensajes_de(chat_id)\n")
reemplazar(
    "        recuerdos = cargar_memoria_persistente()\n"
    "        texto_recuerdos = ''\n"
    "        if recuerdos:\n"
    "            texto_recuerdos = ' Datos importantes que ya sabes del usuario: ' + '; '.join(recuerdos) + '.'\n",
    "        recuerdos = supa.cargar_recuerdos()\n"
    "        texto_recuerdos = ''\n"
    "        if recuerdos:\n"
    "            texto_recuerdos = ' Datos importantes que ya sabes del usuario: ' + '; '.join(\n"
    "                f\"{r['clave']}: {r['valor']}\" for r in recuerdos) + '.'\n")
reemplazar(
    "        historial.append({'role': 'user', 'texto': mensaje_usuario})\n"
    "        historial.append({'role': 'assistant', 'texto': respuesta})\n"
    "        guardar_memoria(historial)\n"
    "\n"
    "        return jsonify({'respuesta': respuesta, 'urls_abrir': acciones.get('urls_abrir', [])})\n",
    "        era_nuevo = len(historial) == 0\n"
    "        supa.guardar_intercambio(chat_id, mensaje_usuario, respuesta)\n"
    "        if era_nuevo:\n"
    "            supa.renombrar_chat(chat_id, mensaje_usuario)\n"
    "\n"
    "        return jsonify({'respuesta': respuesta, 'chat_id': chat_id,\n"
    "                        'urls_abrir': acciones.get('urls_abrir', [])})\n")
reemplazar(
    "    except Exception as e:\n        print('[ERROR] Excepcion inesperada en /chat:', e)\n",
    "    except supa.SupaError as e:\n"
    "        print('[ERROR] Supabase en /chat:', e)\n"
    "        return jsonify({'respuesta': 'No puedo acceder a su historial en este momento, señor.', 'error': str(e)}), 502\n"
    "\n"
    "    except Exception as e:\n        print('[ERROR] Excepcion inesperada en /chat:', e)\n")

# 5. comprobacion final: no deben quedar restos de la memoria vieja
for resto in ['cargar_memoria(', 'guardar_memoria(', 'agregar_recuerdo(',
              'cargar_memoria_persistente(', 'MEMORIA_PATH', '_DIR_DATOS']:
    assert resto not in s, 'Quedo un resto de la memoria vieja: ' + resto

open(ARCHIVO, 'w', encoding='utf-8').write(s)
print('server.py actualizado para Supabase.')
