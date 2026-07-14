# Database Schema

These are the exact migrations applied to the FinVarEx Supabase project
(ref `wmovmhilasvzcqvuzbvj`), in order:

1. `20260714140651_create_varex_core_schema.sql` — the 7-table schema
   (stores, sales_actuals, sales_forecasts, weekly_environmental_context,
   competitor_intelligence, seasonal_index, variance_reports) from Data
   Architecture v3 Section 4.
2. `20260714153713_add_synthetic_fields_disclosure_to_env_context.sql` —
   adds a `synthetic_fields` column so it's explicit in the data itself
   which environmental columns are disclosed-synthetic vs. authentic Kaggle
   data (see `etl/README.md` for the full real/synthetic breakdown).

## Recreating the schema from scratch

If you ever need to stand up a fresh Supabase project (or reset this one):

- **Via the Supabase SQL editor**: open each file in this folder in order
  and run it.
- **Via the Supabase CLI** (if you install it): `supabase link` to this
  project, then `supabase db push` will apply any migrations in this folder
  that haven't been applied yet.

These files are the source of truth for the schema going forward — if you
make further schema changes directly in the Supabase dashboard, add a
matching numbered `.sql` file here so the repo and the live database don't
drift apart.
