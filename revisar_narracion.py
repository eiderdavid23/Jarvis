import server  # arma el indice
import narrador

faltan = sorted(n for n in narrador.INDICE if not narrador.tiene(n))
print(f'{len(faltan)} herramientas usan la linea automatica:')
for n in faltan:
    print('  -', n)
