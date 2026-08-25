import json
import pytz
import time as _time
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from db import query, execute
from config import PROFESSOR_LIST
from security import (
    require_role, subject, owns, forbid_unless_owner, is_admin,
    current_claims, record_audit,
)

teacher_bp = Blueprint("teacher", __name__)
PH = pytz.timezone("Asia/Manila")

# ── In-memory caches ──────────────────────────────────────────────────────────
_logs_cache     = {"data": None, "ts": 0, "photos": {}}
_LOGS_TTL       = 30  # seconds

_students_cache = {"data": None, "ts": 0, "key": ""}
_STUDENTS_TTL   = 30

_requests_cache = {"data": None, "ts": 0, "key": ""}
_REQUESTS_TTL   = 15


def _serialize_row(row):
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


def _with_photos(result):
    """Re-attach faculty photos to a cached, photo-free availability payload."""
    photos = _logs_cache.get("photos") or {}
    return [
        {**dept, "professors": [
            {**p, "photo": photos.get((p["name"], dept["department"]))}
            for p in dept["professors"]
        ]}
        for dept in result
    ]


DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
WORKING_START = "06:00"
WORKING_END   = "19:30"


def _to_bool(val):
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

    if log.get("manual"):
        return log.get("manual_status", "Unavailable")

    now_ph       = datetime.now(PH)
    current_time = now_ph.time()
    day_name     = now_ph.strftime("%A").lower()

    work_start = _parse_time(WORKING_START)
    work_end   = _parse_time(WORKING_END)
    if work_start and work_end:
        if not (work_start <= current_time <= work_end):
            return "Unavailable"

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
        # Support multiple slots
        slots = day_sched.get("slots") if isinstance(day_sched, dict) else None
        if slots:
            for slot in slots:
                start = _parse_time(slot.get("start"))
                end   = _parse_time(slot.get("end"))
                if start and end and start <= current_time <= end:
                    return "Available"
            return "Unavailable"
        # Legacy single slot
        start = _parse_time(day_sched.get("start"))
        end   = _parse_time(day_sched.get("end"))
        if start and end and start <= current_time <= end:
            return "Available"
        return "Unavailable"

    return "Unavailable"


# ─── TEACHER LOGS WITH CACHE ──────────────────────────────────────────────────

@teacher_bp.route("/teacher-logs", methods=["GET"])
def get_teacher_logs():
    """The public availability board. The kiosk reads this with no session.

    Faculty photos are personal data and used to be served to anyone who asked,
    so they are included only for authenticated callers. The cache therefore
    holds the anonymous (photo-free) shape, and the authenticated variant is
    built from the same rows on demand.
    """
    global _logs_cache
    authed = current_claims() is not None
    now = _time.time()
    if _logs_cache["data"] is not None and now - _logs_cache["ts"] < _LOGS_TTL:
        return jsonify(_with_photos(_logs_cache["data"]) if authed else _logs_cache["data"])

    merged = {dept: list(profs) for dept, profs in PROFESSOR_LIST.items()}
    db_accounts = query(
        "SELECT professor_name, department FROM teacher_accounts "
        "WHERE removed_at IS NULL ORDER BY department, professor_name",
        fetchall=True
    ) or []
    for row in db_accounts:
        dept, name = row["department"], row["professor_name"]
        if dept not in merged: merged[dept] = []
        if name not in merged[dept]: merged[dept].append(name)

    status_rows = query(
        """SELECT professor_name, department, manual, manual_status
           FROM teacher_logs WHERE action_type='manual_status'
           AND id IN (SELECT MAX(id) FROM teacher_logs WHERE action_type='manual_status'
                      GROUP BY professor_name, department)""",
        fetchall=True
    ) or []
    status_map = {(r["professor_name"], r["department"]): r for r in status_rows}

    sched_rows = query(
        """SELECT professor_name, department, weekly_schedule
           FROM teacher_logs WHERE action_type='schedule_update'
           AND id IN (SELECT MAX(id) FROM teacher_logs WHERE action_type='schedule_update'
                      GROUP BY professor_name, department)""",
        fetchall=True
    ) or []
    sched_map = {(r["professor_name"], r["department"]): r for r in sched_rows}

    photo_rows = query(
        "SELECT professor_name, department, photo FROM teacher_accounts WHERE removed_at IS NULL",
        fetchall=True
    ) or []
    photo_map = {(r["professor_name"], r["department"]): r.get("photo") for r in photo_rows}

    today_ph = datetime.now(PH).strftime("%Y-%m-%d")
    consumed_rows = query(
        """SELECT professor_name, COUNT(*) as cnt
           FROM consultation_requests
           WHERE status IN ('pending','done') AND request_time::date = %s::date
           GROUP BY professor_name""",
        (today_ph,), fetchall=True
    ) or []
    pending_map = {r["professor_name"]: r["cnt"] for r in consumed_rows}

    result = []
    for dept, profs in merged.items():
        dept_list = []
        for name in profs:
            key        = (name, dept)
            status_log = status_map.get(key)
            sched_log  = sched_map.get(key)
            combined   = {
                "manual":          _to_bool(status_log.get("manual")) if status_log else False,
                "manual_status":   status_log.get("manual_status") if status_log else None,
                "weekly_schedule": sched_log.get("weekly_schedule") if sched_log else None,
            }
            status = _compute_status(combined)
            weekly = combined["weekly_schedule"]
            if weekly:
                try: weekly = json.loads(weekly) if isinstance(weekly, str) else weekly
                except: weekly = None

            today_key = DAYS[datetime.now(PH).weekday()]
            day_limit = 0
            if weekly and isinstance(weekly, dict) and today_key in weekly:
                day_sched = weekly[today_key]
                if isinstance(day_sched, dict):
                    day_limit = day_sched.get("limit", 0) or 0

            consumed_today = pending_map.get(name, 0)
            slots_left = max(0, day_limit - consumed_today) if day_limit > 0 else None

            if day_limit > 0 and slots_left == 0 and status == "Available":
                status = "Unavailable"

            dept_list.append({
                "name": name, "department": dept, "status": status,
                "manual_status": combined["manual_status"],
                "manual": combined["manual"],
                "weekly_schedule": weekly,
                "consumed_today": consumed_today,
                "slots_left": slots_left,
                "day_limit": day_limit,
            })
        result.append({"department": dept, "professors": dept_list})

    # Cached without photos; _with_photos() re-attaches them for signed-in users.
    _logs_cache = {"data": result, "ts": now, "photos": photo_map}
    return jsonify(_with_photos(result) if authed else result)


# ─── RESET DAILY CONSULTATION COUNT ──────────────────────────────────────────

@teacher_bp.route("/teacher/reset-daily-count", methods=["POST"])
@require_role("teacher", "admin")
def reset_daily_count():
    global _logs_cache, _requests_cache, _students_cache
    # The account is the caller's own; an employee_id in the body is ignored.
    employee_id = subject()
    teacher = query(
        "SELECT professor_name FROM teacher_accounts WHERE employee_id=%s",
        (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404
    today_ph = datetime.now(PH).strftime("%Y-%m-%d")
    execute(
        """UPDATE consultation_requests
           SET status='archived'
           WHERE professor_name=%s AND status IN ('pending','done')
           AND request_time::date = %s::date""",
        (teacher["professor_name"], today_ph)
    )
    _logs_cache["ts"] = 0
    _requests_cache["ts"] = 0
    _students_cache["ts"] = 0
    return jsonify({"message": "Daily count reset. New session started."})


# ─── SAVE WEEKLY SCHEDULE ─────────────────────────────────────────────────────

@teacher_bp.route("/teacher/save-schedule", methods=["POST"])
@require_role("teacher", "admin")
def save_schedule():
    global _logs_cache
    data = request.json or {}
    employee_id     = subject()
    weekly_schedule = data.get("weekly_schedule")

    if not weekly_schedule:
        return jsonify({"error": "Missing weekly_schedule"}), 400

    teacher = query(
        "SELECT professor_name, department FROM teacher_accounts WHERE employee_id=%s",
        (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    now_ph = datetime.now(PH)
    execute(
        """INSERT INTO teacher_logs
           (professor_name, department, action_type, manual, weekly_schedule, log_time)
           VALUES (%s, %s, 'schedule_update', FALSE, %s::jsonb, %s::timestamp)""",
        (teacher["professor_name"], teacher["department"],
         json.dumps(weekly_schedule), now_ph.strftime("%Y-%m-%d %H:%M:%S"))
    )
    _logs_cache["ts"] = 0
    return jsonify({"message": "Schedule saved successfully"})


# ─── SAVE MANUAL STATUS ───────────────────────────────────────────────────────

@teacher_bp.route("/teacher/save-manual-status", methods=["POST"])
@require_role("teacher", "admin")
def save_manual_status():
    global _logs_cache
    data = request.json or {}
    employee_id   = subject()
    manual_status = data.get("manual_status")

    if not manual_status:
        return jsonify({"error": "Missing manual_status"}), 400

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
           (professor_name, department, action_type, manual, manual_status, log_time)
           VALUES (%s, %s, 'manual_status', %s, %s, %s::timestamp)""",
        (teacher["professor_name"], teacher["department"],
         is_manual,
         manual_status if is_manual else None,
         now_ph.strftime("%Y-%m-%d %H:%M:%S"))
    )
    _logs_cache["ts"] = 0
    return jsonify({"message": "Status updated"})


# ─── GET REQUESTS FOR TEACHER ─────────────────────────────────────────────────

@teacher_bp.route("/teacher/requests/<employee_id>", methods=["GET"])
@require_role("teacher", "admin")
def get_teacher_requests(employee_id):
    denied = forbid_unless_owner(employee_id)
    if denied:
        return denied
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
           WHERE cr.professor_name=%s AND cr.status='pending'
           ORDER BY cr.created_at DESC""",
        (teacher["professor_name"],), fetchall=True
    )
    return jsonify([_serialize_row(r) for r in (reqs or [])])


# ─── MARK REQUEST DONE ────────────────────────────────────────────────────────

def _own_request_or_error(req_id):
    """Load a consultation request, refusing one that belongs to someone else.

    Without this check any signed-in teacher could resolve any other teacher's
    requests just by guessing the row id, which is a small integer.
    """
    req = query(
        "SELECT id, professor_name FROM consultation_requests WHERE id=%s",
        (req_id,), fetchone=True
    )
    if not req:
        return None, (jsonify({"error": "Request not found"}), 404)
    if is_admin():
        return req, None
    me = query(
        "SELECT professor_name FROM teacher_accounts WHERE employee_id=%s",
        (subject(),), fetchone=True
    )
    if not me or me["professor_name"] != req["professor_name"]:
        return None, (jsonify({"error": "Not permitted."}), 403)
    return req, None


@teacher_bp.route("/teacher/requests/<int:req_id>/done", methods=["POST"])
@require_role("teacher", "admin")
def mark_done(req_id):
    global _logs_cache, _requests_cache
    _, denied = _own_request_or_error(req_id)
    if denied:
        return denied
    _logs_cache["ts"] = 0
    _requests_cache["ts"] = 0
    execute("UPDATE consultation_requests SET status='done' WHERE id=%s", (req_id,))
    return jsonify({"message": "Marked as done"})


# ─── DECLINE REQUEST ──────────────────────────────────────────────────────────

@teacher_bp.route("/teacher/requests/<int:req_id>/decline", methods=["POST"])
@require_role("teacher", "admin")
def decline_request(req_id):
    global _logs_cache, _requests_cache
    _, denied = _own_request_or_error(req_id)
    if denied:
        return denied
    _logs_cache["ts"] = 0
    _requests_cache["ts"] = 0
    execute("UPDATE consultation_requests SET status='declined' WHERE id=%s", (req_id,))
    return jsonify({"message": "Request declined"})


# ─── CLEAR ALL LOGS ───────────────────────────────────────────────────────────

@teacher_bp.route("/teacher/clear-logs", methods=["POST"])
@require_role("admin")
def clear_logs():
    """Delete every consultation request.

    This used to be unauthenticated *and* to delete teacher_logs as well, which
    is where saved schedules and status overrides live — so the dashboard's
    "Delete All" button quietly wiped every professor's schedule. It now touches
    consultation requests only. Prefer /api/admin/requests/archive, which is
    reversible; this stays for a genuine full reset.
    """
    global _logs_cache, _requests_cache, _students_cache
    total = query("SELECT COUNT(*) AS c FROM consultation_requests", fetchone=True)["c"]
    execute("DELETE FROM consultation_requests")
    _logs_cache["ts"] = 0
    _requests_cache["ts"] = 0
    _students_cache["ts"] = 0
    record_audit("admin.clear_requests", detail=f"{total} requests deleted")
    return jsonify({"message": f"{total} consultation requests deleted"})


# ─── DEAN: STUDENTS ───────────────────────────────────────────────────────────

@teacher_bp.route("/dean/students", methods=["GET"])
@require_role("admin")
def dean_get_students():
    global _students_cache
    page      = max(1, int(request.args.get("page", 1)))
    limit     = min(50, int(request.args.get("limit", 20)))
    search    = (request.args.get("search") or "").strip()
    cache_key = f"{page}:{limit}:{search}"
    now       = _time.time()
    if _students_cache["data"] is not None and now - _students_cache["ts"] < _STUDENTS_TTL and _students_cache["key"] == cache_key:
        return jsonify(_students_cache["data"])
    offset = (page - 1) * limit
    # Filtering happens in SQL. The dashboard used to filter the 20 rows it had
    # already loaded, so searching never looked past the current page.
    if search:
        like = f"%{search}%"
        rows = query(
            "SELECT * FROM students WHERE full_name ILIKE %s OR student_id ILIKE %s "
            "ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (like, like, limit, offset), fetchall=True
        )
        total = query(
            "SELECT COUNT(*) as c FROM students WHERE full_name ILIKE %s OR student_id ILIKE %s",
            (like, like), fetchone=True
        )["c"]
    else:
        rows  = query(
            "SELECT * FROM students ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (limit, offset), fetchall=True
        )
        total = query("SELECT COUNT(*) as c FROM students", fetchone=True)["c"]
    # SELECT * was handing every student's bcrypt hash to the dashboard. It is
    # a hash, not a password, but it has no business leaving the database — an
    # admin session that leaks should not also leak an offline cracking target.
    # The dashboard only needs to know whether a PIN exists.
    def _public(row):
        out = _serialize_row(row)
        out["has_pin"] = bool(out.pop("pin_hash", None))
        return out

    resp   = {
        "data":  [_public(r) for r in (rows or [])],
        "page":  page, "limit": limit, "total": total,
        "pages": -(-total // limit)
    }
    _students_cache = {"data": resp, "ts": now, "key": cache_key}
    return jsonify(resp)


# ─── DEAN: REQUESTS ───────────────────────────────────────────────────────────

@teacher_bp.route("/dean/requests", methods=["GET"])
@require_role("admin")
def dean_get_requests():
    global _requests_cache
    page       = max(1, int(request.args.get("page", 1)))
    limit      = min(50, int(request.args.get("limit", 20)))
    status     = (request.args.get("status") or "").strip()
    department = (request.args.get("department") or "").strip()
    search     = (request.args.get("search") or "").strip()
    date_from  = (request.args.get("from") or "").strip()
    date_to    = (request.args.get("to") or "").strip()
    cache_key  = f"{page}:{limit}:{status}:{department}:{search}:{date_from}:{date_to}"
    now        = _time.time()
    if _requests_cache["data"] is not None and now - _requests_cache["ts"] < _REQUESTS_TTL and _requests_cache["key"] == cache_key:
        return jsonify(_requests_cache["data"])
    offset = (page - 1) * limit

    # Filters are composed as parameterised fragments — never string-formatted
    # into the SQL — so the free-text search cannot reach the query structure.
    where, args = [], []
    if status:
        where.append("status = %s");     args.append(status)
    if department:
        where.append("department = %s"); args.append(department)
    if search:
        where.append("(student_name ILIKE %s OR professor_name ILIKE %s OR student_id ILIKE %s)")
        like = f"%{search}%"
        args += [like, like, like]
    if date_from:
        where.append("request_time >= %s::timestamp"); args.append(f"{date_from} 00:00:00")
    if date_to:
        where.append("request_time <= %s::timestamp"); args.append(f"{date_to} 23:59:59")
    clause = (" WHERE " + " AND ".join(where)) if where else ""

    rows  = query(
        f"SELECT * FROM consultation_requests{clause} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        tuple(args + [limit, offset]), fetchall=True
    )
    total = query(
        f"SELECT COUNT(*) as c FROM consultation_requests{clause}",
        tuple(args), fetchone=True
    )["c"]
    resp = {
        "data":  [_serialize_row(r) for r in (rows or [])],
        "page":  page, "limit": limit, "total": total,
        "pages": -(-total // limit)
    }
    _requests_cache = {"data": resp, "ts": now, "key": cache_key}
    return jsonify(resp)


# ─── DEAN: GET TEACHERS ───────────────────────────────────────────────────────

@teacher_bp.route("/dean/teachers", methods=["GET"])
@require_role("admin")
def dean_get_teachers():
    rows = query(
        "SELECT * FROM teacher_accounts WHERE removed_at IS NULL ORDER BY created_at DESC",
        fetchall=True)
    for r in (rows or []):
        r.pop("password_hash", None)
        r.pop("pin_hash", None)
    return jsonify([_serialize_row(r) for r in (rows or [])])


# ─── DEAN: ADD TEACHER ────────────────────────────────────────────────────────

@teacher_bp.route("/dean/add-teacher", methods=["POST"])
@require_role("admin")
def dean_add_teacher():
    global _students_cache
    data           = request.json or {}
    professor_name = (data.get("professor_name") or "").strip()
    department     = (data.get("department") or "").strip()

    if not professor_name or not department:
        return jsonify({"error": "Name and department are required"}), 400

    existing = query(
        "SELECT employee_id, removed_at FROM teacher_accounts "
        "WHERE professor_name=%s AND department=%s",
        (professor_name, department), fetchone=True
    )
    if existing and not existing.get("removed_at"):
        return jsonify({"error": f"{professor_name} already exists in {department}"}), 409
    if existing:
        # Someone removed and now being added back. Restoring beats refusing:
        # their employee ID is derived from name and department, so a fresh
        # insert would collide with the tombstone anyway. They come back with no
        # card and no PIN, exactly like a new account.
        execute(
            "UPDATE teacher_accounts SET removed_at=NULL, removed_reason=NULL, active=TRUE "
            "WHERE employee_id=%s",
            (existing["employee_id"],)
        )
        execute(
            "INSERT INTO professors (name, department) VALUES (%s, %s) "
            "ON CONFLICT (name, department) DO NOTHING",
            (professor_name, department)
        )
        _logs_cache["ts"] = 0
        return jsonify({
            "message":        f"{professor_name} restored.",
            "employee_id":    existing["employee_id"],
            "professor_name": professor_name,
            "department":     department,
        })

    # One definition of the ID, shared with the startup seeding.
    from models import make_employee_id, _UNUSABLE_PASSWORD
    employee_id = make_employee_id(professor_name, department)

    execute(
        """INSERT INTO teacher_accounts (employee_id, professor_name, department, password_hash)
           VALUES (%s, %s, %s, %s)""",
        (employee_id, professor_name, department, _UNUSABLE_PASSWORD)
    )
    _logs_cache["ts"] = 0
    record_audit("admin.add_teacher", target=employee_id,
                 detail=f"{professor_name} / {department}")
    return jsonify({
        "message": "Teacher added successfully",
        "employee_id": employee_id,
        "professor_name": professor_name,
        "department": department
    }), 201


# ─── UPDATE TEACHER NAME ──────────────────────────────────────────────────────

@teacher_bp.route("/teacher/update-name", methods=["POST"])
@require_role("teacher", "admin")
def update_teacher_name():
    global _logs_cache
    data = request.json or {}
    # Admins rename other people from the dashboard; a teacher renames only
    # themselves, so a body-supplied id is honoured for admins alone.
    employee_id = (data.get("employee_id") or "").strip() if is_admin() else subject()
    new_name    = (data.get("new_name") or "").strip()

    if not employee_id or not new_name:
        return jsonify({"error": "Missing employee_id or new_name"}), 400

    teacher = query(
        "SELECT * FROM teacher_accounts WHERE employee_id=%s",
        (employee_id,), fetchone=True
    )
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    execute("UPDATE teacher_accounts SET professor_name=%s WHERE employee_id=%s", (new_name, employee_id))
    execute("UPDATE teacher_logs SET professor_name=%s WHERE professor_name=%s AND department=%s",
            (new_name, teacher["professor_name"], teacher["department"]))
    execute("UPDATE consultation_requests SET professor_name=%s WHERE professor_name=%s",
            (new_name, teacher["professor_name"]))
    _logs_cache["ts"] = 0
    record_audit("teacher.rename", target=employee_id,
                 detail=f'{teacher["professor_name"]} -> {new_name}')
    return jsonify({
        "message": "Name updated successfully",
        "new_name": new_name,
        "employee_id": employee_id,
        "department": teacher["department"]
    })


# ─── TEACHER PROFILE PHOTO ────────────────────────────────────────────────────

@teacher_bp.route("/teacher/update-photo", methods=["POST"])
@require_role("teacher", "admin")
def update_teacher_photo():
    data = request.json or {}
    employee_id = subject()
    photo       = data.get("photo")
    if not photo:
        return jsonify({"error": "Missing photo"}), 400
    execute("UPDATE teacher_accounts SET photo=%s WHERE employee_id=%s", (photo, employee_id))
    return jsonify({"message": "Photo updated"})


@teacher_bp.route("/teacher/profile/<employee_id>", methods=["GET"])
@require_role("teacher", "admin")
def get_teacher_profile(employee_id):
    denied = forbid_unless_owner(employee_id)
    if denied:
        return denied
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
        "photo": teacher.get("photo"),
        "has_pin": bool(teacher.get("pin_hash")),
    })


# ─── APPOINTMENT SCHEDULING ───────────────────────────────────────────────────

@teacher_bp.route("/teacher/requests/<int:req_id>/appoint", methods=["POST"])
@require_role("teacher", "admin")
def set_appointment(req_id):
    global _requests_cache
    _, denied = _own_request_or_error(req_id)
    if denied:
        return denied
    data = request.json or {}
    appt_date  = data.get("appointment_date")
    appt_time  = data.get("appointment_time")
    appt_notes = data.get("appointment_notes", "")

    if not appt_date or not appt_time:
        return jsonify({"error": "Date and time required"}), 400

    now_ph = datetime.now(PH)
    execute(
        """UPDATE consultation_requests
           SET appointment_date=%s::date, appointment_time=%s, appointment_notes=%s,
               appointment_set_at=%s::timestamp, status='pending'
           WHERE id=%s""",
        (appt_date, appt_time, appt_notes,
         now_ph.strftime("%Y-%m-%d %H:%M:%S"), req_id)
    )
    _requests_cache["ts"] = 0
    return jsonify({"message": "Appointment set successfully"})
