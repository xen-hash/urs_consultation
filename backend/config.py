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


# ─── Secrets and sessions ─────────────────────────────────────────────────────
# These defaults exist so `python app.py` runs out of the box for local work.
# Shipping them is the same as having no authentication at all, so a deploy that
# still carries one fails at startup unless it opts out explicitly — see
# _assert_secrets_configured() at the bottom of this file.

DEFAULT_SECRET_KEY     = "urs-consultation-secret-2024"
DEFAULT_ADMIN_PASSWORD = "admin123"

SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)

# How long a session token stays valid. Tokens are stateless and cannot be
# revoked individually, so this doubles as the blast radius of a leaked one.
SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", 12))

# ── Student registration checks ───────────────────────────────────────────────
# Registration is open by design — students sign themselves up — so these are
# what stands between the roster and anyone who finds the URL.
#
# STUDENT_EMAIL_DOMAINS: comma-separated list a registration email must end
# with. Empty means any address is accepted, which is the weakest setting and
# only sensible while the school's own domain is being sorted out.
#
# STUDENT_ID_PATTERN: a regular expression the student number must match. The
# default accepts the common Philippine forms — 2021-00123, 21-00123, or a
# plain run of digits — and rejects free text.
#
# STUDENT_AUTO_VERIFY: when true, accounts skip the administrator's queue. Off
# by default: an unverified account can look around but cannot file a request.
STUDENT_EMAIL_DOMAINS = [
    d.strip().lstrip("@").lower()
    for d in (os.getenv("STUDENT_EMAIL_DOMAINS", "") or "").split(",")
    if d.strip()
]
STUDENT_ID_PATTERN = os.getenv("STUDENT_ID_PATTERN", r"^\d{2,4}-?\d{3,6}$")
STUDENT_AUTO_VERIFY = os.getenv("STUDENT_AUTO_VERIFY", "").strip().lower() in (
    "1", "true", "yes", "on"
)

ALLOW_INSECURE_DEFAULTS = os.getenv("ALLOW_INSECURE_DEFAULTS", "").strip().lower() in (
    "1", "true", "yes", "on"
)

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

WORKING_HOURS_START = "06:00"
WORKING_HOURS_END   = "19:30"


# ─── Administrator credentials ────────────────────────────────────────────────
# The admin login used to be a string compared inside the browser bundle. It is
# now a bcrypt hash checked on the server. Set ADMIN_PASSWORD_HASH in the
# environment; ADMIN_PASSWORD is accepted as a convenience and hashed at boot.

ADMIN_USERNAME      = os.getenv("ADMIN_USERNAME", "admin").strip()
ADMIN_PASSWORD      = os.getenv("ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)

_admin_hash_env = (os.getenv("ADMIN_PASSWORD_HASH") or "").strip()


def _resolve_admin_hash():
    """The bcrypt hash to check admin logins against.

    Prefers ADMIN_PASSWORD_HASH so the plaintext never has to exist in the
    environment. Falls back to hashing ADMIN_PASSWORD once at import time.
    """
    if _admin_hash_env:
        return _admin_hash_env.encode()
    import bcrypt
    return bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt())


ADMIN_PASSWORD_HASH = _resolve_admin_hash()

# Say which credential source is in play, because getting this wrong looks
# exactly like a mistyped password: ADMIN_PASSWORD_HASH silently wins over
# ADMIN_PASSWORD when both are set, and a value pasted with a stray space is
# invisible in a dashboard. Neither the password nor the hash is ever printed —
# only which variable was read, the expected username, and the password's
# length so a stray space shows up as an off-by-one.
print(
    f"[SECURITY] Admin login expects username={ADMIN_USERNAME!r}; "
    f"credential from "
    f"{'ADMIN_PASSWORD_HASH' if _admin_hash_env else 'ADMIN_PASSWORD'}"
    + ("" if _admin_hash_env else f" (length {len(ADMIN_PASSWORD)})")
)
if _admin_hash_env and os.getenv("ADMIN_PASSWORD"):
    print(
        "[SECURITY] WARNING: both ADMIN_PASSWORD_HASH and ADMIN_PASSWORD are "
        "set. The hash wins and ADMIN_PASSWORD is ignored — delete one of them."
    )


# ─── Startup guard ────────────────────────────────────────────────────────────

def _assert_secrets_configured():
    """Refuse to boot with the built-in development secrets still in place.

    Serving traffic with a known SECRET_KEY means anyone can forge a session
    token for any role, so this is a hard failure rather than a warning. Local
    development sets ALLOW_INSECURE_DEFAULTS=1.
    """
    weak = []
    if SECRET_KEY == DEFAULT_SECRET_KEY:
        weak.append("SECRET_KEY")
    if not _admin_hash_env and ADMIN_PASSWORD == DEFAULT_ADMIN_PASSWORD:
        weak.append("ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH)")

    if not weak:
        return
    if ALLOW_INSECURE_DEFAULTS:
        print(
            "[SECURITY] WARNING: using built-in defaults for "
            f"{', '.join(weak)}. Allowed only because ALLOW_INSECURE_DEFAULTS "
            "is set. Never do this on a deployed instance."
        )
        return
    raise RuntimeError(
        "Refusing to start: these still hold their built-in development "
        f"defaults -> {', '.join(weak)}.\n"
        "Anyone who reads this source can forge an admin session against a\n"
        "deployment configured this way. Set them in the environment:\n"
        "  SECRET_KEY          a long random string\n"
        "  ADMIN_PASSWORD_HASH a bcrypt hash (or ADMIN_PASSWORD)\n"
        "For local development only, set ALLOW_INSECURE_DEFAULTS=1."
    )


_assert_secrets_configured()