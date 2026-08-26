"""Turning what the database holds into times a reader in Manila recognises.

Two clocks write into this schema, and both leave a naive TIMESTAMP behind:

  * the database clock, on columns that default to CURRENT_TIMESTAMP. The
    session timezone is pinned to UTC in db.py, so those are UTC.
  * the application clock, on columns the routes fill in themselves. Those are
    written as Manila local time, because that is the clock a consultation is
    actually scheduled against.

Neither carries an offset, so the two are indistinguishable once they reach the
frontend — which is how the activity log came to be eight hours behind the wall
clock in the room it was being read in, while the request times beside it were
right. Nothing was wrong with either value; there was simply no way to tell
them apart.

This is the one place that knows which is which. Every timestamp leaves the API
as ISO 8601 *with* the +08:00 offset, so the ambiguity ends at the boundary:
`new Date()` in the browser reads it correctly, and a reader in another
timezone still gets the same instant rather than a number that quietly means
something else.

Storage is deliberately left alone. Rewriting seven columns' worth of history
to make the two clocks agree is a migration that can only be run once and can
be wrong once; converting on the way out is reversible by editing this file.
"""

from datetime import date, datetime, timedelta

import pytz

PH = pytz.timezone("Asia/Manila")
UTC = pytz.utc

# The columns the database clock writes. Everything else that is a timestamp is
# written by the app in Manila time. Keyed by column name because the routes
# select with `*` and join across tables — the name is what survives.
UTC_COLUMNS = frozenset({"created_at", "enrolled_at"})


def to_ph(value, column=None):
    """A datetime as Manila time, offset attached.

    An aware value is converted. A naive one is read as UTC or as Manila
    depending on the column it came from, then converted, so the result always
    describes the same instant it did in the row.
    """
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(PH)
    if column in UTC_COLUMNS:
        return UTC.localize(value).astimezone(PH)
    return PH.localize(value)


def iso_ph(value, column=None):
    """`2026-08-26T22:41:03+08:00` — unambiguous to any reader."""
    moment = to_ph(value, column)
    return moment.isoformat(timespec="seconds") if moment else None


def _duration(value):
    total = int(value.total_seconds())
    sign = "-" if total < 0 else ""
    total = abs(total)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{sign}{h:02}:{m:02}:{s:02}"


def serialize_row(row):
    """One database row as JSON-safe values, timestamps in Manila time.

    Shared by the admin, teacher and student routes: three near-identical
    copies of this loop had drifted apart, and only one of them had ever heard
    of timezones.
    """
    if not row:
        return row
    out = {}
    for key, value in row.items():
        if isinstance(value, datetime):
            out[key] = iso_ph(value, key)
        elif isinstance(value, date):
            out[key] = value.isoformat()
        elif isinstance(value, timedelta):
            out[key] = _duration(value)
        else:
            out[key] = value
    return out


def serialize_rows(rows):
    return [serialize_row(r) for r in (rows or [])]
