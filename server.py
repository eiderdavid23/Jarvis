# Punto de entrada para Vercel y gunicorn: solo reexporta la app.
from servidor.app import app  # noqa: F401
