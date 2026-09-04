"""Accept, cancel, and the history a teacher could never see.

The capacity assertions are the ones worth reading twice. A day's slots are
counted from the requests that consume them, so a status that is committed but
not yet held has to count — otherwise the same slot is handed out again and the
teacher is quietly overbooked.
"""

import pytest

from db import query
from models import STATUS_VALUES
from teacher import CONSUMING_STATUSES, OPEN_STATUSES


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
    """One pending request from the student to the fixture teacher."""
    res = client.post("/api/consultation/request", json={
        "professor_name": a_teacher["professor_name"],
        "department": a_teacher["department"],
        "purpose": "Thesis consultation",
        "category": "Thesis",
    }, headers=as_student)
    assert res.status_code == 201
    return query("SELECT * FROM consultation_requests", fetchone=True)


def status_of(req_id):
    return query("SELECT status FROM consultation_requests WHERE id=%s",
                 (req_id,), fetchone=True)["status"]


class TestTheStatusVocabulary:
    def test_accepted_and_cancelled_are_allowed_by_the_database(self, filed):
        """Both halves have to change together, or the CHECK rejects the write."""
        for value in ("accepted", "cancelled"):
            query("UPDATE consultation_requests SET status=%s WHERE id=%s",
                  (value, filed["id"]))
            assert status_of(filed["id"]) == value

    def test_an_invented_status_is_still_refused(self, filed):
        with pytest.raises(Exception):
            query("UPDATE consultation_requests SET status='nonsense' WHERE id=%s",
                  (filed["id"],))

    def test_accepted_counts_against_capacity(self):
        """The overbooking trap: committed-but-not-held must consume its slot."""
        assert "accepted" in CONSUMING_STATUSES

    def test_a_resolved_request_frees_its_slot(self):
        for freed in ("declined", "cancelled", "archived"):
            assert freed not in CONSUMING_STATUSES


class TestAccepting:
    def test_a_teacher_can_accept_their_own_request(self, client, filed, as_teacher):
        res = client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        assert res.status_code == 200
        assert status_of(filed["id"]) == "accepted"

    def test_accepting_records_when(self, client, filed, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        row = query("SELECT accepted_at FROM consultation_requests WHERE id=%s",
                    (filed["id"],), fetchone=True)
        assert row["accepted_at"] is not None

    def test_accepting_is_audited(self, client, filed, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        assert query("SELECT 1 FROM audit_log WHERE action='request.accept'",
                     fetchone=True) is not None

    def test_another_teacher_cannot_accept_it(self, client, filed, another_teacher, auth):
        res = client.post(f"/api/teacher/requests/{filed['id']}/accept",
                          headers=auth("teacher", another_teacher["employee_id"]))
        assert res.status_code == 403
        assert status_of(filed["id"]) == "pending"

    def test_a_student_cannot_accept_anything(self, client, filed, as_student):
        res = client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_student)
        assert res.status_code == 403

    def test_a_settled_request_cannot_be_accepted(self, client, filed, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/done", headers=as_teacher)
        res = client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        assert res.status_code == 409
        assert status_of(filed["id"]) == "done"

    def test_an_accepted_request_can_still_be_completed(self, client, filed, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        assert client.post(f"/api/teacher/requests/{filed['id']}/done",
                           headers=as_teacher).status_code == 200
        assert status_of(filed["id"]) == "done"


class TestCancelling:
    def test_a_student_can_withdraw_their_own_request(self, client, filed, as_student):
        res = client.post(f"/api/consultation/request/{filed['id']}/cancel",
                          headers=as_student)
        assert res.status_code == 200
        assert status_of(filed["id"]) == "cancelled"

    def test_cancelling_records_when_and_is_audited(self, client, filed, as_student):
        client.post(f"/api/consultation/request/{filed['id']}/cancel", headers=as_student)
        row = query("SELECT cancelled_at FROM consultation_requests WHERE id=%s",
                    (filed["id"],), fetchone=True)
        assert row["cancelled_at"] is not None
        assert query("SELECT 1 FROM audit_log WHERE action='request.cancel'",
                     fetchone=True) is not None

    def test_an_accepted_request_can_still_be_withdrawn(self, client, filed,
                                                        as_student, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        res = client.post(f"/api/consultation/request/{filed['id']}/cancel",
                          headers=as_student)
        assert res.status_code == 200

    def test_another_student_cannot_cancel_it(self, client, filed, make_student, auth):
        other = make_student(student_id="2021-04444", name="Someone Else")
        res = client.post(f"/api/consultation/request/{filed['id']}/cancel",
                          headers=auth("student", other["student_id"]))
        assert res.status_code == 403
        assert status_of(filed["id"]) == "pending"

    def test_a_teacher_cannot_cancel_on_a_students_behalf(self, client, filed, as_teacher):
        res = client.post(f"/api/consultation/request/{filed['id']}/cancel",
                          headers=as_teacher)
        assert res.status_code == 403

    def test_a_settled_request_cannot_be_cancelled(self, client, filed,
                                                   as_student, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/decline", headers=as_teacher)
        res = client.post(f"/api/consultation/request/{filed['id']}/cancel",
                          headers=as_student)
        assert res.status_code == 409

    def test_cancelling_frees_the_professor_for_a_new_request(
        self, client, filed, as_student, a_teacher
    ):
        """The duplicate guard must not hold a student back after they withdraw."""
        client.post(f"/api/consultation/request/{filed['id']}/cancel", headers=as_student)
        query("UPDATE consultation_requests SET created_at = created_at - INTERVAL '1 hour'")

        res = client.post("/api/consultation/request", json={
            "professor_name": a_teacher["professor_name"],
            "department": a_teacher["department"],
            "purpose": "Second attempt",
            "category": "Thesis",
        }, headers=as_student)
        assert res.status_code == 201


class TestTheDuplicateGuardCoversAccepted:
    def test_a_second_request_while_one_is_accepted_is_refused(
        self, client, filed, as_student, as_teacher, a_teacher
    ):
        """Otherwise one student takes two of the same professor's slots."""
        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        query("UPDATE consultation_requests SET created_at = created_at - INTERVAL '1 hour'")

        res = client.post("/api/consultation/request", json={
            "professor_name": a_teacher["professor_name"],
            "department": a_teacher["department"],
            "purpose": "Again",
            "category": "Thesis",
        }, headers=as_student)
        assert res.status_code == 429


class TestTheQueueAndTheHistory:
    def url(self, a_teacher, suffix=""):
        return f"/api/teacher/requests/{a_teacher['employee_id']}{suffix}"

    def test_the_queue_holds_open_requests(self, client, filed, a_teacher, as_teacher):
        rows = client.get(self.url(a_teacher), headers=as_teacher).get_json()
        assert [r["id"] for r in rows] == [filed["id"]]

    def test_an_accepted_request_stays_in_the_queue(self, client, filed,
                                                    a_teacher, as_teacher):
        """It is still the teacher's to hold; it must not vanish on accept."""
        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        rows = client.get(self.url(a_teacher), headers=as_teacher).get_json()
        assert [r["status"] for r in rows] == ["accepted"]

    def test_a_completed_request_leaves_the_queue(self, client, filed,
                                                  a_teacher, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/done", headers=as_teacher)
        assert client.get(self.url(a_teacher), headers=as_teacher).get_json() == []

    def test_history_shows_what_the_queue_no_longer_does(self, client, filed,
                                                         a_teacher, as_teacher):
        """A teacher could previously never see what they had resolved."""
        client.post(f"/api/teacher/requests/{filed['id']}/done", headers=as_teacher)
        rows = client.get(self.url(a_teacher, "?status=history"),
                          headers=as_teacher).get_json()
        assert [r["status"] for r in rows] == ["done"]

    def test_history_includes_cancellations(self, client, filed, a_teacher,
                                            as_student, as_teacher):
        client.post(f"/api/consultation/request/{filed['id']}/cancel", headers=as_student)
        rows = client.get(self.url(a_teacher, "?status=history"),
                          headers=as_teacher).get_json()
        assert [r["status"] for r in rows] == ["cancelled"]

    def test_a_single_status_can_be_asked_for(self, client, filed, a_teacher, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        rows = client.get(self.url(a_teacher, "?status=accepted"),
                          headers=as_teacher).get_json()
        assert len(rows) == 1

    def test_an_unknown_status_falls_back_to_the_queue(self, client, filed,
                                                       a_teacher, as_teacher):
        """A bad query string must not silently widen what is returned."""
        rows = client.get(self.url(a_teacher, "?status=../etc/passwd"),
                          headers=as_teacher).get_json()
        assert [r["status"] for r in rows] == list(OPEN_STATUSES[:1])

    def test_all_returns_every_status(self, client, filed, a_teacher, as_teacher):
        client.post(f"/api/teacher/requests/{filed['id']}/done", headers=as_teacher)
        rows = client.get(self.url(a_teacher, "?status=all"), headers=as_teacher).get_json()
        assert len(rows) == 1

    def test_another_teachers_queue_is_refused(self, client, another_teacher, as_teacher):
        res = client.get(self.url(another_teacher), headers=as_teacher)
        assert res.status_code in (401, 403)


class TestCapacityAccounting:
    def test_an_accepted_request_still_consumes_a_slot(self, client, filed,
                                                       a_teacher, as_teacher):
        """The whole point: accepting must not hand the slot back out."""
        def slots_left():
            board = client.get("/api/teacher-logs").get_json()
            for dept in board:
                for prof in dept["professors"]:
                    if prof["name"] == a_teacher["professor_name"]:
                        return prof.get("slots_left")
            return None

        query("UPDATE teacher_accounts SET daily_limit=2 WHERE employee_id=%s",
              (a_teacher["employee_id"],))
        import teacher as teacher_module
        teacher_module._logs_cache["ts"] = 0
        before = slots_left()

        client.post(f"/api/teacher/requests/{filed['id']}/accept", headers=as_teacher)
        teacher_module._logs_cache["ts"] = 0
        assert slots_left() == before, "accepting freed the slot it should have kept"

    def test_cancelling_gives_the_slot_back(self, client, filed, a_teacher, as_student):
        import teacher as teacher_module

        query("UPDATE teacher_accounts SET daily_limit=2 WHERE employee_id=%s",
              (a_teacher["employee_id"],))
        teacher_module._logs_cache["ts"] = 0

        def slots_left():
            board = client.get("/api/teacher-logs").get_json()
            for dept in board:
                for prof in dept["professors"]:
                    if prof["name"] == a_teacher["professor_name"]:
                        return prof.get("slots_left")

        taken = slots_left()
        client.post(f"/api/consultation/request/{filed['id']}/cancel", headers=as_student)
        teacher_module._logs_cache["ts"] = 0
        assert slots_left() > taken


class TestStatusValuesStayInStep:
    def test_every_status_the_code_uses_is_in_the_vocabulary(self):
        for value in set(CONSUMING_STATUSES) | set(OPEN_STATUSES) | {"cancelled"}:
            assert value in STATUS_VALUES
