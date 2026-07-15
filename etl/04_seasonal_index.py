"""
Stage 2 / Step 4: Build seasonal_index (v3 Section 7, revised).

seasonal_index[dept][store_type][iso_week] = avg(actual_sales for that
dept, that store_type, that iso_week, across all stores of that type and
all years) / avg(actual_sales for that dept, that store_type, across all
iso_weeks).

Keyed by (dept_id, store_type, iso_week) rather than (dept_id, iso_week).
This was originally pooled across all 45 stores per department, but that
pooling was validated to be a materially poor fit for many individual
stores (avg within-dept store-vs-pooled-index correlation as low as 0.51,
some stores near-zero or negative -- see the FinVarEx product brief
Retrospective / commit history for the analysis). Store `type` (A/B/C, an
authentic Kaggle field for store format/size) is a real, consistent driver
of that heterogeneity -- same-type store pairs correlate higher than
cross-type pairs in 65/71 departments tested. Region/climate does NOT
explain it (stores.region_name is synthetic, location_is_assumed=TRUE),
so this deliberately segments by store_type, not region.

Full per-store granularity was considered and rejected: only ~140 weeks
of history exist per store-dept combination, which is too thin to fit a
reliable per-store weekly index (the same "don't fit what the data can't
support" reasoning the product brief applies to the SARIMAX order).
store_type (3 buckets) is the granularity the data actually supports.

Reads directly from the DB (sales_actuals and stores must already be
loaded -- run 01_load_stores.py and 02_load_sales_actuals.py first).

Idempotent: safe to re-run (ON CONFLICT DO UPDATE on dept_id, store_type,
iso_week).
"""
import pandas as pd
from psycopg2.extras import execute_values
from db import get_connection


def main():
    conn = get_connection()
    try:
        sales = pd.read_sql(
            """
            SELECT sa.dept_id, sa.week_date, sa.actual_sales, st.type AS store_type
            FROM sales_actuals sa
            JOIN stores st ON st.store_id = sa.store_id
            """,
            conn,
        )
        sales["week_date"] = pd.to_datetime(sales["week_date"])
        sales["iso_week"] = sales["week_date"].dt.isocalendar().week.astype(int)

        dept_type_week_avg = sales.groupby(["dept_id", "store_type", "iso_week"])[
            "actual_sales"
        ].mean()
        dept_type_avg = sales.groupby(["dept_id", "store_type"])["actual_sales"].mean()

        rows = []
        for (dept_id, store_type, iso_week), week_avg in dept_type_week_avg.items():
            overall_avg = dept_type_avg[(dept_id, store_type)]
            if overall_avg and overall_avg != 0:
                idx = week_avg / overall_avg
                rows.append((int(dept_id), str(store_type), int(iso_week), round(float(idx), 3)))

        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO seasonal_index (dept_id, store_type, iso_week, seasonal_index)
                VALUES %s
                ON CONFLICT (dept_id, store_type, iso_week) DO UPDATE SET seasonal_index = EXCLUDED.seasonal_index
                """,
                rows,
            )
        conn.commit()
        print(f"seasonal_index: upserted {len(rows)} rows")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
