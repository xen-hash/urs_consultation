import os
import ssl
from urllib.parse import urlparse, parse_qs, unquote

from dotenv import load_dotenv

load_dotenv()

# ─── Database (PostgreSQL) ────────────────────────────────────────────────────
# Preferred: a single connection string, which is what Neon / Supabase / Render
# hand you. Example:
#   DATABASE_URL=postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require
# The individual DB_* variables are still honoured so older deployments keep
# working; they just default to Postgres' port instead of MySQL's.

DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRESQL_URL")
    or ""
).strip()


def _parse_database_url(url: str):
    """Split a postgres:// URL into connection parts. Returns None if unusable."""
    parsed = urlparse(url)
    if parsed.scheme not in ("postgres", "postgresql", "psql"):
        return None
    qs = parse_qs(parsed.query)
    return {
        "host": parsed.hostname or "127.0.0.1",
        "port": parsed.port or 5432,
        "user": unquote(parsed.username) if parsed.username else "postgres",
        "password": unquote(parsed.password) if parsed.password else "",
        "database": (parsed.path or "/").lstrip("/") or "postgres",
        "sslmode": (qs.get("sslmode") or [""])[0].strip().lower(),
    }


_url_parts = _parse_database_url(DATABASE_URL) if DATABASE_URL else None

if _url_parts:
    DB_HOST = _url_parts["host"]
    DB_PORT = _url_parts["port"]
    DB_USER = _url_parts["user"]
    DB_PASS = _url_parts["password"]
    DB_NAME = _url_parts["database"]
    _SSLMODE = _url_parts["sslmode"]
else:
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = int(os.getenv("DB_PORT", 5432))
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASS = os.getenv("DB_PASSWORD", os.getenv("DB_PASS", ""))  # supports both
    DB_NAME = os.getenv("DB_NAME", "consultation_system")
    _SSLMODE = ""

# An explicit DB_SSLMODE always wins over whatever the URL carried.
DB_SSLMODE = (os.getenv("DB_SSLMODE") or _SSLMODE or "").strip().lower()

if not DB_SSLMODE:
    # Mirror libpq's own default of 'prefer': try TLS, but fall back to a
    # plaintext connection if the server declines it. Managed Postgres (Neon,
    # Supabase, Aiven) always accepts TLS; a database reached over a provider's
    # private network — Render's internal database URL, for one — refuses it,
    # and demanding TLS there fails with "Server refuses SSL".
    local = DB_HOST in ("127.0.0.1", "localhost", "::1", "")
    DB_SSLMODE = "disable" if local else "prefer"


# How many pooled connections to keep open. Reconnecting to a managed Postgres
# costs a full TLS handshake on every query, which is why we hold a few open.
# Set DB_POOL_SIZE=0 to go back to one fresh connection per query.
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", 3))


def build_ssl_context():
    """Map DB_SSLMODE onto pg8000's tri-state ssl_context argument.

    pg8000 reads this parameter as three distinct cases, and the difference
    between False and None is easy to get wrong:

        False       -> never negotiate TLS
        None        -> try TLS, fall back to plaintext if the server refuses
                       (exactly libpq's sslmode=prefer)
        SSLContext  -> try TLS, raise "Server refuses SSL" if refused

    Returning None for 'disable' would therefore still connect over TLS.
    """
    if DB_SSLMODE in ("", "disable", "off", "false"):
        return False
    if DB_SSLMODE in ("prefer", "allow"):
        # Let pg8000 do the try-then-fall-back dance itself.
        return None
    ctx = ssl.create_default_context()
    if DB_SSLMODE in ("verify-ca", "verify-full"):
        # Full certificate validation against the system trust store.
        ctx.check_hostname = DB_SSLMODE == "verify-full"
        ctx.verify_mode = ssl.CERT_REQUIRED
    else:
        # 'require': encrypt, but don't validate the certificate. This is what
        # libpq does for sslmode=require, and it is what makes Supabase's
        # pooler certificates work out of the box.
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


SECRET_KEY = os.getenv("SECRET_KEY", "urs-consultation-secret-2024")
QR_FOLDER  = os.path.join(os.path.dirname(__file__), "static", "qrcodes")

PROFESSOR_LIST = {
    "Civil Engineering Department": [
        "Engr. Von Cyrel DL. San Jose","Engr. John Troy Borromeo",
        "Engr. John Louie Cuerdo","Engr. Jasmin M. Panganiban",
        "Engr. Joanna Marie Reyes","Engr. John Carlo L. Ramos",
        "Engr. Paul Ryan M. Reyes","Engr. John Jerby A. Ytang",
        "AR. Lyndon Sheridan P. Trinidad"
    ],
    "Computer Engineering Department": [
        "Engr. Cystaleene Jade A. Santos","Engr. Paul Arvy A. Alfonso",
        "Engr. Allan P. Anorico","Engr. Lester A. Espiritu",
        "Engr. Fredelina F. De Leon"
    ],
    "Electronics Engineering Department": [
        "Engr. Erickson T. Marcos (ECE)","Dr. Marvin P. Amoin",
        "Engr. Jenadel DL. Antipolo","Engr. Jessie O. Barreto",
        "Dr. Francisco F. Culibrina","Engr. Jemuel V. Landerito",
        "Engr. Joan Baez D. Obien","Engr. Rio Camille M. Pedrocillo"
    ],
    "Electrical Engineering Department": [
        "Engr. John Niel B. Herrera","Engr. Roy John E. Balajadia",
        "Engr. Marlon A. Bautista","Engr. Norman C. Francisco",
        "Engr. Michael I. Pascua","Engr. Joshua P. Tejada"
    ],
    "Mechanical Engineering Department": [
        "Engr. Jakki Stacy Wayne A. Serra","Engr. Lean Jo B. Anievas",
        "Engr. Jayson Full B. Cabubas","Engr. Merie Ann C. Dudang",
        "Engr. Wilson Jr. C. Freo","Engr. Alliken Jett I. Ruallo",
        "Engr. Mhaezie Nhelle R. Sexon","Engr. Ver Ian J. Victorio"
    ],
    "GEC GEAS Department": [
        "Engr. Erickson T. Marcos (GEAS)","Engr. Glenda A. Cabandong",
        "Engr. Eleonor F. Dilidili","Engr. Jocelyn C. Rubio",
        "Engr. John Paul J. Sacatrapos","Prof. Marissa Yolanda C. Samonte"
    ]
}

KIOSK_PASSWORD      = os.getenv("KIOSK_PASSWORD", "admin123")
ADMIN_PASSWORD      = os.getenv("ADMIN_PASSWORD", "admin123")
WORKING_HOURS_START = "06:00"
WORKING_HOURS_END   = "19:30"