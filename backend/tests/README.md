# Backend tests

The suite runs against a **real PostgreSQL**. The data layer is Postgres-specific
— JSONB casts, `ON CONFLICT`, `%s::timestamp`, `RESTART IDENTITY CASCADE` — so a
SQLite stand-in would test a different program than the one that ships.

## Running them

Anything that speaks Postgres will do. With Docker:

```bash
docker run --rm -d --name urs-test-db \
  -e POSTGRES_USER=urs -e POSTGRES_PASSWORD=urs -e POSTGRES_DB=ursdb_test \
  -p 55432:5432 postgres:16

pip install -r backend/requirements-dev.txt
pytest                    # from the repository root
```

The default connection string is
`postgresql://urs@127.0.0.1:55432/ursdb_test`. Point somewhere else with:

```bash
TEST_DATABASE_URL=postgresql://user:pass@host:5432/somedb pytest
```

## The database gets emptied

`conftest.py` truncates `consultation_requests`, `teacher_logs`, `audit_log`,
`biometrics` and `students` between tests. It therefore sets `DATABASE_URL`
**unconditionally** rather than falling back to whatever happens to be exported —
inheriting a developer's real connection string would empty their database.
`TEST_DATABASE_URL` is the only way to aim it somewhere else, and it should never
be aimed at anything you would miss.

The seeded `professors` and `teacher_accounts` rows are left in place: `init_db()`
creates them from `config.PROFESSOR_LIST` at import, and most tests need faculty
to exist.

## What is covered

| File | Subject |
|---|---|
| `test_teacher_profile.py` | The schedule round trip — the bug where a teacher's weekly schedule could not survive being edited |
| `test_consultation_requests.py` | Who may file a request, and the duplicate and cooldown guards |
| `test_availability.py` | `_compute_status`, with the Manila clock frozen |
| `test_security.py` | Session tokens, ownership guards, the rate limiter |

## Writing more

Useful fixtures in `conftest.py`:

- `client` — Flask test client, with the database already cleaned
- `auth(role, id, name=None)` — Authorization headers signed the way the app signs them
- `make_student(...)` — inserts a student, verified unless told otherwise
- `a_teacher` / `another_teacher` — seeded faculty accounts

The in-process caches and the rate limiter are module-level dicts (one gunicorn
worker by design — see the `Procfile`). `conftest` resets them between tests; a
new one needs adding there too, or its state will leak from one test into the
next.
