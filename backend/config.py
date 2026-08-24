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

def _clean_url(raw: str) -> str:
    """Tidy up the two ways a connection string usually arrives mangled."""
    url = (raw or "").strip()
    # Pasted straight from a "psql 'postgresql://...'" snippet.
    if url.lower().startswith("psql "):
        url = url[5:].strip()
    # Pasted with the surrounding quotes included.
    if len(url) >= 2 and url[0] == url[-1] and url[0] in ("'", '"'):
        url = url[1:-1].strip()
    return url


# Variable names we accept a connection string under, in priority order.
_URL_VARIABLES = ("DATABASE_URL", "POSTGRES_URL", "POSTGRESQL_URL")

DATABASE_URL = _clean_url(
    next((os.environ[n] for n in _URL_VARIABLES if os.environ.get(n)), "")
)


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

if DATABASE_URL and not _url_parts:
    # Set, but not something we can use. Falling back to localhost here would
    # surface later as "Can't create a connection to host 127.0.0.1", which
    # says nothing about the real problem — so fail with the real problem.
    _shown = DATABASE_URL[:40] + ("..." if len(DATABASE_URL) > 40 else "")
    raise RuntimeError(
        f"DATABASE_URL is set but is not a PostgreSQL connection string.\n"
        f"  got      : {_shown}\n"
        f"  expected : postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require\n"
        f"A mysql:// URL will not work — this app runs on PostgreSQL. Copy the\n"
        f"'Connection string' from your Neon or Supabase dashboard."
    )

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

if _url_parts:
    _CONFIG_SOURCE = "DATABASE_URL"
elif os.getenv("DB_HOST"):
    _CONFIG_SOURCE = "DB_HOST and friends"
else:
    _CONFIG_SOURCE = "built-in defaults"

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


# Say out loud what we are about to connect to. Without this, a misconfigured
# deploy just reports "Can't create a connection to host 127.0.0.1", which
# looks like a database outage rather than a missing environment variable.
# The password is deliberately never included.
print(
    f"[DB] Target: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME} "
    f"sslmode={DB_SSLMODE} (from {_CONFIG_SOURCE})"
)

def _looks_like_a_connection_string(value: str) -> bool:
    return _clean_url(value).lower().startswith(("postgresql://", "postgres://"))


def _misnamed_candidates():
    """Env vars holding a Postgres URL under a name we don't read.

    A variable called DATA_URL instead of DATABASE_URL is invisible to this
    app and shows up only as a failed connection to 127.0.0.1. Name the
    variable rather than making the user guess; values are never printed.
    """
    return sorted(
        name
        for name, value in os.environ.items()
        if name not in _URL_VARIABLES and value and _looks_like_a_connection_string(value)
    )


if _CONFIG_SOURCE == "built-in defaults":
    print(
        "[DB] WARNING: neither DATABASE_URL nor DB_HOST is set, so that target "
        "is a local database that almost certainly does not exist here."
    )
    print(f"[DB] Looked for: {', '.join(_URL_VARIABLES)}")
    _candidates = _misnamed_candidates()
    if _candidates:
        print(
            f"[DB] But these variables DO hold a Postgres connection string: "
            f"{', '.join(_candidates)}"
        )
        print(
            f"[DB] -> Rename {_candidates[0]} to DATABASE_URL and redeploy. "
            f"The value looks right; only the name is wrong."
        )
    else:
        print(
            "[DB] No variable anywhere in the environment holds a Postgres "
            "connection string. Add DATABASE_URL with the connection string "
            "from your Neon or Supabase dashboard."
        )

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