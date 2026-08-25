import pytz
from datetime import datetime, date, timedelta, timezone
from flask import Blueprint, request, jsonify
from db import query, execute
from security import require_role, subject, forbid_unless_owner, is_admin

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
@require_role("student")
def submit_request():
    """File a consultation request as the signed-in student.

    The requester's identity comes from the session token. Previously the
    student_id and student_name were read from the request body, so anyone
    could file requests in another student's name.
    """
    data = request.json or {}
    for f in ("professor_name", "purpose", "category", "department"):
        if not data.get(f):
            return jsonify({"error": f"Missing: {f}"}), 400

    me = query("SELECT * FROM students WHERE student_id=%s", (subject(),), fetchone=True)
    if not me:
        return jsonify({"error": "Student not found"}), 404

    student_id   = me["student_id"]
    student_name = me["full_name"]
    course       = me["course"] or data.get("course") or ""
    now_ph = datetime.now(PH)

    # Check if student already has a pending/active request to this professor
    existing = query(
        """SELECT id FROM consultation_requests
           WHERE student_id=%s AND professor_name=%s AND status='pending'""",
        (student_id, data["professor_name"]), fetchone=True
    )
    if existing:
        return jsonify({"error": "You already have a pending consultation request with this professor. Please wait for it to be resolved first."}), 429

    # Spam prevention — 3-second window.
    # created_at is written by the database clock in UTC, so the cutoff has to
    # be UTC too. Deriving it from Manila time put it 8 hours in the future,
    # which meant this guard never matched anything.
    three_sec_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=3)
    dup = query(
        """SELECT id FROM consultation_requests
           WHERE student_id=%s AND created_at > %s::timestamp""",
        (student_id, three_sec_ago), fetchone=True
    )
    if dup:
        return jsonify({"error": "Please wait a moment before submitting another request."}), 429

    prof = query(
        "SELECT id FROM professors WHERE name=%s AND department=%s",
        (data["professor_name"], data["department"]), fetchone=True
    )
    prof_id = prof["id"] if prof else None

    execute(
        """INSERT INTO consultation_requests
           (student_id, student_name, course, professor_name, professor_id,
            purpose, category, status, request_time, department)
           VALUES (%s,%s,%s,%s,%s,%s,%s,'pending',%s::timestamp,%s)""",
        (student_id, student_name, course,
         data["professor_name"], prof_id,
         data["purpose"], data["category"],
         now_ph.strftime("%Y-%m-%d %H:%M:%S"), data["department"])
    )

    return jsonify({"message": "Consultation request submitted!"}), 201


@student_bp.route("/consultation/history/<student_id>", methods=["GET"])
@require_role("student", "admin")
def get_history(student_id):
    denied = forbid_unless_owner(student_id)
    if denied:
        return denied
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
        "page":  page, "limit": limit, "total": total,
        "pages": -(-total // limit)
    })


@student_bp.route("/student/update-profile", methods=["POST"])
@require_role("student", "admin")
def update_student_profile():
    data = request.json or {}
    student_id = subject()
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
@require_role("student", "admin")
def get_student_profile(student_id):
    denied = forbid_unless_owner(student_id)
    if denied:
        return denied
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
