p = 'android/app/src/main/AndroidManifest.xml'
s = open(p, encoding='utf-8').read()
permisos = [
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.USE_EXACT_ALARM',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
]
extra = ''
for x in permisos:
    if x not in s:
        extra += '    <uses-permission android:name="%s" />\n' % x
assert '</manifest>' in s
s = s.replace('</manifest>', extra + '</manifest>')
open(p, 'w', encoding='utf-8').write(s)
print('Manifiesto parchado')

import os, re
n = os.environ.get('RUN_NUMBER', '1')
g = 'android/app/build.gradle'
b = open(g, encoding='utf-8').read()
b, c1 = re.subn(r'versionCode\s*=?\s*\d+', 'versionCode ' + os.environ.get('VERSION_CODE', n), b)
b, c2 = re.subn(r'versionName\s*=?\s*"[^"]*"', 'versionName "1.' + n + '"', b)
assert c1 == 1 and c2 == 1, 'build.gradle: no encontre versionCode o versionName'
open(g, 'w', encoding='utf-8').write(b)
print('Version', n)

b = open(g, encoding='utf-8').read()
b, c3 = re.subn(r'applicationId\s*=?\s*"[^"]*"', 'applicationId "com.david.jarvis2"', b)
assert c3 == 1, 'build.gradle: no encontre applicationId'
open(g, 'w', encoding='utf-8').write(b)
print('ID de la app: com.david.jarvis2')

m = 'android/app/src/main/AndroidManifest.xml'
t = open(m, encoding='utf-8').read()
FILTRO = """            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.david.jarvis" />
            </intent-filter>
        """
assert t.count('</activity>') == 1 and 'singleTask' in t, 'manifiesto: actividad no esperada'
t = t.replace('</activity>', FILTRO + '</activity>')
open(m, 'w', encoding='utf-8').write(t)
print('Enlace profundo listo')

import re
sp = 'android/app/src/main/res/values/styles.xml'
st = open(sp, encoding='utf-8').read()
mm = re.search(r'<style name="AppTheme[.]NoActionBar"[^>]*>', st)
assert mm, 'styles.xml: no encontre AppTheme.NoActionBar'
extra = '\n        <item name="android:statusBarColor">#050505</item>\n        <item name="android:windowLightStatusBar">false</item>'
st = st[:mm.end()] + extra + st[mm.end():]
open(sp, 'w', encoding='utf-8').write(st)
print('Barra de estado oscura')

exec(open('manos_nativo.py', encoding='utf-8').read())
