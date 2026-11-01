"""Manos de Jarvis: copia el servicio de accesibilidad y el plugin al proyecto Android.
Lo llama parches.py al final (cwd = app/, ya existe android/)."""
import os
import shutil

PAQ = 'android/app/src/main/java/com/david/jarvis'
RES = 'android/app/src/main/res'
assert os.path.isdir(PAQ), 'manos: no existe ' + PAQ + ' (cambio el appId o la plantilla de Capacitor)'

for f in ('ManosServicio.java', 'ManosPlugin.java', 'BurbujaManos.java', 'BurbujaUI.java', 'EscuchaServicio.java', 'BurbujaVoz.java',
            'TvRemoto.java', 'TvOrdenes.java', 'TvAgente.java'):
    shutil.copy('nativo/' + f, PAQ + '/' + f)
os.makedirs(RES + '/xml', exist_ok=True)
shutil.copy('nativo/manos_accesibilidad.xml', RES + '/xml/manos_accesibilidad.xml')
os.makedirs(RES + '/values', exist_ok=True)
shutil.copy('nativo/manos_strings.xml', RES + '/values/manos_strings.xml')

# MainActivity: registrar el plugin antes de iniciar el puente de Capacitor
assert os.path.exists(PAQ + '/MainActivity.java'), 'manos: MainActivity no es Java: ' + str(os.listdir(PAQ))
open(PAQ + '/MainActivity.java', 'w', encoding='utf-8').write(
    'package com.david.jarvis;\n\n'
    'import android.os.Bundle;\n'
    'import com.getcapacitor.BridgeActivity;\n\n'
    'public class MainActivity extends BridgeActivity {\n'
    '    @Override\n'
    '    public void onCreate(Bundle savedInstanceState) {\n'
    '        registerPlugin(ManosPlugin.class);\n'
    '        super.onCreate(savedInstanceState);\n'
    '    }\n'
    '}\n')

# Manifiesto: declarar el servicio de accesibilidad
m = 'android/app/src/main/AndroidManifest.xml'
t = open(m, encoding='utf-8').read()
SERVICIO = """
        <service
            android:name=".ManosServicio"
            android:exported="false"
            android:label="Jarvis"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/manos_accesibilidad" />
        </service>
        <service
            android:name=".EscuchaServicio"
            android:exported="false"
            android:foregroundServiceType="microphone" />
    """
assert t.count('</application>') == 1, 'manos: manifiesto inesperado'
assert 'ManosServicio' not in t, 'manos: el servicio ya estaba declarado'
t = t.replace('</application>', SERVICIO + '</application>')

# Android 11+: sin <queries> el servicio no puede ver ni abrir otras apps (abrir_app, WhatsApp)
QUERIES = """    <queries>
        <package android:name="com.whatsapp" />
        <package android:name="com.whatsapp.w4b" />
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
    </queries>

"""
assert t.count('<application') == 1 and '<queries>' not in t, 'manos: manifiesto inesperado (queries)'
t = t.replace('<application', QUERIES + '    <application', 1)
open(m, 'w', encoding='utf-8').write(t)
print('Manos nativas listas')
