"""
Air quality collector for sensor.community → Supabase.
Runs every 10 minutes via GitHub Actions.

Reads from two sensors (SDS011 + BME280) and inserts one row into
the Supabase `readings` table using the collection time as the timestamp,
so every run always produces a unique row regardless of sensor update frequency.

Required environment variables (set as GitHub Actions secrets):
  SUPABASE_URL          – https://YOUR_PROJECT_ID.supabase.co
  SUPABASE_SERVICE_KEY  – service_role key (from Supabase → Settings → API)
"""

import os
import sys
import time
from datetime import datetime, timezone

import requests

# ── Sensor configuration ──────────────────────────────────────────────────
PM_SENSOR_ID  = 63261   # SDS011  – P1=PM10, P2=PM2.5
ENV_SENSOR_ID = 63262   # BME280  – temperature, humidity, pressure
API_BASE      = "https://data.sensor.community/airrohr/v1/sensor"

RETRY_ATTEMPTS = 3
RETRY_DELAY_S  = 15   # seconds between retries

# ── Supabase connection (injected via env vars) ───────────────────────────
SUPABASE_URL         = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

HEADERS = {
    "apikey":        SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}


def fetch_sensor(sensor_id: int) -> dict:
    """Fetch the latest reading from a sensor.community sensor, with retries."""
    last_err = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            r = requests.get(f"{API_BASE}/{sensor_id}/", timeout=15)
            r.raise_for_status()
            data = r.json()
            if not data:
                raise ValueError(f"No data returned from sensor {sensor_id}")
            return data[0]
        except Exception as exc:
            last_err = exc
            if attempt < RETRY_ATTEMPTS:
                print(f"  attempt {attempt} failed ({exc}), retrying in {RETRY_DELAY_S}s…")
                time.sleep(RETRY_DELAY_S)
    raise last_err


def parse_values(entry: dict) -> dict[str, float | None]:
    result = {}
    for sv in entry.get("sensordatavalues", []):
        try:
            result[sv["value_type"]] = float(sv["value"])
        except (KeyError, TypeError, ValueError):
            pass
    return result


def collect() -> None:
    pm_entry  = fetch_sensor(PM_SENSOR_ID)
    env_entry = fetch_sensor(ENV_SENSOR_ID)

    pm_vals  = parse_values(pm_entry)
    env_vals = parse_values(env_entry)

    # Use current UTC time as the row timestamp — guarantees a new row every run
    # even if the sensor API returns a cached/repeated measurement timestamp.
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

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
    except requests.exceptions.ConnectionError as exc:
        # Transient network failure — log and exit 0 so GitHub doesn't flag as broken
        print(f"WARN: sensor.community unreachable (transient), skipping this run.\n  {exc}", file=sys.stderr)
        sys.exit(0)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
