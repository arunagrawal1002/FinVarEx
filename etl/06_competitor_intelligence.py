"""
Stage 2 / Step 6: Hand-build competitor_intelligence (v3 Section 6).

Fully synthetic, fully disclosed (data_is_synthetic = TRUE on every row --
there is no real competitive-intelligence dataset for this project). At
least one row per demo scenario store, plus a few scattered across the
wider portfolio so the Portfolio Anomaly Queue has more than the curated
presets to surface.

Idempotent: safe to re-run (ON CONFLICT DO NOTHING via a NOT EXISTS guard,
since competitor_id is a bare serial with no natural unique key).
"""
from psycopg2.extras import execute_values
from db import get_connection

# (store_id, competitor_brand, distance_miles, launch_date)
ROWS = [
    (1, "Target", 1.2, "2012-06-15"),
    (1, "Costco", 4.5, "2011-03-01"),
    (4, "Kroger", 0.8, "2012-07-01"),
    (10, "Meijer", 2.1, "2012-05-20"),
    (15, "Target", 1.9, "2011-11-10"),
    (20, "Whole Foods", 0.5, "2012-08-05"),
    (27, "Costco", 3.0, "2012-04-10"),
    (30, "Dollar General", 0.4, "2012-06-01"),
    (33, "Target", 2.6, "2010-09-15"),
    (41, "Trader Joe's", 1.1, "2012-09-01"),
    (45, "Kroger", 2.8, "2012-03-20"),
]


def main():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM competitor_intelligence")
            existing = cur.fetchone()[0]
            if existing > 0:
                print(f"competitor_intelligence: {existing} rows already present, skipping seed")
                return

            execute_values(
                cur,
                """
                INSERT INTO competitor_intelligence
                    (store_id, competitor_brand, distance_miles, launch_date, data_is_synthetic)
                VALUES %s
                """,
                [(s, b, d, dt, True) for s, b, d, dt in ROWS],
            )
        conn.commit()
        print(f"competitor_intelligence: inserted {len(ROWS)} rows")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
