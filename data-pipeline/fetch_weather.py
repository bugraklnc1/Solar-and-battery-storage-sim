"""
Step 2 / Step 3: Fetches past 7 days of hourly weather data from Open-Meteo API
for Berlin, Madrid, and Lisbon (no API key required).

Outputs:
  - data-pipeline/raw/{city}_raw_{date}.json  → raw API backup per city
  - data-pipeline/output/solar_data_raw.json  → combined raw records (input for clean_data.py)
"""

import json
import pathlib
from datetime import datetime, timezone

import requests

# ---------------------------------------------------------------------------
# City configuration (project.md §5 — extensible)
# ---------------------------------------------------------------------------
CITIES: dict[str, tuple[float, float]] = {
    "Berlin": (52.52, 13.41),
    "Madrid": (40.41, -3.70),
    "Lisbon": (38.72, -9.14),
}

API_URL = "https://api.open-meteo.com/v1/forecast"

BASE_DIR = pathlib.Path(__file__).parent
RAW_DIR = BASE_DIR / "raw"
OUTPUT_DIR = BASE_DIR / "output"


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def fetch_raw_data(city: str, latitude: float, longitude: float) -> dict:
    """Fetches raw hourly JSON response from Open-Meteo for a single city."""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,shortwave_radiation",
        "past_days": 7,
        "forecast_days": 0,
    }
    response = requests.get(API_URL, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()
    data["_city"] = city  # tag the city for traceability
    return data


def save_raw(raw: dict, city: str, today: str) -> pathlib.Path:
    """Saves raw API response to raw/ as a date-stamped JSON backup."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    raw_path = RAW_DIR / f"{city.lower()}_raw_{today}.json"
    raw_path.write_text(json.dumps(raw, indent=2, ensure_ascii=False))
    print(f"  [ok] Raw data saved: {raw_path}")
    return raw_path


def transform(raw: dict, city: str) -> list[dict]:
    """
    Transforms raw Open-Meteo response into the solar_data.json contract.

    Contract (project.md §5):
      {
        "timestamp": "2026-09-20T12:00:00Z",
        "location": "Berlin",
        "temperature_2m": 22.5,
        "shortwave_radiation": 750.0
      }

    None values are preserved for clean_data.py to fill via interpolation.
    """
    hourly = raw.get("hourly", {})
    timestamps: list[str] = hourly.get("time", [])
    temperatures: list[float | None] = hourly.get("temperature_2m", [])
    radiations: list[float | None] = hourly.get("shortwave_radiation", [])

    if not timestamps:
        raise ValueError(f"[{city}] API response has empty 'hourly.time'.")

    records = []
    for ts, temp, rad in zip(timestamps, temperatures, radiations):
        # Open-Meteo returns "2026-09-20T12:00" (no Z); append UTC suffix
        timestamp_utc = ts if ts.endswith("Z") else ts + "Z"
        records.append(
            {
                "timestamp": timestamp_utc,
                "location": city,
                "temperature_2m": temp,
                "shortwave_radiation": rad,
            }
        )
    return records


def save_raw_output(records: list[dict]) -> pathlib.Path:
    """
    Writes all cities' combined raw records to output/solar_data_raw.json.
    This file is consumed by clean_data.py.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_output_path = OUTPUT_DIR / "solar_data_raw.json"
    raw_output_path.write_text(json.dumps(records, indent=2, ensure_ascii=False))
    print(f"\n[ok] Combined raw output saved: {raw_output_path}  ({len(records)} records)")
    return raw_output_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    all_records: list[dict] = []

    for city, (lat, lon) in CITIES.items():
        print(f"\n[->] Fetching {city} (lat={lat}, lon={lon})...")

        raw = fetch_raw_data(city, lat, lon)
        time_range = raw.get("hourly", {}).get("time", ["?", "?"])
        print(f"  [ok] Response received: {time_range[0]} -> {time_range[-1]}")

        save_raw(raw, city, today)

        records = transform(raw, city)

        none_temps = sum(1 for r in records if r["temperature_2m"] is None)
        none_rads = sum(1 for r in records if r["shortwave_radiation"] is None)
        if none_temps or none_rads:
            print(f"  [!] Missing values: {none_temps} temperature, {none_rads} radiation -> will be filled by clean_data.py")
        else:
            print(f"  [ok] {len(records)} records, no missing values.")

        all_records.extend(records)

    save_raw_output(all_records)
    print("[ok] fetch_weather.py done. Next: python clean_data.py")


if __name__ == "__main__":
    main()
