"""What gets pushed, and — more importantly — where it does not go.

The design these tests pin down exists because the previous one had no rooms:
``broadcast_request`` sent the student's name and the purpose of their
consultation to every connected socket, including the anonymous ones on the
public availability board. So the assertions about what the *availability* room
carries matter as much as the ones about delivery.
"""

import pytest

import realtime
from db import query

PROFESSOR = "Engr. Cystaleene Jade A. Santos"
DEPARTMENT = "Computer Engineering Department"


@pytest.fixture
def emitted(monkeypatch):
    """Capture emits instead of sending them. Returns the list of (event, payload, room)."""
    sent = []

    class FakeSocketIO:
        def emit(self, event, payload, to=None):
            sent.append((event, payload, to))

    monkeypatch.setattr(realtime, "_socketio", FakeSocketIO())
    return sent


@pytest.fixture
def student(make_student):
    return make_student()


@pytest.fixture
def as_student(student, auth):
    return auth("student", student["student_id"], student["full_name"])


def a_request():
    return {
        "professor_name": PROFESSOR,
        "department": DEPARTMENT,
        "purpose": "Thesis consultation",
        "category": "Thesis",
    }


def rooms(sent, event):
    return [room for name, _, room in sent if name == event]


def payloads(sent, event):
    return [payload for name, payload, _ in sent if name == event]


class TestNothingLeaksToThePublicRoom:
    def test_filing_a_request_tells_the_teacher_only(self, client, as_student, emitted):
        client.post("/api/consultation/request", json=a_request(), headers=as_student)

        employee_id = realtime.employee_id_for(PROFESSOR)
        assert rooms(emitted, "new_request") == [f"teacher:{employee_id}"]

    def test_the_public_room_never_carries_a_student_or_a_purpose(
        self, client, as_student, emitted
    ):
        """The whole reason the old design could not simply be given a token."""
        client.post("/api/consultation/request", json=a_request(), headers=as_student)

        public = [p for name, p, room in emitted if room == realtime.AVAILABILITY_ROOM]
        assert public, "the board was never told its slot count changed"
        for payload in public:
            flat = str(payload).lower()
            assert "thesis consultation" not in flat
            assert "test student" not in flat
            assert "student_name" not in payload
            assert "purpose" not in payload

    def test_availability_carries_only_who_and_where(self, emitted):
        realtime.availability_changed(PROFESSOR, DEPARTMENT)
        assert payloads(emitted, "status_update") == [
            {"professor_name": PROFESSOR, "department": DEPARTMENT}
        ]


class TestDeliveryToBothSides:
    def test_resolving_a_request_reaches_the_student_and_the_teacher(
        self, client, student, as_student, a_teacher, auth, emitted
    ):
        # File against the teacher whose account the fixture hands back, so the
        # ownership guard on the resolving route passes.
        body = a_request()
        body["professor_name"] = a_teacher["professor_name"]
        body["department"] = a_teacher["department"]
        client.post("/api/consultation/request", json=body, headers=as_student)
        req_id = query("SELECT id FROM consultation_requests", fetchone=True)["id"]

        emitted.clear()
        client.post(f"/api/teacher/requests/{req_id}/done",
                    headers=auth("teacher", a_teacher["employee_id"]))

        assert set(rooms(emitted, "request_update")) == {f"student:{student['student_id']}"}
        assert rooms(emitted, "consultation_update") == [
            f"teacher:{a_teacher['employee_id']}"
        ]
        assert payloads(emitted, "request_update")[0]["status"] == "done"

    def test_a_decline_reaches_the_student(
        self, client, student, as_student, a_teacher, auth, emitted
    ):
        body = a_request()
        body["professor_name"] = a_teacher["professor_name"]
        body["department"] = a_teacher["department"]
        client.post("/api/consultation/request", json=body, headers=as_student)
        req_id = query("SELECT id FROM consultation_requests", fetchone=True)["id"]

        emitted.clear()
        client.post(f"/api/teacher/requests/{req_id}/decline",
                    headers=auth("teacher", a_teacher["employee_id"]))
        assert payloads(emitted, "request_update")[0]["status"] == "declined"

    def test_a_status_change_reaches_the_board(self, client, a_teacher, auth, emitted):
        client.post("/api/teacher/save-manual-status",
                    json={"manual_status": "On Leave"},
                    headers=auth("teacher", a_teacher["employee_id"]))
        assert realtime.AVAILABILITY_ROOM in rooms(emitted, "status_update")

    def test_a_schedule_save_reaches_the_board(self, client, a_teacher, auth, emitted):
        client.post("/api/teacher/save-schedule",
                    json={"weekly_schedule": {"monday": {"unavailable": True, "slots": []}}},
                    headers=auth("teacher", a_teacher["employee_id"]))
        assert realtime.AVAILABILITY_ROOM in rooms(emitted, "status_update")


class TestNothingIsAnnouncedForAWriteThatFailed:
    def test_a_refused_request_emits_nothing(self, client, make_student, auth, emitted):
        pending = make_student(student_id="2021-09999", verified=False)
        res = client.post("/api/consultation/request", json=a_request(),
                          headers=auth("student", pending["student_id"]))
        assert res.status_code == 403
        assert emitted == []

    def test_resolving_someone_elses_request_emits_nothing(
        self, client, as_student, a_teacher, another_teacher, auth, emitted
    ):
        body = a_request()
        body["professor_name"] = a_teacher["professor_name"]
        body["department"] = a_teacher["department"]
        client.post("/api/consultation/request", json=body, headers=as_student)
        req_id = query("SELECT id FROM consultation_requests", fetchone=True)["id"]

        emitted.clear()
        res = client.post(f"/api/teacher/requests/{req_id}/done",
                          headers=auth("teacher", another_teacher["employee_id"]))
        assert res.status_code == 403
        assert emitted == []


class TestClientsCanNoLongerAnnounceAnything:
    """The forgery surface is removed rather than guarded.

    flask_socketio registers handlers straight onto the underlying server when
    the app is passed to the constructor, so that — not SocketIO.handlers, which
    stays empty — is the registry to read.
    """

    def handlers(self):
        import app as app_module

        return set(app_module.socketio.server.handlers.get("/", {}))

    @pytest.mark.parametrize("event", [
        "broadcast_request", "broadcast_status", "broadcast_request_done",
    ])
    def test_the_old_relay_handlers_are_gone(self, flask_app, event):
        """A client emitting one of these used to be rebroadcast to everyone."""
        assert event not in self.handlers()

    def test_only_the_connection_lifecycle_is_handled(self, flask_app):
        """Anything else accepted from a client is a channel for forged events."""
        assert self.handlers() == {"connect", "disconnect"}


class TestEmitFailureIsNotFatal:
    def test_a_broken_transport_does_not_fail_the_request(
        self, client, as_student, monkeypatch
    ):
        """A request that was written must not 500 because the push failed."""

        class ExplodingSocketIO:
            def emit(self, *a, **k):
                raise RuntimeError("transport is down")

        monkeypatch.setattr(realtime, "_socketio", ExplodingSocketIO())
        res = client.post("/api/consultation/request", json=a_request(),
                          headers=as_student)
        assert res.status_code == 201
        assert query("SELECT COUNT(*) AS n FROM consultation_requests",
                     fetchone=True)["n"] == 1


class TestRoomNaming:
    def test_rooms_are_namespaced_so_ids_cannot_collide(self):
        # A student id and an employee id could otherwise be the same string.
        assert realtime.teacher_room("X1") != realtime.student_room("X1")

    def test_employee_id_lookup_finds_a_seeded_teacher(self, clean_db):
        assert realtime.employee_id_for(PROFESSOR) is not None

    def test_employee_id_lookup_is_none_for_a_stranger(self, clean_db):
        assert realtime.employee_id_for("Nobody At All") is None

    def test_employee_id_lookup_handles_none(self, clean_db):
        assert realtime.employee_id_for(None) is None
