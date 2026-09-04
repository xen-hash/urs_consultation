"""The notification centre, and who is allowed to read what.

The ownership tests carry the most weight. Notifications quote consultation
purposes and student names back at their recipient, so a listing that could be
pointed at someone else's id would be a worse leak than anything the socket
rooms guard.
"""

import pytest

import notifications as notify_mod
from db import query


@pytest.fixture
def student(make_student):
    return make_student()


@pytest.fixture
def as_student(student, auth):
    return auth("student", student["student_id"], student["full_name"])


@pytest.fixture
def as_teacher(a_teacher, auth):
    return auth("teacher", a_teacher["employee_id"], a_teacher["professor_name"])


@pytest.fixture
def filed(client, as_student, a_teacher):
    res = client.post("/api/consultation/request", json={
        "professor_name": a_teacher["professor_name"],
        "department": a_teacher["department"],
        "purpose": "Thesis consultation",
        "category": "Thesis",
    }, headers=as_student)
    assert res.status_code == 201
    return query("SELECT * FROM consultation_requests", fetchone=True)


def rows_for(role, recipient_id):
    return query(
        "SELECT * FROM notifications WHERE recipient_role=%s AND recipient_id=%s "
        "ORDER BY id",
        (role, str(recipient_id)), fetchall=True
    ) or []


class TestTheTransitionsThatNotify:
    def test_filing_a_request_notifies_the_teacher(self, filed, a_teacher):
        kinds = [r["kind"] for r in rows_for("teacher", a_teacher["employee_id"])]
        assert notify_mod.NEW_REQUEST in kinds

    def test_accepting_notifies_the_student(self, client, filed, student, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        kinds = [r["kind"] for r in rows_for("student", student["student_id"])]
        assert notify_mod.REQUEST_ACCEPTED in kinds

    def test_declining_notifies_the_student(self, client, filed, student, as_teacher):
        """A decline used to be invisible until they next opened the app."""
        client.post(f"/api/teacher/requests/{filed['id']}/decline", headers=as_teacher)
        kinds = [r["kind"] for r in rows_for("student", student["student_id"])]
        assert notify_mod.REQUEST_DECLINED in kinds

    def test_completing_notifies_the_student(self, client, filed, student, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/done", headers=as_teacher)
        kinds = [r["kind"] for r in rows_for("student", student["student_id"])]
        assert notify_mod.REQUEST_DONE in kinds

    def test_setting_an_appointment_notifies_the_student(self, client, filed,
                                                         student, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/appoint",
                    json={"appointment_date": "2026-09-10",
                          "appointment_time": "10:00 AM",
                          "appointment_notes": "Bring your draft"},
                    headers=as_teacher)
        rows = [r for r in rows_for("student", student["student_id"])
                if r["kind"] == notify_mod.APPOINTMENT_SET]
        assert rows and "2026-09-10" in rows[0]["body"]

    def test_withdrawing_notifies_the_teacher(self, client, filed, a_teacher, as_student):
        client.post(f"/api/consultation/request/{filed['id']}/cancel", headers=as_student)
        kinds = [r["kind"] for r in rows_for("teacher", a_teacher["employee_id"])]
        assert notify_mod.REQUEST_CANCELLED in kinds

    def test_confirming_enrolment_notifies_the_student(self, client, student, auth):
        client.post(f"/api/admin/students/{student['student_id']}/verify",
                    json={"verified": True}, headers=auth("admin", "testadmin"))
        kinds = [r["kind"] for r in rows_for("student", student["student_id"])]
        assert notify_mod.ACCOUNT_VERIFIED in kinds

    def test_withdrawing_confirmation_does_not_notify(self, client, student, auth):
        """Telling someone their access was taken away is a conversation, not a bell."""
        client.post(f"/api/admin/students/{student['student_id']}/verify",
                    json={"verified": False}, headers=auth("admin", "testadmin"))
        kinds = [r["kind"] for r in rows_for("student", student["student_id"])]
        assert notify_mod.ACCOUNT_VERIFIED not in kinds


class TestNothingIsWrittenForAWriteThatFailed:
    def test_a_refused_request_notifies_nobody(self, client, make_student, auth,
                                               a_teacher):
        pending = make_student(student_id="2021-07777", verified=False)
        res = client.post("/api/consultation/request", json={
            "professor_name": a_teacher["professor_name"],
            "department": a_teacher["department"],
            "purpose": "Nope", "category": "Other",
        }, headers=auth("student", pending["student_id"]))
        assert res.status_code == 403
        assert rows_for("teacher", a_teacher["employee_id"]) == []

    def test_a_refused_accept_notifies_nobody(self, client, filed, student,
                                              another_teacher, auth):
        before = len(rows_for("student", student["student_id"]))
        res = client.post(f"/api/teacher/requests/{filed['id']}/accept",
                          headers=auth("teacher", another_teacher["employee_id"]))
        assert res.status_code == 403
        assert len(rows_for("student", student["student_id"])) == before


class TestReadingYourOwn:
    def test_the_listing_is_scoped_to_the_caller(self, client, filed, student,
                                                 as_student, a_teacher, as_teacher):
        """There is no id in the request to point somewhere else."""
        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)

        mine = client.get("/api/notifications", headers=as_student).get_json()
        assert all(r["kind"] != notify_mod.NEW_REQUEST for r in mine["data"]), \
            "a student was shown the teacher's notification"

        theirs = client.get("/api/notifications", headers=as_teacher).get_json()
        assert any(r["kind"] == notify_mod.NEW_REQUEST for r in theirs["data"])

    def test_an_anonymous_caller_gets_nothing(self, client):
        assert client.get("/api/notifications").status_code == 401

    def test_newest_first(self, client, student, as_student):
        for i in range(3):
            notify_mod.notify("student", student["student_id"], "test", f"n{i}")
        titles = [r["title"] for r in
                  client.get("/api/notifications", headers=as_student).get_json()["data"]]
        assert titles == ["n2", "n1", "n0"]

    def test_paging(self, client, student, as_student):
        for i in range(5):
            notify_mod.notify("student", student["student_id"], "test", f"n{i}")
        body = client.get("/api/notifications?page=2&limit=2",
                          headers=as_student).get_json()
        assert len(body["data"]) == 2 and body["total"] == 5

    def test_the_page_size_is_capped(self, client, as_student):
        body = client.get("/api/notifications?limit=100000",
                          headers=as_student).get_json()
        assert body["limit"] == notify_mod.MAX_PAGE_SIZE

    def test_junk_paging_is_refused(self, client, as_student):
        assert client.get("/api/notifications?page=abc",
                          headers=as_student).status_code == 400

    def test_unread_only(self, client, student, as_student):
        first = notify_mod.notify("student", student["student_id"], "test", "read me")
        notify_mod.notify("student", student["student_id"], "test", "still unread")
        client.post(f"/api/notifications/{first}/read", headers=as_student)

        body = client.get("/api/notifications?unread=1", headers=as_student).get_json()
        assert [r["title"] for r in body["data"]] == ["still unread"]


class TestReadState:
    def test_the_count_starts_at_zero_and_follows_writes(self, client, student,
                                                         as_student):
        assert client.get("/api/notifications/unread-count",
                          headers=as_student).get_json()["unread"] == 0
        notify_mod.notify("student", student["student_id"], "test", "hello")
        assert client.get("/api/notifications/unread-count",
                          headers=as_student).get_json()["unread"] == 1

    def test_marking_one_read(self, client, student, as_student):
        nid = notify_mod.notify("student", student["student_id"], "test", "hello")
        body = client.post(f"/api/notifications/{nid}/read", headers=as_student).get_json()
        assert body["unread"] == 0

    def test_marking_all_read(self, client, student, as_student):
        for i in range(3):
            notify_mod.notify("student", student["student_id"], "test", f"n{i}")
        assert client.post("/api/notifications/read-all",
                           headers=as_student).get_json()["unread"] == 0

    def test_read_state_is_on_the_server_not_the_device(self, client, student,
                                                        as_student, auth):
        """It used to live in one browser's localStorage, so a second device
        showed everything as unread again."""
        nid = notify_mod.notify("student", student["student_id"], "test", "hello")
        client.post(f"/api/notifications/{nid}/read", headers=as_student)

        # A different session for the same person — a second device.
        other_device = auth("student", student["student_id"], student["full_name"])
        assert client.get("/api/notifications/unread-count",
                          headers=other_device).get_json()["unread"] == 0

    def test_marking_someone_elses_as_read_does_nothing(self, client, student,
                                                        make_student, auth):
        nid = notify_mod.notify("student", student["student_id"], "test", "private")
        other = make_student(student_id="2021-08888", name="Other")
        client.post(f"/api/notifications/{nid}/read",
                    headers=auth("student", other["student_id"]))

        row = query("SELECT read_at FROM notifications WHERE id=%s", (nid,), fetchone=True)
        assert row["read_at"] is None, "another student marked this one read"


class TestNotifyItself:
    def test_a_missing_recipient_is_a_no_op(self):
        assert notify_mod.notify("student", None, "test", "x") is None
        assert notify_mod.notify(None, "2021-00001", "test", "x") is None

    def test_a_storage_failure_does_not_raise(self, monkeypatch):
        """The change being announced has already been committed."""
        def boom(*a, **k):
            raise RuntimeError("database is down")

        monkeypatch.setattr(notify_mod, "query", boom)
        assert notify_mod.notify("student", "2021-00001", "test", "x") is None

    def test_it_pushes_to_the_recipients_room(self, student, monkeypatch):
        import realtime

        sent = []

        class FakeSocketIO:
            def emit(self, event, payload, to=None):
                sent.append((event, payload, to))

        monkeypatch.setattr(realtime, "_socketio", FakeSocketIO())
        notify_mod.notify("student", student["student_id"], "test", "hello")

        assert sent and sent[0][0] == "notification"
        assert sent[0][2] == realtime.student_room(student["student_id"])
