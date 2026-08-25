"""Session tokens, role guards and the audit trail.

Every protected endpoint in this app used to trust whatever `employee_id` or
`student_id` arrived in the request body, which meant any caller could act as
any user. Identity now comes from a signed token the server issued, and never
from the request body.

The token is an `itsdangerous` signed payload rather than a JWT — itsdangerous
already ships with Flask, so this adds no dependency. It carries three claims:

    role -> "student" | "teacher" | "admin"
    sub  -> student_id / employee_id / admin username
    name -> display name, for the audit trail

Tokens are stateless and cannot be revoked individually before they expire;
SESSION_TTL_HOURS is short for that reason. Revoking a *credential* (a QR card)
is separate and immediate — see the qr_serial rotation in admin.py.
"""

import time
import threading
from functools import wraps

from flask import request, jsonify, g
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from config import SECRET_KEY, SESSION_TTL_HOURS
from db import query, execute

_TOKEN_SALT = "urs-session-v1"
_serializer = URLSafeTimedSerializer(SECRET_KEY, salt=_TOKEN_SALT)

ROLES = ("student", "teacher", "admin")


# ─── Token issue / read ───────────────────────────────────────────────────────

def issue_token(role, subject, name=None):
    """Sign a session token. `subject` is the caller's stable id."""
    if role not in ROLES:
        raise ValueError(f"unknown role: {role}")
    return _serializer.dumps({"role": role, "sub": str(subject), "name": name})


def read_token():
    """Claims from the Authorization header, or None if absent/invalid/expired."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    raw = header[7:].strip()
    if not raw:
        return None
    try:
        claims = _serializer.loads(raw, max_age=SESSION_TTL_HOURS * 3600)
    except (SignatureExpired, BadSignature):
        return None
    if not isinstance(claims, dict) or claims.get("role") not in ROLES:
        return None
    return claims


def current_claims():
    """Claims for this request, cached on `g`. None when unauthenticated."""
    if "claims" not in g:
        g.claims = read_token()
    return g.claims


# ─── Guards ───────────────────────────────────────────────────────────────────

def require_role(*roles):
    """Reject the request unless the caller holds one of `roles`.

    401 means "no usable token"; 403 means "authenticated, wrong role". The
    frontend interceptor treats them the same (clear session, bounce to login),
    but the distinction matters when reading logs.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            claims = current_claims()
            if not claims:
                return jsonify({"error": "Authentication required."}), 401
            if claims["role"] not in roles:
                return jsonify({"error": "Not permitted."}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def is_admin():
    claims = current_claims()
    return bool(claims and claims["role"] == "admin")


def subject():
    """The authenticated caller's own id."""
    claims = current_claims()
    return claims["sub"] if claims else None


def owns(target_id):
    """True when the caller is acting on their own record. Admin always passes.

    Comparison is case-insensitive because employee IDs are typed by hand on the
    PIN login screen and get upper-cased there.
    """
    claims = current_claims()
    if not claims:
        return False
    if claims["role"] == "admin":
        return True
    return str(claims["sub"]).strip().lower() == str(target_id or "").strip().lower()


def forbid_unless_owner(target_id):
    """Guard body for routes that take an id in the URL or body.

    Returns a Flask response to return early, or None when the caller may
    proceed. Used instead of a decorator where the id has to be pulled out of
    the payload first.
    """
    if not current_claims():
        return jsonify({"error": "Authentication required."}), 401
    if not owns(target_id):
        return jsonify({"error": "Not permitted."}), 403
    return None


# ─── Rate limiting ────────────────────────────────────────────────────────────
# Deliberately in-process: gunicorn runs this app with a single gevent worker
# (see Procfile), so one dict is the whole picture. If the deployment ever grows
# to multiple workers this has to move to the database or Redis, otherwise the
# limit silently multiplies by the worker count.

_attempts = {}
_attempts_lock = threading.Lock()


def rate_limit(key, limit, window_seconds):
    """Record an attempt. Returns seconds to wait, or 0 when allowed."""
    now = time.time()
    with _attempts_lock:
        hits = [t for t in _attempts.get(key, ()) if now - t < window_seconds]
        if len(hits) >= limit:
            return int(window_seconds - (now - hits[0])) + 1
        hits.append(now)
        _attempts[key] = hits
        # Opportunistic sweep so the dict can't grow without bound.
        if len(_attempts) > 2048:
            for k in [k for k, v in _attempts.items()
                      if not v or now - v[-1] > window_seconds]:
                _attempts.pop(k, None)
    return 0


def clear_rate_limit(key):
    """Forget a key's attempts — call after a successful login."""
    with _attempts_lock:
        _attempts.pop(key, None)


def too_many_attempts(key, limit, window_seconds):
    """Rate-limit guard returning a ready 429 response, or None when allowed."""
    wait = rate_limit(key, limit, window_seconds)
    if wait:
        return jsonify({
            "error": f"Too many attempts. Try again in {wait} seconds."
        }), 429
    return None


def client_ip():
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


# ─── Audit trail ──────────────────────────────────────────────────────────────

def record_audit(action, target=None, detail=None, actor=None):
    """Append one row to the audit log.

    Never raises: an audit write failing must not turn a successful login into a
    500. `actor` overrides the token claims for the login routes, which record
    who just authenticated before a token exists.
    """
    claims = actor or current_claims() or {}
    try:
        execute(
            """INSERT INTO audit_log
               (actor_role, actor_id, actor_name, action, target, detail, ip)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (claims.get("role"), claims.get("sub"), claims.get("name"),
             action, target, detail, client_ip())
        )
    except Exception as exc:  # pragma: no cover - best effort
        print(f"[AUDIT] failed to record {action}: {exc}")


# ─── QR helper ────────────────────────────────────────────────────────────────

def generate_qr_b64(data: str) -> str:
    """PNG QR code as base64, for embedding in an <img src="data:...">."""
    import io
    import base64
    import qrcode

    qr = qrcode.QRCode(version=None, box_size=20, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def teacher_by_employee_id(employee_id):
    return query(
        "SELECT * FROM teacher_accounts WHERE employee_id=%s",
        ((employee_id or "").strip(),), fetchone=True
    )
