# FinVarEx — Session Handoff

Last updated: 2026-07-16 (Stage 7 session). Written for whoever (or whichever
Claude session) picks this up next.

## Where things stand

All 7 stages of the roadmap are built. This session's Stage 7 work is
committed locally (`415a4da feat: build reports dashboard + report detail
pages (Stage 7)`, on top of `5507f47` which was already pushed by the prior
session) but **the sandbox this session ran in has no GitHub credentials, so
`415a4da` has not been pushed to `main` yet** — that means it is also not yet
live on Vercel. **Arun needs to run `git push origin main` himself** (from a
terminal that already has GitHub auth configured) before it deploys.
Everything below that says "Done" is done in the local working tree; only
the push of this one commit is outstanding.

| Stage | What it is | Status |
|---|---|---|
| 1 | Product brief + Supabase schema (7 tables) | Done |
| 2 | ETL / seeding from Kaggle Walmart dataset | Done |
| 3 | Structured input form + Zod validation | Done |
| 4 | Deterministic logic layer (variance math, classification) | Done |
| 5 | LLM narrative layer (prompt boundary + post-hoc validation) | Done |
| 6 | Database persistence (`variance_reports` table) | Done |
| 7 | Frontend output + admin dashboard | Done (this session) |

Production: https://finvarex.vercel.app (Vercel project `finvarex`, team `waypoint5`,
git auto-deploy wired up — pushes to `main` deploy automatically).

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
told it to behave. Stage 6 (`src/lib/persist-report.ts`) writes the locked
Stage 4 math and the Stage 5 narrative to `variance_reports` as one audit
record, inside `generateNarrativeForInput` (`src/app/input/actions.ts`), once
the narrative is generated. Stage 7 (`src/app/reports/`) reads those rows
back: a dashboard list (`page.tsx`) and a per-report detail view
(`[id]/page.tsx`) that reconstructs a `VarianceBreakdown` from the persisted
columns rather than recomputing anything. Every Server Action re-validates
raw input server-side with Zod (`src/lib/validation.ts`) — the client-side
validation is UX only, not a trust boundary.

## What's next: nothing roadmap-required — optional follow-ups only

All 7 stages are built. What's left is push/deploy (see the warning at the
top) and the "real end-to-end browser test" that's been an open item since
Stage 6 (see below) — not new features. If picking this up to polish further,
worth knowing about:

- The reports dashboard (Stage 7, this session) is deliberately the lighter
  option discussed at the end of the previous session: it lists/ranks
  `variance_reports` rows that already exist, rather than the brief's fuller
  "Portfolio Anomaly Queue" concept (Section 04/07), which would mean
  batch-computing variance across all ~3,300 store/dept combinations so
  anomalies get flagged *before* an analyst asks for anything. That's a
  meaningfully bigger build (new batch job, likely a new table/materialized
  view) and was an explicit scope call, not an oversight — see this session's
  commit message and Arun's own choice among three scoping options for the
  reasoning.
- `variance_reports` has 0 rows right now (see "Not yet done" below), so
  nobody has actually seen the dashboard rendered against real data yet.

## Stage 7 summary (completed this session, 2026-07-16)

Added the read side of `variance_reports` (only writes existed before) and
the pages that use it:

- `src/lib/queries.ts`: `getRecentReports()` / `getReportById()` (plain
  Supabase reads, same pattern as the rest of the file) and
  `classificationRiskWeight()`, a judgment-call severity ranking over the 8
  classifications used for the dashboard's default sort.
- `src/app/reports/page.tsx`: lists reports, filterable by classification,
  sortable "risk-ranked" (severity + low confidence first — the default) vs.
  "most recent." Filtering/sorting happens in JS after one bounded read
  (limit 200), not in SQL, matching how `getDeptsForStore`/`getAvailableMonths`
  already do set logic client-side rather than reaching for raw SQL.
- `src/app/reports/[id]/page.tsx`: single-report detail view. Reconstructs a
  `VarianceBreakdown` from the persisted `mathematical_drivers` /
  `classification` / `rubric_bucket` / `confidence_score` / `system_flags`
  columns (lossless, since `mathematical_drivers` was written verbatim by
  `persist-report.ts`) and reuses `VarianceBreakdownView` from the input flow.
  That component gained two optional props (`confidenceLabel`, `footerNote`)
  so it can honestly describe a persisted row's *final* confidence instead of
  claiming it's showing Stage 4's pre-narrative baseline, which isn't stored
  once a report is saved.
- `src/app/reports/{ClassificationBadge,ReportsFilters,PersistedNarrativeView}.tsx`:
  supporting components. `PersistedNarrativeView` is a new component, not a
  reuse of `input/NarrativeView.tsx` — that component's props
  (`baselineConfidence`, `forbidden_topic_hits`, `contradicted`) only exist
  together in memory during the live Stage 4→5 flow and can't be honestly
  reconstructed from what actually survives persistence.
- `src/app/input/InputForm.tsx`: now surfaces the `reportId` that
  `generateNarrativeForInput` has returned since Stage 6 (previously unused)
  as a "View in reports dashboard" link once a report is saved; also fixed
  stale copy that still claimed persistence wasn't wired up.

Verification approach (same sandbox limitation as Stage 6 — this environment
can't reach Supabase directly over HTTP, only through the dedicated MCP):
- `tsc --noEmit` and `eslint` both clean. (Two pre-existing `eslint` errors in
  `scripts/adversarial-narrative-test.ts` and one pre-existing unused-import
  warning in `InputForm.tsx` predate this session and weren't touched.)
- A live schema-conformance test via the Supabase MCP: inserted a synthetic
  `variance_reports` row shaped like a real persisted report, ran the exact
  select list `getRecentReports`/`getReportById` use against it, confirmed the
  shape matches `VarianceReportRow` end-to-end (nested `mathematical_drivers`
  JSON included), then deleted the test row.

**Not yet done: a real end-to-end browser test.** `variance_reports` has 0
rows in it right now, so the dashboard's empty state is the only thing
that's actually been seen rendered against live data — not a populated list,
not the detail page with real content, not the "View in reports dashboard"
link from the input flow. Worth running `npm run dev` locally, submitting one
form all the way through, and clicking into the resulting report.

## Stage 6 summary (completed 2026-07-15/16, prior session)

Added `src/lib/persist-report.ts` (`persistVarianceReport`) and wired it into
`generateNarrativeForInput`. Maps `mathematical_drivers` /`classification` /
`rubric_bucket` straight from the Stage 4 breakdown, `ai_explanation` /
`confidence_score` / `system_flags` from the Stage 5 narrative result, and
`input_snapshot` from the validated raw form payload. Uses the service-role
client (`src/lib/supabase-server.ts`) since RLS has zero policies on this
table. A persistence failure is logged but doesn't fail the request — the
analyst still gets their narrative even if the audit write fails.

Verification approach (the sandbox this was built in can't reach Supabase or
Anthropic directly over HTTP — only through their dedicated MCP integrations,
confirmed via a 403 from an egress proxy on a direct `curl`) — so instead of a
full browser click-through:
- `tsc --noEmit` and `eslint` both clean.
- A live schema-conformance test via the Supabase MCP: inserted a payload
  shaped exactly like what `persistVarianceReport` sends, confirmed it's
  accepted, confirmed the `classification` CHECK constraint genuinely rejects
  invalid values (not silently disabled), then deleted the test row.

**Not yet done: a real end-to-end browser test.** Worth running `npm run dev`
locally, submitting one form, and confirming a row actually lands in
`variance_reports` — this session only proved the code compiles and the
schema accepts the shape, not that the full click-through works.

## Known issues fixed (don't re-diagnose these)

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
  the same dept now produce different seasonal-adjustment values. (This
  finding is now also logged in the product brief's Retrospective section,
  `docs/VarEx_Product_Brief.pdf`, Section 08.)
- **Forbidden-topic regexes in `validate.ts` only matched exact singular
  keywords** — "storms" (plural) slipped past the weather-topic detector
  undetected, found via an adversarial test
  (`scripts/adversarial-narrative-test.ts`, run with `npx tsx
  scripts/adversarial-narrative-test.ts`). Fixed by widening patterns to
  `word\w*` stems. All 7 adversarial/control cases pass now — rerun that
  script any time `validate.ts` changes.
- **`finvarex-app/` had no `.gitattributes`**, so files edited on Windows kept
  coming back with CRLF line endings against an LF-committed history — every
  line of a touched file showed as "changed" with zero real content diff.
  Confirmed via `git diff --ignore-all-space` (empty) before discarding
  anything. Fixed by adding `finvarex-app/.gitattributes` (`* text=auto
  eol=lf`) and re-checking out the affected files. If a Windows editor touches
  these files again, git should now normalize automatically instead of
  showing whole-file noise.
- **`supabase-js`'s `.insert()` typing resolves to `never`** on this project
  because there's no generated Database schema type (`supabase gen types`
  was never run). Reads already work around the same gap by casting results
  with `as unknown as X` (see `src/lib/queries.ts`); `.insert()` needed an
  explicit `as any` + `eslint-disable-next-line @typescript-eslint/no-explicit-any`
  at the query-builder boundary instead (see `src/lib/persist-report.ts`).
  Generating real types (`generate_typescript_types` via the Supabase MCP, or
  `supabase gen types typescript`) would remove the need for this if it
  becomes worth the churn.
- **Sandbox-specific, not relevant to Arun's own machine:** when this repo is
  accessed from an AI agent's sandboxed shell (mounted, not the real
  filesystem), quirks show up that recurred again this session and will
  likely recur for a future session working the same way: (1) the shell's
  view of a file can go stale after the mount is first established — it
  keeps serving old content for files edited through Read/Write/Edit rather
  than through the shell itself, confirmed again this session via mismatched
  `wc -l`/`stat mtime` between the two tool surfaces on 4 files; the
  workaround is to re-`cat`/heredoc the known-correct content directly
  through the shell rather than trusting its view of a file it hasn't
  touched since the mount started. (2) git on this mount can't unlink its
  own `.lock`/temp-object files (`.git/index.lock`, `.git/HEAD.lock`,
  `.git/objects/*/tmp_obj_*`) after normal operations, so they pile up and
  the next git command fails with "Another git process seems to be running"
  even though nothing actually is — renaming the stale lock file out of the
  way (not deleting — deletes fail too) clears it; the leftover tmp-object
  warnings are otherwise harmless noise. (3) new this session: **the sandbox
  has no GitHub credentials for `git push`** (fails with "could not read
  Username for 'https://github.com'") even though the mount is the real
  working tree and commits made here are real, local commits — pushing them
  is a step a human needs to do from a machine with GitHub auth already set
  up. None of these three exist when working normally from Arun's own
  machine.

## Environment / secrets

- Supabase project `FinVarEx`, ref `wmovmhilasvzcqvuzbvj`, region `us-east-1`.
  URL and service-role key are in `finvarex-app/.env.local` (gitignored) and
  set in Vercel env vars. Note: `.env.local` is currently saved with a UTF-8
  BOM, which breaks naive `source .env.local` / shell-based env loading (the
  BOM merges into the first variable name) — strip it first if a script needs
  to load this file directly instead of via Next.js's own env loading.
- `ANTHROPIC_API_KEY` is set in both `.env.local` and Vercel. Model in use:
  `claude-haiku-4-5-20251001` (chosen for cost — see
  `src/lib/narrative/constants.ts` to change it).
- `.env.example` documents all required vars without real values — keep it in
  sync if you add new env vars.

## Required commit structure (from root README)

The assignment wants a minimum of 6 commits following a specific structure.
Actual local history (`git log --oneline`) as of this session — note only
`415a4da` is **not yet pushed** (`5507f47` and everything below it is already
on `origin/main`); see the warning at the top:

```
415a4da feat: build reports dashboard + report detail pages (Stage 7)
5507f47 docs: update session handoff for Stage 7 kickoff
099c31e feat: configure database persistence models
6c04036 chore: normalize line endings to LF
2ed928a docs: log seasonal_index store-type finding in product brief retrospective
f16fcfb docs: add session handoff, update README status
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

This now satisfies every required category (docs, input form, logic layer,
LLM integration, database persistence, frontend output/admin dashboard) plus
extra fix/chore commits — the full suggested structure from the root README
is met once `415a4da` is pushed.
