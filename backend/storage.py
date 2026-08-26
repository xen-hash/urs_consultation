"""Reclaiming database space after a delete.

A DELETE in Postgres does not free anything. It marks rows dead; the space
becomes reusable by that same table once a vacuum gets to it, and is reliably
returned to the filesystem only by VACUUM FULL, which rewrites the table. On a
free tier with a hard storage ceiling that distinction is the whole game:
without this, deleting a thousand students leaves the database exactly as large
as it was, and the quota keeps counting them.

So there are two levels here, and they do different jobs:

  vacuum(...)       runs after a delete. Plain VACUUM: no exclusive lock, runs
                    in milliseconds on tables this size, and marks the dead
                    space reusable straight away instead of waiting for
                    autovacuum's thresholds. New rows land in the space the
                    deleted ones left behind, so the table stops growing.

                    It also returns space outright when the free pages happen to
                    sit at the end of the table, which VACUUM can truncate —
                    clearing every request measured 46MB -> 8.6MB on nothing but
                    this. Deleting a scattered half of the students, which is the
                    ordinary case, measured no reduction at all. So it is worth
                    doing on every delete and worth nothing to rely on.

  vacuum_full(...)  is the deliberate one, behind an admin action. It rewrites
                    each table and hands the space back to the filesystem
                    whether the free space was at the end or scattered through
                    the middle — the scattered-half case above went 23.8MB ->
                    15.8MB on this and nothing else. It takes an ACCESS
                    EXCLUSIVE lock for the length of each table's rewrite, so it
                    is never run automatically on a delete.

One caveat that belongs with the numbers, not buried: on Neon the storage a
project is billed for includes its history window, so space freed here shows up
after that window passes rather than immediately. VACUUM FULL shrinks the
database; it does not rewind Neon's history.
"""

import re

from db import query, fetch_one, fetch_all
from config import AUDIT_RETENTION_DAYS

# Table names cannot be bound as parameters — they have to be interpolated into
# the SQL text. So they never come from a request: this is the only list, and
# anything not in it is refused before it reaches a statement.
TABLES = (
    "students",
    "teacher_accounts",
    "consultation_requests",
    "teacher_logs",
    "audit_log",
    "professors",
    "biometrics",
)

_SAFE_NAME = re.compile(r"^[a-z_][a-z0-9_]*$")


def _checked(tables):
    """Every name validated twice: against the allowlist and against a pattern."""
    names = tuple(tables) if tables else TABLES
    for name in names:
        if name not in TABLES or not _SAFE_NAME.match(name):
            raise ValueError(f"refusing to vacuum unknown table {name!r}")
    return names


def sizes():
    """Per-table bytes on disk, largest first, plus the database total."""
    rows = fetch_all(
        """SELECT relname AS table,
                  pg_total_relation_size(c.oid) AS bytes
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = current_schema()
              AND c.relkind = 'r'
            ORDER BY pg_total_relation_size(c.oid) DESC"""
    ) or []
    total = fetch_one("SELECT pg_database_size(current_database()) AS bytes")
    return {
        "tables": [{"table": r["table"], "bytes": int(r["bytes"])} for r in rows],
        "total_bytes": int(total["bytes"]) if total else 0,
    }


def _database_bytes():
    row = fetch_one("SELECT pg_database_size(current_database()) AS bytes")
    return int(row["bytes"]) if row else 0


def vacuum(*tables):
    """Mark the space a delete just freed as reusable, now rather than later.

    Cheap and lock-free, so it is safe to call on the delete path. Failure is
    swallowed on purpose: the delete itself already succeeded and committed, and
    turning a successful deletion into an error because the cleanup afterwards
    could not run would be the wrong trade. Autovacuum reaches it eventually
    either way.
    """
    for name in _checked(tables):
        try:
            # VACUUM cannot run inside a transaction; db connections are
            # autocommit, so this is issued on its own.
            query(f"VACUUM (ANALYZE) {name}")
        except Exception:
            continue


def prune_audit(days=None):
    """Drop audit entries past the retention window.

    The audit log is the one table nothing ever deleted from — every sign-in,
    every failed attempt and every admin action, kept forever. At a thousand
    sign-ins a day it outgrows the student photos it was meant to be a footnote
    beside. Keeping a year of it is still a real audit trail.
    """
    window = AUDIT_RETENTION_DAYS if days is None else int(days)
    if window <= 0:
        return 0
    row = fetch_one(
        "SELECT COUNT(*) AS c FROM audit_log "
        "WHERE created_at < NOW() - make_interval(days => %s)", (window,)
    )
    count = int(row["c"]) if row else 0
    if count:
        query("DELETE FROM audit_log WHERE created_at < NOW() - make_interval(days => %s)",
              (window,))
    return count


def vacuum_full(tables=None, prune_days=None):
    """Rewrite the tables and hand the space back to the filesystem.

    Returns what it actually recovered, measured rather than asserted, so the
    caller can show a real number instead of claiming success.
    """
    names = _checked(tables)
    before = _database_bytes()
    pruned = prune_audit(prune_days)

    reclaimed, failed = [], []
    for name in names:
        try:
            query(f"VACUUM (FULL, ANALYZE) {name}")
            reclaimed.append(name)
        except Exception as exc:
            # One table refusing (a lock it cannot take, a permission the host
            # withholds) must not abandon the rest.
            failed.append({"table": name, "error": str(exc)[:200]})

    after = _database_bytes()
    return {
        "before_bytes": before,
        "after_bytes": after,
        # Never negative: concurrent writes during the rewrite can leave the
        # database fractionally larger, and reporting "-4 KB freed" reads as a
        # bug rather than as noise.
        "freed_bytes": max(before - after, 0),
        "tables": reclaimed,
        "failed": failed,
        "audit_rows_pruned": pruned,
    }
