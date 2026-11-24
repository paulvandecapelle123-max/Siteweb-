"""Comptes : e-mail + mot de passe (scrypt salé), session par cookie httpOnly."""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import sqlite3
import time

from .. import config
from . import db

COOKIE = "pm_session"
SESSION_DAYS = 30
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthError(ValueError):
    pass


def hash_password(pw: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${h.hex()}"


def check_password(pw: str, stored: str) -> bool:
    try:
        _, salt_hex, h_hex = stored.split("$")
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(pw, bytes.fromhex(salt_hex)), stored)


def register(email: str, password: str) -> int:
    email = email.strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 254:
        raise AuthError("Adresse e-mail invalide.")
    if len(password) < 8:
        raise AuthError("Le mot de passe doit faire au moins 8 caractères.")
    try:
        with db._lock:
            cur = db.conn().execute("INSERT INTO users (email, pw_hash, created_at) VALUES (?,?,?)",
                                    (email, hash_password(password), time.time()))
            uid = int(cur.lastrowid)
    except sqlite3.IntegrityError:
        raise AuthError("Un compte existe déjà avec cette adresse. Connecte-toi.")
    if config.WELCOME_CREDITS > 0:
        db.add_entry(uid, config.WELCOME_CREDITS, "Bienvenue : premier mix offert", f"welcome:{uid}")
    return uid


def login(email: str, password: str) -> int:
    with db._lock:
        row = db.conn().execute("SELECT id, pw_hash FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
    if row is None or not check_password(password, row["pw_hash"]):
        raise AuthError("E-mail ou mot de passe incorrect.")
    return int(row["id"])


def new_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with db._lock:
        db.conn().execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
                          (token, user_id, time.time() + SESSION_DAYS * 86400))
    return token


def end_session(token: str) -> None:
    with db._lock:
        db.conn().execute("DELETE FROM sessions WHERE token = ?", (token,))


def user_for_token(token: str | None) -> dict | None:
    if not token:
        return None
    with db._lock:
        row = db.conn().execute("SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id "
                                "WHERE s.token = ? AND s.expires_at > ?", (token, time.time())).fetchone()
    return {"id": int(row["id"]), "email": row["email"]} if row else None
