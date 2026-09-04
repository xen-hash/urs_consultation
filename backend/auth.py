"""Login routes. Every one of them ends in a signed session token.

What changed and why:

  * `/teacher/quick-login` is gone. It was public, and it handed out any
    professor's employee ID and login QR to whoever asked — a complete account
    takeover with no credential involved. There is no safe version of it;
    faculty credentials are issued by an administrator (see admin.py).

  * `/teacher/qr-login` matches on `qr_serial`, not `employee_id`. Employee IDs
    are derived from name+department and are therefore guessable; a QR that
    encodes one is not a secret. The serial is random and rotatable.

  * `set-pin` acts on the caller's own account, taken from the session token.
    It used to accept any employee_id in the body, so anyone could overwrite
    anyone's PIN.

  * The legacy `/teacher/register` and `/teacher/login` password routes are
    gone. Nothing called them and they widened the surface for no benefit.
"""

import bcrypt
from datetime import datetime

import pytz
from flask import Blueprint, request, jsonify

from db import query, execute
from config import ADMIN_USERNAME, ADMIN_PASSWORD_HASH
from security import (
    issue_token, require_role, subject, too_many_attempts, clear_rate_limit, client_ip,
    record_audit, generate_qr_b64, teacher_by_employee_id,
)

auth_bp = Blueprint("auth", __name__)
PH = pytz.timezone("Asia/Manila")

# Login throttles. The PIN is four digits and employee IDs are guessable, so an
# unthrottled pin-login is a few hours of brute force away from any account.
PIN_LIMIT,   PIN_WINDOW   = 5,  15 * 60
QR_LIMIT,    QR_WINDOW    = 20, 15 * 60
ADMIN_LIMIT, ADMIN_WINDOW = 5,  15 * 60
STUDENT_LIMIT, STUDENT_WINDOW = 10, 15 * 60


def _now_ph_str():
    return datetime.now(PH).strftime("%Y-%m-%d %H:%M:%S")


def _teacher_payload(teacher):
    return {
        "id":             teacher["id"],
        "employee_id":    teacher["employee_id"],
        "professor_name": teacher["professor_name"],
        "department":     teacher["department"],
        "photo":          teacher.get("photo"),
        "has_pin":        bool(teacher.get("pin_hash")),
    }


def _student_payload(student):
    return {
        "id":         student["id"],
        "student_id": student["student_id"],
        "full_name":  student["full_name"],
        "course":     student["course"],
        "year_level": student["year_level"],
        "department": student["department"],
        "email":      student.get("email"),
        "photo":      student.get("photo"),
        "has_pin":    bool(student.get("pin_hash")),
        # The dashboard tells the student where they stand rather than letting
        # them find out when a request is refused.
        "verified":   bool(student.get("verified")),
    }


def _check_registration(student_id, email):
    """The checks that stand between the roster and anyone who finds the URL.

    Registration is open by design — students sign themselves up — so this is
    the whole of it: the student number has to look like a student number, and
    the address has to be on the school's domain when one is configured.
    Neither proves enrolment on its own, which is why an account still waits
    for an administrator unless STUDENT_AUTO_VERIFY is set.
    """
    import re
    from config import STUDENT_ID_PATTERN, STUDENT_EMAIL_DOMAINS

    if STUDENT_ID_PATTERN:
        try:
            if not re.match(STUDENT_ID_PATTERN, student_id):
                return ("That student number doesn't look right. Use the one on your "
                        "registration form, like M2022-0247.")
        except re.error:
            pass   # a bad pattern in the environment must not lock everyone out

    if "@" not in email or "." not in email.split("@")[-1]:
        return "Enter a valid email address."

    if STUDENT_EMAIL_DOMAINS:
        domain = email.split("@")[-1].lower()
        if not any(domain == d or domain.endswith("." + d) for d in STUDENT_EMAIL_DOMAINS):
            allowed = " or ".join("@" + d for d in STUDENT_EMAIL_DOMAINS)
            return f"Use your school email address ({allowed})."
    return None


# ─── STUDENT REGISTER ─────────────────────────────────────────────────────────

@auth_bp.route("/student/register", methods=["POST"])
def student_register():
    from config import STUDENT_AUTO_VERIFY

    data = request.json or {}
    required = ["student_id", "full_name", "course", "year_level", "department", "pin", "email"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing field: {field}"}), 400

    student_id = data["student_id"].strip().upper()
    email      = data["email"].strip().lower()
    pin        = str(data["pin"]).strip()

    if len(pin) != 4 or not pin.isdigit():
        return jsonify({"error": "PIN must be exactly 4 digits."}), 400

    problem = _check_registration(student_id, email)
    if problem:
        return jsonify({"error": problem}), 400

    throttled = too_many_attempts(f"register:{client_ip()}", STUDENT_LIMIT, STUDENT_WINDOW)
    if throttled:
        return throttled

    existing = query("SELECT id FROM students WHERE UPPER(student_id)=%s", (student_id,), fetchone=True)
    if existing:
        return jsonify({"error": "Student ID already registered."}), 409

    # One account per address, so a single person cannot quietly hold several.
    if query("SELECT id FROM students WHERE LOWER(email)=LOWER(%s)", (email,), fetchone=True):
        return jsonify({"error": "That email address is already registered."}), 409

    pin_hash = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    execute(
        "INSERT INTO students (student_id, full_name, course, year_level, department, "
        "pin_hash, email, verified, verified_at, verified_by) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (student_id, data["full_name"].strip(), data["course"].strip(),
         data["year_level"].strip(), data["department"].strip(), pin_hash, email,
         STUDENT_AUTO_VERIFY, _now_ph_str() if STUDENT_AUTO_VERIFY else None,
         "auto" if STUDENT_AUTO_VERIFY else None)
    )
    student = query("SELECT * FROM students WHERE UPPER(student_id)=UPPER(%s)", (student_id,), fetchone=True)
    token = issue_token("student", student_id, student["full_name"])
    record_audit("student.register", target=student_id,
                 actor={"role": "student", "sub": student_id, "name": student["full_name"]})

    # The QR is a convenience for the student's own ID card. Unlike the faculty
    # card it is not a login credential — student login is ID + PIN — so
    # returning it here gives away nothing.
    return jsonify({
        "message":    "Registered successfully!" if student.get("verified")
                      else "Registered. The admin office will confirm your enrolment — "
                           "you can look around in the meantime.",
        "token":      token,
        "student":    _student_payload(student),
        "student_id": student_id,
        "full_name":  student["full_name"],
        "qr_base64":  generate_qr_b64(student_id),
    }), 201


# ─── STUDENT FIND (step 1 of 2-step login) ───────────────────────────────────

@auth_bp.route("/student/find", methods=["POST"])
def student_find():
    data = request.json or {}
    student_id = (data.get("student_id") or "").strip()
    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    throttled = too_many_attempts(f"find:{client_ip()}", STUDENT_LIMIT * 3, STUDENT_WINDOW)
    if throttled:
        return throttled

    student = query(
        "SELECT student_id, full_name, pin_hash FROM students WHERE UPPER(student_id)=UPPER(%s)",
        (student_id,), fetchone=True
    )
    if not student:
        return jsonify({"error": "Student not found. Please register first."}), 404
    return jsonify({
        "student_id": student["student_id"],
        "full_name":  student["full_name"],
        "has_pin":    bool(student.get("pin_hash")),
    })


# ─── STUDENT LOGIN ────────────────────────────────────────────────────────────

@auth_bp.route("/student/login", methods=["POST"])
def student_login():
    data = request.json or {}
    student_id = (data.get("student_id") or "").strip()
    pin        = str(data.get("pin") or "").strip()

    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    throttled = too_many_attempts(f"student-login:{student_id.lower()}", STUDENT_LIMIT, STUDENT_WINDOW)
    if throttled:
        return throttled

    student = query("SELECT * FROM students WHERE UPPER(student_id)=UPPER(%s)", (student_id,), fetchone=True)
    if not student:
        return jsonify({"error": "Student not found. Please register first."}), 404

    # From here on, the number as stored — not as typed. The session token's
    # subject is what every ownership check compares against, and their
    # consultation history is filed under the stored spelling; a token minted
    # from "m2022-0247" would match none of it.
    student_id = student["student_id"]

    # PIN verification — skipped only for legacy accounts that never set one.
    if student.get("pin_hash"):
        if not pin:
            return jsonify({"error": "PIN is required."}), 401
        if not bcrypt.checkpw(pin.encode(), student["pin_hash"].encode()):
            return jsonify({"error": "Incorrect PIN. Please try again."}), 401

    clear_rate_limit(f"student-login:{student_id.lower()}")
    execute("UPDATE students SET last_login=%s::timestamp WHERE student_id=%s",
            (_now_ph_str(), student_id))

    actor = {"role": "student", "sub": student_id, "name": student["full_name"]}
    record_audit("student.login", target=student_id, actor=actor)
    return jsonify({
        "message": "Login successful",
        "token":   issue_token("student", student_id, student["full_name"]),
        "student": _student_payload(student),
    })


# ─── STUDENT SET PIN ──────────────────────────────────────────────────────────

@auth_bp.route("/student/set-pin", methods=["POST"])
@require_role("student", "admin")
def student_set_pin():
    """Set or change the caller's own PIN.

    The student_id comes from the session token, never the body — the previous
    version let anyone overwrite any student's PIN by naming them.
    """
    data = request.json or {}
    pin  = str(data.get("pin") or "").strip()
    student_id = subject()

    if len(pin) != 4 or not pin.isdigit():
        return jsonify({"error": "PIN must be exactly 4 digits."}), 400

    student = query("SELECT * FROM students WHERE UPPER(student_id)=UPPER(%s)", (student_id,), fetchone=True)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    if student.get("pin_hash"):
        current = str(data.get("current_pin") or "").strip()
        if not current or not bcrypt.checkpw(current.encode(), student["pin_hash"].encode()):
            return jsonify({"error": "Current PIN is incorrect."}), 401

    pin_hash = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    execute("UPDATE students SET pin_hash=%s WHERE student_id=%s", (pin_hash, student_id))
    record_audit("student.set_pin", target=student_id)
    return jsonify({"message": "PIN set successfully"})


# ─── TEACHER QR LOGIN (scan the issued Faculty ID card) ──────────────────────

@auth_bp.route("/teacher/qr-login", methods=["POST"])
def teacher_qr_login():
    """Log in by scanning an admin-issued Faculty ID card.

    The card encodes a random `qr_serial`, not the employee ID. Reissuing a card
    rotates that serial, which is what makes the previous card stop working.
    """
    data = request.json or {}
    # `employee_id` is still read so an old client sending the previous field
    # name gets the same (correct) rejection rather than a confusing 400.
    qr_token = (data.get("qr_token") or data.get("employee_id") or "").strip()

    if not qr_token:
        return jsonify({"error": "QR code required"}), 400

    throttled = too_many_attempts(f"qr-login:{client_ip()}", QR_LIMIT, QR_WINDOW)
    if throttled:
        return throttled

    teacher = query(
        "SELECT * FROM teacher_accounts WHERE qr_serial=%s", (qr_token,), fetchone=True
    )
    if not teacher:
        record_audit("teacher.qr_login_failed", detail="unrecognised card",
                     actor={"role": None, "sub": None, "name": None})
        return jsonify({
            "error": "QR code not recognised. If your card is new or was "
                     "reissued, ask the admin office for a current one."
        }), 404

    if teacher.get("active") is False:
        return jsonify({"error": "This account is deactivated. Contact the admin office."}), 403

    execute("UPDATE teacher_accounts SET last_login=%s::timestamp WHERE employee_id=%s",
            (_now_ph_str(), teacher["employee_id"]))

    actor = {"role": "teacher", "sub": teacher["employee_id"], "name": teacher["professor_name"]}
    record_audit("teacher.login", target=teacher["employee_id"], detail="qr", actor=actor)
    return jsonify({
        "message": "Login successful",
        "token":   issue_token("teacher", teacher["employee_id"], teacher["professor_name"]),
        "teacher": _teacher_payload(teacher),
    })


# ─── TEACHER PIN LOGIN ────────────────────────────────────────────────────────

@auth_bp.route("/teacher/pin-login", methods=["POST"])
def teacher_pin_login():
    data = request.json or {}
    employee_id = (data.get("employee_id") or "").strip().upper()
    pin         = str(data.get("pin") or "").strip()

    if not employee_id or not pin:
        return jsonify({"error": "Employee ID and PIN required"}), 400

    key = f"pin-login:{employee_id.lower()}"
    throttled = too_many_attempts(key, PIN_LIMIT, PIN_WINDOW)
    if throttled:
        record_audit("teacher.login_throttled", target=employee_id,
                     actor={"role": None, "sub": employee_id, "name": None})
        return throttled

    teacher = teacher_by_employee_id(employee_id)
    if not teacher:
        return jsonify({"error": "Employee ID not found."}), 404

    if teacher.get("active") is False:
        return jsonify({"error": "This account is deactivated. Contact the admin office."}), 403

    if not teacher.get("pin_hash"):
        return jsonify({
            "error": "No PIN set. Scan your Faculty ID card first, then set a PIN."
        }), 400

    if not bcrypt.checkpw(pin.encode(), teacher["pin_hash"].encode()):
        return jsonify({"error": "Incorrect PIN."}), 401

    clear_rate_limit(key)
    execute("UPDATE teacher_accounts SET last_login=%s::timestamp WHERE employee_id=%s",
            (_now_ph_str(), teacher["employee_id"]))

    actor = {"role": "teacher", "sub": teacher["employee_id"], "name": teacher["professor_name"]}
    record_audit("teacher.login", target=teacher["employee_id"], detail="pin", actor=actor)
    return jsonify({
        "message": "Login successful",
        "token":   issue_token("teacher", teacher["employee_id"], teacher["professor_name"]),
        "teacher": _teacher_payload(teacher),
    })


# ─── TEACHER SET PIN ──────────────────────────────────────────────────────────

@auth_bp.route("/teacher/set-pin", methods=["POST"])
@require_role("teacher", "admin")
def teacher_set_pin():
    """Set or change the caller's own PIN.

    Like the student version, the account comes from the session token. When a
    PIN already exists the current one must be supplied, so a borrowed unlocked
    session cannot quietly lock the real owner out.
    """
    data = request.json or {}
    pin  = str(data.get("pin") or "").strip()
    employee_id = subject()

    if len(pin) != 4 or not pin.isdigit():
        return jsonify({"error": "PIN must be exactly 4 digits"}), 400

    teacher = teacher_by_employee_id(employee_id)
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    if teacher.get("pin_hash"):
        current = str(data.get("current_pin") or "").strip()
        if not current or not bcrypt.checkpw(current.encode(), teacher["pin_hash"].encode()):
            return jsonify({"error": "Current PIN is incorrect."}), 401

    pin_hash = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    execute("UPDATE teacher_accounts SET pin_hash=%s WHERE employee_id=%s",
            (pin_hash, employee_id))
    record_audit("teacher.set_pin", target=employee_id)
    return jsonify({"message": "PIN set successfully"})


# ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────

@auth_bp.route("/admin/login", methods=["POST"])
def admin_login():
    """Verify administrator credentials on the server.

    These used to be two string constants in the frontend bundle, which meant
    anyone who opened DevTools was an administrator.
    """
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    key = f"admin-login:{client_ip()}"
    throttled = too_many_attempts(key, ADMIN_LIMIT, ADMIN_WINDOW)
    if throttled:
        record_audit("admin.login_throttled", target=username,
                     actor={"role": None, "sub": username, "name": None})
        return throttled

    # Compare the password even when the username is wrong, so the response time
    # does not reveal which half failed.
    password_ok = bcrypt.checkpw(password.encode(), ADMIN_PASSWORD_HASH)
    if not password_ok or username.lower() != ADMIN_USERNAME.lower():
        record_audit("admin.login_failed", target=username,
                     actor={"role": None, "sub": username, "name": None})
        return jsonify({"error": "Invalid credentials."}), 401

    clear_rate_limit(key)
    actor = {"role": "admin", "sub": ADMIN_USERNAME, "name": "Administrator"}
    record_audit("admin.login", target=ADMIN_USERNAME, actor=actor)
    return jsonify({
        "message": "Login successful",
        "token":   issue_token("admin", ADMIN_USERNAME, "Administrator"),
        "admin":   {"username": ADMIN_USERNAME, "name": "Administrator"},
    })


# ─── SESSION PROBE ────────────────────────────────────────────────────────────

@auth_bp.route("/session", methods=["GET"])
@require_role("student", "teacher", "admin")
def session_probe():
    """Cheap 'is my token still good?' check for the frontend on boot."""
    from security import current_claims
    claims = current_claims()
    return jsonify({"role": claims["role"], "sub": claims["sub"], "name": claims.get("name")})
