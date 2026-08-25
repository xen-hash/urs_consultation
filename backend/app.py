import os
from datetime import datetime

import pytz
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

from models import init_db
from auth import auth_bp
from teacher import teacher_bp
from student import student_bp
from export import export_bp
from tts import tts_bp
from biometric import biometric_bp
from admin import admin_bp
from config import SECRET_KEY, KIOSK_PASSWORD
from security import read_token, too_many_attempts, client_ip

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
ALLOWED_ORIGINS = [o.strip() for o in _origins_raw.split(",") if o.strip()]
if "*" in ALLOWED_ORIGINS:
    print("[SECURITY] WARNING: ALLOWED_ORIGINS is '*' — any website can call this API.")

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


# ─── Kiosk exit ───────────────────────────────────────────────────────────────

@app.route("/api/kiosk/exit", methods=["POST"])
def kiosk_exit():
    """Verify the kiosk exit code on the server.

    The kiosk is a shared unattended screen, so this is a low-value secret — but
    it used to be a constant in the frontend bundle, which meant it was not a
    secret at all.
    """
    throttled = too_many_attempts(f"kiosk-exit:{client_ip()}", 5, 15 * 60)
    if throttled:
        return throttled
    password = (request.json or {}).get("password") or ""
    if password != KIOSK_PASSWORD:
        return jsonify({"error": "Incorrect password."}), 401
    return jsonify({"message": "ok"})


# ─── Socket.IO Events ─────────────────────────────────────────────────────────
# Anonymous sockets may connect and listen — the kiosk board is a read-only
# display with no session. Emitting is another matter: these handlers rebroadcast
# to every client, so an unauthenticated emitter could forge availability
# changes and fake consultation requests on every screen in the building.

def _emitter_claims(data):
    """Claims for a socket event, from the payload token. None when untrusted."""
    token = (data or {}).get("token") if isinstance(data, dict) else None
    if not token:
        return None
    from itsdangerous import BadSignature, SignatureExpired
    from security import _serializer, ROLES
    from config import SESSION_TTL_HOURS
    try:
        claims = _serializer.loads(token, max_age=SESSION_TTL_HOURS * 3600)
    except (SignatureExpired, BadSignature):
        return None
    if not isinstance(claims, dict) or claims.get("role") not in ROLES:
        return None
    return claims


def _strip_token(data):
    """Never rebroadcast the emitter's own session token to every listener."""
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if k != "token"}
    return data


@socketio.on("connect")
def on_connect(auth=None):
    print("[WS] Client connected")


@socketio.on("disconnect")
def on_disconnect(reason=None):
    print("[WS] Client disconnected")


@socketio.on("broadcast_status")
def handle_status_broadcast(data):
    claims = _emitter_claims(data)
    if not claims or claims["role"] not in ("teacher", "admin"):
        return
    emit("status_update", _strip_token(data), broadcast=True)


@socketio.on("broadcast_request")
def handle_request_broadcast(data):
    claims = _emitter_claims(data)
    if not claims:
        return
    payload = _strip_token(data)
    emit("consultation_update", payload, broadcast=True)
    emit("new_request", payload, broadcast=True)


@socketio.on("broadcast_request_done")
def handle_done_broadcast(data):
    claims = _emitter_claims(data)
    if not claims or claims["role"] not in ("teacher", "admin"):
        return
    emit("request_done", _strip_token(data), broadcast=True)


# ─── Initialize DB (runs under gunicorn AND direct) ───────────────────────────
print("[URS] Initializing database...")
init_db()

# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 5000))
    print(f"[URS] Starting server on http://0.0.0.0:{PORT}")
    socketio.run(app, host="0.0.0.0", port=PORT, debug=False,
                 use_reloader=False, allow_unsafe_werkzeug=True)
