"""PostgreSQL access layer.

Uses pg8000, a pure-Python driver. That matters here: gunicorn runs this app
with a single gevent worker, and gevent can only yield around sockets it has
monkey-patched. A C driver (psycopg/libpq) would block the whole worker for the
duration of every query; pg8000 lets the other greenlets keep running.
"""

import threading

import pg8000.dbapi
from pg8000.exceptions import DatabaseError, InterfaceError

from config import (
    DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT, DB_POOL_SIZE,
    build_ssl_context,
)

# SQLSTATE classes that mean "this connection is gone", not "this query was
# bad": 08xxx connection exceptions, plus the codes a server sends while it is
# shutting a session down. Anything else is a real SQL error and must not be
# retried — re-running a failed INSERT could double-write.
_CONNECTION_SQLSTATES = ("57P01", "57P02", "57P03")


def _is_connection_error(exc):
    if isinstance(exc, (InterfaceError, OSError)):
        return True
    if isinstance(exc, DatabaseError):
        detail = exc.args[0] if exc.args else None
        code = detail.get("C") if isinstance(detail, dict) else None
        if code:
            return code.startswith("08") or code in _CONNECTION_SQLSTATES
    return False


def connect():
    """Open a brand-new connection to Postgres."""
    conn = pg8000.dbapi.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASS or None,
        database=DB_NAME,
        port=DB_PORT,
        ssl_context=build_ssl_context(),
        timeout=10,
        tcp_keepalive=True,
        application_name="urs-consultation",
    )
    conn.autocommit = True
    return conn


# ─── Connection pool ──────────────────────────────────────────────────────────
# Deliberately small. Managed Postgres free tiers cap total connections, and an
# oversized pool is how this app ran out of memory before. DB_POOL_SIZE=0 falls
# back to a fresh connection per query.

_pool = []
_pool_lock = threading.Lock()


def _acquire():
    if DB_POOL_SIZE > 0:
        with _pool_lock:
            if _pool:
                return _pool.pop()
    return connect()


def _release(conn):
    if DB_POOL_SIZE > 0:
        with _pool_lock:
            if len(_pool) < DB_POOL_SIZE:
                _pool.append(conn)
                return
    _discard(conn)


def _discard(conn):
    try:
        conn.close()
    except Exception:
        pass


def _rollback(conn):
    """Clear an aborted statement so the connection is safe to pool again."""
    try:
        conn.rollback()
        return True
    except Exception:
        return False


def get_connection():
    """Kept for callers that want to drive a connection themselves."""
    return connect()


def _rows_as_dicts(cur):
    """pg8000 returns tuples; the rest of the app expects dict rows."""
    if cur.description is None:
        return []
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _run(sql, args, fetchone, fetchall, conn):
    # pg8000 cursors are not context managers, so close them by hand.
    cur = conn.cursor()
    try:
        cur.execute(sql, args or ())
        if fetchone:
            rows = _rows_as_dicts(cur)
            return rows[0] if rows else None
        if fetchall:
            return _rows_as_dicts(cur)
        # Nothing to fetch: INSERT/UPDATE/DELETE/DDL.
        return None
    finally:
        try:
            cur.close()
        except Exception:
            pass


def query(sql, args=None, fetchone=False, fetchall=False, commit=False):
    """Run a statement. Returns a dict row, a list of dict rows, or None.

    `commit` is accepted for backwards compatibility — connections run in
    autocommit mode, so every statement is already committed on success.
    """
    conn = _acquire()
    try:
        result = _run(sql, args, fetchone, fetchall, conn)
    except Exception as exc:
        if _is_connection_error(exc):
            # A pooled connection can be closed under us by the server (Neon
            # and Supabase both cull idle ones). The statement never reached
            # Postgres, so retrying it once on a fresh connection is safe.
            _discard(conn)
            conn = connect()
            try:
                result = _run(sql, args, fetchone, fetchall, conn)
            except Exception:
                _discard(conn)
                raise
        else:
            # A real SQL error (constraint violation, bad query). Do NOT retry.
            # The connection stays usable once the aborted statement is undone.
            if _rollback(conn):
                _release(conn)
            else:
                _discard(conn)
            raise
    _release(conn)
    return result


def execute(sql, args=None):
    """Run an INSERT/UPDATE/DELETE."""
    return query(sql, args)


def fetch_one(sql, args=None):
    return query(sql, args, fetchone=True)


def fetch_all(sql, args=None):
    return query(sql, args, fetchall=True)
