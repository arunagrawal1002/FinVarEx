# FinVarEx — Session Handoff

Last updated: 2026-07-15. Written for whoever (or whichever Claude session) picks this up next.

## Where things stand

Stages 1-5 of the roadmap are built, committed, and pushed to `main`
(https://github.com/arunagrawal1002/FinVarEx). Latest commit on main:
`004c2b2 Add Stage 5 narrative layer, adversarial regex fix, seasonal_index store-type migration`.

| Stage | What it is | Status |
|---|---|---|
| 1 | Product brief + Supabase schema (7 tables) | Done |
| 2 | ETL / seeding from Kaggle Walmart dataset | Done |
| 3 | Structured input form + Zod validation | Done |
| 4 | Deterministic logic layer (variance math, classification) | Done |
| 5 | LLM narrative layer (prompt boundary + post-hoc validation) | Done |
| 6 | Database persistence (`variance_reports` table) | **Not started — next up** |
| 7 | Frontend output + admin dashboard | Not started |

Production: https://finvarex.vercel.app (Vercel project `finvarex`, team `waypoint5`,
redeployed via Vercel MCP on each push — git auto-deploy is wired up, pushes to `main`
deploy automatically).

Local dev: works. `npm run dev` from `finvarex-app/` runs clean now (see "Known
issues fixed" below if it breaks again on a fresh machine).

## Architecture, in one paragraph

The core thesis (from the product brief) is a hard split between a deterministic
logic layer and a language layer. Stage 4 (`src/lib/variance/`) computes every
number and classification from the raw actuals — variance %, z-scores, seasonal
index, competitor impact, YoY — and locks them before any LLM sees them. Stage 5
(`src/lib/narrative/`) only narrates those locked facts; it never computes
anything, and its output is independently re-checked afterward
(`src/lib/narrative/validate.ts`) rather than trusted just because the prompt
told it to behave. Every Server Action re-validates raw input server-side with
Zod (`src/lib/validation.ts`) — the client-side validation is UX only, not a
trust boundary.

## What's next: Stage 6 (database persistence)

The `variance_reports` table already exists (migration
`20260714140651_create_varex_core_schema.sql`):

```sql
CREATE TABLE variance_reports (
    id                   BIGSERIAL PRIMARY KEY,
    store_id             INT REFERENCES stores(store_id),
    dept_id              INT,
    target_month         DATE,
    generated_at         TIMESTAMP DEFAULT NOW(),
    input_snapshot       JSONB,
    mathematical_drivers JSONB,
    classification       VARCHAR(30) CHECK (...),
    rubric_bucket        VARCHAR(20) CHECK (...),
    ai_explanation       TEXT,
    confidence_score     INT CHECK (confidence_score BETWEEN 0 AND 100),
    system_flags         TEXT[]
);
```

Nothing writes to it yet. The Stage 4 output (`VarianceBreakdown` from
`src/lib/variance/index.ts`) and Stage 5 output (`NarrativeResult` from
`src/lib/narrative/index.ts`) are both fully shaped to match this table almost
1:1 — `mathematical_drivers` maps straight to `breakdown.mathematical_drivers`,
`classification`/`rubric_bucket`/`confidence_score`/`system_flags` already
exist on the breakdown/narrative objects, `ai_explanation` is
`narrativeResult.narrative`.

Suggested approach: add a Server Action (or extend
`generateNarrativeForInput` in `src/app/input/actions.ts`) that inserts a row
after the narrative is generated, using the existing server-only Supabase
client pattern in `src/lib/supabase-server.ts` (service-role key, never
exposed to the client). `input_snapshot` should store the raw validated form
input for audit/reproducibility. Use the server-role client, not the anon
key — RLS is enabled on all 7 tables with zero policies
(`20260714192300_enable_rls_no_policies.sql`), so the anon key can't write
anything; only the service-role client (server-side only) can.

After that: Stage 7, a page to browse past `variance_reports` rows (admin
dashboard / output panel) — no design work done on this yet.

## Known issues fixed this session (don't re-diagnose these)

- **Local npm install crashed with `TypeError: Invalid Version:`** on Windows
  (npm 11.16.0 / Node 25.6.0), reproducible even with a fully fresh cache —
  not a corrupted-cache issue. Root cause: the `resolve` package's published
  tarball (pulled in transitively via `postcss-import`) ships malformed
  `package.json` test fixtures that crash npm's arborist dedupe step. Fixed
  with a `"resolve": "^1.22.10"` entry under `"overrides"` in
  `finvarex-app/package.json`. If this resurfaces after a dependency bump,
  check whether `resolve` still resolves to a version above the override, or
  bump the override version.
- **Money validation silently rejected ~32% of valid two-decimal dollar
  amounts** (`Math.round(v*100) === v*100` fails under IEEE 754 float
  imprecision). Fixed with an epsilon comparison in
  `src/lib/validation.ts`. Verified against 10,000 sampled values.
- **`seasonal_index` was pooled across all 45 stores per department**, which
  meant a store's seasonal adjustment ignored genuine store-level variation.
  Validated statistically that store **type** (not region — region in this
  dataset is synthetic/non-causal) is the real driver. Re-keyed the table to
  `(dept_id, store_type, iso_week)` — see migration
  `20260715120000_rekey_seasonal_index_by_store_type.sql` and the rewritten
  `etl/04_seasonal_index.py`. Verified live: two stores of different types in
  the same dept now produce different seasonal-adjustment values.
- **Forbidden-topic regexes in `validate.ts` only matched exact singular
  keywords** — "storms" (plural) slipped past the weather-topic detector
  undetected, found via an adversarial test
  (`scripts/adversarial-narrative-test.ts`, run with `npx tsx
  scripts/adversarial-narrative-test.ts`). Fixed by widening patterns to
  `word\w*` stems. All 7 adversarial/control cases pass now — rerun that
  script any time `validate.ts` changes.

## Environment / secrets

- Supabase project `FinVarEx`, ref `wmovmhilasvzcqvuzbvj`, region `us-east-1`.
  URL and service-role key are in `finvarex-app/.env.local` (gitignored) and
  set in Vercel env vars.
- `ANTHROPIC_API_KEY` is set in both `.env.local` and Vercel. Model in use:
  `claude-haiku-4-5-20251001` (chosen for cost — see
  `src/lib/narrative/constants.ts` to change it).
- `.env.example` documents all required vars without real values — keep it in
  sync if you add new env vars.

## A loose end, not yet decided

Early this session we validated that `seasonal_index` should be keyed by
store type, not region (region data in this dataset is synthetic and has no
real causal effect — confirmed via correlation analysis). I offered to add a
line documenting this finding to the product brief's Retrospective section;
that offer was never taken up. Worth doing at some point for the writeup, low
priority relative to Stage 6/7.

## Required commit structure (from root README)

The assignment wants a minimum of 6 commits following a specific structure.
Actual history so far (`git log --oneline`):

```
004c2b2 Add Stage 5 narrative layer, adversarial regex fix, seasonal_index store-type migration
f4f1f9c fix: money validation rejected ~32% of valid two-decimal dollar amounts (float precision)
d327917 fix: re-key seasonal_index by store type, not pooled across all stores
2dc9789 feat: build deterministic logic layer calculations
02add78 Add example environment variables for Supabase
71031ca Exclude .env.example from .gitignore
28f2562 feat: implement structured data input form and validation
4de4e69 Vendor raw Kaggle CSVs into etl/data/, add local_or_remote fallback
294e6e4 feat: add Supabase schema migrations
e2dcddb docs: add product brief documentation
```

This satisfies the required categories (docs, input form, logic layer, LLM
integration) plus extra fix commits, which is fine — the rubric asks for a
minimum, not an exact match. Stage 6 (`feat: configure database persistence
models`) and Stage 7 (`feat: design visual output panels and admin
dashboard`) commit messages are still needed to fully match the suggested
structure in the root README.

## Root README status checklist is stale

`README.md` at the repo root still shows ETL, input form, logic layer, and
LLM integration as unchecked `[ ]` boxes — they're actually done. Worth
updating alongside the Stage 6 commit so the README reflects reality.
