"""Server-side push, addressed to rooms.

Two things were wrong with what this replaces.

It never worked. The old handlers rebroadcast whatever a *client* emitted, and
required a ``token`` field in the payload to prove the emitter was signed in.
No client ever sent one, so every handler returned silently and nothing was
ever pushed. The app ran entirely on 15-30 second polling while paying for the
socket connections as well.

And it could not be fixed by adding that token. There were no rooms, so
``broadcast_request`` sent the student's name and the purpose of their
consultation to *every* connected socket — including the anonymous ones sitting
on the public availability board. Making the old design work would have put
consultation purposes on a wall display.

So the direction is inverted. The server already knows about every state change,
because every state change goes through a route here; the routes emit, and the
client only listens. A client can no longer announce anything, which removes the
forgery surface rather than guarding it, and an event can no longer be emitted
for a write that failed.

Three rooms, and what may be said in each:

``availability``
    Public, joined by everyone including anonymous kiosk screens. Carries who is
    available and how many slots are left — the same facts ``/api/teacher-logs``
    already serves without a session. Never a student name, never a purpose.

``teacher:<employee_id>``
    Joined only by that teacher. Carries their incoming requests, with the
    student's name and purpose, which they are entitled to see.

``student:<student_id>``
    Joined only by that student. Carries what happened to their own requests.
"""

from db import query

# Set by app.py once the SocketIO instance exists. The blueprints are imported
# before that happens, so they cannot import it from app directly, and a module
# that imports nothing from app keeps the dependency one-way.
_socketio = None


def bind(socketio):
    global _socketio
    _socketio = socketio


AVAILABILITY_ROOM = "availability"


def teacher_room(employee_id):
    return f"teacher:{employee_id}"


def student_room(student_id):
    return f"student:{student_id}"


def _emit(event, payload, room):
    """Push one event, or do nothing if sockets are not running.

    Never raises. A consultation request that was written must not fail because
    the notification about it could not be delivered.
    """
    if _socketio is None:
        return
    try:
        _socketio.emit(event, payload, to=room)
    except Exception as exc:  # pragma: no cover - transport failure
        print(f"[WS] emit of {event} to {room} failed: {exc}")


def employee_id_for(professor_name):
    """The account id behind a display name, for addressing a teacher's room.

    Requests reference a professor by name — the schema joins on strings — but
    rooms are keyed by employee id, which does not change when someone is
    renamed.
    """
    if not professor_name:
        return None
    row = query(
        "SELECT employee_id FROM teacher_accounts "
        "WHERE professor_name=%s AND removed_at IS NULL LIMIT 1",
        (professor_name,), fetchone=True
    )
    return row["employee_id"] if row else None


# ─── What the routes call ─────────────────────────────────────────────────────

def request_filed(request_row):
    """A student filed a request: tell the teacher it is for, and nobody else."""
    employee_id = employee_id_for(request_row.get("professor_name"))
    if not employee_id:
        return
    _emit("new_request", {
        "id": request_row.get("id"),
        "student_name": request_row.get("student_name"),
        "category": request_row.get("category"),
        "purpose": request_row.get("purpose"),
    }, teacher_room(employee_id))


def request_resolved(student_id, professor_name, request_id, status):
    """A request changed state. Both sides of it are told, and only those two."""
    payload = {"id": request_id, "status": status, "professor_name": professor_name}
    if student_id:
        _emit("request_update", payload, student_room(student_id))
    employee_id = employee_id_for(professor_name)
    if employee_id:
        _emit("consultation_update", payload, teacher_room(employee_id))


def availability_changed(professor_name, department=None):
    """A teacher's status or schedule changed — the public board may say so.

    Deliberately carries no more than the name and department: the board reads
    the full picture from /api/teacher-logs, and this only tells it to.
    """
    _emit("status_update", {
        "professor_name": professor_name,
        "department": department,
    }, AVAILABILITY_ROOM)
