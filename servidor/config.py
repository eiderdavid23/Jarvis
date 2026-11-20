"""Configuracion central. Lee el .env una sola vez; el resto importa de aqui."""
import os

from dotenv import load_dotenv

load_dotenv()

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETA_WEB = os.path.join(RAIZ, 'web')

PUERTO = int(os.environ.get('PORT', '3000'))

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

# Solo dos proveedores de IA: Gemini y Groq.
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODELO = os.environ.get('GEMINI_MODEL', 'gemini-3.5-flash')
GEMINI_RESPALDO = os.environ.get('GEMINI_MODEL_RESPALDO', 'gemini-3.5-flash-lite')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_MODELO = os.environ.get('GROQ_MODEL', 'openai/gpt-oss-120b')

TIEMPO_IA = 60  # segundos de espera por respuesta de la IA
