"""``_compute_status`` — how a teacher's row becomes a word on the public board.

No database here: the function takes a log row and returns a status. The clock
is the awkward part, since it reads "now" in Manila, so these freeze it.
"""

import json
from datetime import datetime

import pytest
import pytz

import teacher as teacher_module
from teacher import _compute_status, _parse_weekly

PH = pytz.timezone("Asia/Manila")


@pytest.fixture
def at():
    """Pin Manila time for one test. Returns a setter taking 'YYYY-MM-DD HH:MM'."""
    real = teacher_module.datetime

    class FrozenDatetime(real):
        frozen = None

        @classmethod
        def now(cls, tz=None):
            return cls.frozen

    def _set(stamp):
        FrozenDatetime.frozen = PH.localize(datetime.strptime(stamp, "%Y-%m-%d %H:%M"))
        teacher_module.datetime = FrozenDatetime

    yield _set
    teacher_module.datetime = real


def schedule_for(day, start, end):
    return {day: {"unavailable": False, "limit": 0,
                  "slots": [{"start": start, "end": end}]}}


# 2026-09-07 is a Monday.
MONDAY_MORNING = "2026-09-07 09:00"
MONDAY_EVENING = "2026-09-07 21:00"
MONDAY_DAWN = "2026-09-07 05:00"


def test_no_row_at_all_is_unavailable():
    assert _compute_status(None) == "Unavailable"


def test_a_manual_override_wins_over_everything(at):
    at(MONDAY_MORNING)
    row = {"manual": True, "manual_status": "In Meeting",
           "weekly_schedule": schedule_for("monday", "08:00 AM", "05:00 PM")}
    assert _compute_status(row) == "In Meeting"


def test_inside_a_scheduled_slot_is_available(at):
    at(MONDAY_MORNING)
    row = {"manual": False,
           "weekly_schedule": schedule_for("monday", "08:00 AM", "11:00 AM")}
    assert _compute_status(row) == "Available"


def test_outside_every_slot_is_unavailable(at):
    at(MONDAY_MORNING)
    row = {"manual": False,
           "weekly_schedule": schedule_for("monday", "01:00 PM", "03:00 PM")}
    assert _compute_status(row) == "Unavailable"


@pytest.mark.parametrize("stamp", [MONDAY_EVENING, MONDAY_DAWN])
def test_outside_working_hours_is_unavailable_whatever_the_schedule(at, stamp):
    """06:00-19:30 caps the day regardless of what the teacher scheduled."""
    at(stamp)
    row = {"manual": False,
           "weekly_schedule": schedule_for("monday", "12:00 AM", "11:30 PM")}
    assert _compute_status(row) == "Unavailable"


def test_a_day_marked_unavailable_is_unavailable(at):
    at(MONDAY_MORNING)
    row = {"manual": False,
           "weekly_schedule": {"monday": {"unavailable": True, "slots": []}}}
    assert _compute_status(row) == "Unavailable"


def test_the_second_slot_of_a_day_counts(at):
    at("2026-09-07 14:00")
    row = {"manual": False, "weekly_schedule": {"monday": {
        "unavailable": False,
        "slots": [{"start": "08:00 AM", "end": "10:00 AM"},
                  {"start": "01:00 PM", "end": "03:00 PM"}],
    }}}
    assert _compute_status(row) == "Available"


def test_a_legacy_single_slot_row_still_works(at):
    """Rows written before multi-slot schedules carry start/end at the day level."""
    at(MONDAY_MORNING)
    row = {"manual": False,
           "weekly_schedule": {"monday": {"start": "08:00 AM", "end": "11:00 AM"}}}
    assert _compute_status(row) == "Available"


def test_a_schedule_stored_as_text_is_decoded(at):
    at(MONDAY_MORNING)
    row = {"manual": False,
           "weekly_schedule": json.dumps(schedule_for("monday", "08:00 AM", "11:00 AM"))}
    assert _compute_status(row) == "Available"


def test_another_days_schedule_does_not_apply(at):
    at(MONDAY_MORNING)
    row = {"manual": False,
           "weekly_schedule": schedule_for("tuesday", "08:00 AM", "11:00 AM")}
    assert _compute_status(row) == "Unavailable"


class TestParseWeekly:
    def test_a_dict_passes_through(self):
        assert _parse_weekly({"monday": {}}) == {"monday": {}}

    def test_json_text_is_decoded(self):
        assert _parse_weekly('{"monday": {}}') == {"monday": {}}

    def test_unparseable_text_is_none_rather_than_an_exception(self):
        assert _parse_weekly("{not json") is None

    def test_none_stays_none(self):
        assert _parse_weekly(None) is None
