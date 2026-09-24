"""
Step 3 / Step 4: Reads output/solar_data_raw.json, cleans it, validates with
Pydantic, and writes the final output/solar_data.json.

Steps:
  1. Sort each city's records by timestamp.
  2. Fill None values in temperature_2m and shortwave_radiation via linear interpolation.
  3. Validate each record with HourlyRecord (Pydantic).
     - Valid records   -> included in output/solar_data.json
     - Invalid records -> logged to validation_errors.log and excluded from output.
  4. Write validated records to output/solar_data.json.

Outputs:
  - data-pipeline/output/solar_data.json   -> clean, validated records
  - data-pipeline/validation_errors.log    -> Pydantic validation error log
"""

import json
import logging
import pathlib
from collections import Counter
from datetime import datetime, timezone

from pydantic import ValidationError

from models import HourlyRecord

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = pathlib.Path(__file__).parent
RAW_OUTPUT_PATH = BASE_DIR / "output" / "solar_data_raw.json"
CLEAN_OUTPUT_PATH = BASE_DIR / "output" / "solar_data.json"
LOG_PATH = BASE_DIR / "validation_errors.log"

# ---------------------------------------------------------------------------
# Module-level logger — configured in _configure_logging() for testability
# ---------------------------------------------------------------------------
logger = logging.getLogger("clean_data")


def _configure_logging(log_path: pathlib.Path = LOG_PATH) -> None:
    """Configures the file handler for the clean_data logger."""
    logging.basicConfig(
        filename=str(log_path),
        filemode="a",
        level=logging.WARNING,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
    )


# ---------------------------------------------------------------------------
# Linear interpolation
# ---------------------------------------------------------------------------

def _interpolate(values: list[float | None]) -> list[float]:
    """
    Fills None values in a float | None list using linear interpolation.

    Edge cases:
      - Leading Nones  : back-filled with the first valid value.
      - Trailing Nones : forward-filled with the last valid value.
      - All None       : filled with 0.0 (degenerate case — logged).
    """
    result: list[float | None] = list(values)
    n = len(result)

    if all(v is None for v in result):
        logger.warning("All values are None; filled with 0.0.")
        return [0.0] * n

    i = 0
    while i < n:
        if result[i] is None:
            j = i
            while j < n and result[j] is None:
                j += 1

            before = result[i - 1] if i > 0 else None
            after = result[j] if j < n else None

            if before is None:
                # Leading None block -> back-fill
                fill_value = float(after)  # type: ignore[arg-type]
                for k in range(i, j):
                    result[k] = fill_value
            elif after is None:
                # Trailing None block -> forward-fill
                fill_value = float(before)
                for k in range(i, j):
                    result[k] = fill_value
            else:
                # Interior None block -> linear interpolation
                gap = j - (i - 1)
                v_before = float(before)
                v_after = float(after)  # type: ignore[arg-type]
                for k in range(i, j):
                    t = (k - (i - 1)) / gap
                    result[k] = v_before + t * (v_after - v_before)

            i = j
        else:
            i += 1

    return result  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Main clean + validate pipeline
# ---------------------------------------------------------------------------

def clean(records: list[dict]) -> list[dict]:
    """
    1. Groups records by city and sorts by timestamp.
    2. Applies linear interpolation for None values.
    3. Validates each record with HourlyRecord (Pydantic).
       - Invalid records are logged to validation_errors.log and excluded.

    Returns:
        List of records that passed Pydantic validation (as dicts).
    """
    cities: dict[str, list[dict]] = {}
    for rec in records:
        cities.setdefault(rec["location"], []).append(rec)

    validated_all: list[dict] = []

    for city, city_records in cities.items():
        print(f"\n[->] Processing {city} ({len(city_records)} records)...")

        city_records.sort(key=lambda r: r["timestamp"])

        temps = [r["temperature_2m"] for r in city_records]
        rads = [r["shortwave_radiation"] for r in city_records]

        none_t = sum(1 for v in temps if v is None)
        none_r = sum(1 for v in rads if v is None)
        if none_t or none_r:
            print(f"  [!] Missing: {none_t} temperature, {none_r} radiation -> interpolating.")

        temps_clean = _interpolate(temps)
        rads_clean = _interpolate(rads)

        accepted = 0
        rejected = 0

        for idx, rec in enumerate(city_records):
            candidate = {
                **rec,
                "temperature_2m": temps_clean[idx],
                "shortwave_radiation": rads_clean[idx],
            }

            try:
                HourlyRecord(**candidate)
                validated_all.append(candidate)
                accepted += 1
            except ValidationError as exc:
                rejected += 1
                logger.warning(
                    "VALIDATION_ERROR [%s] %s -> %s",
                    city,
                    candidate.get("timestamp", "?"),
                    exc.errors()[0]["msg"],
                )

        print(f"  [ok] {city}: {accepted} accepted, {rejected} rejected.")

    return validated_all


def main() -> None:
    _configure_logging()

    print(f"[->] Reading raw data: {RAW_OUTPUT_PATH}")

    if not RAW_OUTPUT_PATH.exists():
        raise FileNotFoundError(
            f"{RAW_OUTPUT_PATH} not found. Run 'python fetch_weather.py' first."
        )

    raw_records: list[dict] = json.loads(RAW_OUTPUT_PATH.read_text(encoding="utf-8"))
    print(f"[ok] {len(raw_records)} raw records loaded.")

    distribution = Counter(r["location"] for r in raw_records)
    for city, count in sorted(distribution.items()):
        print(f"    {city}: {count} records")

    validated = clean(raw_records)

    CLEAN_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CLEAN_OUTPUT_PATH.write_text(json.dumps(validated, indent=2, ensure_ascii=False))

    run_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"\n[ok] Validated data written: {CLEAN_OUTPUT_PATH}  ({len(validated)} records)")
    print(f"[ok] Error log: {LOG_PATH}")
    print(f"[ok] clean_data.py done ({run_ts}). Next: python -m pytest tests/")


if __name__ == "__main__":
    main()
