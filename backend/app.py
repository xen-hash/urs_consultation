import os
from datetime import datetime

import pytz
from flask import Flask, jsonify
from flask_socketio import SocketIO, join_room
from flask_cors import CORS
from itsdangerous import BadSignature, SignatureExpired

import realtime
from security import _serializer, ROLES
from config import SESSION_TTL_HOURS
from models import init_db
from auth import auth_bp
from teacher import teacher_bp
from student import student_bp
from export import export_bp
from tts import tts_bp
from biometric import biometric_bp
from admin import admin_bp
from notifications import notifications_bp
from config import SECRET_KEY

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=None)
app.secret_key = SECRET_KEY

# Profile photos arrive as base64 data URLs and go straight into TEXT columns.
# Without a ceiling, one request can push an arbitrary amount of data into the
# database. 8 MB comfortably fits a webcam still.
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_CONTENT_MB", 8)) * 1024 * 1024

# CORS used to default to "*", which let any site on the internet call this API
# with a user's credentials. The default is now local development only; a real
# deployment must name its frontend origin.
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
_origins_raw = (os.getenv("ALLOWED_ORIGINS") or DEFAULT_ORIGINS).strip()


def _normalise_origin(value):
    """An Origin header is scheme://host[:port] — never a trailing slash, never
    a path. Operators paste browser URLs, which have both, and the mismatch is
    invisible: the server answers 200 and the browser silently drops the
    response for a missing header. Normalise so a pasted URL still matches."""
    origin = value.strip()
    if not origin or origin == "*":
        return origin
    if "://" in origin:
        scheme, _, rest = origin.partition("://")
        return f"{scheme.lower()}://{rest.split('/', 1)[0]}"
    return origin.split("/", 1)[0]


ALLOWED_ORIGINS = [o for o in (_normalise_origin(p) for p in _origins_raw.split(",")) if o]
if "*" in ALLOWED_ORIGINS:
    print("[SECURITY] WARNING: ALLOWED_ORIGINS is '*' — any website can call this API.")
# Print the effective list. A rejected origin is otherwise only visible as a
# browser-side failure, while the server reports 200 and looks healthy.
print(f"[SECURITY] Accepting browser requests from: {', '.join(ALLOWED_ORIGINS)}")
if not os.getenv("ALLOWED_ORIGINS"):
    print(
        "[SECURITY] WARNING: ALLOWED_ORIGINS is not set, so only local "
        "development origins are accepted. A deployed frontend will have every "
        "request blocked by the browser."
    )

CORS(
    app,
    resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=False,
)
socketio = SocketIO(
    app, cors_allowed_origins=ALLOWED_ORIGINS, async_mode="gevent", allow_upgrades=False
)

PH = pytz.timezone("Asia/Manila")

# ─── Blueprints ───────────────────────────────────────────────────────────────
app.register_blueprint(auth_bp,      url_prefix="/api/auth")
app.register_blueprint(teacher_bp,   url_prefix="/api")
app.register_blueprint(student_bp,   url_prefix="/api")
app.register_blueprint(export_bp,    url_prefix="/api")
app.register_blueprint(tts_bp,       url_prefix="/api")
app.register_blueprint(biometric_bp, url_prefix="/api")
app.register_blueprint(admin_bp,     url_prefix="/api/admin")
app.register_blueprint(notifications_bp, url_prefix="/api")


# ─── Security headers ─────────────────────────────────────────────────────────

@app.after_request
def security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    # This is a JSON API; nothing it returns should ever be rendered as a page.
    response.headers.setdefault(
        "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
    )
    return response


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.route("/")
@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "time": datetime.now(PH).strftime("%Y-%m-%d %H:%M:%S"),
    })


# ─── Socket.IO Events ─────────────────────────────────────────────────────────
# Clients only listen. Everything pushed is emitted by the routes in
# realtime.py, because the routes are where state actually changes — see the
# module docstring there for why the previous client-to-client relay both never
# worked and could not safely be made to.
#
# The only thing handled here is the connection itself: work out who is on the
# other end, and put them in the rooms they are entitled to hear.

realtime.bind(socketio)


def _claims_from_auth(auth):
    """Verify the token a client presents at connect. None when unauthenticated.

    Anonymous connections are legitimate — the availability board is a public,
    read-only screen with no session — so this returns None rather than
    refusing, and the caller joins the public room only.
    """
    token = (auth or {}).get("token") if isinstance(auth, dict) else None
    if not token:
        return None
    try:
        claims = _serializer.loads(token, max_age=SESSION_TTL_HOURS * 3600)
    except (SignatureExpired, BadSignature):
        return None
    if not isinstance(claims, dict) or claims.get("role") not in ROLES:
        return None
    return claims


@socketio.on("connect")
def on_connect(auth=None):
    # Everyone hears availability: it is the same public information
    # /api/teacher-logs serves without a session.
    join_room(realtime.AVAILABILITY_ROOM)

    claims = _claims_from_auth(auth)
    if not claims:
        print("[WS] Client connected (anonymous, availability only)")
        return

    role, subject_id = claims["role"], claims.get("sub")
    if role == "teacher" and subject_id:
        join_room(realtime.teacher_room(subject_id))
    elif role == "student" and subject_id:
        join_room(realtime.student_room(subject_id))
    # An admin watches the boards rather than one person's queue, so the public
    # room is the whole of it — and joining every teacher's room would hand the
    # dashboard student names it does not display.
    print(f"[WS] Client connected ({role})")


@socketio.on("disconnect")
def on_disconnect(reason=None):
    print("[WS] Client disconnected")


# ─── Initialize DB (runs under gunicorn AND direct) ───────────────────────────
print("[URS] Initializing database...")
init_db()

# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 5000))
    print(f"[URS] Starting server on http://0.0.0.0:{PORT}")
    socketio.run(app, host="0.0.0.0", port=PORT, debug=False,
                 use_reloader=False, allow_unsafe_werkzeug=True)
