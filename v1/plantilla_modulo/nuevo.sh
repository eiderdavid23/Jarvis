#!/bin/bash
# Uso (desde ~/jarvis):  bash plantilla_modulo/nuevo.sh gastos "Gastos"
# Crea los 3 archivos del modulo a partir de la plantilla e imprime los pasos que faltan.
set -e
ID="$1"; NOMBRE="$2"
if ! [[ "$ID" =~ ^[a-z][a-z0-9_]{1,20}$ ]] || [ -z "$NOMBRE" ] || [[ "$NOMBRE" == *"|"* ]] || [[ "$NOMBRE" == *"&"* ]]; then
  echo 'Uso: bash plantilla_modulo/nuevo.sh <id_en_minusculas> "<Nombre>"   (ej: gastos "Gastos")'; exit 1
fi
cd "$(dirname "$0")/.."
for f in "${ID}_api.py" "public/${ID}.html" "supabase_${ID}.sql"; do
  [ -e "$f" ] && { echo "Ya existe $f; no se sobrescribe."; exit 1; }
done
MAY="${ID^^}"
conv() { sed -e "s|EJEMPLO|${MAY}|g" -e "s|Ejemplo|${NOMBRE}|g" -e "s|ejemplo|${ID}|g" "$1" > "$2"; }
conv plantilla_modulo/modulo_api.py "${ID}_api.py"
conv plantilla_modulo/modulo.html "public/${ID}.html"
conv plantilla_modulo/modulo.sql "supabase_${ID}.sql"
python3 -m py_compile "${ID}_api.py" && rm -rf __pycache__/"${ID}_api".*.pyc
echo "Creados: ${ID}_api.py  public/${ID}.html  supabase_${ID}.sql"
echo
echo "Faltan estos pasos:"
echo " 1. Ejecutar supabase_${ID}.sql completo en Supabase > SQL Editor."
echo " 2. server.py: junto a 'import nexus_api' agregar 'import ${ID}_api' y junto a"
echo "    'app.register_blueprint(nexus_api.bp)' agregar 'app.register_blueprint(${ID}_api.bp)'."
echo " 3. public/modulos.js: sumar a MODULOS una linea (usar SIEMPRE .html, por Vercel):"
echo "    { id: '${ID}', nombre: '${NOMBRE}', url: '/${ID}.html?modulo=1', icono: ['M12 5v14', 'M5 12h14'] },"
echo " 4. (Opcional) herramientas de Jarvis: ver la seccion Modulos de CONTEXTO_JARVIS.md."
echo " 5. Reiniciar 'python server.py', probar, y despues: git add -A && git commit && git push"
