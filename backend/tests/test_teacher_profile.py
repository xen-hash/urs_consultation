"""The teacher profile endpoint, and the schedule round trip it exists to serve.

These cover the bug where a teacher's weekly schedule could not survive being
edited: the dashboard had no way to read back what it saved, so its editor
opened on defaults and wrote those over the real schedule on the next save.
Every assertion about ``weekly_schedule`` here fails against the code as it
stood before that fix.
"""

import pytest

SCHEDULE = {
    "monday": {
        "unavailable": False,
        "limit": 7,
        "slots": [
            {"start": "09:00 AM", "end": "11:30 AM"},
            {"start": "01:00 PM", "end": "03:00 PM"},
        ],
    },
    "tuesday": {"unavailable": True, "limit": 0, "slots": []},
    "wednesday": {
        "unavailable": False,
        "limit": 3,
        "slots": [{"start": "07:30 AM", "end": "10:00 AM"}],
    },
}


@pytest.fixture
def as_teacher(a_teacher, auth):
    return auth("teacher", a_teacher["employee_id"], a_teacher["professor_name"])


def profile(client, teacher, headers):
    return client.get(f"/api/teacher/profile/{teacher['employee_id']}",
                      headers=headers).get_json()


def test_fresh_account_reports_no_schedule(client, a_teacher, as_teacher):
    body = profile(client, a_teacher, as_teacher)
    # The key must be present even when empty: its absence is what left the
    # dashboard with no way to tell "none saved" from "not loaded yet".
    assert "weekly_schedule" in body
    assert body["weekly_schedule"] is None
    assert body["manual_status"] == "Auto (use schedule)"


def test_schedule_survives_a_save_and_reload(client, a_teacher, as_teacher):
    saved = client.post("/api/teacher/save-schedule",
                        json={"weekly_schedule": SCHEDULE}, headers=as_teacher)
    assert saved.status_code == 200

    body = profile(client, a_teacher, as_teacher)
    assert body["weekly_schedule"] == SCHEDULE
    # JSONB can come back as text depending on the driver; the client indexes
    # into this by weekday, so a string would be a silent breakage.
    assert isinstance(body["weekly_schedule"], dict)


def test_newest_save_wins(client, a_teacher, as_teacher):
    """teacher_logs is append-only, so "current" is the newest row, not the first."""
    client.post("/api/teacher/save-schedule",
                json={"weekly_schedule": SCHEDULE}, headers=as_teacher)
    later = {"friday": {"unavailable": False, "limit": 1,
                        "slots": [{"start": "04:00 PM", "end": "05:30 PM"}]}}
    client.post("/api/teacher/save-schedule",
                json={"weekly_schedule": later}, headers=as_teacher)

    assert profile(client, a_teacher, as_teacher)["weekly_schedule"] == later


def test_manual_status_round_trips_and_leaves_the_schedule_alone(
    client, a_teacher, as_teacher
):
    client.post("/api/teacher/save-schedule",
                json={"weekly_schedule": SCHEDULE}, headers=as_teacher)
    client.post("/api/teacher/save-manual-status",
                json={"manual_status": "On Leave"}, headers=as_teacher)

    body = profile(client, a_teacher, as_teacher)
    assert body["manual_status"] == "On Leave"
    assert body["weekly_schedule"] == SCHEDULE


def test_clearing_the_override_reads_back_as_auto(client, a_teacher, as_teacher):
    client.post("/api/teacher/save-manual-status",
                json={"manual_status": "In Meeting"}, headers=as_teacher)
    client.post("/api/teacher/save-manual-status",
                json={"manual_status": "Auto (use schedule)"}, headers=as_teacher)

    # save_manual_status stores NULL when the teacher is not overriding, so the
    # endpoint has to spell the absence the way the dropdown does.
    assert profile(client, a_teacher, as_teacher)["manual_status"] == "Auto (use schedule)"


def test_existing_fields_are_unchanged(client, a_teacher, as_teacher):
    body = profile(client, a_teacher, as_teacher)
    for field in ("employee_id", "professor_name", "department",
                  "has_pin", "daily_limit"):
        assert field in body, f"{field} disappeared from the profile response"


def test_another_teachers_profile_is_refused(client, another_teacher, as_teacher):
    res = client.get(f"/api/teacher/profile/{another_teacher['employee_id']}",
                     headers=as_teacher)
    assert res.status_code in (401, 403)


def test_profile_requires_a_session(client, a_teacher):
    res = client.get(f"/api/teacher/profile/{a_teacher['employee_id']}")
    assert res.status_code == 401


def test_admin_may_read_any_profile(client, a_teacher, auth):
    res = client.get(f"/api/teacher/profile/{a_teacher['employee_id']}",
                     headers=auth("admin", "testadmin"))
    assert res.status_code == 200
