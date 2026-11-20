"""Crea la app Flask y registra los modulos. No lleva logica propia."""
from flask import Flask, send_from_directory

from servidor import config
from servidor.nucleo import supa
from servidor.modulos.chat import api as chat_api
from servidor.modulos.tareas import api as tareas_api

app = Flask(__name__, static_folder=config.CARPETA_WEB, static_url_path='')

# Cada modulo nuevo se registra aqui, en una sola linea.
for modulo in (supa, chat_api, tareas_api):
    app.register_blueprint(modulo.bp)


@app.route('/')
def inicio():
    return send_from_directory(config.CARPETA_WEB, 'index.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=config.PUERTO)
