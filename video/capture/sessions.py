"""Write capture/sessions.json: a signed-in session per role, in the shape the
frontend keeps in sessionStorage ({token, profile}). Run after seed.py."""
import json
from pathlib import Path

import requests

from seed import API, FACULTY, employee_id, token, CE

OUT = Path(__file__).with_name("sessions.json")


def get(path, tok):
    r = requests.get(API + path, headers={"Authorization": f"Bearer {tok}"})
    r.raise_for_status()
    return r.json()


def main():
    admin = token("admin", "dean", "Administrator")
    tid = employee_id("Engr. Ana Villareal", CE)
    t_tok = token("teacher", tid, "Engr. Ana Villareal")
    t_prof = get(f"/teacher/profile/{tid}", t_tok)

    sid = "2023-10452"
    s_tok = token("student", sid, "Mika Soriano")
    s_prof = get(f"/student/profile/{sid}", s_tok)

    OUT.write_text(json.dumps({
        "teacher": {"token": t_tok, "profile": t_prof},
        "student": {"token": s_tok, "profile": s_prof},
        "admin": {"token": admin, "profile": {"username": "dean", "name": "Administrator"}},
        # Every professor's token, so a capture can change anyone's status.
        "faculty": {n: token("teacher", employee_id(n, d), n) for n, d, *_ in FACULTY},
    }, indent=1))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
