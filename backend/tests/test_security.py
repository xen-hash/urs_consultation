"""Session tokens, ownership guards and the rate limiter.

These are the primitives every route leans on, so a regression here is a
regression everywhere at once.
"""

import time

import pytest
from itsdangerous import BadSignature

import security
from security import (
    _serializer,
    clear_rate_limit,
    issue_token,
    rate_limit,
)


class TestTokens:
    def test_a_token_round_trips_its_claims(self):
        claims = _serializer.loads(issue_token("student", "2021-00001", "A Student"))
        assert claims == {"role": "student", "sub": "2021-00001", "name": "A Student"}

    def test_the_subject_is_always_a_string(self):
        """Employee and student ids are compared as strings by owns()."""
        assert _serializer.loads(issue_token("teacher", 12345))["sub"] == "12345"

    def test_a_tampered_token_is_rejected(self):
        # A token is payload.timestamp.signature, and the payload is base64 —
        # so tampering means editing that segment, not the decoded text. Swap a
        # character in it and leave the original signature in place.
        payload, timestamp, signature = issue_token("student", "2021-00001").split(".")
        swapped = ("B" if payload[-1] != "B" else "C")
        with pytest.raises(BadSignature):
            _serializer.loads(f"{payload[:-1]}{swapped}.{timestamp}.{signature}")

    def test_a_re_signed_payload_is_needed_to_change_a_role(self):
        """The signature is over the claims, so the role cannot be edited in flight."""
        import base64
        import json

        forged = base64.urlsafe_b64encode(
            json.dumps({"role": "admin", "sub": "2021-00001"}).encode()
        ).decode().rstrip("=")
        _, timestamp, signature = issue_token("student", "2021-00001").split(".")
        with pytest.raises(BadSignature):
            _serializer.loads(f"{forged}.{timestamp}.{signature}")

    def test_a_token_signed_with_another_key_is_rejected(self):
        from itsdangerous import URLSafeTimedSerializer

        other = URLSafeTimedSerializer("a-different-secret", salt="urs-session-v1")
        with pytest.raises(BadSignature):
            _serializer.loads(other.dumps({"role": "admin", "sub": "x"}))

    def test_an_expired_token_is_rejected(self):
        token = issue_token("student", "2021-00001")
        with pytest.raises(Exception):
            _serializer.loads(token, max_age=-1)


class TestOwnership:
    """owns() reads the caller from the request context, so these need one."""

    def as_role(self, flask_app, role, subject_id):
        return flask_app.test_request_context(
            headers={"Authorization": f"Bearer {issue_token(role, subject_id)}"}
        )

    def test_a_student_owns_their_own_id(self, flask_app):
        with self.as_role(flask_app, "student", "2021-00001"):
            assert security.owns("2021-00001") is True

    def test_a_student_does_not_own_another_id(self, flask_app):
        with self.as_role(flask_app, "student", "2021-00001"):
            assert security.owns("2021-00002") is False

    def test_comparison_ignores_case(self, flask_app):
        """Employee IDs are typed by hand and upper-cased on the PIN screen."""
        with self.as_role(flask_app, "teacher", "t-30967"):
            assert security.owns("T-30967") is True

    def test_admin_owns_everything(self, flask_app):
        with self.as_role(flask_app, "admin", "testadmin"):
            assert security.owns("anybody-at-all") is True

    def test_nobody_owns_anything_without_a_session(self, flask_app):
        with flask_app.test_request_context():
            assert security.owns("2021-00001") is False

    def test_forbid_unless_owner_answers_401_then_403(self, flask_app):
        with flask_app.test_request_context():
            assert security.forbid_unless_owner("2021-00001")[1] == 401
        with self.as_role(flask_app, "student", "2021-00001"):
            assert security.forbid_unless_owner("2021-00002")[1] == 403
            assert security.forbid_unless_owner("2021-00001") is None


class TestRateLimit:
    @pytest.fixture(autouse=True)
    def _clean(self):
        security._attempts.clear()
        yield
        security._attempts.clear()

    def test_attempts_under_the_limit_are_allowed(self):
        for _ in range(3):
            assert rate_limit("k", limit=3, window_seconds=60) == 0

    def test_the_attempt_over_the_limit_is_refused(self):
        for _ in range(3):
            rate_limit("k", 3, 60)
        assert rate_limit("k", 3, 60) > 0

    def test_keys_are_counted_separately(self):
        for _ in range(3):
            rate_limit("one", 3, 60)
        assert rate_limit("two", 3, 60) == 0

    def test_the_window_expires(self):
        rate_limit("k", 1, 1)
        assert rate_limit("k", 1, 1) > 0
        time.sleep(1.1)
        assert rate_limit("k", 1, 1) == 0

    def test_clearing_restores_the_allowance(self):
        """Called after a successful login, so one bad night is not a lockout."""
        for _ in range(3):
            rate_limit("k", 3, 60)
        clear_rate_limit("k")
        assert rate_limit("k", 3, 60) == 0


class TestLoginThrottling:
    """The limiter as the admin login route actually uses it."""

    def test_repeated_bad_admin_logins_are_throttled(self, client):
        codes = [
            client.post("/api/auth/admin/login",
                        json={"username": "testadmin", "password": "wrong"}).status_code
            for _ in range(8)
        ]
        assert 429 in codes, "brute force against the admin login was never throttled"
