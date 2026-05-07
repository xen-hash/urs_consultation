import json
import pytz
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from db import query, execute
from config import PROFESSOR_LIST

teacher_bp = Blueprint("teacher", __name__)
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
            # MySQL TIME columns come back as timedelta
            total = int(v.total_seconds())
            h, rem = divmod(total, 3600)
            m, s   = divmod(rem, 60)
            result[k] = f"{h:02}:{m:02}:{s:02}"
        else:
            result[k] = v
    return result


DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
WORKING_START = "06:00"
WORKING_END   = "19:30"


def _to_bool(val):
    """
    Safely convert MySQL manual flag to Python bool.
    MySQL BIT(1) returns bytes — b'\x00' is truthy in Python,
    so we must convert properly: b'\x00' → False, b'\x01' → True.
    Also handles int, bool, and None.
    """
    if val is None:
        return False
    if isinstance(val, (bytes, bytearray)):
        return int.from_bytes(val, "big") != 0
    return bool(val)


def _parse_time(t_str):
    if not t_str:
        return None
    t_str = t_str.strip()
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(t_str, fmt).time()
        except ValueError:
            pass
    return None


def _compute_status(log):
    if log is None:
        return "Unavailable"

    # 1. Manual override is HIGHEST priority — beats working hours
    if log.get("manual"):
        return log.get("manual_status", "Unavailable")

    # 2. Working hours gate (only for schedule-based status)
    now_ph       = datetime.now(PH)
    current_time = now_ph.time()
    day_name     = now_ph.strftime("%A").lower()

    work_start = _parse_time(WORKING_START)
    work_end   = _parse_time(WORKING_END)
    if work_start and work_end:
        if not (work_start <= current_time <= work_end):
            return "Unavailable"

    # Weekly schedule
    weekly = log.get("weekly_schedule")
    if isinstance(weekly, str):
        try:
            weekly = json.loads(weekly)
        except Exception:
            weekly = None

    if weekly and day_name in weekly:
        day_sched = weekly[day_name]
        if not day_sched or day_sched.get("unavailable"):
            return "Unavailable"
        start = _parse_time(day_sched.get("start"))
        end   = _parse_time(day_sched.get("end"))
        if start and end and start <= current_time <= end:
            return "Available"
        return "Unavailable"

    # Fallback
    return "Unavailable"


# ─── GET ALL PROFESSORS WITH STATUS ──────────────────────────────────────────

@teacher_bp.route("/teacher-logs", methods=["GET"])
def get_teacher_logs():
    # Keep PROFESSOR_LIST as the base, only append DB-added teachers not already in it
    merged = {dept: list(profs) for dept, profs in PROFESSOR_LIST.items()}
    db_accounts = query(
        "SELECT professor_name, department FROM teacher_accounts ORDER BY department, professor_name",
        fetchall=True
    ) or []
    for row in db_accounts:
        dept = row["department"]
        name = row["professor_name"]
        if dept not in merged:
            merged[dept] = []
        if name not in merged[dept]:
            merged[dept].append(name)

    # ── Pre-fetch all profile photos in one query (avoids N+1) ───────────────
    photo_rows = query(
        "SELECT professor_name, department, photo FROM teacher_accounts",
        fetchall=True
    ) or []
    photo_map = {
        (r["professor_name"], r["department"]): r.get("photo")
        for r in photo_rows
    }

    result = []
    for dept, profs in merged.items():
        dept_list = []
        for name in profs:
            status_log = query(
                """SELECT `manual`, manual_status FROM teacher_logs
                   WHERE professor_name=%s AND department=%s
                   AND action_type='manual_status'
                   ORDER BY id DESC LIMIT 1""",
                (name, dept), fetchone=True
            )
            schedule_log = query(
                """SELECT weekly_schedule FROM teacher_logs
                   WHERE professor_name=%s AND department=%s
                   AND action_type='schedule_update'
                   ORDER BY id DESC LIMIT 1""",
                (name, dept), fetchone=True
            )
            combined = {
                "manual":          _to_bool(status_log.get("manual")) if status_log else False,
                "manual_status":   status_log.get("manual_status") if status_log else None,
                "weekly_schedule": schedule_log.get("weekly_schedule") if schedule_log else None
            }
            status = _compute_status(combined)
            weekly = combined["weekly_schedule"]
            if weekly:
                try:
                    weekly = json.loads(weekly) if isinstance(weekly, str) else weekly
                except Exception:
                    weekly = None
            dept_list.append({
                "name":          name,
                "department":    dept,
                "status":        status,
                "manual_status": combined["manual_status"],
                "manual":        combined["manual"],
                "weekly_schedule": weekly,
                "photo":         photo_map.get((name, dept)),   # ← profile photo
            })
        result.append({"department": dept, "professors": dept_list})
    return jsonify(result)


# ─── SAVE WEEKLY SCHEDULE ─────────────────────────────────────────────────────

@teacher_bp.route("/teacher/save-schedule", methods=["POST"])
def save_schedule():
    data = request.json or {}
    employee_id     = data.get("employee_id")
    weekly_schedule = data.get("weekly_schedule")

    if not employee_id or not weekly_schedule:
        return jsonify({"error": "Missing employee_id or weekly_schedule"}), 400

    teacher = query(
        "SELECT professor_name, department FROM teacher_accounts WHERE employee_id=%s",
        (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    now_ph = datetime.now(PH)
    execute(
        """INSERT INTO teacher_logs
           (professor_name, department, action_type, `manual`, weekly_schedule, log_time)
           VALUES (%s, %s, 'schedule_update', 0, %s, %s)""",
        (teacher["professor_name"], teacher["department"],
         json.dumps(weekly_schedule), now_ph.strftime("%Y-%m-%d %H:%M:%S"))
    )
    return jsonify({"message": "Schedule saved successfully"})


# ─── SAVE MANUAL STATUS ───────────────────────────────────────────────────────

@teacher_bp.route("/teacher/save-manual-status", methods=["POST"])
def save_manual_status():
    data = request.json or {}
    employee_id   = data.get("employee_id")
    manual_status = data.get("manual_status")

    if not employee_id or not manual_status:
        return jsonify({"error": "Missing fields"}), 400

    teacher = query(
        "SELECT professor_name, department FROM teacher_accounts WHERE employee_id=%s",
        (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    now_ph    = datetime.now(PH)
    is_manual = manual_status.lower() != "auto (use schedule)"

    execute(
        """INSERT INTO teacher_logs
           (professor_name, department, action_type, `manual`, manual_status, log_time)
           VALUES (%s, %s, 'manual_status', %s, %s, %s)""",
        (teacher["professor_name"], teacher["department"],
         1 if is_manual else 0,
         manual_status if is_manual else None,
         now_ph.strftime("%Y-%m-%d %H:%M:%S"))
    )
    return jsonify({"message": "Status updated"})


# ─── GET REQUESTS FOR TEACHER ────────────────────────────────────────────────

@teacher_bp.route("/teacher/requests/<employee_id>", methods=["GET"])
def get_teacher_requests(employee_id):
    teacher = query(
        "SELECT professor_name, department FROM teacher_accounts WHERE employee_id=%s",
        (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    reqs = query(
        """SELECT cr.*, s.photo AS student_photo
           FROM consultation_requests cr
           LEFT JOIN students s ON cr.student_id = s.student_id
           WHERE cr.professor_name=%s AND cr.`status`='pending'
           ORDER BY cr.created_at DESC""",
        (teacher["professor_name"],), fetchall=True
    )
    return jsonify([_serialize_row(r) for r in (reqs or [])])


# ─── MARK REQUEST DONE ────────────────────────────────────────────────────────

@teacher_bp.route("/teacher/requests/<int:req_id>/done", methods=["POST"])
def mark_done(req_id):
    execute("UPDATE consultation_requests SET `status`='done' WHERE id=%s", (req_id,))
    return jsonify({"message": "Marked as done"})


# ─── DECLINE REQUEST ──────────────────────────────────────────────────────────

@teacher_bp.route("/teacher/requests/<int:req_id>/decline", methods=["POST"])
def decline_request(req_id):
    execute("UPDATE consultation_requests SET `status`='declined' WHERE id=%s", (req_id,))
    return jsonify({"message": "Request declined"})


# ─── CLEAR ALL LOGS ───────────────────────────────────────────────────────────

@teacher_bp.route("/teacher/clear-logs", methods=["POST"])
def clear_logs():
    execute("DELETE FROM teacher_logs")
    execute("DELETE FROM consultation_requests")
    return jsonify({"message": "All logs cleared"})


# ─── DEAN ENDPOINTS ───────────────────────────────────────────────────────────

@teacher_bp.route("/dean/students", methods=["GET"])
def dean_get_students():
    rows = query("SELECT * FROM students ORDER BY created_at DESC", fetchall=True)
    return jsonify([_serialize_row(r) for r in (rows or [])])


@teacher_bp.route("/dean/requests", methods=["GET"])
def dean_get_requests():
    rows = query("SELECT * FROM consultation_requests ORDER BY created_at DESC", fetchall=True)
    return jsonify([_serialize_row(r) for r in (rows or [])])


@teacher_bp.route("/dean/teachers", methods=["GET"])
def dean_get_teachers():
    rows = query("SELECT * FROM teacher_accounts ORDER BY created_at DESC", fetchall=True)
    for r in (rows or []):
        r.pop("password_hash", None)
    return jsonify([_serialize_row(r) for r in (rows or [])])


@teacher_bp.route("/dean/add-teacher", methods=["POST"])
def dean_add_teacher():
    data           = request.json or {}
    professor_name = (data.get("professor_name") or "").strip()
    department     = (data.get("department") or "").strip()

    if not professor_name or not department:
        return jsonify({"error": "Name and department are required"}), 400

    existing = query(
        "SELECT employee_id FROM teacher_accounts WHERE professor_name=%s AND department=%s",
        (professor_name, department), fetchone=True
    )
    if existing:
        return jsonify({"error": f"{professor_name} already exists in {department}"}), 409

    import uuid
    employee_id = "EMP-" + uuid.uuid4().hex[:8].upper()

    execute(
        """INSERT INTO teacher_accounts (employee_id, professor_name, department)
           VALUES (%s, %s, %s)""",
        (employee_id, professor_name, department)
    )
    return jsonify({
        "message": "Teacher added successfully",
        "employee_id": employee_id,
        "professor_name": professor_name,
        "department": department
    }), 201


# ─── UPDATE TEACHER NAME ──────────────────────────────────────────────────────

@teacher_bp.route("/teacher/update-name", methods=["POST"])
def update_teacher_name():
    data = request.json or {}
    employee_id = data.get("employee_id")
    new_name    = (data.get("new_name") or "").strip()

    if not employee_id or not new_name:
        return jsonify({"error": "Missing employee_id or new_name"}), 400

    teacher = query(
        "SELECT * FROM teacher_accounts WHERE employee_id=%s",
        (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    execute(
        "UPDATE teacher_accounts SET professor_name=%s WHERE employee_id=%s",
        (new_name, employee_id)
    )
    execute(
        "UPDATE teacher_logs SET professor_name=%s WHERE professor_name=%s AND department=%s",
        (new_name, teacher["professor_name"], teacher["department"])
    )
    execute(
        "UPDATE consultation_requests SET professor_name=%s WHERE professor_name=%s",
        (new_name, teacher["professor_name"])
    )
    return jsonify({
        "message": "Name updated successfully",
        "new_name": new_name,
        "employee_id": employee_id,
        "department": teacher["department"]
    })


# ─── TEACHER PROFILE PHOTO ────────────────────────────────────────────────────

@teacher_bp.route("/teacher/update-photo", methods=["POST"])
def update_teacher_photo():
    data = request.json or {}
    employee_id = (data.get("employee_id") or "").strip()
    photo       = data.get("photo")
    if not employee_id or not photo:
        return jsonify({"error": "Missing employee_id or photo"}), 400
    execute("UPDATE teacher_accounts SET photo=%s WHERE employee_id=%s", (photo, employee_id))
    return jsonify({"message": "Photo updated"})


@teacher_bp.route("/teacher/profile/<employee_id>", methods=["GET"])
def get_teacher_profile(employee_id):
    teacher = query(
        "SELECT * FROM teacher_accounts WHERE employee_id=%s",
        (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404
    return jsonify({
        "employee_id": teacher["employee_id"],
        "professor_name": teacher["professor_name"],
        "department": teacher["department"],
        "photo": teacher.get("photo")
    })


# ─── APPOINTMENT SCHEDULING ───────────────────────────────────────────────────

@teacher_bp.route("/teacher/requests/<int:req_id>/appoint", methods=["POST"])
def set_appointment(req_id):
    data = request.json or {}
    appt_date  = data.get("appointment_date")
    appt_time  = data.get("appointment_time")
    appt_notes = data.get("appointment_notes", "")

    if not appt_date or not appt_time:
        return jsonify({"error": "Date and time required"}), 400

    now_ph = datetime.now(PH)
    execute(
        """UPDATE consultation_requests
           SET appointment_date=%s, appointment_time=%s, appointment_notes=%s,
               appointment_set_at=%s, `status`='pending'
           WHERE id=%s""",
        (appt_date, appt_time, appt_notes,
         now_ph.strftime("%Y-%m-%d %H:%M:%S"), req_id)
    )
    return jsonify({"message": "Appointment set successfully"})