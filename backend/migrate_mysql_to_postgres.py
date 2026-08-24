#!/usr/bin/env python3
"""Copy the URS consultation data out of the old MySQL database into Postgres.

Run this once, from a machine that can reach both databases:

    export MYSQL_URL="mysql://user:pass@host:3306/consultation_system"
    export DATABASE_URL="postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"
    python migrate_mysql_to_postgres.py

It is safe to re-run: existing rows are skipped by primary key unless you pass
--overwrite. Nothing is ever written to the MySQL side.

Options:
    --dry-run     Read and convert everything, but write nothing.
    --truncate    Empty the Postgres tables first (destructive, asks first).
    --overwrite   Update rows that already exist instead of skipping them.
    --only a,b    Restrict to these tables.
    --batch N     Rows per INSERT batch (default 200).
    --yes         Don't prompt for confirmation on --truncate.
"""

import argparse
import json
import os
import sys
from urllib.parse import urlparse, unquote

import pymysql
import pymysql.cursors

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import connect as pg_connect          # noqa: E402
from models import init_db, STATUS_VALUES     # noqa: E402
import config                                 # noqa: E402

# Parents before children, so foreign keys always resolve.
TABLE_ORDER = [
    "professors",
    "students",
    "teacher_accounts",
    "teacher_logs",
    "consultation_requests",
    "biometrics",
]

# Columns that are BOOLEAN in Postgres but TINYINT(1) in MySQL.
BOOLEAN_COLUMNS = {("teacher_logs", "manual")}

# Columns that are JSONB in Postgres and need an explicit cast on insert.
JSONB_COLUMNS = {("teacher_logs", "weekly_schedule")}

# `professors` is seeded from config.PROFESSOR_LIST on every startup, so the
# Postgres rows already exist under different ids than MySQL used. Match those
# rows on their natural key instead of the id, let Postgres assign the id, and
# rewrite anything that pointed at the old id.
NATURAL_KEYS = {"professors": ("name", "department")}

# (table, column) -> the table whose ids need translating.
FOREIGN_IDS = {("consultation_requests", "professor_id"): "professors"}


# ─── Source connection ────────────────────────────────────────────────────────

def mysql_settings():
    """Read MySQL connection details from the environment."""
    url = (
        os.getenv("MYSQL_URL")
        or os.getenv("MYSQL_PUBLIC_URL")
        or os.getenv("SOURCE_MYSQL_URL")
        or ""
    ).strip()
    if url:
        p = urlparse(url)
        if p.scheme not in ("mysql", "mysql+pymysql"):
            sys.exit(f"MYSQL_URL must start with mysql:// — got {p.scheme!r}")
        return {
            "host": p.hostname or "127.0.0.1",
            "port": p.port or 3306,
            "user": unquote(p.username) if p.username else "root",
            "password": unquote(p.password) if p.password else "",
            "database": (p.path or "/").lstrip("/") or "consultation_system",
        }
    host = os.getenv("MYSQL_HOST") or os.getenv("OLD_DB_HOST")
    if not host:
        sys.exit(
            "No MySQL source configured. Set MYSQL_URL, or MYSQL_HOST / MYSQL_USER /\n"
            "MYSQL_PASSWORD / MYSQL_DB / MYSQL_PORT."
        )
    return {
        "host": host,
        "port": int(os.getenv("MYSQL_PORT") or os.getenv("OLD_DB_PORT") or 3306),
        "user": os.getenv("MYSQL_USER") or os.getenv("OLD_DB_USER") or "root",
        "password": os.getenv("MYSQL_PASSWORD") or os.getenv("OLD_DB_PASS") or "",
        "database": os.getenv("MYSQL_DB") or os.getenv("OLD_DB_NAME") or "consultation_system",
    }


def mysql_connect(settings, streaming=False):
    return pymysql.connect(
        charset="utf8mb4",
        cursorclass=pymysql.cursors.SSDictCursor if streaming else pymysql.cursors.DictCursor,
        connect_timeout=20,
        read_timeout=120,
        **settings,
    )


# ─── Value conversion ─────────────────────────────────────────────────────────

def convert(table, column, value, warnings):
    """Turn one MySQL value into something Postgres will accept."""
    if value is None:
        return None

    if isinstance(value, (bytes, bytearray)):
        # MySQL hands back bytes for BLOB-ish columns and for TINYINT(1) on
        # some driver versions.
        if (table, column) in BOOLEAN_COLUMNS:
            return int.from_bytes(value, "big") != 0
        try:
            value = value.decode("utf-8")
        except UnicodeDecodeError:
            value = value.decode("utf-8", "replace")
            warnings.append(f"{table}.{column}: undecodable bytes replaced")

    if (table, column) in BOOLEAN_COLUMNS:
        return bool(value)

    if (table, column) in JSONB_COLUMNS:
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        text = str(value).strip()
        if not text:
            return None
        try:
            json.loads(text)          # reject anything Postgres would choke on
        except ValueError:
            warnings.append(f"{table}.{column}: dropped value that is not valid JSON")
            return None
        return text

    if table == "consultation_requests" and column == "status":
        text = str(value).strip().lower()
        if text not in STATUS_VALUES:
            warnings.append(f"consultation_requests.status: {value!r} -> 'pending'")
            return "pending"
        return text

    return value


# ─── Schema introspection ─────────────────────────────────────────────────────

def mysql_tables(cur):
    cur.execute("SHOW TABLES")
    key = None
    names = set()
    for row in cur.fetchall():
        if key is None:
            key = next(iter(row))
        names.add(row[key])
    return names


def mysql_columns(cur, table):
    cur.execute(f"SHOW COLUMNS FROM `{table}`")
    return [r["Field"] for r in cur.fetchall()]


def pg_columns(pg_cur, table):
    pg_cur.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = current_schema() AND table_name = %s "
        "ORDER BY ordinal_position",
        (table,),
    )
    return [r[0] for r in pg_cur.fetchall()]


def pg_count(pg_cur, table):
    pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
    return pg_cur.fetchone()[0]


# ─── Copy one table ───────────────────────────────────────────────────────────

def build_insert(table, columns, overwrite):
    placeholders = ", ".join(
        "%s::jsonb" if (table, c) in JSONB_COLUMNS else "%s" for c in columns
    )
    collist = ", ".join(columns)
    sql = f"INSERT INTO {table} ({collist}) VALUES ({placeholders})"

    conflict = NATURAL_KEYS.get(table, ("id",))
    if not all(c in columns for c in conflict):
        return sql

    target = ", ".join(conflict)
    if overwrite:
        updates = ", ".join(
            f"{c} = EXCLUDED.{c}" for c in columns if c not in conflict
        )
        if updates:
            return f"{sql} ON CONFLICT ({target}) DO UPDATE SET {updates}"
    return f"{sql} ON CONFLICT ({target}) DO NOTHING"


def copy_table(table, my_settings, pg_conn, pg_cur, args, warnings, id_maps):
    probe = mysql_connect(my_settings)
    try:
        with probe.cursor() as cur:
            if table not in mysql_tables(cur):
                return {"table": table, "status": "absent in MySQL", "read": 0, "written": 0}
            source_cols = mysql_columns(cur, table)
    finally:
        probe.close()

    target_cols = pg_columns(pg_cur, table)
    columns = [c for c in source_cols if c in target_cols]
    if table in NATURAL_KEYS:
        # Let Postgres assign the id; the old one is meaningless here.
        columns = [c for c in columns if c != "id"]
    if not columns:
        return {"table": table, "status": "no matching columns", "read": 0, "written": 0}

    remaps = {
        columns.index(col): id_maps.get(ref, {})
        for (tbl, col), ref in FOREIGN_IDS.items()
        if tbl == table and col in columns
    }

    skipped_cols = [c for c in source_cols if c not in target_cols]
    if skipped_cols:
        warnings.append(f"{table}: source-only columns ignored -> {', '.join(skipped_cols)}")

    sql = build_insert(table, columns, args.overwrite)
    order = " ORDER BY id" if "id" in columns else ""
    select = f"SELECT {', '.join('`' + c + '`' for c in columns)} FROM `{table}`{order}"

    read = written = 0
    stream = mysql_connect(my_settings, streaming=True)
    try:
        with stream.cursor() as cur:
            cur.execute(select)
            batch = []
            while True:
                row = cur.fetchone()
                if row is None:
                    break
                read += 1
                values = [convert(table, c, row[c], warnings) for c in columns]
                for index, mapping in remaps.items():
                    old_id = values[index]
                    if old_id is None:
                        continue
                    if old_id in mapping:
                        values[index] = mapping[old_id]
                    else:
                        warnings.append(
                            f"{table}.{columns[index]}: no match for old id {old_id} -> NULL"
                        )
                        values[index] = None
                batch.append(values)
                if len(batch) >= args.batch:
                    written += flush(pg_conn, pg_cur, sql, batch, args.dry_run)
                    batch = []
            if batch:
                written += flush(pg_conn, pg_cur, sql, batch, args.dry_run)
    finally:
        stream.close()

    return {"table": table, "status": "ok", "read": read, "written": written}


def flush(pg_conn, pg_cur, sql, batch, dry_run):
    if dry_run:
        return 0
    try:
        pg_cur.executemany(sql, batch)
        return len(batch)
    except Exception:
        # One bad row shouldn't sink the batch — retry row by row so the rest
        # lands and the failure names the row that caused it.
        pg_conn.rollback()
        ok = 0
        for row in batch:
            try:
                pg_cur.execute(sql, row)
                ok += 1
            except Exception as exc:
                pg_conn.rollback()
                print(f"    ! row skipped: {str(exc)[:160]}")
        return ok


def build_id_map(table, my_settings, pg_cur):
    """Map old MySQL ids to the Postgres ids of the same rows, by natural key."""
    key = NATURAL_KEYS[table]
    source = {}
    conn = mysql_connect(my_settings)
    try:
        with conn.cursor() as cur:
            if table not in mysql_tables(cur):
                return {}
            cols = ", ".join("`" + c + "`" for c in ("id",) + key)
            cur.execute(f"SELECT {cols} FROM `{table}`")
            for row in cur.fetchall():
                source[tuple(row[c] for c in key)] = row["id"]
    finally:
        conn.close()

    pg_cur.execute(f"SELECT id, {', '.join(key)} FROM {table}")
    target = {tuple(r[1:]): r[0] for r in pg_cur.fetchall()}

    return {
        old_id: target[natural]
        for natural, old_id in source.items()
        if natural in target
    }


def reset_sequence(pg_cur, table):
    """Point the identity sequence past the highest id we just inserted."""
    pg_cur.execute(
        f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
        f"COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM {table}"
    )


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Copy URS data from MySQL to PostgreSQL.")
    ap.add_argument("--dry-run", action="store_true", help="read and convert, write nothing")
    ap.add_argument("--truncate", action="store_true", help="empty the Postgres tables first")
    ap.add_argument("--overwrite", action="store_true", help="update rows that already exist")
    ap.add_argument("--only", default="", help="comma-separated list of tables")
    ap.add_argument("--batch", type=int, default=200, help="rows per insert batch")
    ap.add_argument("--yes", action="store_true", help="skip the --truncate confirmation")
    args = ap.parse_args()

    tables = TABLE_ORDER
    if args.only:
        wanted = {t.strip() for t in args.only.split(",") if t.strip()}
        unknown = wanted - set(TABLE_ORDER)
        if unknown:
            sys.exit(f"Unknown table(s): {', '.join(sorted(unknown))}")
        tables = [t for t in TABLE_ORDER if t in wanted]

    my_settings = mysql_settings()
    print(f"Source (MySQL)     : {my_settings['user']}@{my_settings['host']}:{my_settings['port']}/{my_settings['database']}")
    print(f"Target (PostgreSQL): {config.DB_USER}@{config.DB_HOST}:{config.DB_PORT}/{config.DB_NAME}")
    if args.dry_run:
        print("Mode               : DRY RUN — nothing will be written")
    print()

    try:
        probe = mysql_connect(my_settings)
        probe.close()
    except Exception as exc:
        sys.exit(f"Cannot reach the MySQL source: {exc}")

    print("Creating the Postgres schema if needed...")
    init_db()
    print()

    pg_conn = pg_connect()
    pg_cur = pg_conn.cursor()
    warnings = []
    try:
        if args.truncate and not args.dry_run:
            if not args.yes:
                answer = input(
                    f"This DELETES every row in {', '.join(tables)} on "
                    f"{config.DB_HOST}/{config.DB_NAME}. Type 'yes' to continue: "
                )
                if answer.strip().lower() != "yes":
                    sys.exit("Aborted.")
            pg_cur.execute(
                f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"
            )
            print("Existing rows removed.\n")

        results = []
        id_maps = {}

        # Build id maps up front so that copying, say, only
        # consultation_requests still resolves its professor_id references.
        for ref in {r for (tbl, _), r in FOREIGN_IDS.items() if tbl in tables}:
            id_maps[ref] = build_id_map(ref, my_settings, pg_cur)

        for table in tables:
            before = pg_count(pg_cur, table)
            print(f"-> {table}")
            result = copy_table(table, my_settings, pg_conn, pg_cur, args, warnings, id_maps)
            if result["status"] == "ok" and not args.dry_run:
                reset_sequence(pg_cur, table)
            if table in NATURAL_KEYS:
                id_maps[table] = build_id_map(table, my_settings, pg_cur)
                print(f"   id map: {len(id_maps[table])} row(s) matched to existing Postgres ids")
            after = pg_count(pg_cur, table)
            result["before"] = before
            result["after"] = after
            results.append(result)
            print(f"   {result['status']}: read {result['read']}, "
                  f"rows in Postgres {before} -> {after}")

        print("\n" + "=" * 64)
        print(f"{'TABLE':<24}{'READ':>8}{'BEFORE':>10}{'AFTER':>10}  STATUS")
        print("-" * 64)
        for r in results:
            print(f"{r['table']:<24}{r['read']:>8}{r['before']:>10}{r['after']:>10}  {r['status']}")
        print("=" * 64)

        if warnings:
            seen = []
            for w in warnings:
                if w not in seen:
                    seen.append(w)
            print(f"\n{len(warnings)} warning(s), {len(seen)} distinct:")
            for w in seen[:25]:
                print(f"  - {w}")
            if len(seen) > 25:
                print(f"  ... and {len(seen) - 25} more")

        missed = [r for r in results if r["status"] == "ok" and r["after"] < r["read"]]
        if missed and not args.dry_run:
            print("\nSome rows did not land (they may already have existed with "
                  "different content — re-run with --overwrite):")
            for r in missed:
                print(f"  - {r['table']}: read {r['read']}, holds {r['after']}")
            return 1

        print("\nDone." if not args.dry_run else "\nDry run complete — nothing was written.")
        return 0
    finally:
        try:
            pg_cur.close()
        except Exception:
            pass
        pg_conn.close()


if __name__ == "__main__":
    sys.exit(main())
