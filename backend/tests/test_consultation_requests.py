"""The guards on filing a consultation request.

These are the rules that keep the request table honest: identity comes from the
session rather than the body, unconfirmed accounts cannot take up a
professor's time, and neither a double-submit nor a stuck retry loop can flood
one professor's queue.
"""

import pytest

from db import query

PROFESSOR = "Engr. Cystaleene Jade A. Santos"
DEPARTMENT = "Computer Engineering Department"


def a_request(**overrides):
    body = {
        "professor_name": PROFESSOR,
        "department": DEPARTMENT,
        "purpose": "Thesis consultation",
        "category": "Thesis",
    }
    body.update(overrides)
    return body


@pytest.fixture
def student(make_student):
    return make_student()


@pytest.fixture
def as_student(student, auth):
    return auth("student", student["student_id"], student["full_name"])


def test_a_verified_student_can_file_a_request(client, as_student):
    res = client.post("/api/consultation/request", json=a_request(), headers=as_student)
    assert res.status_code == 201

    row = query("SELECT * FROM consultation_requests", fetchone=True)
    assert row["status"] == "pending"
    assert row["professor_name"] == PROFESSOR


def test_an_unconfirmed_account_is_refused(client, make_student, auth):
    pending = make_student(student_id="2021-09999", name="Unconfirmed",
                           verified=False)
    headers = auth("student", pending["student_id"], pending["full_name"])

    res = client.post("/api/consultation/request", json=a_request(), headers=headers)
    assert res.status_code == 403
    assert query("SELECT COUNT(*) AS n FROM consultation_requests",
                 fetchone=True)["n"] == 0


def test_identity_comes_from_the_session_not_the_body(client, student, as_student,
                                                      make_student):
    """Filing in someone else's name was possible until the id moved to the token."""
    victim = make_student(student_id="2021-00002", name="Someone Else")

    client.post("/api/consultation/request",
                json=a_request(student_id=victim["student_id"],
                               student_name=victim["full_name"]),
                headers=as_student)

    row = query("SELECT * FROM consultation_requests", fetchone=True)
    assert row["student_id"] == student["student_id"]
    assert row["student_name"] == student["full_name"]


def test_a_second_pending_request_to_the_same_professor_is_refused(client, as_student):
    assert client.post("/api/consultation/request", json=a_request(),
                       headers=as_student).status_code == 201

    # Step past the three-second spam window so this tests the duplicate rule
    # rather than the cooldown.
    query("UPDATE consultation_requests SET created_at = created_at - INTERVAL '1 hour'")

    res = client.post("/api/consultation/request", json=a_request(), headers=as_student)
    assert res.status_code == 429
    assert query("SELECT COUNT(*) AS n FROM consultation_requests",
                 fetchone=True)["n"] == 1


def test_a_resolved_request_does_not_block_a_new_one(client, as_student):
    client.post("/api/consultation/request", json=a_request(), headers=as_student)
    query("UPDATE consultation_requests SET status='done', "
          "created_at = created_at - INTERVAL '1 hour'")

    res = client.post("/api/consultation/request", json=a_request(), headers=as_student)
    assert res.status_code == 201


def test_the_cooldown_blocks_a_rapid_second_request(client, as_student):
    """Three seconds, measured against created_at — which the database writes in UTC.

    Deriving the cutoff from Manila time once put it eight hours in the future,
    so the guard matched nothing at all.
    """
    client.post("/api/consultation/request", json=a_request(), headers=as_student)

    res = client.post("/api/consultation/request",
                      json=a_request(professor_name="Engr. Paul Arvy A. Alfonso"),
                      headers=as_student)
    assert res.status_code == 429


def test_missing_fields_are_rejected(client, as_student):
    for field in ("professor_name", "purpose", "category", "department"):
        body = a_request()
        del body[field]
        res = client.post("/api/consultation/request", json=body, headers=as_student)
        assert res.status_code == 400, f"{field} was accepted while missing"


def test_a_teacher_cannot_file_a_request(client, a_teacher, auth):
    res = client.post("/api/consultation/request", json=a_request(),
                      headers=auth("teacher", a_teacher["employee_id"]))
    assert res.status_code == 403


def test_an_anonymous_caller_cannot_file_a_request(client):
    assert client.post("/api/consultation/request", json=a_request()).status_code == 401


def test_history_is_the_students_own(client, student, as_student, make_student):
    other = make_student(student_id="2021-00003", name="Other Student")
    client.post("/api/consultation/request", json=a_request(), headers=as_student)

    mine = client.get(f"/api/consultation/history/{student['student_id']}",
                      headers=as_student)
    assert mine.status_code == 200

    theirs = client.get(f"/api/consultation/history/{other['student_id']}",
                        headers=as_student)
    assert theirs.status_code in (401, 403)
