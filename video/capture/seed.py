"""Fill the capture backend with a believable, entirely fictional morning.

Everything goes through the app's own API, so notifications, logs and stats
come out exactly as they would for real users. Run once against a fresh
database, after capture/backend.py is up:

    python capture/seed.py
"""
import hashlib
import json
import time

import requests
from itsdangerous import URLSafeTimedSerializer

API = "http://127.0.0.1:5000/api"
# Must match capture/backend.py.
SIGNER = URLSafeTimedSerializer("video-capture-only", salt="urs-session-v1")


def employee_id(name, dept):
    raw = f"{name.strip().lower()}|{dept.strip().lower()}"
    return f"T-{int(hashlib.md5(raw.encode()).hexdigest(), 16) % 90000 + 10000}"


def token(role, sub, name):
    return SIGNER.dumps({"role": role, "sub": sub, "name": name})


def call(method, path, tok=None, **body):
    r = requests.request(method, API + path, json=body or None,
                         headers={"Authorization": f"Bearer {tok}"} if tok else {})
    if r.status_code >= 400:
        raise SystemExit(f"{method} {path} -> {r.status_code} {r.text}")
    return r.json()


CE, CPE = "Civil Engineering Department", "Computer Engineering Department"
EE, ECE = "Electrical Engineering Department", "Electronics Engineering Department"
ME, GEC = "Mechanical Engineering Department", "GEC GEAS Department"

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]


def week(*slots):
    day = {"unavailable": False, "slots": [{"start": a, "end": b} for a, b in slots], "limit": 0}
    off = {"unavailable": True, "slots": [{"start": "08:00 AM", "end": "09:00 AM"}], "limit": 0}
    return {d: (day if d in WEEKDAYS else off) for d in WEEKDAYS + ["saturday", "sunday"]}


MORNING = week(("10:00 AM", "12:00 PM"), ("01:00 PM", "03:00 PM"))
AFTERNOON = week(("01:00 PM", "04:00 PM"))

# (name, dept, schedule, manual status or None to follow the schedule)
FACULTY = [
    ("Engr. Ana Villareal", CE, MORNING, None),
    ("Engr. Nico Valdez", CE, MORNING, "On Leave"),
    ("Engr. Tomas Rivera", CE, AFTERNOON, None),
    ("Prof. Marco Dizon", CPE, MORNING, "In Meeting"),
    ("Prof. Rina Torres", CPE, MORNING, None),
    ("Engr. Kaye Bautista", CPE, MORNING, None),
    ("Engr. Liza Manalo", EE, MORNING, None),
    ("Engr. Rey Padilla", EE, AFTERNOON, None),
    ("Engr. Paolo Lim", ECE, MORNING, "Unavailable"),
    ("Dr. Joy Lacson", ECE, MORNING, None),
    ("Dr. Carlo Aquino", ME, MORNING, "On Leave"),
    ("Engr. Ben Ocampo", ME, MORNING, None),
    ("Prof. Bea Salcedo", GEC, MORNING, None),
    ("Prof. Iris Ferrer", GEC, AFTERNOON, None),
]

STUDENTS = [
    ("2023-10452", "Mika Soriano", "BS Computer Engineering", "3rd Year", CPE),
    ("2022-20318", "Josh Navarro", "BS Civil Engineering", "4th Year", CE),
    ("2024-11207", "Aira Mendoza", "BS Electrical Engineering", "2nd Year", EE),
    ("2023-30981", "Leo Castillo", "BS Mechanical Engineering", "3rd Year", ME),
    ("2024-40116", "Kyla Ramirez", "BS Electronics Engineering", "2nd Year", ECE),
    ("2022-51734", "Paul Santiago", "BS Computer Engineering", "4th Year", CPE),
    ("2023-62250", "Ella Fajardo", "BS Civil Engineering", "3rd Year", CE),
]

# (student, professor, dept, category, purpose, final status)
HISTORY = [
    ("2022-20318", "Engr. Ana Villareal", CE, "Academic", "Clarify the grading on my CE 211 midterm", "done"),
    ("2024-11207", "Engr. Liza Manalo", EE, "Academic", "Help with circuit analysis problem set 4", "done"),
    ("2023-30981", "Prof. Bea Salcedo", GEC, "Personal", "Advice on shifting my elective", "accepted"),
    ("2024-40116", "Dr. Joy Lacson", ECE, "Academic", "Lab report feedback, experiment 3", "accepted"),
    ("2022-51734", "Prof. Rina Torres", CPE, "Thesis", "Thesis title defense preparation", "pending"),
    ("2023-62250", "Engr. Tomas Rivera", CE, "Academic", "Review of my surveying field notes", "pending"),
    ("2022-20318", "Engr. Ben Ocampo", ME, "Academic", "Consultation on the thermo design project", "done"),
]


def main():
    for name, dept, sched, manual in FACULTY:
        t = token("teacher", employee_id(name, dept), name)
        call("POST", "/teacher/save-schedule", t, weekly_schedule=sched)
        call("POST", "/teacher/save-manual-status", t, manual_status=manual or "Auto (use schedule)")

    for sid, full, course, year, dept in STUDENTS:
        first = full.split()[0].lower()
        call("POST", "/auth/student/register", student_id=sid, full_name=full, course=course,
             year_level=year, department=dept, pin="2468", email=f"{first}@students.example.edu")

    names = {s[0]: s[1] for s in STUDENTS}
    for sid, prof, dept, category, purpose, final in HISTORY:
        st = token("student", sid, names[sid])
        # The API refuses two requests from one student within three seconds.
        time.sleep(3.2)
        call("POST", "/consultation/request", st, professor_name=prof, department=dept,
             category=category, purpose=purpose)
        if final == "pending":
            continue
        tt = token("teacher", employee_id(prof, dept), prof)
        req = next(r for r in requests.get(f"{API}/teacher/requests/{employee_id(prof, dept)}",
                                           headers={"Authorization": f"Bearer {tt}"}).json()
                   if isinstance(r, dict) and r.get("student_id") == sid)
        call("POST", f"/teacher/requests/{req['id']}/accept", tt)
        if final == "done":
            call("POST", f"/teacher/requests/{req['id']}/done", tt)

    board = requests.get(f"{API}/teacher-logs").json()
    print(json.dumps({d["department"]: {p["name"]: p["status"] for p in d["professors"]} for d in board}, indent=1))


if __name__ == "__main__":
    main()
