import pytz
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from db import query, execute

student_bp = Blueprint("student", __name__)
PH = pytz.timezone("Asia/Manila")


def _serialize_row(row):
    """Convert date/datetime/timedelta values to JSON-safe strings."""
    if not row:
        return row
    result = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            result[k] = v.strftime("%Y-%m-%d %H:%M:%S")
        elif isinstance(v, date):
            result[k] = v.isoformat()
        elif isinstance(v, timedelta):
            total = int(v.total_seconds())
            h, rem = divmod(total, 3600)
            m, s   = divmod(rem, 60)
            result[k] = f"{h:02}:{m:02}:{s:02}"
        else:
            result[k] = v
    return result


@student_bp.route("/consultation/request", methods=["POST"])
def submit_request():
    data = request.json or {}
    required = ["student_id", "student_name", "course", "professor_name", "purpose", "category", "department"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"Missing: {f}"}), 400

    now_ph = datetime.now(PH)

    # Duplicate prevention — 5-second window
    five_sec_ago = (now_ph - timedelta(seconds=5)).strftime("%Y-%m-%d %H:%M:%S")
    dup = query(
        """SELECT id FROM consultation_requests
           WHERE student_id=%s AND professor_name=%s AND created_at > %s""",
        (data["student_id"], data["professor_name"], five_sec_ago), fetchone=True
    )
    if dup:
        return jsonify({"error": "Duplicate request — please wait a moment."}), 429

    prof = query(
        "SELECT id FROM professors WHERE name=%s AND department=%s",
        (data["professor_name"], data["department"]), fetchone=True
    )
    prof_id = prof["id"] if prof else None

    execute(
        """INSERT INTO consultation_requests
           (student_id, student_name, course, professor_name, professor_id,
            purpose, category, status, request_time, department)
           VALUES (%s,%s,%s,%s,%s,%s,%s,'pending',%s,%s)""",
        (data["student_id"], data["student_name"], data["course"],
         data["professor_name"], prof_id,
         data["purpose"], data["category"],
         now_ph.strftime("%Y-%m-%d %H:%M:%S"), data["department"])
    )

    return jsonify({"message": "Consultation request submitted!"}), 201


@student_bp.route("/consultation/history/<student_id>", methods=["GET"])
def get_history(student_id):
    page   = max(1, int(request.args.get("page", 1)))
    limit  = min(50, int(request.args.get("limit", 10)))
    offset = (page - 1) * limit
    rows   = query(
        "SELECT * FROM consultation_requests WHERE student_id=%s ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (student_id, limit, offset), fetchall=True
    )
    total  = query(
        "SELECT COUNT(*) as c FROM consultation_requests WHERE student_id=%s",
        (student_id,), fetchone=True
    )["c"]
    return jsonify({
        "data":  [_serialize_row(r) for r in (rows or [])],
        "page":  page,
        "limit": limit,
        "total": total,
        "pages": -(-total // limit)
    })


@student_bp.route("/student/update-profile", methods=["POST"])
def update_student_profile():
    data = request.json or {}
    student_id = (data.get("student_id") or "").strip()
    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    student = query("SELECT * FROM students WHERE student_id=%s", (student_id,), fetchone=True)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    full_name  = (data.get("full_name") or student["full_name"]).strip()
    course     = (data.get("course") or student["course"]).strip()
    year_level = (data.get("year_level") or student["year_level"]).strip()
    department = (data.get("department") or student["department"]).strip()
    photo      = data.get("photo")

    if photo:
        execute(
            "UPDATE students SET full_name=%s, course=%s, year_level=%s, department=%s, photo=%s WHERE student_id=%s",
            (full_name, course, year_level, department, photo, student_id)
        )
    else:
        execute(
            "UPDATE students SET full_name=%s, course=%s, year_level=%s, department=%s WHERE student_id=%s",
            (full_name, course, year_level, department, student_id)
        )

    updated = query("SELECT * FROM students WHERE student_id=%s", (student_id,), fetchone=True)
    return jsonify({
        "message": "Profile updated successfully",
        "student": {
            "id": updated["id"],
            "student_id": updated["student_id"],
            "full_name": updated["full_name"],
            "course": updated["course"],
            "year_level": updated["year_level"],
            "department": updated["department"],
            "photo": updated.get("photo")
        }
    })


@student_bp.route("/student/profile/<student_id>", methods=["GET"])
def get_student_profile(student_id):
    student = query("SELECT * FROM students WHERE student_id=%s", (student_id,), fetchone=True)
    if not student:
        return jsonify({"error": "Student not found"}), 404
    return jsonify({
        "student_id": student["student_id"],
        "full_name":  student["full_name"],
        "course":     student["course"],
        "year_level": student["year_level"],
        "department": student["department"],
        "photo":      student.get("photo"),
        "has_pin":    bool(student.get("pin_hash"))
    })


@student_bp.route("/student/set-pin", methods=["POST"])
def set_student_pin():
    import bcrypt
    data       = request.json or {}
    student_id = (data.get("student_id") or "").strip()
    pin        = str(data.get("pin") or "").strip()

    if not student_id:
        return jsonify({"error": "Student ID required"}), 400
    if len(pin) != 4 or not pin.isdigit():
        return jsonify({"error": "PIN must be exactly 4 digits."}), 400

    student = query("SELECT id FROM students WHERE student_id=%s", (student_id,), fetchone=True)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    pin_hash = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    execute("UPDATE students SET pin_hash=%s WHERE student_id=%s", (pin_hash, student_id))
    return jsonify({"message": "PIN set successfully"})