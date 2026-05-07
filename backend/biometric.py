# biometric.py — Flask proxy routes for the biometric microservice
# Register in app.py: from biometric import biometric_bp; app.register_blueprint(biometric_bp, url_prefix="/api")

import requests
from flask import Blueprint, request, jsonify
from db import query, execute

biometric_bp = Blueprint("biometric", __name__)

BIOMETRIC_URL = "http://localhost:8000"   # FastAPI microservice


def _proxy_post(path, payload):
    """Forward a POST request to the biometric microservice."""
    try:
        r = requests.post(f"{BIOMETRIC_URL}{path}", json=payload, timeout=15)
        return r.json(), r.status_code
    except requests.exceptions.ConnectionError:
        return {"error": "Biometric service offline. Start biometric_service.py."}, 503


# ── Live detection (for webcam overlay) ──────────────────────────────────────

@biometric_bp.route("/biometric/detect", methods=["POST"])
def detect():
    data, code = _proxy_post("/api/detect", request.json)
    return jsonify(data), code


# ── Face login ────────────────────────────────────────────────────────────────

@biometric_bp.route("/biometric/login", methods=["POST"])
def face_login():
    """
    Receive a base64 webcam frame, forward to biometric service,
    then look up the matched label in MySQL and return the same
    session data as QR + PIN login.

    Label format: "student_<student_id>"  e.g. "student_M2024-0001"
                  "teacher_<employee_id>" e.g. "teacher_EMP-ABCD1234"
    """
    payload = request.json or {}
    image   = payload.get("image")
    if not image:
        return jsonify({"error": "No image provided"}), 400

    result, code = _proxy_post("/api/recognize", {"image": image})
    if code != 200:
        return jsonify(result), code

    if not result.get("recognized"):
        return jsonify({
            "recognized": False,
            "reason":         result.get("reason", "Not recognized"),
            "face_confidence": result.get("face_confidence", 0),
            "eye_confidence":  result.get("eye_confidence", 0),
        }), 401

    label = result.get("label", "")

    # ── Resolve label to a user record ───────────────────────────────────────
    if label.startswith("student_"):
        student_id = label[len("student_"):]
        student = query(
            "SELECT * FROM students WHERE student_id=%s",
            (student_id,), fetchone=True
        )
        if not student:
            return jsonify({"error": "Student not found", "recognized": False}), 404
        return jsonify({
            "recognized":      True,
            "type":            "student",
            "face_confidence": result.get("face_confidence"),
            "eye_confidence":  result.get("eye_confidence"),
            "student": {
                "student_id": student["student_id"],
                "full_name":  student["full_name"],
                "course":     student["course"],
                "year_level": student["year_level"],
                "department": student["department"],
                "photo":      student.get("photo"),
            }
        })

    elif label.startswith("teacher_"):
        employee_id = label[len("teacher_"):]
        teacher = query(
            "SELECT * FROM teacher_accounts WHERE employee_id=%s",
            (employee_id,), fetchone=True
        )
        if not teacher:
            return jsonify({"error": "Teacher not found", "recognized": False}), 404
        return jsonify({
            "recognized":      True,
            "type":            "teacher",
            "face_confidence": result.get("face_confidence"),
            "eye_confidence":  result.get("eye_confidence"),
            "teacher": {
                "employee_id":    teacher["employee_id"],
                "professor_name": teacher["professor_name"],
                "department":     teacher["department"],
                "photo":          teacher.get("photo"),
            }
        })

    return jsonify({"error": "Unknown label format", "recognized": False}), 400


# ── Enroll ────────────────────────────────────────────────────────────────────

@biometric_bp.route("/biometric/enroll", methods=["POST"])
def face_enroll():
    """
    Enroll face + eye biometrics for a student or teacher.
    body: { "label": "student_M2024-0001", "images": ["<base64>", ...] }
    """
    payload = request.json or {}
    label   = payload.get("label")
    images  = payload.get("images", [])

    if not label or not images:
        return jsonify({"error": "label and images required"}), 400

    result, code = _proxy_post("/api/enroll", {"label": label, "images": images})

    if result.get("enrolled"):
        # Record enrollment in DB
        if label.startswith("student_"):
            student_id = label[len("student_"):]
            execute(
                """INSERT INTO biometrics (student_id, face_file, eye_file)
                   VALUES ((SELECT id FROM students WHERE student_id=%s LIMIT 1), %s, %s)
                   ON DUPLICATE KEY UPDATE face_file=%s, eye_file=%s, enrolled_at=NOW()""",
                (student_id, f"{label}_face.npy", f"{label}_eye.npy",
                 f"{label}_face.npy", f"{label}_eye.npy")
            )

    return jsonify(result), code


# ── Delete enrollment ─────────────────────────────────────────────────────────

@biometric_bp.route("/biometric/enroll/<label>", methods=["DELETE"])
def delete_enroll(label):
    try:
        r = requests.delete(f"{BIOMETRIC_URL}/api/enroll/{label}", timeout=10)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


# ── List enrolled ─────────────────────────────────────────────────────────────

@biometric_bp.route("/biometric/enrolled", methods=["GET"])
def enrolled():
    try:
        r = requests.get(f"{BIOMETRIC_URL}/api/enrolled", timeout=5)
        return jsonify(r.json()), r.status_code
    except Exception:
        return jsonify({"labels": [], "error": "Biometric service offline"}), 503