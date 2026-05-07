import os
import io
import base64
import hashlib
import bcrypt
import qrcode
from flask import Blueprint, request, jsonify
from db import query, execute
from config import QR_FOLDER, PROFESSOR_LIST

auth_bp = Blueprint("auth", __name__)
os.makedirs(QR_FOLDER, exist_ok=True)


def _generate_qr_b64(data: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=20, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _make_employee_id(professor_name: str, department: str) -> str:
    raw = f"{professor_name}|{department}"
    return "EMP-" + hashlib.md5(raw.encode()).hexdigest()[:8].upper()


# ─── STUDENT REGISTER ─────────────────────────────────────────────────────────
@auth_bp.route("/student/register", methods=["POST"])
def student_register():
    data = request.json or {}
    required = ["student_id", "full_name", "course", "year_level", "department", "pin"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing field: {field}"}), 400

    student_id = data["student_id"].strip()
    pin        = str(data["pin"]).strip()

    if len(pin) != 4 or not pin.isdigit():
        return jsonify({"error": "PIN must be exactly 4 digits."}), 400

    existing = query("SELECT id FROM students WHERE student_id=%s", (student_id,), fetchone=True)
    if existing:
        return jsonify({"error": "Student ID already registered."}), 409

    pin_hash = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    qr_b64   = _generate_qr_b64(student_id)
    execute(
        "INSERT INTO students (student_id, full_name, course, year_level, department, pin_hash) VALUES (%s,%s,%s,%s,%s,%s)",
        (student_id, data["full_name"].strip(), data["course"].strip(),
         data["year_level"].strip(), data["department"].strip(), pin_hash)
    )
    return jsonify({
        "message": "Registered successfully!",
        "student_id": student_id,
        "full_name": data["full_name"],
        "qr_base64": qr_b64
    }), 201


# ─── STUDENT FIND (step 1 of 2-step login) ───────────────────────────────────
@auth_bp.route("/student/find", methods=["POST"])
def student_find():
    data = request.json or {}
    student_id = (data.get("student_id") or "").strip()
    if not student_id:
        return jsonify({"error": "Student ID required"}), 400
    student = query("SELECT student_id, full_name, pin_hash FROM students WHERE student_id=%s", (student_id,), fetchone=True)
    if not student:
        return jsonify({"error": "Student not found. Please register first."}), 404
    return jsonify({
        "student_id": student["student_id"],
        "full_name":  student["full_name"],
        "has_pin":    bool(student.get("pin_hash"))
    })


# ─── STUDENT LOGIN ────────────────────────────────────────────────────────────
@auth_bp.route("/student/login", methods=["POST"])
def student_login():
    data = request.json or {}
    student_id = (data.get("student_id") or "").strip()
    pin        = str(data.get("pin") or "").strip()

    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    student = query("SELECT * FROM students WHERE student_id=%s", (student_id,), fetchone=True)
    if not student:
        return jsonify({"error": "Student not found. Please register first."}), 404

    # PIN verification — skip only if student has no PIN yet (legacy accounts)
    if student.get("pin_hash"):
        if not pin:
            return jsonify({"error": "PIN is required."}), 401
        if not bcrypt.checkpw(pin.encode(), student["pin_hash"].encode()):
            return jsonify({"error": "Incorrect PIN. Please try again."}), 401

    return jsonify({
        "message": "Login successful",
        "student": {
            "id":         student["id"],
            "student_id": student["student_id"],
            "full_name":  student["full_name"],
            "course":     student["course"],
            "year_level": student["year_level"],
            "department": student["department"],
            "photo":      student.get("photo")
        }
    })


# ─── TEACHER QUICK LOGIN (select name from list) ──────────────────────────────
@auth_bp.route("/teacher/quick-login", methods=["POST"])
def teacher_quick_login():
    try:
        data = request.json or {}
        professor_name = (data.get("professor_name") or "").strip()
        department     = (data.get("department") or "").strip()

        if not professor_name or not department:
            return jsonify({"error": "Professor name and department required"}), 400

        # Generate stable unique employee ID from name+dept
        employee_id = _make_employee_id(professor_name, department)

        # Check if already registered by employee_id
        existing = query(
            "SELECT employee_id FROM teacher_accounts WHERE employee_id=%s",
            (employee_id,), fetchone=True
        )

        if not existing:
            # Check if registered under same name+dept with a different ID
            existing_by_name = query(
                "SELECT employee_id FROM teacher_accounts WHERE professor_name=%s AND department=%s",
                (professor_name, department), fetchone=True
            )
            if existing_by_name:
                employee_id = existing_by_name["employee_id"]
            else:
                # Auto-register new teacher
                pw = bcrypt.hashpw(employee_id.encode(), bcrypt.gensalt()).decode()
                execute(
                    "INSERT INTO teacher_accounts (employee_id, professor_name, department, password_hash) VALUES (%s,%s,%s,%s)",
                    (employee_id, professor_name, department, pw)
                )
                execute(
                    "INSERT IGNORE INTO professors (name, department) VALUES (%s,%s)",
                    (professor_name, department)
                )

        qr_b64 = _generate_qr_b64(employee_id)

        return jsonify({
            "message": "QR generated successfully",
            "employee_id": employee_id,
            "professor_name": professor_name,
            "department": department,
            "qr_base64": qr_b64
        })

    except Exception as e:
        import traceback
        print("[ERROR] quick-login failed:", traceback.format_exc())
        return jsonify({"error": "Server error: " + str(e)}), 500


# ─── TEACHER QR LOGIN (scan saved QR) ────────────────────────────────────────
@auth_bp.route("/teacher/qr-login", methods=["POST"])
def teacher_qr_login():
    data = request.json or {}
    employee_id = (data.get("employee_id") or "").strip()

    if not employee_id:
        return jsonify({"error": "Employee ID required"}), 400

    teacher = query(
        "SELECT * FROM teacher_accounts WHERE employee_id=%s", (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "QR not recognized. Please select your name from the list first."}), 404

    return jsonify({
        "message": "Login successful",
        "teacher": {
            "id": teacher["id"],
            "employee_id": teacher["employee_id"],
            "professor_name": teacher["professor_name"],
            "department": teacher["department"],
            "photo": teacher.get("photo")
        }
    })


# ─── TEACHER REGISTER (legacy) ────────────────────────────────────────────────
@auth_bp.route("/teacher/register", methods=["POST"])
def teacher_register():
    data = request.json or {}
    required = ["employee_id", "professor_name", "department", "password"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing field: {field}"}), 400

    employee_id    = data["employee_id"].strip()
    professor_name = data["professor_name"].strip()
    department     = data["department"].strip()

    existing = query("SELECT id FROM teacher_accounts WHERE employee_id=%s", (employee_id,), fetchone=True)
    if existing:
        return jsonify({"error": "Employee ID already registered."}), 409

    pw_hash = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt()).decode()
    qr_b64  = _generate_qr_b64(employee_id)

    execute(
        "INSERT INTO teacher_accounts (employee_id, professor_name, department, password_hash) VALUES (%s,%s,%s,%s)",
        (employee_id, professor_name, department, pw_hash)
    )
    return jsonify({
        "message": "Teacher registered successfully!",
        "employee_id": employee_id,
        "professor_name": professor_name,
        "qr_base64": qr_b64
    }), 201


# ─── TEACHER LOGIN (legacy password) ─────────────────────────────────────────
@auth_bp.route("/teacher/login", methods=["POST"])
def teacher_login():
    data = request.json or {}
    employee_id = (data.get("employee_id") or "").strip()
    password    = data.get("password", "")

    if not employee_id:
        return jsonify({"error": "Employee ID required"}), 400

    teacher = query(
        "SELECT * FROM teacher_accounts WHERE employee_id=%s", (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "Employee ID not found."}), 404

    if not bcrypt.checkpw(password.encode(), teacher["password_hash"].encode()):
        return jsonify({"error": "Incorrect password."}), 401

    return jsonify({
        "message": "Login successful",
        "teacher": {
            "id": teacher["id"],
            "employee_id": teacher["employee_id"],
            "professor_name": teacher["professor_name"],
            "department": teacher["department"],
            "photo": teacher.get("photo")
        }
    })