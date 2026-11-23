#!/usr/bin/env python3
"""JarvisPC: la app de Jarvis para Windows, Mac y Linux.

Una ventana que:
  - vincula este PC con tu Jarvis (pegas el texto que te da Jarvis, una sola vez),
  - abre Jarvis completo en su propia ventana (chat, voz, todo lo de la web),
  - deja corriendo el agente que atiende las ordenes de Jarvis en este PC
    (abrir programas, ver la pantalla, volumen, bloquear, archivos, escribir, clic...),
  - puede iniciarse sola con el PC.

El motor es agente_pc.py. Ese archivo sigue funcionando en terminal (--terminal).
Compilar: pyinstaller --onefile --windowed --name JarvisPC jarvis_pc_app.py
"""
import os
import platform
import queue
import shutil
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

import agente_pc as A

try:
    import tkinter as tk
    from tkinter import filedialog
except Exception:  # sin tkinter no hay ventana: se cae a la terminal
    tk = None

SISTEMA = platform.system()
FONDO, PANEL, LINEA = '#05070d', '#0b1220', '#12324a'
CIAN, TEXTO, SUAVE = '#00e5ff', '#e6f7ff', '#8fb3c4'
VERDE, ROJO, AMBAR = '#2ee6a6', '#ff5470', '#ffb84d'
ESTADOS = {
    'sin_vincular': ('Sin vincular', AMBAR),
    'conectando': ('Conectando con Jarvis...', AMBAR),
    'conectado': ('Conectado con Jarvis', VERDE),
    'sin_conexion': ('Sin conexion con Jarvis, reintentando...', AMBAR),
    'token': ('El vinculo ya no es valido: vincula de nuevo', ROJO),
}


# ---- Abrir Jarvis en su propia ventana -----------------------------------------

def _navegadores():
    """Rutas de navegadores basados en Chromium (permiten abrir una ventana tipo app)."""
    if SISTEMA == 'Windows':
        bases = [os.environ.get(v) for v in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA')]
        sub = [r'Microsoft\Edge\Application\msedge.exe', r'Google\Chrome\Application\chrome.exe',
               r'BraveSoftware\Brave-Browser\Application\brave.exe']
        return [str(Path(b) / s) for s in sub for b in bases if b and (Path(b) / s).exists()]
    if SISTEMA == 'Darwin':
        apps = ['Google Chrome', 'Microsoft Edge', 'Brave Browser', 'Chromium']
        return [a for a in apps if Path('/Applications/%s.app' % a).exists()]
    nombres = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser']
    return [x for x in (shutil.which(n) for n in nombres) if x]


def abrir_jarvis():
    """Abre Jarvis como una app (sin barra de direcciones). Si no hay Chrome/Edge, usa el navegador normal."""
    url = A.CFG.get('url')
    if not url:
        return False
    for nav in _navegadores():
        try:
            if SISTEMA == 'Darwin':
                subprocess.Popen(['open', '-na', nav, '--args', '--app=' + url])
            else:
                subprocess.Popen([nav, '--app=' + url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception:
            continue
    try:
        webbrowser.open(url)
        return True
    except Exception:
        return False


# ---- Iniciar con el PC ---------------------------------------------------------

def _comando_inicio():
    if getattr(sys, 'frozen', False):
        return [sys.executable, '--minimizado']
    return [sys.executable, str(Path(__file__).resolve()), '--minimizado']


def _archivo_inicio():
    if SISTEMA == 'Darwin':
        return Path.home() / 'Library' / 'LaunchAgents' / 'com.jarvis.pc.plist'
    return Path.home() / '.config' / 'autostart' / 'jarvis-pc.desktop'


def inicio_activo():
    try:
        if SISTEMA == 'Windows':
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Run') as k:
                winreg.QueryValueEx(k, 'JarvisPC')
            return True
        return _archivo_inicio().exists()
    except Exception:
        return False


def poner_inicio(activar):
    cmd = _comando_inicio()
    if SISTEMA == 'Windows':
        import winreg
        ruta = r'Software\Microsoft\Windows\CurrentVersion\Run'
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, ruta, 0, winreg.KEY_SET_VALUE) as k:
            if activar:
                winreg.SetValueEx(k, 'JarvisPC', 0, winreg.REG_SZ, subprocess.list2cmdline(cmd))
            else:
                try:
                    winreg.DeleteValue(k, 'JarvisPC')
                except FileNotFoundError:
                    pass
        return
    f = _archivo_inicio()
    if not activar:
        if f.exists():
            f.unlink()
        return
    f.parent.mkdir(parents=True, exist_ok=True)
    if SISTEMA == 'Darwin':
        args = ''.join('<string>%s</string>' % c for c in cmd)
        f.write_text('<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>'
                     '<key>Label</key><string>com.jarvis.pc</string>'
                     '<key>ProgramArguments</key><array>%s</array>'
                     '<key>RunAtLoad</key><true/></dict></plist>' % args, encoding='utf-8')
    else:
        f.write_text('[Desktop Entry]\nType=Application\nName=JarvisPC\nExec=%s\nX-GNOME-Autostart-enabled=true\n'
                     % subprocess.list2cmdline(cmd), encoding='utf-8')


# ---- Ventana -------------------------------------------------------------------

class Ventana:
    def __init__(self, args):
        self.args = args
        self.raiz = tk.Tk()
        self.raiz.title('JarvisPC')
        self.raiz.configure(bg=FONDO)
        self.raiz.geometry('460x640')
        self.raiz.minsize(420, 560)
        self.logs = queue.Queue()
        self.pendientes = queue.Queue()  # trabajos que el agente pide hacer en el hilo de la ventana
        self.estado_clave = 'sin_vincular'
        self.detener = None
        self.hilo = None

        A.GANCHOS['log'] = self.logs.put
        A.GANCHOS['estado'] = self._estado_desde_hilo
        A.GANCHOS['confirmar'] = lambda texto, seg: self._en_ventana(lambda: self._preguntar(texto, seg), seg + 5)
        A.GANCHOS['portapapeles'] = lambda t: self._en_ventana(lambda: self._copiar(t), 5)

        self._armar()
        self.raiz.protocol('WM_DELETE_WINDOW', self._cerrar)
        self.raiz.after(150, self._bombear)
        if A.CFG.get('url') and A.CFG.get('token'):
            self._arrancar()
            if args.minimizado:
                self.raiz.iconify()
        else:
            self._poner_estado('sin_vincular')
        self._refrescar()

    # -- construccion
    def _boton(self, padre, texto, comando, principal=False):
        return tk.Button(padre, text=texto, command=comando, relief='flat', cursor='hand2', bd=0,
                         bg=CIAN if principal else PANEL, fg=FONDO if principal else CIAN,
                         activebackground=TEXTO if principal else LINEA, activeforeground=FONDO if principal else CIAN,
                         font=('Segoe UI', 11, 'bold' if principal else 'normal'), padx=12, pady=9,
                         highlightthickness=0 if principal else 1, highlightbackground=LINEA)

    def _armar(self):
        r = self.raiz
        tk.Label(r, text='J A R V I S   P C', bg=FONDO, fg=CIAN, font=('Segoe UI', 17, 'bold')).pack(pady=(18, 2))
        tk.Label(r, text='Jarvis completo en tu computador', bg=FONDO, fg=SUAVE, font=('Segoe UI', 10)).pack()

        fila = tk.Frame(r, bg=FONDO)
        fila.pack(pady=(14, 6))
        self.punto = tk.Label(fila, text='●', bg=FONDO, fg=AMBAR, font=('Segoe UI', 13))
        self.punto.pack(side='left')
        self.lbl_estado = tk.Label(fila, text='', bg=FONDO, fg=TEXTO, font=('Segoe UI', 11, 'bold'))
        self.lbl_estado.pack(side='left', padx=(6, 0))

        # Vincular
        self.caja_vinculo = tk.Frame(r, bg=PANEL, highlightthickness=1, highlightbackground=LINEA)
        self.caja_vinculo.pack(fill='x', padx=18, pady=8)
        self.txt_ayuda = tk.Label(self.caja_vinculo, bg=PANEL, fg=SUAVE, justify='left', wraplength=400,
                                  font=('Segoe UI', 9))
        self.txt_ayuda.pack(anchor='w', padx=12, pady=(10, 4))
        self.entrada = tk.Entry(self.caja_vinculo, bg=FONDO, fg=TEXTO, insertbackground=CIAN, relief='flat',
                                font=('Consolas', 10), highlightthickness=1, highlightbackground=LINEA,
                                highlightcolor=CIAN)
        self.entrada.pack(fill='x', padx=12, ipady=6)
        self.entrada.bind('<Return>', lambda _e: self._vincular())
        self.fila_vinculo = tk.Frame(self.caja_vinculo, bg=PANEL)
        self.fila_vinculo.pack(fill='x', padx=12, pady=10)
        self.btn_vincular = self._boton(self.fila_vinculo, 'Vincular', self._vincular, True)
        self.btn_vincular.pack(side='left')
        self.btn_pegar = self._boton(self.fila_vinculo, 'Pegar', self._pegar)
        self.btn_pegar.pack(side='left', padx=8)
        self.btn_desvincular = self._boton(self.fila_vinculo, 'Desvincular este PC', self._desvincular)
        self.lbl_error = tk.Label(self.caja_vinculo, text='', bg=PANEL, fg=ROJO, wraplength=400, justify='left',
                                  font=('Segoe UI', 9))

        self.btn_abrir = self._boton(r, 'Abrir Jarvis', self._abrir, True)
        self.btn_abrir.pack(fill='x', padx=18, pady=(8, 4))

        # Opciones
        op = tk.Frame(r, bg=FONDO)
        op.pack(fill='x', padx=18, pady=(8, 0))
        self.var_control = tk.BooleanVar(value=bool(A.CFG.get('control')))
        self.var_inicio = tk.BooleanVar(value=inicio_activo())
        for var, texto, cmd in (
            (self.var_control, 'Control automatico: Jarvis puede escribir, hacer clic y ver la pantalla sin preguntar',
             self._cambiar_control),
            (self.var_inicio, 'Iniciar JarvisPC cuando prenda el PC', self._cambiar_inicio),
        ):
            tk.Checkbutton(op, text=texto, variable=var, command=cmd, bg=FONDO, fg=TEXTO, selectcolor=PANEL,
                           activebackground=FONDO, activeforeground=CIAN, anchor='w', justify='left',
                           wraplength=400, font=('Segoe UI', 9), highlightthickness=0).pack(fill='x', pady=2)
        tk.Label(op, text='Apagar, reiniciar y mover archivos siempre piden permiso.', bg=FONDO, fg=SUAVE,
                 font=('Segoe UI', 8)).pack(anchor='w', padx=4)

        carp = tk.Frame(r, bg=FONDO)
        carp.pack(fill='x', padx=18, pady=(10, 0))
        tk.Label(carp, text='Carpeta de archivos de Jarvis:', bg=FONDO, fg=SUAVE, font=('Segoe UI', 9)).pack(anchor='w')
        f2 = tk.Frame(carp, bg=FONDO)
        f2.pack(fill='x')
        self.lbl_carpeta = tk.Label(f2, text='', bg=FONDO, fg=TEXTO, font=('Consolas', 9), anchor='w')
        self.lbl_carpeta.pack(side='left', fill='x', expand=True)
        self._boton(f2, 'Cambiar', self._cambiar_carpeta).pack(side='right')

        tk.Label(r, text='Actividad', bg=FONDO, fg=SUAVE, font=('Segoe UI', 9)).pack(anchor='w', padx=18, pady=(12, 2))
        self.registro = tk.Text(r, height=8, bg=PANEL, fg=SUAVE, relief='flat', font=('Consolas', 9), wrap='word',
                                state='disabled', highlightthickness=1, highlightbackground=LINEA)
        self.registro.pack(fill='both', expand=True, padx=18)

        pie = tk.Frame(r, bg=FONDO)
        pie.pack(fill='x', padx=18, pady=12)
        self._boton(pie, 'Minimizar', self.raiz.iconify).pack(side='left')
        self._boton(pie, 'Salir', self._salir).pack(side='right')

    # -- estado
    def _estado_desde_hilo(self, clave):
        self.logs.put(('estado', clave))

    def _poner_estado(self, clave):
        self.estado_clave = clave
        texto, color = ESTADOS.get(clave, ESTADOS['conectando'])
        self.lbl_estado.config(text=texto)
        self.punto.config(fg=color)

    def _refrescar(self):
        vinculado = bool(A.CFG.get('url') and A.CFG.get('token'))
        self.lbl_carpeta.config(text=str(A.base()))
        if vinculado:
            self.txt_ayuda.config(text='Vinculado con: ' + A.CFG['url'])
            self.entrada.pack_forget()
            self.btn_vincular.pack_forget()
            self.btn_pegar.pack_forget()
            self.btn_desvincular.pack(side='left')
            self.btn_abrir.config(state='normal')
        else:
            self.txt_ayuda.config(text='1) En Jarvis (web o app): Ajustes > Manos de Jarvis > Controlar un PC > '
                                       'Vincular un PC.\n2) Copia el texto que te muestra y pegalo aqui.')
            self.btn_desvincular.pack_forget()
            self.entrada.pack(fill='x', padx=12, ipady=6, before=self.fila_vinculo)
            self.btn_vincular.pack(side='left')
            self.btn_pegar.pack(side='left', padx=8)
            self.btn_abrir.config(state='disabled')

    # -- hilo del agente
    def _arrancar(self):
        if self.hilo and self.hilo.is_alive() and self.detener and not self.detener.is_set():
            return
        self.detener = threading.Event()
        self.hilo = threading.Thread(target=A.bucle, args=(self.detener,), daemon=True)
        self.hilo.start()
        A.aviso('Agente de Jarvis listo. Carpeta de archivos: %s | Control automatico: %s' % (
            A.base(), 'si' if A.CFG.get('control') else 'no (pide permiso)'))

    def _parar(self):
        if self.detener:
            self.detener.set()

    # -- el agente pide cosas a la ventana (tkinter solo se toca desde su hilo)
    def _en_ventana(self, fn, espera):
        hecho = threading.Event()
        caja = {}
        self.pendientes.put((fn, hecho, caja))
        hecho.wait(espera)
        return caja.get('r')

    def _bombear(self):
        try:
            while True:
                dato = self.logs.get_nowait()
                if isinstance(dato, tuple) and dato and dato[0] == 'estado':
                    self._poner_estado(dato[1])
                else:
                    self.registro.config(state='normal')
                    self.registro.insert('end', str(dato) + '\n')
                    if int(self.registro.index('end-1c').split('.')[0]) > 300:
                        self.registro.delete('1.0', '50.0')
                    self.registro.see('end')
                    self.registro.config(state='disabled')
        except queue.Empty:
            pass
        try:
            fn, hecho, caja = self.pendientes.get_nowait()
            try:
                caja['r'] = fn()
            except Exception:
                caja['r'] = None
            hecho.set()
        except queue.Empty:
            pass
        self.raiz.after(150, self._bombear)

    def _copiar(self, texto):
        self.raiz.clipboard_clear()
        self.raiz.clipboard_append(texto)
        self.raiz.update()
        return True

    def _preguntar(self, texto, segundos):
        """Cuadro Si/No siempre al frente. Sin respuesta a tiempo = No."""
        d = tk.Toplevel(self.raiz)
        d.title('Jarvis')
        d.configure(bg=FONDO)
        d.attributes('-topmost', True)
        d.resizable(False, False)
        resultado = {'r': False}
        tk.Label(d, text='Jarvis quiere ' + texto + '.\n\n¿Permitir?', bg=FONDO, fg=TEXTO, wraplength=360,
                 justify='left', font=('Segoe UI', 11)).pack(padx=22, pady=(20, 8))
        restante = tk.Label(d, text='', bg=FONDO, fg=SUAVE, font=('Segoe UI', 9))
        restante.pack()

        def cerrar(valor):
            resultado['r'] = valor
            try:
                d.destroy()
            except Exception:
                pass

        fila = tk.Frame(d, bg=FONDO)
        fila.pack(pady=14)
        self._boton(fila, 'Si, permitir', lambda: cerrar(True), True).pack(side='left', padx=6)
        self._boton(fila, 'No', lambda: cerrar(False)).pack(side='left', padx=6)
        d.protocol('WM_DELETE_WINDOW', lambda: cerrar(False))

        def cuenta(n):
            if not d.winfo_exists():
                return
            if n <= 0:
                cerrar(False)
                return
            restante.config(text='Se cancela solo en %d s' % n)
            d.after(1000, lambda: cuenta(n - 1))

        d.update_idletasks()
        w, h = d.winfo_reqwidth(), d.winfo_reqheight()
        d.geometry('+%d+%d' % ((d.winfo_screenwidth() - w) // 2, (d.winfo_screenheight() - h) // 3))
        d.deiconify()
        d.lift()
        d.focus_force()
        cuenta(int(segundos))
        self.raiz.wait_window(d)
        return resultado['r']

    # -- acciones de los botones
    def _pegar(self):
        try:
            self.entrada.delete(0, 'end')
            self.entrada.insert(0, self.raiz.clipboard_get())
        except Exception:
            pass

    def _vincular(self):
        url, tok = A.leer_vinculo(self.entrada.get())
        if not url:
            self.lbl_error.config(text='No encontre el texto de Jarvis. Debe tener "--url ... --token ...". '
                                       'Vuelve a copiarlo completo desde Jarvis.')
            self.lbl_error.pack(anchor='w', padx=12, pady=(0, 8))
            return
        self.lbl_error.pack_forget()
        A.CFG['url'], A.CFG['token'] = url, tok
        A.guardar_config()
        self.entrada.delete(0, 'end')
        self._refrescar()
        self._arrancar()

    def _desvincular(self):
        if not self._preguntar_simple('Desvincular este PC de Jarvis?'):
            return
        self._parar()
        A.CFG['token'] = ''
        A.guardar_config()
        self._poner_estado('sin_vincular')
        self._refrescar()

    def _preguntar_simple(self, texto):
        from tkinter import messagebox
        return messagebox.askyesno('JarvisPC', texto, parent=self.raiz)

    def _abrir(self):
        if not abrir_jarvis():
            A.aviso('No pude abrir Jarvis. Abre esta direccion en tu navegador: ' + str(A.CFG.get('url')))

    def _cambiar_control(self):
        A.CFG['control'] = bool(self.var_control.get())
        A.guardar_config()
        A.aviso('Control automatico: ' + ('si' if A.CFG['control'] else 'no (pide permiso)'))

    def _cambiar_inicio(self):
        try:
            poner_inicio(bool(self.var_inicio.get()))
        except Exception as e:
            self.var_inicio.set(inicio_activo())
            A.aviso('No pude cambiar el inicio con el PC: ' + str(e)[:80])

    def _cambiar_carpeta(self):
        c = filedialog.askdirectory(parent=self.raiz, initialdir=str(A.base()), title='Carpeta de Jarvis')
        if c:
            A.CFG['carpeta'] = c
            A.guardar_config()
            self._refrescar()

    def _cerrar(self):
        """La X solo minimiza: si se cierra, Jarvis deja de controlar este PC."""
        self.raiz.iconify()

    def _salir(self):
        if self._preguntar_simple('Si sales, Jarvis dejara de poder controlar este PC.\n\nSalir de todos modos?'):
            self._parar()
            self.raiz.destroy()

    def correr(self):
        self.raiz.mainloop()


def main(args=None):
    args = args or A.leer_args()
    A.cargar_config(args)
    if tk is None or not A.hay_pantalla():
        A.principal(args)
        return
    if SISTEMA == 'Windows':
        try:  # pantallas de alta resolucion: ventana nitida y coordenadas reales
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass
    Ventana(args).correr()


if __name__ == '__main__':
    main()
