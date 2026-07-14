# FinVarEx app

Next.js (App Router, TypeScript, Tailwind) frontend for the Variance
Explanation Assistant.

## Why server-only Supabase access

All 7 Supabase tables have Row Level Security enabled with zero
anon/authenticated policies (see `../supabase/migrations/`). That means the
anon key cannot read or write anything. This app never uses the anon key --
every query goes through `src/lib/supabase-server.ts`, which uses the
service role key inside Server Components and Server Actions only. That
file throws if it's ever imported into client code.

## Setup

```bash
cp .env.example .env.local
# fill in SUPABASE_SERVICE_ROLE_KEY from the Supabase dashboard
npm install
npm run dev
```

## Stage 3 scope (current)

`/input` implements the Structured Input Form and Input Validation stages
of the required pipeline:

1. Store / Department / Target Month picker (Department options are
   filtered to what actually has sales history for the chosen store;
   Target Month options are filtered to what has a precomputed forecast
   in `sales_forecasts`, restricted to the May-Oct 2012 reporting window).
2. Editable weekly actuals grid, pre-filled from `sales_actuals`.
3. Validation (Zod): numeric, non-negative, max-2-decimal financial figures;
   required store/dept/month selection; month restricted to the reporting
   window. Runs client-side for instant feedback, then again inside the
   Server Action as the real trust boundary.

On successful validation the form shows a confirmation with the normalized
payload shape -- it does **not** write to `variance_reports` yet (that's
Stage 6). Stages 4-6 build on top of this validated payload.
