"""Base SQLite : comptes, sessions de connexion et registre des crédits.

Le solde n'est jamais stocké tel quel : c'est la somme des mouvements du registre (achats, mix, remboursements).
Chaque mouvement porte une référence unique (`ref`), ce qui rend les crédits idempotents :
un même paiement Stripe ou un même mix ne peut pas être compté deux fois.
"""
from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path

from .. import config

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None
_path: Path | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  pw_hash TEXT NOT NULL,
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT UNIQUE,
  amount_cents INTEGER,
  created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id);
"""


def conn() -> sqlite3.Connection:
    """Connexion partagée (recréée si le dossier de données change, utile pour les tests)."""
    global _conn, _path
    path = Path(config.DATA_DIR) / "promptmix.db"
    with _lock:
        if _conn is None or _path != path:
            path.parent.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn.executescript(SCHEMA)
            _path = path
        return _conn


def balance(user_id: int) -> int:
    with _lock:
        row = conn().execute("SELECT COALESCE(SUM(delta), 0) AS b FROM ledger WHERE user_id = ?", (user_id,)).fetchone()
        return int(row["b"])


def add_entry(user_id: int, delta: int, reason: str, ref: str | None, amount_cents: int | None = None) -> bool:
    """Ajoute un mouvement. Retourne False si la référence existe déjà (déjà compté)."""
    with _lock:
        try:
            conn().execute("INSERT INTO ledger (user_id, delta, reason, ref, amount_cents, created_at) VALUES (?,?,?,?,?,?)",
                           (user_id, delta, reason, ref, amount_cents, time.time()))
            return True
        except sqlite3.IntegrityError:
            return False


class InsufficientCredits(Exception):
    pass


def debit(user_id: int, credits: int, reason: str, ref: str) -> None:
    """Retire des crédits de façon atomique (le solde ne peut pas devenir négatif)."""
    with _lock:
        c = conn()
        c.execute("BEGIN IMMEDIATE")
        try:
            b = c.execute("SELECT COALESCE(SUM(delta), 0) AS b FROM ledger WHERE user_id = ?", (user_id,)).fetchone()["b"]
            if b < credits:
                raise InsufficientCredits(f"Il te faut {credits} crédit(s), tu en as {b}.")
            c.execute("INSERT INTO ledger (user_id, delta, reason, ref, created_at) VALUES (?,?,?,?,?)",
                      (user_id, -credits, reason, ref, time.time()))
            c.execute("COMMIT")
        except Exception:
            c.execute("ROLLBACK")
            raise


def history(user_id: int, limit: int = 30) -> list[dict]:
    with _lock:
        rows = conn().execute("SELECT delta, reason, amount_cents, created_at FROM ledger WHERE user_id = ? "
                              "ORDER BY id DESC LIMIT ?", (user_id, limit)).fetchall()
        return [dict(r) for r in rows]
