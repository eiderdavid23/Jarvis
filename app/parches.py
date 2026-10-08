p = 'android/app/src/main/AndroidManifest.xml'
s = open(p, encoding='utf-8').read()
permisos = [
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.USE_EXACT_ALARM',
    'android.permission.POST_NOTIFICATIONS',
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
b, c1 = re.subn(r'versionCode\s*=?\s*\d+', 'versionCode ' + n, b)
b, c2 = re.subn(r'versionName\s*=?\s*"[^"]*"', 'versionName "1.' + n + '"', b)
assert c1 == 1 and c2 == 1, 'build.gradle: no encontre versionCode o versionName'
open(g, 'w', encoding='utf-8').write(b)
print('Version', n)

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
