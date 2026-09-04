import pytz
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from db import query, execute
from security import require_role, subject, forbid_unless_owner, record_audit
from phtime import serialize_row
import realtime

student_bp = Blueprint("student", __name__)
PH = pytz.timezone("Asia/Manila")


def _serialize_row(row):
    """Row out with Manila-offset timestamps — see phtime for the two clocks."""
    return serialize_row(row)


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

    # An account nobody has confirmed can browse the board but cannot take up a
    # professor's time. This is what registration checks alone cannot do:
    # anyone can type a plausible student number, and only the admin office
    # knows who is actually enrolled.
    if not me.get("verified"):
        return jsonify({
            "error": "Your account is still waiting to be confirmed by the admin "
                     "office. You can see who is available, but you cannot send a "
                     "request until they confirm you are enrolled."
        }), 403

    student_id   = me["student_id"]
    student_name = me["full_name"]
    course       = me["course"] or data.get("course") or ""
    now_ph = datetime.now(PH)

    # Check if student already has a pending/active request to this professor
    # "Already open" now includes accepted: the teacher has taken it on and not
    # yet held it, so a second request to the same professor is still a
    # duplicate — and it would consume a second slot of their day.
    existing = query(
        """SELECT id FROM consultation_requests
           WHERE student_id=%s AND professor_name=%s
             AND status IN ('pending', 'accepted')""",
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

    new_id = query(
        """INSERT INTO consultation_requests
           (student_id, student_name, course, professor_name, professor_id,
            purpose, category, status, request_time, department)
           VALUES (%s,%s,%s,%s,%s,%s,%s,'pending',%s::timestamp,%s)
           RETURNING id""",
        (student_id, student_name, course,
         data["professor_name"], prof_id,
         data["purpose"], data["category"],
         now_ph.strftime("%Y-%m-%d %H:%M:%S"), data["department"]),
        fetchone=True
    )

    # Only after the write succeeded, and only into the room of the teacher it
    # is addressed to. The student's name and purpose go no further than that.
    realtime.request_filed({
        "id": (new_id or {}).get("id"),
        "professor_name": data["professor_name"],
        "student_name": student_name,
        "category": data["category"],
        "purpose": data["purpose"],
    })
    # A filed request consumes one of the day's slots, so the public board's
    # slots-left figure is now stale.
    realtime.availability_changed(data["professor_name"], data["department"])

    return jsonify({"message": "Consultation request submitted!"}), 201


@student_bp.route("/consultation/request/<int:req_id>/cancel", methods=["POST"])
@require_role("student")
def cancel_request(req_id):
    """Withdraw a request the student filed themselves.

    There was no way to do this. A student who filed by mistake, or who sorted
    the problem out on their own, could only leave the row sitting in a
    professor's queue — and it kept consuming one of that professor's slots for
    the day until they resolved it by hand.

    Cancelling is a status rather than a delete: the teacher may already have
    read it, and "withdrawn" is a more honest thing for them to see than a row
    that silently disappears.
    """
    req = query(
        "SELECT id, student_id, professor_name, status "
        "FROM consultation_requests WHERE id=%s",
        (req_id,), fetchone=True
    )
    if not req:
        return jsonify({"error": "Request not found"}), 404
    # Identity from the session, never the URL — the row id is a small integer
    # and would otherwise be guessable.
    if str(req["student_id"]) != str(subject()):
        return jsonify({"error": "Not permitted."}), 403
    if req["status"] not in ("pending", "accepted"):
        return jsonify({
            "error": f"That request is already {req['status']} and cannot be cancelled."
        }), 409

    now_ph = datetime.now(PH)
    execute(
        "UPDATE consultation_requests SET status='cancelled', cancelled_at=%s::timestamp "
        "WHERE id=%s",
        (now_ph.strftime("%Y-%m-%d %H:%M:%S"), req_id)
    )
    record_audit("request.cancel", target=str(req_id),
                 detail=f"{req['student_id']} -> {req['professor_name']}")
    # Tell the teacher it has gone, and the board that the slot is free again.
    realtime.request_resolved(
        req["student_id"], req["professor_name"], req_id, "cancelled"
    )
    realtime.availability_changed(req["professor_name"])
    return jsonify({"message": "Request cancelled"})


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
            "photo": updated.get("photo"),
            "verified": bool(updated.get("verified")),
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
        "has_pin":    bool(student.get("pin_hash")),
        # The dashboard re-reads this on load so a student who was confirmed
        # while signed in stops being told to wait, without signing out first.
        "verified":   bool(student.get("verified")),
    })
