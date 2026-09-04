"""Shared fixtures for the backend test suite.

Everything here runs against a real PostgreSQL. The app's data layer is pg8000
talking to Postgres-specific SQL — JSONB casts, ``ON CONFLICT``, ``%s::timestamp``
— so a SQLite stand-in would test a different program than the one that ships.

The environment has to be set before anything imports ``config``: it reads the
connection settings at import time, and ``models.init_db()`` runs at import of
``app``. Hence the assignments at module scope, above the app imports.
"""

import os
import pathlib
import sys

import pytest

BACKEND = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

# Point at the test database *unconditionally*, rather than falling back to
# whatever DATABASE_URL happens to be exported. The suite truncates tables
# between tests, so inheriting a developer's real connection string would empty
# their database. Opting in through TEST_DATABASE_URL is the only way to aim
# this somewhere else.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://urs@127.0.0.1:55432/ursdb_test"
)
# config refuses to boot on built-in defaults unless this is set. These are
# throwaway values for a throwaway database.
os.environ["ALLOW_INSECURE_DEFAULTS"] = "1"
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used-anywhere-real")
os.environ.setdefault("ADMIN_USERNAME", "testadmin")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")

import app as app_module  # noqa: E402
import security  # noqa: E402
import teacher as teacher_module  # noqa: E402
from db import query  # noqa: E402

# Seeded by init_db from config.PROFESSOR_LIST and needed by most tests, so
# these are left alone between tests. Everything else is per-test state.
TRANSACTIONAL_TABLES = (
    "consultation_requests",
    "teacher_logs",
    "audit_log",
    "biometrics",
    "students",
)


@pytest.fixture(scope="session")
def flask_app():
    """The real application object. Importing it already ran init_db()."""
    app_module.app.config.update(TESTING=True)
    return app_module.app


@pytest.fixture
def client(flask_app, clean_db):
    return flask_app.test_client()


@pytest.fixture
def clean_db():
    """Empty the per-test tables and drop the in-process state that outlives them.

    The caches and the rate limiter are module-level dicts (single gunicorn
    worker by design — see the Procfile), so without this a cached availability
    payload or a spent login allowance leaks from one test into the next.
    """
    query("TRUNCATE " + ", ".join(TRANSACTIONAL_TABLES) + " RESTART IDENTITY CASCADE")
    security._attempts.clear()
    teacher_module._logs_cache.update({"data": None, "ts": 0, "photos": {}})
    teacher_module._students_cache.update({"data": None, "ts": 0, "key": ""})
    teacher_module._requests_cache.update({"data": None, "ts": 0, "key": ""})
    yield


@pytest.fixture
def a_teacher():
    """One seeded faculty account, as a dict."""
    return query(
        "SELECT employee_id, professor_name, department FROM teacher_accounts "
        "WHERE removed_at IS NULL ORDER BY id LIMIT 1",
        fetchone=True,
    )


@pytest.fixture
def another_teacher(a_teacher):
    return query(
        "SELECT employee_id, professor_name, department FROM teacher_accounts "
        "WHERE employee_id<>%s AND removed_at IS NULL ORDER BY id LIMIT 1",
        (a_teacher["employee_id"],),
        fetchone=True,
    )


@pytest.fixture
def make_student():
    """Insert a student and return the row. Verified unless told otherwise."""

    def _make(student_id="2021-00001", name="Test Student", verified=True,
              course="BS Computer Engineering",
              department="Computer Engineering Department"):
        query(
            """INSERT INTO students (student_id, full_name, course, year_level,
                                     department, verified)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            (student_id, name, course, "3rd Year", department, verified),
        )
        return query("SELECT * FROM students WHERE student_id=%s",
                     (student_id,), fetchone=True)

    return _make


@pytest.fixture
def auth():
    """Authorization headers for a role, signed the way the app signs them."""

    def _auth(role, subject_id, name=None):
        token = security.issue_token(role, subject_id, name)
        return {"Authorization": f"Bearer {token}"}

    return _auth
