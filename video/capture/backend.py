"""Run the real backend for screen capture, with a fictional roster and a frozen clock.

The video shows the app's own screens, but never the real faculty: the roster
in backend/config.py is swapped for made-up names before anything imports it,
so the real names never reach the database. The clock is fixed at a weekday
morning so availability, schedules and "today" read the same on every run.

    DATABASE_URL=postgresql://urs@127.0.0.1:55432/ursdb_video python capture/backend.py
"""
import os
import sys
from datetime import datetime
from pathlib import Path

import pytz
import time_machine

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

# Throwaway values for a throwaway local database.
os.environ.setdefault("DATABASE_URL", "postgresql://urs@127.0.0.1:55432/ursdb_video")
os.environ.update({
    "ALLOW_INSECURE_DEFAULTS": "1",
    "SECRET_KEY": "video-capture-only",
    "ADMIN_USERNAME": "dean",
    "ADMIN_PASSWORD": "video-capture",
    "STUDENT_AUTO_VERIFY": "1",
    "ALLOWED_ORIGINS": "http://localhost:5173",
})

# Thursday 1 October 2026, 10:24 in Manila. The clock keeps ticking from there.
FROZEN = pytz.timezone("Asia/Manila").localize(datetime(2026, 10, 1, 10, 24))
time_machine.travel(FROZEN, tick=True).start()

ROSTER = {
    "Civil Engineering Department": ["Engr. Ana Villareal", "Engr. Nico Valdez", "Engr. Tomas Rivera"],
    "Computer Engineering Department": ["Prof. Marco Dizon", "Prof. Rina Torres", "Engr. Kaye Bautista"],
    "Electrical Engineering Department": ["Engr. Liza Manalo", "Engr. Rey Padilla"],
    "Electronics Engineering Department": ["Engr. Paolo Lim", "Dr. Joy Lacson"],
    "Mechanical Engineering Department": ["Dr. Carlo Aquino", "Engr. Ben Ocampo"],
    "GEC GEAS Department": ["Prof. Bea Salcedo", "Prof. Iris Ferrer"],
}

import config  # noqa: E402

config.PROFESSOR_LIST.clear()
config.PROFESSOR_LIST.update(ROSTER)


def db():
    import pg8000.native
    c = config
    return pg8000.native.Connection(c.DB_USER, host=c.DB_HOST, port=c.DB_PORT,
                                    database=c.DB_NAME, password=c.DB_PASS or None)


def freeze_database_clock():
    """Put Postgres on the same frozen clock as the app.

    Columns default to the database's own time and some queries compare against
    NOW(), so with only the app frozen, "last seen" read hours out. A public
    now() that adds the offset, placed ahead of pg_catalog on the search path,
    makes every unqualified now() in the app's SQL agree with it.
    """
    conn = db()
    real = conn.run("SELECT EXTRACT(EPOCH FROM pg_catalog.now())")[0][0]
    offset = FROZEN.timestamp() - float(real)
    conn.run(f"CREATE OR REPLACE FUNCTION public.now() RETURNS timestamptz LANGUAGE sql STABLE "
             f"AS $$ SELECT pg_catalog.now() + interval '{offset:.3f} seconds' $$")
    conn.run(f"ALTER DATABASE {config.DB_NAME} SET search_path = public, pg_catalog")
    conn.close()


def default_to_frozen_now():
    conn = db()
    conn.run("SET search_path = public, pg_catalog")
    for table, column in conn.run(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND column_name IN ('created_at', 'enrolled_at')"):
        conn.run(f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT now()")
    conn.close()


freeze_database_clock()

import app as app_module  # noqa: E402

default_to_frozen_now()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"[capture] backend on http://127.0.0.1:{port}, clock at {FROZEN:%a %d %b %Y %H:%M} Manila")
    app_module.socketio.run(app_module.app, host="127.0.0.1", port=port, debug=False,
                            use_reloader=False, allow_unsafe_werkzeug=True)
