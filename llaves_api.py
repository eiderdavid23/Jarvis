"""Llaves de IA por cuenta: se guardan cifradas (Fernet) en Supabase, con RLS por usuario.
Necesita la variable LLAVES_SECRET (una clave Fernet) y la tabla llaves_ia (supabase_llaves.sql)."""
import os

from flask import Blueprint, jsonify, request, g

import supa

bp = Blueprint('llaves', __name__)
PROVEEDORES = ('gemini', 'groq')


def _fernet():
    s = os.environ.get('LLAVES_SECRET', '').strip()
    if not s:
        return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(s.encode())
    except Exception:
        print('[LLAVES] LLAVES_SECRET no es una clave valida')
        return None


def _descifrar(f, texto):
    try:
        return f.decrypt(texto.encode()).decode()
    except Exception:
        return ''


def llaves_del_usuario():
    """{'gemini': 'llave', 'groq': 'llave'} de la cuenta actual. Lanza SupaError si falla la base."""
    f = _fernet()
    if not f:
        return None
    filas = supa._rest('GET', 'llaves_ia', {'select': 'proveedor,llave_cifrada'}) or []
    out = {}
    for fila in filas:
        k = _descifrar(f, fila.get('llave_cifrada') or '')
        if k and fila.get('proveedor') in PROVEEDORES:
            out[fila['proveedor']] = k
    return out


def llave_de(proveedor):
    """Llave guardada en la cuenta (para cuando el navegador no la manda). '' si no hay o algo falla."""
    try:
        return (llaves_del_usuario() or {}).get(proveedor, '')
    except Exception as e:
        print('[LLAVES] No pude leer la llave de la cuenta:', e)
        return ''


@bp.errorhandler(supa.SupaError)
def _error_supa(e):
    return jsonify({'error': 'No pude usar las llaves de la cuenta. Revise que supabase_llaves.sql este ejecutado.', 'codigo': 'sin_tabla'}), 502


def _sin_secreto():
    return jsonify({'error': 'Falta LLAVES_SECRET en el servidor', 'codigo': 'sin_secreto'}), 503


@bp.route('/llaves', methods=['GET'])
@supa.requiere_login
def api_llaves():
    llaves = llaves_del_usuario()
    if llaves is None:
        return _sin_secreto()
    return jsonify({'usuario': g.usuario_id, 'llaves': llaves})


@bp.route('/llaves', methods=['POST'])
@supa.requiere_login
def api_guardar_llave():
    f = _fernet()
    if not f:
        return _sin_secreto()
    d = request.get_json(silent=True) or {}
    prov = (d.get('proveedor') or '').strip().lower()
    llave = (d.get('llave') or '').strip()
    if prov not in PROVEEDORES or len(llave) < 20 or len(llave) > 200 or any(c.isspace() for c in llave):
        return jsonify({'error': 'Llave no valida'}), 400
    supa._rest('POST', 'llaves_ia', {'on_conflict': 'user_id,proveedor'}, {
        'user_id': g.usuario_id, 'proveedor': prov,
        'llave_cifrada': f.encrypt(llave.encode()).decode(),
        'actualizado': supa._ahora().isoformat()
    }, {'Prefer': 'resolution=merge-duplicates'})
    return jsonify({'ok': True})


@bp.route('/llaves/<proveedor>', methods=['DELETE'])
@supa.requiere_login
def api_borrar_llave(proveedor):
    if proveedor not in PROVEEDORES:
        return jsonify({'error': 'Proveedor no valido'}), 400
    supa._rest('DELETE', 'llaves_ia', {'proveedor': 'eq.' + proveedor})
    return jsonify({'ok': True})
