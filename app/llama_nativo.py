"""Modelo local: copia el plugin, permite http a 127.0.0.1 y registra el plugin.
Lo llama parches.py al final (cwd = app/, ya existe android/)."""
import os
import re
import shutil

PAQ = 'android/app/src/main/java/com/david/jarvis'
RES = 'android/app/src/main/res'
JNI = 'android/app/src/main/jniLibs/arm64-v8a'
assert os.path.exists(JNI + '/libllama_server.so'), 'llama: falta libllama_server.so (fallo el paso del motor)'

shutil.copy('nativo/LlamaPlugin.java', PAQ + '/LlamaPlugin.java')
shutil.copy('nativo/DescargaServicio.java', PAQ + '/DescargaServicio.java')

os.makedirs(RES + '/xml', exist_ok=True)
open(RES + '/xml/red_local.xml', 'w', encoding='utf-8').write(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<network-security-config>\n'
    '    <domain-config cleartextTrafficPermitted="true">\n'
    '        <domain includeSubdomains="false">127.0.0.1</domain>\n'
    '    </domain-config>\n'
    '</network-security-config>\n')

m = 'android/app/src/main/AndroidManifest.xml'
t = open(m, encoding='utf-8').read()
assert 'networkSecurityConfig' not in t, 'llama: el manifiesto ya tenia networkSecurityConfig'
t, n = re.subn(r'<application', '<application android:networkSecurityConfig="@xml/red_local"', t, count=1)
assert n == 1, 'llama: no encontre <application'
# Descarga de modelos en segundo plano (servicio en primer plano, tipo dataSync)
assert 'DescargaServicio' not in t and t.count('</application>') == 1, 'llama: manifiesto inesperado (descarga)'
t = t.replace('</application>',
              '        <service\n'
              '            android:name=".DescargaServicio"\n'
              '            android:exported="false"\n'
              '            android:foregroundServiceType="dataSync" />\n'
              '    </application>')
open(m, 'w', encoding='utf-8').write(t)

a = PAQ + '/MainActivity.java'
s = open(a, encoding='utf-8').read()
viejo = 'registerPlugin(ManosPlugin.class);'
assert viejo in s and 'LlamaPlugin' not in s, 'llama: MainActivity no es la esperada'
s = s.replace(viejo, viejo + '\n        registerPlugin(LlamaPlugin.class);')
open(a, 'w', encoding='utf-8').write(s)

g = 'android/app/build.gradle'
b = open(g, encoding='utf-8').read()
assert 'useLegacyPackaging' not in b, 'llama: build.gradle ya tenia useLegacyPackaging'
b, n = re.subn(r'(\nandroid\s*\{)', r'\1\n    packaging {\n        jniLibs {\n            useLegacyPackaging = true\n        }\n    }', b, count=1)
assert n == 1, 'llama: no encontre el bloque android { en build.gradle'
open(g, 'w', encoding='utf-8').write(b)
print('Modelo local listo')
