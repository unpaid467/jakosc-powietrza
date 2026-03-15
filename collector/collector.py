"""
Hourly air quality collector for sensor.community → Supabase.

Reads from two sensors (SDS011 + BME280) and inserts one row into
the Supabase `readings` table.  Duplicate timestamps are silently
ignored thanks to the unique index on `timestamp`.

Required environment variables (set as GitHub Actions secrets):
  SUPABASE_URL          – https://YOUR_PROJECT_ID.supabase.co
  SUPABASE_SERVICE_KEY  – service_role key (from Supabase → Settings → API)
"""

import os
import sys
from datetime import datetime, timezone

import requests

# ── Sensor configuration ──────────────────────────────────────────────────
PM_SENSOR_ID  = 63261   # SDS011  – P1=PM10, P2=PM2.5
ENV_SENSOR_ID = 63262   # BME280  – temperature, humidity, pressure
API_BASE      = "https://data.sensor.community/airrohr/v1/sensor"

# ── Supabase connection (injected via env vars) ───────────────────────────
SUPABASE_URL         = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

HEADERS = {
    "apikey":        SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "resolution=ignore-duplicates,return=minimal",
}


def fetch_sensor(sensor_id: int) -> dict:
    """Fetch the latest reading from a sensor.community sensor."""
    r = requests.get(f"{API_BASE}/{sensor_id}/", timeout=15)
    r.raise_for_status()
    data = r.json()
    if not data:
        raise ValueError(f"No data returned from sensor {sensor_id}")
    return data[0]


def parse_values(entry: dict) -> dict[str, float | None]:
    result = {}
    for sv in entry.get("sensordatavalues", []):
        try:
            result[sv["value_type"]] = float(sv["value"])
        except (KeyError, TypeError, ValueError):
            pass
    return result


def sensor_timestamp_to_utc(ts_raw: str) -> str:
    """Convert sensor timestamp 'YYYY-MM-DD HH:MM:SS' (UTC) to ISO 8601."""
    dt = datetime.strptime(ts_raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    return dt.isoformat()


def collect() -> None:
    pm_entry  = fetch_sensor(PM_SENSOR_ID)
    env_entry = fetch_sensor(ENV_SENSOR_ID)

    pm_vals  = parse_values(pm_entry)
    env_vals = parse_values(env_entry)

    ts_raw    = pm_entry.get("timestamp") or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    timestamp = sensor_timestamp_to_utc(ts_raw)

    row = {
        "timestamp": timestamp,
        "pm25":      pm_vals.get("P2"),
        "pm10":      pm_vals.get("P1"),
        "temp":      env_vals.get("temperature"),
        "hum":       env_vals.get("humidity"),
        "pressure":  env_vals.get("pressure"),
    }

    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/readings",
        json=row,
        headers=HEADERS,
        timeout=15,
    )
    r.raise_for_status()
    print(f"OK  {row['timestamp']}  PM2.5={row['pm25']}  PM10={row['pm10']}  temp={row['temp']}")


if __name__ == "__main__":
    try:
        collect()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
