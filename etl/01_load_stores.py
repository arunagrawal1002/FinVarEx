"""
Stage 2 / Step 1: Load stores.csv and attach disclosed-synthetic geocoding.

Real fields: store_id, type, size (from the original Kaggle competition data).
Synthetic fields: latitude, longitude, region_name (location_is_assumed=TRUE)
-- there is no real store-location data in the original dataset, so this
mirrors real US metro coordinates for plausibility but is explicitly flagged
as assumed, per the Data Architecture v3 doc's disclosure requirement.

Idempotent: safe to re-run (ON CONFLICT DO NOTHING on store_id).
"""
import pandas as pd
from psycopg2.extras import execute_values
from db import get_connection, local_or_remote

STORES_URL = "https://raw.githubusercontent.com/vicky60629/Walmart-Store-Sales-Forecasting/master/data/stores.csv"

# Disclosed synthetic: cycle through real US metro coordinates for plausibility.
CITIES = [
    (40.7128, -74.0060, "Northeast"),
    (42.3601, -71.0589, "Northeast"),
    (39.9526, -75.1652, "Northeast"),
    (38.9072, -77.0369, "Mid-Atlantic"),
    (33.7490, -84.3880, "Southeast"),
    (25.7617, -80.1918, "Southeast"),
    (35.2271, -80.8431, "Southeast"),
    (29.7604, -95.3698, "South"),
    (32.7767, -96.7970, "South"),
    (30.2672, -97.7431, "South"),
    (41.8781, -87.6298, "Midwest"),
    (39.9612, -82.9988, "Midwest"),
    (44.9778, -93.2650, "Midwest"),
    (39.0997, -94.5786, "Midwest"),
    (33.4484, -112.0740, "Southwest"),
    (35.0844, -106.6504, "Southwest"),
    (36.1699, -115.1398, "Southwest"),
    (34.0522, -118.2437, "West"),
    (37.7749, -122.4194, "West"),
    (47.6062, -122.3321, "West"),
    (45.5152, -122.6784, "West"),
    (39.7392, -104.9903, "Mountain"),
    (40.7608, -111.8910, "Mountain"),
]


def main():
    stores = pd.read_csv(local_or_remote("stores.csv", STORES_URL))
    rows = []
    for i, r in stores.iterrows():
        lat, lon, region = CITIES[i % len(CITIES)]
        lat_j = round(lat + ((r.Store * 37) % 100 - 50) / 1000, 6)
        lon_j = round(lon + ((r.Store * 53) % 100 - 50) / 1000, 6)
        rows.append((int(r.Store), r.Type, int(r.Size), lat_j, lon_j, region, True))

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO stores (store_id, type, size, latitude, longitude, region_name, location_is_assumed)
                VALUES %s
                ON CONFLICT (store_id) DO NOTHING
                """,
                rows,
            )
        conn.commit()
        print(f"stores: upserted {len(rows)} rows")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
