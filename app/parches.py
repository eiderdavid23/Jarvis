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
