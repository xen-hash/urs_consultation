"""The connect handler, exercised through real Socket.IO clients.

The tests in test_realtime.py assert which room each event is addressed to.
These assert the other half — that a client only ends up in the rooms it is
entitled to — which is what actually makes the addressing mean anything.
"""

import pytest

import app as app_module
import realtime
from security import issue_token

socketio = app_module.socketio


def connect(auth=None):
    return socketio.test_client(app_module.app, auth=auth)


def events(client):
    """Event names this client has been sent since it last flushed."""
    return {msg["name"] for msg in client.get_received()}


@pytest.fixture
def anonymous():
    """A public availability screen: connected, with no session at all."""
    client = connect()
    client.get_received()
    yield client
    client.disconnect()


@pytest.fixture
def signed_in_teacher(a_teacher):
    client = connect({"token": issue_token("teacher", a_teacher["employee_id"])})
    client.get_received()
    yield client
    client.disconnect()


class TestAnonymousConnections:
    def test_a_screen_with_no_session_still_connects(self, anonymous):
        """The availability board is a public read-only display."""
        assert anonymous.is_connected()

    def test_it_hears_availability(self, anonymous):
        realtime.availability_changed("Engr. Someone", "Some Department")
        assert "status_update" in events(anonymous)

    def test_it_does_not_hear_a_teachers_requests(self, anonymous, a_teacher):
        """The leak the old design had: purposes on a wall display."""
        realtime.request_filed({
            "id": 1,
            "professor_name": a_teacher["professor_name"],
            "student_name": "Juan Dela Cruz",
            "category": "Thesis",
            "purpose": "Something private",
        })
        assert "new_request" not in events(anonymous)

    def test_it_does_not_hear_a_students_updates(self, anonymous):
        realtime.request_resolved("2021-00001", "Engr. Someone", 1, "declined")
        assert "request_update" not in events(anonymous)


class TestGarbageTokens:
    @pytest.mark.parametrize("auth", [
        {"token": "not-a-token"},
        {"token": ""},
        {},
        None,
        {"token": issue_token("teacher", "T-1")[:-4] + "AAAA"},  # bad signature
    ])
    def test_an_unusable_token_degrades_to_anonymous(self, auth, a_teacher):
        """Refusing the connection would blank the public board on a stale token."""
        client = connect(auth)
        client.get_received()
        try:
            assert client.is_connected()
            realtime.request_filed({
                "id": 1,
                "professor_name": a_teacher["professor_name"],
                "student_name": "Juan Dela Cruz",
                "category": "Thesis",
                "purpose": "Something private",
            })
            assert "new_request" not in events(client)
        finally:
            client.disconnect()


class TestSignedInConnections:
    def test_a_teacher_hears_their_own_requests(self, signed_in_teacher, a_teacher):
        realtime.request_filed({
            "id": 1,
            "professor_name": a_teacher["professor_name"],
            "student_name": "Juan Dela Cruz",
            "category": "Thesis",
            "purpose": "Draft chapter 3",
        })
        assert "new_request" in events(signed_in_teacher)

    def test_a_teacher_does_not_hear_another_teachers_requests(
        self, signed_in_teacher, another_teacher
    ):
        realtime.request_filed({
            "id": 2,
            "professor_name": another_teacher["professor_name"],
            "student_name": "Someone Else",
            "category": "Grades",
            "purpose": "Not their business",
        })
        assert "new_request" not in events(signed_in_teacher)

    def test_a_teacher_still_hears_availability(self, signed_in_teacher):
        realtime.availability_changed("Engr. Someone", "Some Department")
        assert "status_update" in events(signed_in_teacher)

    def test_a_student_hears_only_their_own_request_updates(self):
        mine = connect({"token": issue_token("student", "2021-00001")})
        mine.get_received()
        try:
            realtime.request_resolved("2021-00002", "Engr. Someone", 9, "done")
            assert "request_update" not in events(mine)

            realtime.request_resolved("2021-00001", "Engr. Someone", 8, "done")
            assert "request_update" in events(mine)
        finally:
            mine.disconnect()

    def test_an_admin_is_not_put_in_every_teachers_room(self, a_teacher):
        """Joining them all would hand the dashboard names it does not display."""
        admin = connect({"token": issue_token("admin", "testadmin")})
        admin.get_received()
        try:
            realtime.request_filed({
                "id": 3,
                "professor_name": a_teacher["professor_name"],
                "student_name": "Juan Dela Cruz",
                "category": "Thesis",
                "purpose": "Private",
            })
            assert "new_request" not in events(admin)
        finally:
            admin.disconnect()
