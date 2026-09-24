"""
Step 4: pytest tests for clean_data.py and models.py.

Test scenarios (project.md §8):
  1. A missing hour (None) is filled correctly via linear interpolation.
  2. Negative radiation is logged to validation_errors.log and excluded from output.
  3. Out-of-range temperature (e.g. -60 °C) is handled the same way.
  4. A valid record passes through to the output without errors.
"""

import logging

import pytest
from pydantic import ValidationError

from clean_data import _interpolate, clean
from models import HourlyRecord

# ---------------------------------------------------------------------------
# Helper: minimal valid record factory
# ---------------------------------------------------------------------------

def _record(
    timestamp: str = "2026-09-20T12:00Z",
    location: str = "Berlin",
    temperature_2m: float | None = 20.0,
    shortwave_radiation: float | None = 500.0,
) -> dict:
    return {
        "timestamp": timestamp,
        "location": location,
        "temperature_2m": temperature_2m,
        "shortwave_radiation": shortwave_radiation,
    }


# ===========================================================================
# 1. Linear interpolation tests
# ===========================================================================

class TestInterpolate:
    def test_no_none_unchanged(self):
        """Lists without None should be returned unchanged."""
        values = [10.0, 20.0, 30.0]
        assert _interpolate(values) == [10.0, 20.0, 30.0]

    def test_single_none_in_middle(self):
        """A single None between two values should become their midpoint."""
        values = [10.0, None, 30.0]
        result = _interpolate(values)
        assert result[1] == pytest.approx(20.0)

    def test_multiple_nones_in_middle(self):
        """Consecutive Nones should be filled with linear steps."""
        values = [0.0, None, None, None, 4.0]
        result = _interpolate(values)
        assert result == pytest.approx([0.0, 1.0, 2.0, 3.0, 4.0])

    def test_none_at_start_backfill(self):
        """Leading Nones should be back-filled with the first valid value."""
        values = [None, None, 5.0]
        result = _interpolate(values)
        assert result[0] == pytest.approx(5.0)
        assert result[1] == pytest.approx(5.0)

    def test_none_at_end_forward_fill(self):
        """Trailing Nones should be forward-filled with the last valid value."""
        values = [7.0, None, None]
        result = _interpolate(values)
        assert result[1] == pytest.approx(7.0)
        assert result[2] == pytest.approx(7.0)

    def test_all_none_returns_zeros(self):
        """An all-None list should be filled with 0.0."""
        result = _interpolate([None, None, None])
        assert result == [0.0, 0.0, 0.0]


# ===========================================================================
# 2. Pydantic model tests
# ===========================================================================

class TestHourlyRecord:
    def test_valid_record(self):
        """A record with valid values should not raise."""
        rec = HourlyRecord(
            timestamp="2026-09-20T12:00Z",
            location="Berlin",
            temperature_2m=22.5,
            shortwave_radiation=500.0,
        )
        assert rec.location == "Berlin"

    def test_invalid_location(self):
        """An unsupported city should raise ValidationError."""
        with pytest.raises(ValidationError):
            HourlyRecord(
                timestamp="2026-09-20T12:00Z",
                location="Paris",
                temperature_2m=20.0,
                shortwave_radiation=300.0,
            )

    def test_temperature_below_minimum(self):
        """Temperature below -50 °C should raise ValidationError."""
        with pytest.raises(ValidationError):
            HourlyRecord(
                timestamp="2026-09-20T00:00Z",
                location="Berlin",
                temperature_2m=-60.0,
                shortwave_radiation=0.0,
            )

    def test_temperature_above_maximum(self):
        """Temperature above 60 °C should raise ValidationError."""
        with pytest.raises(ValidationError):
            HourlyRecord(
                timestamp="2026-09-20T12:00Z",
                location="Istanbul",
                temperature_2m=61.0,
                shortwave_radiation=800.0,
            )

    def test_negative_radiation(self):
        """Negative shortwave_radiation should raise ValidationError."""
        with pytest.raises(ValidationError):
            HourlyRecord(
                timestamp="2026-09-20T12:00Z",
                location="Lisbon",
                temperature_2m=25.0,
                shortwave_radiation=-10.0,
            )

    def test_zero_radiation_valid(self):
        """Zero radiation (nighttime) is physically valid and should pass."""
        rec = HourlyRecord(
            timestamp="2026-09-20T02:00Z",
            location="Berlin",
            temperature_2m=15.0,
            shortwave_radiation=0.0,
        )
        assert rec.shortwave_radiation == 0.0


# ===========================================================================
# 3. clean() integration tests (log output verified via caplog)
# ===========================================================================

class TestClean:
    def test_valid_record_included_in_output(self, caplog):
        """A valid record should appear in the output."""
        records = [_record()]
        with caplog.at_level(logging.WARNING, logger="clean_data"):
            result = clean(records)
        assert len(result) == 1
        assert result[0]["timestamp"] == "2026-09-20T12:00Z"

    def test_negative_radiation_excluded_and_logged(self, caplog):
        """
        A record with negative radiation should be excluded from output
        and a VALIDATION_ERROR should appear in the log.
        """
        records = [_record(shortwave_radiation=-10.0)]
        with caplog.at_level(logging.WARNING, logger="clean_data"):
            result = clean(records)

        assert len(result) == 0, "Invalid record must not appear in output"
        assert any("VALIDATION_ERROR" in msg for msg in caplog.messages), \
            "Log must contain VALIDATION_ERROR"

    def test_extreme_temperature_excluded_and_logged(self, caplog):
        """
        A record with temperature below -50 °C should be excluded from output
        and logged as a validation error.
        """
        records = [_record(temperature_2m=-60.0)]
        with caplog.at_level(logging.WARNING, logger="clean_data"):
            result = clean(records)

        assert len(result) == 0, "Invalid record must not appear in output"
        assert any("VALIDATION_ERROR" in msg for msg in caplog.messages), \
            "Log must contain VALIDATION_ERROR"

    def test_interpolation_fills_missing_hour(self, caplog):
        """
        A None value between two valid records should be filled by interpolation
        and the resulting record should pass Pydantic validation.
        """
        records = [
            _record(timestamp="2026-09-20T10:00Z", temperature_2m=10.0, shortwave_radiation=100.0),
            _record(timestamp="2026-09-20T11:00Z", temperature_2m=None, shortwave_radiation=None),
            _record(timestamp="2026-09-20T12:00Z", temperature_2m=20.0, shortwave_radiation=200.0),
        ]
        with caplog.at_level(logging.WARNING, logger="clean_data"):
            result = clean(records)

        assert len(result) == 3, "All 3 records should be present (Nones filled)"

        middle = next(r for r in result if r["timestamp"] == "2026-09-20T11:00Z")
        assert middle["temperature_2m"] == pytest.approx(15.0)
        assert middle["shortwave_radiation"] == pytest.approx(150.0)

    def test_mixed_records_partial_rejection(self, caplog):
        """
        In a mixed list, valid records should be accepted and invalid ones rejected.
        """
        records = [
            _record(timestamp="2026-09-20T10:00Z"),
            _record(timestamp="2026-09-20T11:00Z", shortwave_radiation=-5.0),
            _record(timestamp="2026-09-20T12:00Z"),
        ]
        with caplog.at_level(logging.WARNING, logger="clean_data"):
            result = clean(records)

        assert len(result) == 2
        timestamps = [r["timestamp"] for r in result]
        assert "2026-09-20T11:00Z" not in timestamps
