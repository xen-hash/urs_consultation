import os
import pytz
from datetime import datetime
from flask import Flask, send_from_directory, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS

from models import init_db
from auth import auth_bp
from teacher import teacher_bp
from student import student_bp
from export import export_bp
from tts import tts_bp

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=None)
app.secret_key = os.getenv("SECRET_KEY", "urs-secret-2024")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})
socketio = SocketIO(app, cors_allowed_origins=ALLOWED_ORIGINS, async_mode="eventlet")

PH = pytz.timezone("Asia/Manila")

# ─── Blueprints ───────────────────────────────────────────────────────────────
app.register_blueprint(auth_bp,      url_prefix="/api/auth")
app.register_blueprint(teacher_bp,   url_prefix="/api")
app.register_blueprint(student_bp,   url_prefix="/api")
app.register_blueprint(export_bp,    url_prefix="/api")
app.register_blueprint(tts_bp,       url_prefix="/api")

# ─── Static QR Codes ──────────────────────────────────────────────────────────
QR_FOLDER = os.path.join(os.path.dirname(__file__), "static", "qrcodes")
os.makedirs(QR_FOLDER, exist_ok=True)

@app.route("/static/qrcodes/<path:filename>")
def serve_qr(filename):
    return send_from_directory(QR_FOLDER, filename)

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.route("/")
@app.route("/api/health")
def health():
    now_ph = datetime.now(PH)
    return jsonify({"status": "ok", "time": now_ph.strftime("%Y-%m-%d %H:%M:%S")})

# ─── Socket.IO Events ─────────────────────────────────────────────────────────
@socketio.on("connect")
def on_connect():
    print("[WS] Client connected")

@socketio.on("disconnect")
def on_disconnect():
    print("[WS] Client disconnected")

@socketio.on("broadcast_status")
def handle_status_broadcast(data):
    emit("status_update", data, broadcast=True)

@socketio.on("broadcast_request")
def handle_request_broadcast(data):
    emit("consultation_update", data, broadcast=True)
    emit("new_request", data, broadcast=True)

@socketio.on("broadcast_request_done")
def handle_done_broadcast(data):
    emit("request_done", data, broadcast=True)

# ─── Initialize DB (runs under gunicorn AND direct) ───────────────────────────
print("[URS] Initializing database...")
init_db()

# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 5000))
    print(f"[URS] Starting server on http://0.0.0.0:{PORT}")
    socketio.run(app, host="0.0.0.0", port=PORT, debug=False, use_reloader=False)