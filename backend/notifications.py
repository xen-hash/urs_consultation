"""Telling people what happened, in the app.

Until now nothing was ever told to anyone. A declined request, an appointment
set, an account confirmed — each was a change the person had been waiting for,
and each was visible only if they happened to open the app and look. The student
inbox even tracked what had been read in that browser's localStorage, so
"unread" meant nothing on a second device.

Delivery here is in-app only, by choice. `notify()` is the single place a
notification is written, so adding email or push later is a sender plugged in
behind this function rather than a change at each of the call sites.

Recipients are addressed as (role, id): students by student_id, teachers by
employee_id. That mirrors how the rest of the schema joins these two tables and
how realtime.py names its rooms, so a notification and the socket event that
announces it are addressed the same way.
"""

from datetime import datetime

import pytz
from flask import Blueprint, jsonify, request

from db import execute, query
from phtime import serialize_row
from security import current_claims, require_role, subject
import realtime

notifications_bp = Blueprint("notifications", __name__)
PH = pytz.timezone("Asia/Manila")

# What a notification can be about. Kept as constants because the client keys
# its icons off them, so a typo here is a missing icon there rather than an
# error anywhere.
REQUEST_ACCEPTED    = "request.accepted"
REQUEST_DECLINED    = "request.declined"
REQUEST_DONE        = "request.done"
REQUEST_CANCELLED   = "request.cancelled"
APPOINTMENT_SET     = "appointment.set"
ACCOUNT_VERIFIED    = "account.verified"
NEW_REQUEST         = "request.new"

MAX_PAGE_SIZE = 50


def notify(role, recipient_id, kind, title, body=None, link=None):
    """Write one notification and tell the recipient's socket room about it.

    Never raises. This is called from routes that have already committed the
    change being announced, and a consultation that was declined must not come
    back as a 500 because the notification about it could not be stored.
    """
    if not role or not recipient_id:
        return None
    try:
        now_ph = datetime.now(PH)
        row = query(
            """INSERT INTO notifications
               (recipient_role, recipient_id, kind, title, body, link, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s::timestamp)
               RETURNING id""",
            (role, str(recipient_id), kind, title, body, link,
             now_ph.strftime("%Y-%m-%d %H:%M:%S")),
            fetchone=True,
        )
    except Exception as exc:
        print(f"[NOTIFY] could not store {kind} for {role}:{recipient_id}: {exc}")
        return None

    # The bell updates without waiting for the next poll. The payload carries no
    # more than the room already entitles its occupant to see.
    room = (realtime.student_room(recipient_id) if role == "student"
            else realtime.teacher_room(recipient_id))
    realtime._emit("notification", {
        "id": (row or {}).get("id"),
        "kind": kind,
        "title": title,
        "body": body,
        "link": link,
    }, room)
    return (row or {}).get("id")


def _me():
    """The (role, id) whose notifications the caller may read."""
    claims = current_claims() or {}
    return claims.get("role"), subject()


@notifications_bp.route("/notifications", methods=["GET"])
@require_role("student", "teacher", "admin")
def list_notifications():
    """This caller's own notifications, newest first.

    There is no way to ask for someone else's: the recipient is taken from the
    session rather than the query string, so there is no id to tamper with.
    """
    role, me = _me()
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(MAX_PAGE_SIZE, max(1, int(request.args.get("limit", 20))))
    except (TypeError, ValueError):
        return jsonify({"error": "page and limit must be whole numbers."}), 400

    unread_only = (request.args.get("unread") or "").strip().lower() in ("1", "true", "yes")
    where = "WHERE recipient_role=%s AND recipient_id=%s"
    args = [role, str(me)]
    if unread_only:
        where += " AND read_at IS NULL"

    total = query(f"SELECT COUNT(*) AS n FROM notifications {where}",
                  tuple(args), fetchone=True)["n"]
    rows = query(
        f"""SELECT * FROM notifications {where}
            ORDER BY created_at DESC, id DESC
            LIMIT %s OFFSET %s""",
        tuple(args + [limit, (page - 1) * limit]), fetchall=True
    ) or []

    return jsonify({
        "data": [serialize_row(r) for r in rows],
        "page": page,
        "limit": limit,
        "total": total,
        "unread": _unread_count(role, me),
    })


def _unread_count(role, me):
    row = query(
        "SELECT COUNT(*) AS n FROM notifications "
        "WHERE recipient_role=%s AND recipient_id=%s AND read_at IS NULL",
        (role, str(me)), fetchone=True
    )
    return (row or {}).get("n", 0)


@notifications_bp.route("/notifications/unread-count", methods=["GET"])
@require_role("student", "teacher", "admin")
def unread_count():
    """Just the number, for the badge. Cheap enough to ask for often."""
    role, me = _me()
    return jsonify({"unread": _unread_count(role, me)})


@notifications_bp.route("/notifications/<int:notif_id>/read", methods=["POST"])
@require_role("student", "teacher", "admin")
def mark_read(notif_id):
    role, me = _me()
    now_ph = datetime.now(PH)
    # Scoped by recipient in the UPDATE itself, so marking someone else's as
    # read matches no rows rather than needing a separate ownership check.
    execute(
        "UPDATE notifications SET read_at=%s::timestamp "
        "WHERE id=%s AND recipient_role=%s AND recipient_id=%s AND read_at IS NULL",
        (now_ph.strftime("%Y-%m-%d %H:%M:%S"), notif_id, role, str(me))
    )
    return jsonify({"unread": _unread_count(role, me)})


@notifications_bp.route("/notifications/read-all", methods=["POST"])
@require_role("student", "teacher", "admin")
def mark_all_read():
    role, me = _me()
    now_ph = datetime.now(PH)
    execute(
        "UPDATE notifications SET read_at=%s::timestamp "
        "WHERE recipient_role=%s AND recipient_id=%s AND read_at IS NULL",
        (now_ph.strftime("%Y-%m-%d %H:%M:%S"), role, str(me))
    )
    return jsonify({"unread": 0})
