# FinVarEx ETL

Loads the full Stage 2 dataset into Supabase. Run this from your own machine
or Replit shell — not from a sandboxed environment with restricted network
access, since it needs to reach both GitHub (for the real Kaggle CSVs) and
Supabase's Postgres endpoint directly.

## Why this exists as a script instead of already being loaded

The dev sandbox used earlier in this project could only reach `pypi.org`,
`files.pythonhosted.org`, and `github.com` — not Supabase's database port,
not Open-Meteo, not FRED. 3 of 79 batches of `sales_actuals` were loaded
manually before switching to this approach, which is faster (seconds, not
hundreds of tool calls) and gets you the full dataset instead of a scoped-down
subset. It's already idempotent (`ON CONFLICT DO NOTHING` / `DO UPDATE`
throughout), so having those 3 batches already in the table is harmless —
re-running `02_load_sales_actuals.py` will just skip rows that already exist.

## Setup

1. Get your Postgres connection string: Supabase dashboard → FinVarEx project
   (ref `wmovmhilasvzcqvuzbvj`) → Settings → Database → Connection string →
   URI. Use the "Session pooler" variant if your network blocks direct
   Postgres connections.
2. Set it as `DATABASE_URL`:
   - **Replit**: add it in the Secrets pane.
   - **Locally**: `export DATABASE_URL="postgresql://postgres:[password]@db.wmovmhilasvzcqvuzbvj.supabase.co:5432/postgres"`
3. Install dependencies: `pip install -r requirements.txt`
4. Run everything: `python run_all.py`

Each step is also runnable individually (`python 02_load_sales_actuals.py`,
etc.) if you want to re-run just one stage. Order matters the first time —
`03` needs stores loaded, `04` and `05` need `sales_actuals` loaded.

## What each step does

| Script | What it loads | Source |
| --- | --- | --- |
| `01_load_stores.py` | 45 stores: real type/size, disclosed-synthetic geocoding | Kaggle `stores.csv` (real) + generated (synthetic) |
| `02_load_sales_actuals.py` | ~421,570 rows, all stores/depts, Feb 2010–Oct 2012 | Kaggle `train.csv` (real, full fidelity) |
| `03_environmental_context.py` | fuel price, markdown, CPI, unemployment, temp (real) + consumer sentiment, disposable income, WTI oil, precipitation, severe weather flag (disclosed synthetic — no live source was reachable) | Kaggle `features.csv` (real) + generated (synthetic, see docstring) |
| `04_seasonal_index.py` | week-of-year multiplier per department | Computed from loaded `sales_actuals` |
| `05_sarimax_forecasts.py` | SARIMAX(1,1,1)+holiday baseline per (store,dept), May–Oct 2012, rolling-avg fallback for thin/unstable series | Computed from loaded `sales_actuals` |
| `06_competitor_intelligence.py` | 11 hand-built synthetic competitor rows | Fully synthetic, disclosed |

## After running: confirm the seed is clean

Ask me (or run directly against the Supabase project) to check row counts
and `get_advisors` once this finishes — that's the last item in Stage 2
before moving to Stage 3.
