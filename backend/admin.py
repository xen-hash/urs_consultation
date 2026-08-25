"""Administrator routes: faculty credentials, the audit log and real totals.

Issuing a faculty QR card lives here, and only here. It used to be a public
endpoint on the teacher portal that would hand anyone any professor's login
credential on request.

The card encodes a random `qr_serial`, never the employee ID. That matters
because employee IDs are derived from name + department and are therefore
guessable — a QR encoding one is not a secret. Issuing a new card overwrites
the serial, so the previous card stops working the moment a replacement is
printed.
"""

import secrets
from datetime import datetime, date, timedelta

import bcrypt
import pytz
from flask import Blueprint, request, jsonify

from db import query, execute
from security import require_role, record_audit, generate_qr_b64

admin_bp = Blueprint("admin", __name__)
PH = pytz.timezone("Asia/Manila")


def _serialize(row):
    if not row:
        return row
    out = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            out[k] = v.strftime("%Y-%m-%d %H:%M:%S")
        elif isinstance(v, date):
            out[k] = v.isoformat()
        elif isinstance(v, timedelta):
            total = int(v.total_seconds())
            h, rem = divmod(total, 3600)
            m, s = divmod(rem, 60)
            out[k] = f"{h:02}:{m:02}:{s:02}"
        else:
            out[k] = v
    return out


def _now_ph():
    return datetime.now(PH).strftime("%Y-%m-%d %H:%M:%S")


def _teacher_or_404(employee_id):
    return query(
        "SELECT * FROM teacher_accounts WHERE employee_id=%s AND removed_at IS NULL",
        ((employee_id or "").strip(),), fetchone=True
    )


def _credential_view(row):
    """Account state for the credentials table. Never includes hashes."""
    return {
        "employee_id":    row["employee_id"],
        "professor_name": row["professor_name"],
        "department":     row["department"],
        "photo":          row.get("photo"),
        "has_pin":        bool(row.get("pin_hash")),
        "has_qr":         bool(row.get("qr_serial")),
        "qr_issued_at":   row.get("qr_issued_at"),
        "last_login":     row.get("last_login"),
        "active":         row.get("active") is not False,
        "created_at":     row.get("created_at"),
    }


# ─── FACULTY CREDENTIALS ──────────────────────────────────────────────────────

@admin_bp.route("/teachers", methods=["GET"])
@require_role("admin")
def list_teachers():
    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        rows = query(
            "SELECT * FROM teacher_accounts "
            "WHERE removed_at IS NULL AND "
            "(professor_name ILIKE %s OR employee_id ILIKE %s OR department ILIKE %s) "
            "ORDER BY department, professor_name",
            (like, like, like), fetchall=True
        )
    else:
        rows = query(
            "SELECT * FROM teacher_accounts WHERE removed_at IS NULL "
            "ORDER BY department, professor_name",
            fetchall=True
        )
    return jsonify([_serialize(_credential_view(r)) for r in (rows or [])])


@admin_bp.route("/teachers/<employee_id>/issue-qr", methods=["POST"])
@require_role("admin")
def issue_qr(employee_id):
    """Mint a new Faculty ID credential and return the card to print.

    The QR payload is shown once, in this response. It is not stored anywhere
    retrievable — only its value in `qr_serial`, which is what a scan is matched
    against. Losing the printout means issuing a new card, not recovering this
    one.
    """
    teacher = _teacher_or_404(employee_id)
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    serial = secrets.token_urlsafe(24)
    execute(
        "UPDATE teacher_accounts SET qr_serial=%s, qr_issued_at=%s::timestamp WHERE employee_id=%s",
        (serial, _now_ph(), teacher["employee_id"])
    )
    replaced = bool(teacher.get("qr_serial"))
    record_audit(
        "admin.issue_qr", target=teacher["employee_id"],
        detail=("reissued — previous card revoked" if replaced else "first issue")
    )
    return jsonify({
        "message":        "Faculty ID issued. The previous card no longer works."
                          if replaced else "Faculty ID issued.",
        "replaced":       replaced,
        "qr_base64":      generate_qr_b64(serial),
        "employee_id":    teacher["employee_id"],
        "professor_name": teacher["professor_name"],
        "department":     teacher["department"],
        "photo":          teacher.get("photo"),
        "issued_at":      _now_ph(),
    })


@admin_bp.route("/teachers/<employee_id>/revoke-qr", methods=["POST"])
@require_role("admin")
def revoke_qr(employee_id):
    """Kill the current card without issuing a replacement."""
    teacher = _teacher_or_404(employee_id)
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404
    if not teacher.get("qr_serial"):
        return jsonify({"message": "No active card to revoke."})

    execute(
        "UPDATE teacher_accounts SET qr_serial=NULL, qr_issued_at=NULL WHERE employee_id=%s",
        (teacher["employee_id"],)
    )
    record_audit("admin.revoke_qr", target=teacher["employee_id"])
    return jsonify({"message": "Card revoked. Scanning it will no longer work."})


@admin_bp.route("/teachers/<employee_id>/reset-pin", methods=["POST"])
@require_role("admin")
def reset_pin(employee_id):
    """Clear a forgotten PIN. The teacher sets a new one after their next login."""
    teacher = _teacher_or_404(employee_id)
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    execute("UPDATE teacher_accounts SET pin_hash=NULL WHERE employee_id=%s",
            (teacher["employee_id"],))
    record_audit("admin.reset_pin", target=teacher["employee_id"])
    return jsonify({"message": "PIN cleared. They can set a new one after scanning their card."})


@admin_bp.route("/teachers/<employee_id>/active", methods=["POST"])
@require_role("admin")
def set_active(employee_id):
    """Deactivate or reactivate an account.

    Deactivating also revokes the card, so a leaver's printed ID is dead even if
    the account is later reactivated.
    """
    teacher = _teacher_or_404(employee_id)
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    active = bool((request.json or {}).get("active", True))
    if active:
        execute("UPDATE teacher_accounts SET active=TRUE WHERE employee_id=%s",
                (teacher["employee_id"],))
    else:
        execute(
            "UPDATE teacher_accounts SET active=FALSE, qr_serial=NULL, qr_issued_at=NULL "
            "WHERE employee_id=%s",
            (teacher["employee_id"],)
        )
    record_audit("admin.set_active", target=teacher["employee_id"],
                 detail="activated" if active else "deactivated — card revoked")
    return jsonify({
        "message": "Account reactivated." if active
                   else "Account deactivated and card revoked.",
        "active": active,
    })


@admin_bp.route("/teachers/<employee_id>", methods=["DELETE"])
@require_role("admin")
def remove_teacher(employee_id):
    """Remove a faculty account, on the record.

    A reason is required rather than optional. Removing someone is the one
    action here that cannot be undone from the dashboard, and "why is this
    professor gone" is the question asked months later, when whoever did it has
    forgotten — so it is asked at the time and written to the audit log.

    Marked, not DELETEd: the roster in config is re-seeded on every boot, so a
    deleted row for a listed professor would reappear on the next restart. The
    mark also keeps their consultation history intact — those are the students'
    records too, and deleting them to tidy up one account is not this action's
    business.
    """
    teacher = _teacher_or_404(employee_id)
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    reason = ((request.json or {}).get("reason") or "").strip()
    if len(reason) < 4:
        return jsonify({"error": "Give a reason for removing this account."}), 400
    reason = reason[:500]

    # Their card and PIN die with the account, so nothing is left that could
    # sign in even if the row were later restored by hand.
    execute(
        "UPDATE teacher_accounts SET removed_at=%s::timestamp, removed_reason=%s, "
        "active=FALSE, qr_serial=NULL, qr_issued_at=NULL, pin_hash=NULL "
        "WHERE employee_id=%s",
        (_now_ph(), reason, teacher["employee_id"])
    )
    # Also drop them from the seeded professor roster, so they stop appearing in
    # the student-facing lists.
    execute("DELETE FROM professors WHERE name=%s AND department=%s",
            (teacher["professor_name"], teacher["department"]))

    record_audit("admin.remove_teacher", target=teacher["employee_id"],
                 detail=f"{teacher['professor_name']} ({teacher['department']}) — {reason}")

    import teacher as teacher_module
    teacher_module._logs_cache["ts"] = 0

    return jsonify({
        "message": f"{teacher['professor_name']} removed. Their card and PIN no longer work.",
    })


# ─── STUDENT ACCOUNTS ─────────────────────────────────────────────────────────
# Students self-register, so there is no card to issue — but a forgotten PIN
# otherwise locks someone out permanently with nobody able to help. These give
# the administrator the same recourse they have for faculty.

def _student_or_404(student_id):
    return query(
        "SELECT * FROM students WHERE student_id=%s",
        ((student_id or "").strip(),), fetchone=True
    )


@admin_bp.route("/students/<student_id>/reset-pin", methods=["POST"])
@require_role("admin")
def reset_student_pin(student_id):
    """Clear a forgotten student PIN so they can set a new one on next sign-in."""
    student = _student_or_404(student_id)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    execute("UPDATE students SET pin_hash=NULL WHERE student_id=%s",
            (student["student_id"],))
    record_audit("admin.reset_student_pin", target=student["student_id"],
                 detail=student["full_name"])

    # The dashboard reads students through a short-lived cache; drop it so the
    # change is visible rather than appearing not to have worked.
    import teacher as teacher_module
    teacher_module._students_cache["ts"] = 0

    return jsonify({
        "message": f"PIN cleared for {student['full_name']}. "
                   f"They choose a new one the next time they sign in."
    })


@admin_bp.route("/students/<student_id>", methods=["DELETE"])
@require_role("admin")
def delete_student(student_id):
    """Remove a student account and its consultation history.

    Irreversible, and the history goes with it — the audit entry is the only
    record that remains, which is why it names who did it.
    """
    student = _student_or_404(student_id)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    requests_removed = query(
        "SELECT COUNT(*) AS c FROM consultation_requests WHERE student_id=%s",
        (student["student_id"],), fetchone=True
    )["c"]

    execute("DELETE FROM consultation_requests WHERE student_id=%s", (student["student_id"],))
    execute("DELETE FROM students WHERE student_id=%s", (student["student_id"],))
    record_audit("admin.delete_student", target=student["student_id"],
                 detail=f"{student['full_name']} — {requests_removed} request(s) removed")

    import teacher as teacher_module
    teacher_module._students_cache["ts"] = 0
    teacher_module._requests_cache["ts"] = 0

    return jsonify({"message": f"{student['full_name']} removed."})


# ─── AUDIT LOG ────────────────────────────────────────────────────────────────

@admin_bp.route("/audit", methods=["GET"])
@require_role("admin")
def audit_log():
    page   = max(1, int(request.args.get("page", 1)))
    limit  = min(100, int(request.args.get("limit", 25)))
    action = (request.args.get("action") or "").strip()
    search = (request.args.get("search") or "").strip()
    offset = (page - 1) * limit

    where, args = [], []
    if action:
        where.append("action = %s")
        args.append(action)
    if search:
        like = f"%{search}%"
        where.append("(actor_name ILIKE %s OR actor_id ILIKE %s OR target ILIKE %s)")
        args += [like, like, like]
    clause = (" WHERE " + " AND ".join(where)) if where else ""

    rows = query(
        f"SELECT * FROM audit_log{clause} ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s",
        tuple(args + [limit, offset]), fetchall=True
    )
    total = query(f"SELECT COUNT(*) AS c FROM audit_log{clause}", tuple(args), fetchone=True)["c"]
    actions = query(
        "SELECT DISTINCT action FROM audit_log ORDER BY action", fetchall=True
    ) or []

    return jsonify({
        "data":    [_serialize(r) for r in (rows or [])],
        "page":    page,
        "limit":   limit,
        "total":   total,
        "pages":   -(-total // limit) if total else 1,
        "actions": [r["action"] for r in actions],
    })


# ─── DASHBOARD TOTALS ─────────────────────────────────────────────────────────

@admin_bp.route("/stats", methods=["GET"])
@require_role("admin")
def stats():
    """Real counts, computed in SQL.

    The dashboard used to derive its headline numbers from whichever 20 rows the
    current page happened to hold, so every figure was wrong past page one.
    """
    today = datetime.now(PH).strftime("%Y-%m-%d")
    one = lambda sql, args=None: query(sql, args, fetchone=True)["c"]

    by_status = query(
        "SELECT status, COUNT(*) AS c FROM consultation_requests GROUP BY status",
        fetchall=True
    ) or []
    status_counts = {r["status"]: r["c"] for r in by_status}

    by_category = query(
        "SELECT category, COUNT(*) AS c FROM consultation_requests "
        "WHERE category IS NOT NULL GROUP BY category ORDER BY c DESC LIMIT 6",
        fetchall=True
    ) or []

    # Daily counts for the trend chart. Generated from a date series rather than
    # from the rows, so days with no requests come back as zero instead of being
    # missing — a line that skips empty days misreports the shape of the week.
    daily = query(
        """SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                  COUNT(cr.id) AS c
           FROM generate_series(
                    (%s::date - INTERVAL '13 days'), %s::date, INTERVAL '1 day'
                ) AS d(day)
           LEFT JOIN consultation_requests cr
                  ON cr.request_time::date = d.day::date
           GROUP BY d.day
           ORDER BY d.day""",
        (today, today), fetchall=True
    ) or []

    return jsonify({
        "daily":     [{"day": r["day"], "count": r["c"]} for r in daily],
        "students":  one("SELECT COUNT(*) AS c FROM students"),
        "teachers":  one("SELECT COUNT(*) AS c FROM teacher_accounts WHERE removed_at IS NULL"),
        "requests":  one("SELECT COUNT(*) AS c FROM consultation_requests"),
        "today":     one(
            "SELECT COUNT(*) AS c FROM consultation_requests WHERE request_time::date = %s::date",
            (today,)
        ),
        "pending":   status_counts.get("pending", 0),
        "done":      status_counts.get("done", 0),
        "declined":  status_counts.get("declined", 0),
        "archived":  status_counts.get("archived", 0),
        "with_pin":  one("SELECT COUNT(*) AS c FROM teacher_accounts WHERE removed_at IS NULL AND pin_hash IS NOT NULL"),
        "with_qr":   one("SELECT COUNT(*) AS c FROM teacher_accounts WHERE removed_at IS NULL AND qr_serial IS NOT NULL"),
        "inactive":  one("SELECT COUNT(*) AS c FROM teacher_accounts WHERE removed_at IS NULL AND active = FALSE"),
        "categories": [{"category": r["category"], "count": r["c"]} for r in by_category],
    })


# ─── ARCHIVE REQUESTS ─────────────────────────────────────────────────────────

@admin_bp.route("/requests/archive", methods=["POST"])
@require_role("admin")
def archive_requests():
    """Archive consultation requests instead of deleting them.

    The dashboard's old "Delete All" ran /teacher/clear-logs, which also emptied
    teacher_logs — every saved schedule and status override in the system. This
    marks requests archived (they drop out of the active views but stay in the
    exports) and touches nothing else.
    """
    data      = request.json or {}
    date_from = (data.get("from") or "").strip()
    date_to   = (data.get("to") or "").strip()
    status    = (data.get("status") or "").strip()

    where = ["status <> 'archived'"]
    args  = []
    if status:
        where.append("status = %s")
        args.append(status)
    if date_from:
        where.append("request_time >= %s::timestamp")
        args.append(f"{date_from} 00:00:00")
    if date_to:
        where.append("request_time <= %s::timestamp")
        args.append(f"{date_to} 23:59:59")
    clause = " WHERE " + " AND ".join(where)

    affected = query(f"SELECT COUNT(*) AS c FROM consultation_requests{clause}",
                     tuple(args), fetchone=True)["c"]
    execute(f"UPDATE consultation_requests SET status='archived'{clause}", tuple(args))

    scope = ", ".join(filter(None, [
        f"status={status}" if status else "",
        f"from={date_from}" if date_from else "",
        f"to={date_to}" if date_to else "",
    ])) or "all active requests"
    record_audit("admin.archive_requests", detail=f"{affected} archived ({scope})")

    # Dashboards read through short-lived caches; drop them so the change shows.
    import teacher as teacher_module
    teacher_module._requests_cache["ts"] = 0
    teacher_module._logs_cache["ts"] = 0

    return jsonify({"message": f"{affected} requests archived.", "archived": affected})
