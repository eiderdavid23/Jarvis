p = 'app/parches.py'
s = open(p, encoding='utf-8').read()
viejo = "    'android.permission.POST_NOTIFICATIONS',\n]"
nuevo = ("    'android.permission.POST_NOTIFICATIONS',\n"
         "    'android.permission.RECORD_AUDIO',\n"
         "    'android.permission.MODIFY_AUDIO_SETTINGS',\n]")
assert s.count(viejo) == 1, 'No encontre la lista de permisos en app/parches.py'
open(p, 'w', encoding='utf-8').write(s.replace(viejo, nuevo))
print('Listo: la APK ahora declara el micrófono.')
