import json
import pytz
import time as _time
from datetime import datetime
from flask import Blueprint, request, jsonify
from db import query, execute
from config import PROFESSOR_LIST
from security import (
    require_role, subject, forbid_unless_owner, is_admin,
    current_claims, record_audit,
)
from phtime import serialize_row

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
    """Row out with Manila-offset timestamps — see phtime for the two clocks."""
    return serialize_row(row)


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


def _parse_weekly(raw):
    """A weekly_schedule column as a dict. JSONB may arrive decoded or as text."""
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return None
    return raw if isinstance(raw, dict) else None


def _latest_log(professor_name, department, action_type):
    """The state one teacher_logs action currently carries for one teacher.

    teacher_logs is append-only, so "current" is the newest row for that
    (name, department, action_type). get_teacher_logs does the same thing in
    bulk with a MAX(id) group-by; this is the single-teacher form of it.
    """
    return query(
        """SELECT manual, manual_status, weekly_schedule
           FROM teacher_logs
           WHERE professor_name=%s AND department=%s AND action_type=%s
           ORDER BY id DESC LIMIT 1""",
        (professor_name, department, action_type), fetchone=True
    )


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

    weekly = _parse_weekly(log.get("weekly_schedule"))

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
        "SELECT professor_name, department, photo, daily_limit FROM teacher_accounts "
        "WHERE removed_at IS NULL",
        fetchall=True
    ) or []
    photo_map = {(r["professor_name"], r["department"]): r.get("photo") for r in photo_rows}
    limit_map = {(r["professor_name"], r["department"]): (r.get("daily_limit") or 0)
                 for r in photo_rows}

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

            # The teacher's own cap wins over the schedule's. It is the number
            # they set on their dashboard for today, and it used to live only in
            # that browser — the board never knew about it, so a professor who
            # had taken all they could still showed as free.
            own_limit = limit_map.get(key, 0)
            if own_limit > 0:
                day_limit = own_limit

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


# ─── DAILY LIMIT ──────────────────────────────────────────────────────────────

@teacher_bp.route("/teacher/daily-limit", methods=["POST"])
@require_role("teacher", "admin")
def save_daily_limit():
    """How many consultations this teacher will take in a day.

    Theirs to set, and freely: it is a statement about their own day, not a
    policy anyone else administers. Acts on the caller's own account — the
    employee id comes from the session, never from the body.

    0 means "no cap of my own", in which case the per-day figure in the weekly
    schedule applies as before. Anything above it is refused rather than
    silently clamped, so a typo is visible instead of quietly becoming a
    different number.
    """
    global _logs_cache
    raw = (request.json or {}).get("daily_limit")
    try:
        limit = int(raw)
    except (TypeError, ValueError):
        return jsonify({"error": "Give a whole number."}), 400
    if limit < 0 or limit > 100:
        return jsonify({"error": "Choose a number between 0 and 100."}), 400

    execute("UPDATE teacher_accounts SET daily_limit=%s WHERE employee_id=%s",
            (limit, subject()))
    # The board reads through a short-lived cache; drop it so the new cap shows
    # in everyone's slots-left straight away.
    _logs_cache["ts"] = 0

    return jsonify({
        "message": f"You will take up to {limit} consultation(s) a day."
                   if limit else "Daily limit removed — your schedule decides.",
        "daily_limit": limit,
    })


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


# ─── DELETE ONE REQUEST ───────────────────────────────────────────────────────

@teacher_bp.route("/teacher/requests/<int:req_id>", methods=["DELETE"])
@require_role("teacher", "admin")
def delete_request(req_id):
    """Delete a consultation request outright, freeing the row.

    Marking one done keeps it — which is right, it is a record of a consultation
    that happened. This is for the rows that are not records of anything: a
    duplicate a student filed three times because the page was slow, a test
    entry, an obvious mistake. Those accumulate, and a teacher who cannot clear
    them ends up scrolling past the same junk for a semester.

    Ownership is checked the same way as marking one done, so a teacher can only
    delete their own; an administrator can delete any. It is written to the
    audit log with the student and professor names, because unlike a status
    change this one cannot be looked at afterwards.
    """
    global _logs_cache, _requests_cache
    req, denied = _own_request_or_error(req_id)
    if denied:
        return denied

    full = query(
        "SELECT student_name, student_id, professor_name, status, purpose "
        "FROM consultation_requests WHERE id=%s",
        (req_id,), fetchone=True
    ) or {}

    execute("DELETE FROM consultation_requests WHERE id=%s", (req_id,))
    record_audit(
        "request.delete", target=str(req_id),
        detail=f"{full.get('student_name') or 'unknown student'} → "
               f"{full.get('professor_name') or 'unknown'} ({full.get('status')})"
    )
    _logs_cache["ts"] = 0
    _requests_cache["ts"] = 0
    return jsonify({"message": "Request deleted."})


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
    # Emptying the table frees nothing on its own — the rows are only marked
    # dead. This hands the space back for reuse now rather than whenever
    # autovacuum next looks.
    import storage
    storage.vacuum("consultation_requests")
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
        out["verified"] = bool(out.get("verified"))
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
    """Register a faculty member.

    Identity is more than a name here. Two professors can share one, and the
    employee ID is derived from name and department — so on the old version a
    second J. Santos in the same department silently collided with the first,
    and re-adding a name that had been removed silently brought the removed
    account back, card history and all. Both are now refused with an
    explanation, and a restore has to be asked for by name.

    Email and staff number are the fields that actually tell two people apart,
    so they are required; position is what an administrator recognises someone
    by on a roster of forty, so it is asked for too.
    """
    global _students_cache
    data           = request.json or {}
    professor_name = (data.get("professor_name") or "").strip()
    department     = (data.get("department") or "").strip()
    email          = (data.get("email") or "").strip().lower()
    position       = (data.get("position") or "").strip()
    staff_no       = (data.get("staff_no") or "").strip().upper()
    restore        = bool(data.get("restore"))

    if not professor_name or not department:
        return jsonify({"error": "Name and department are required."}), 400
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"error": "A valid work email address is required."}), 400
    if not staff_no:
        return jsonify({"error": "A staff or employee number is required."}), 400

    # Email and staff number are unique across the whole roster, not just within
    # a department — the same person cannot hold two accounts by moving.
    for column, value, label in (("email", email, "email address"),
                                 ("staff_no", staff_no, "staff number")):
        clash = query(
            f"SELECT professor_name, department, removed_at FROM teacher_accounts "
            f"WHERE LOWER({column})=LOWER(%s)",
            (value,), fetchone=True
        )
        if clash and not clash.get("removed_at"):
            return jsonify({
                "error": f"That {label} already belongs to {clash['professor_name']} "
                         f"({clash['department']})."
            }), 409

    existing = query(
        "SELECT employee_id, removed_at, removed_reason FROM teacher_accounts "
        "WHERE professor_name=%s AND department=%s",
        (professor_name, department), fetchone=True
    )
    if existing and not existing.get("removed_at"):
        return jsonify({
            "error": f"{professor_name} already exists in {department}. If this is a "
                     f"different person with the same name, add their middle initial "
                     f"so the two can be told apart."
        }), 409

    if existing and not restore:
        # The account was removed on purpose. Bringing it back on a name match
        # alone is how a removed professor reappeared with their old history
        # attached — so say who it was and make the choice explicit.
        when = existing["removed_at"]
        when = when.strftime("%d %b %Y") if hasattr(when, "strftime") else str(when)[:10]
        return jsonify({
            "error": f"{professor_name} was removed from {department} on {when}"
                     + (f" — \"{existing['removed_reason']}\"." if existing.get("removed_reason") else ".")
                     + " Restore that account, or use a different name if this is someone else.",
            "removed_account": {
                "employee_id":    existing["employee_id"],
                "professor_name": professor_name,
                "department":     department,
                "removed_at":     when,
                "removed_reason": existing.get("removed_reason"),
            },
        }), 409

    if existing and restore:
        execute(
            "UPDATE teacher_accounts SET removed_at=NULL, removed_reason=NULL, active=TRUE, "
            "email=%s, position=%s, staff_no=%s WHERE employee_id=%s",
            (email, position or None, staff_no, existing["employee_id"])
        )
        execute(
            "INSERT INTO professors (name, department) VALUES (%s, %s) "
            "ON CONFLICT (name, department) DO NOTHING",
            (professor_name, department)
        )
        _logs_cache["ts"] = 0
        record_audit("admin.restore_teacher", target=existing["employee_id"],
                     detail=f"{professor_name} / {department}")
        return jsonify({
            "message":        f"{professor_name} restored. They have no card and no PIN — issue a new card.",
            "employee_id":    existing["employee_id"],
            "professor_name": professor_name,
            "department":     department,
            "restored":       True,
        })

    # One definition of the ID, shared with the startup seeding.
    from models import make_employee_id, _UNUSABLE_PASSWORD
    employee_id = make_employee_id(professor_name, department)

    execute(
        """INSERT INTO teacher_accounts
             (employee_id, professor_name, department, password_hash, email, position, staff_no)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (employee_id, professor_name, department, _UNUSABLE_PASSWORD,
         email, position or None, staff_no)
    )
    execute(
        "INSERT INTO professors (name, department) VALUES (%s, %s) "
        "ON CONFLICT (name, department) DO NOTHING",
        (professor_name, department)
    )
    _logs_cache["ts"] = 0
    record_audit("admin.add_teacher", target=employee_id,
                 detail=f"{professor_name} / {department} / {email}")
    return jsonify({
        "message": "Faculty member added.",
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

    # The dashboard has to be able to read back what it saved. Both of these
    # live in teacher_logs rather than on the account, and leaving them out of
    # this response meant the dashboard opened its schedule editor on a set of
    # defaults and wrote those over the real schedule on the next save.
    name, dept = teacher["professor_name"], teacher["department"]
    sched_log  = _latest_log(name, dept, "schedule_update")
    status_log = _latest_log(name, dept, "manual_status")

    # save_manual_status stores NULL whenever the teacher is not overriding, so
    # the absence of a manual status is what "follow my schedule" looks like.
    # Spell it the way the dashboard's dropdown does.
    manual_status = (status_log.get("manual_status")
                     if status_log and _to_bool(status_log.get("manual")) else None)

    return jsonify({
        "employee_id": teacher["employee_id"],
        "professor_name": name,
        "department": dept,
        "photo": teacher.get("photo"),
        "has_pin": bool(teacher.get("pin_hash")),
        "daily_limit": teacher.get("daily_limit") or 0,
        "weekly_schedule": _parse_weekly(sched_log.get("weekly_schedule")) if sched_log else None,
        "manual_status": manual_status or "Auto (use schedule)",
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
