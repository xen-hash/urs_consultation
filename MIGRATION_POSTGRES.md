# Moving off MySQL onto free PostgreSQL

The backend now talks to PostgreSQL instead of MySQL. Neon and Supabase both
have free tiers that do not expire, which is the point of the change.

Everything is driven by one environment variable, `DATABASE_URL`.

---

## STEP 1 — Create the free database

**Neon** (recommended — the free tier stays free and needs no card)

1. Go to https://neon.tech → sign up → **Create project**
2. Region: pick the one closest to you (Singapore is nearest the Philippines)
3. On the project dashboard, copy the **Connection string**. It looks like:

```
postgresql://neondb_owner:npg_xxxxxxxx@ep-cool-name-12345.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

**Supabase** is the alternative: https://supabase.com → New project →
Settings → Database → **Connection string → URI**. Swap in the password you
chose when creating the project.

> Neon free projects suspend after ~5 minutes idle and wake on the next query,
> which adds about a second to the first request. The UptimeRobot ping you
> already have keeps the backend awake; it keeps the database awake too.

---

## STEP 2 — Point the backend at it

Set this on your host (Railway → Variables, or Render → Environment):

```
DATABASE_URL = postgresql://neondb_owner:npg_xxxx@ep-xxx.neon.tech/neondb?sslmode=require
```

Then delete the now-unused `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` and
`DB_PORT` variables.

Keep `SECRET_KEY`, `ALLOWED_ORIGINS`, `KIOSK_PASSWORD` and `ADMIN_PASSWORD`
exactly as they were.

Redeploy. On boot the app creates every table and re-seeds the professor list,
so an empty database is fine — you do not need to run any SQL by hand.

Check it worked:

```
https://your-backend-url/api/health   →   {"status": "ok", "time": "..."}
```

---

## STEP 3 — Bring the old data across

Do this only if the old MySQL database is still reachable. It reads from MySQL
and never writes to it, so the old data is not at risk.

Run it from your own PC (it needs to reach both databases):

```bash
cd backend
pip install -r requirements.txt

# The OLD MySQL database — Railway shows this as MYSQL_URL or MYSQL_PUBLIC_URL
export MYSQL_URL="mysql://root:oldpassword@containers-us-west-1.railway.app:6543/railway"

# The NEW Postgres database
export DATABASE_URL="postgresql://neondb_owner:npg_xxxx@ep-xxx.neon.tech/neondb?sslmode=require"

# Look first — reads and converts everything, writes nothing
python migrate_mysql_to_postgres.py --dry-run

# Then do it for real
python migrate_mysql_to_postgres.py
```

On Windows PowerShell use `$env:MYSQL_URL = "..."` instead of `export`.

The script prints a table of how many rows it read and how many the new
database now holds:

```
TABLE                       READ    BEFORE     AFTER  STATUS
----------------------------------------------------------------
professors                     3        42        42  ok
students                     146         0       146  ok
teacher_accounts              31         0        31  ok
teacher_logs                 892         0       892  ok
consultation_requests       1204         0      1204  ok
biometrics                     0         0         0  absent in MySQL
```

It is safe to run more than once — rows already copied are skipped, not
duplicated. Useful flags:

| Flag | What it does |
|---|---|
| `--dry-run` | Read and convert only, write nothing |
| `--overwrite` | Update rows that already exist instead of skipping them |
| `--truncate` | Empty the Postgres tables first (asks before deleting) |
| `--only students,teacher_logs` | Restrict to certain tables |

### Things the script will tell you about

- **`professors` shows BEFORE 42 / AFTER 42.** Expected. The app seeds the
  professor roster from `config.py` on every startup, so those rows already
  exist. The script matches them by name and department rather than by id, and
  rewrites `consultation_requests.professor_id` to point at the new ids.
- **`biometrics: absent in MySQL`.** Also expected — that table was never
  created on the MySQL side. Postgres creates it properly now.
- **`source-only columns ignored`.** A column exists in MySQL that the current
  schema doesn't have. Nothing you need is dropped silently; it names the column.
- **`status: 'X' -> 'pending'`.** A request had a status outside
  pending/done/declined/archived and was normalised.

---

## STEP 4 — Verify

Log in as a student and as a teacher, check the dashboard lists your
professors, and download an export from the dean view. If the counts in the
migration report match what you expect, you're done.

---

## What changed in the code

| | Before | After |
|---|---|---|
| Driver | `pymysql` | `pg8000` (pure Python, so the single gevent worker isn't blocked during queries) |
| Config | `DB_HOST` / `DB_USER` / `DB_PASS` / … | one `DATABASE_URL` (the `DB_*` variables still work) |
| Connections | one new connection per query | a small pool, `DB_POOL_SIZE` (default 3, `0` disables) |
| TLS | none | on automatically for remote hosts; `DB_SSLMODE` overrides |
| `status` column | MySQL `ENUM` | `VARCHAR` + `CHECK` constraint |
| `manual` column | `TINYINT(1)` | real `BOOLEAN` |
| `weekly_schedule` | `JSON` | `JSONB` |
| `photo` | `MEDIUMTEXT` | `TEXT` |
| `biometrics` table | referenced but never created | created |

Two fixes came along with the move:

- The `biometrics` table was written to by the biometric enrolment route but
  was never created by `init_db()`, so enrolment always failed. It exists now.
- `Procfile` and `render.yaml` asked gunicorn for the `eventlet` worker, but
  `eventlet` isn't in `requirements.txt` and `app.py` configures Socket.IO with
  `async_mode="gevent"`. Both now say `gevent`, matching `nixpacks.toml`.

---

## Timezone convention

Two clocks write to these tables, and mixing them up caused two live bugs
(both fixed):

| Column | Clock | Written by |
|---|---|---|
| `created_at`, `enrolled_at` | **UTC** | the database (`DEFAULT CURRENT_TIMESTAMP`) |
| `request_time`, `log_time`, `appointment_set_at` | **Manila** | the app |

`db.py` pins every connection to `SET TIME ZONE 'UTC'`, so `created_at` means
the same thing on Neon, on Supabase and on a laptop. Anything comparing
against `created_at` must convert to UTC first — see
`_manila_day_utc_bounds()` in `export.py`.

> If your old MySQL server was **not** running in UTC, the `created_at` values
> copied across will be offset by however far its clock was from UTC.
> `request_time` is unaffected (the app always wrote Manila time into it), and
> the professor dashboard's daily counts use `request_time`, so they stay
> correct either way. Railway's MySQL ran UTC, so normally there is nothing
> to do here.

---

### Rolling back

The MySQL code is one commit back in git, and this migration only ever reads
from MySQL — the old database is untouched. To go back, revert the commit and
restore the old `DB_*` environment variables.
