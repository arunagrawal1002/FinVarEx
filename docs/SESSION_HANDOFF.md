# FinVarEx — Session Handoff

Last updated: 2026-07-16. Written for whoever (or whichever Claude session)
picks this up next.

## Where things stand

Stages 1-6 of the roadmap are built, committed, pushed to `main`
(https://github.com/arunagrawal1002/FinVarEx), and deployed. Latest commit on
main: `099c31e feat: configure database persistence models`. Confirmed live
on Vercel (deployment `dpl_C8S1EZ6dZjQjNts9E93iNsHd1Co9`, state `READY`,
built from `099c31e`).

| Stage | What it is | Status |
|---|---|---|
| 1 | Product brief + Supabase schema (7 tables) | Done |
| 2 | ETL / seeding from Kaggle Walmart dataset | Done |
| 3 | Structured input form + Zod validation | Done |
| 4 | Deterministic logic layer (variance math, classification) | Done |
| 5 | LLM narrative layer (prompt boundary + post-hoc validation) | Done |
| 6 | Database persistence (`variance_reports` table) | Done |
| 7 | Frontend output + admin dashboard | **Not started — next up** |

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
the narrative is generated. Every Server Action re-validates raw input
server-side with Zod (`src/lib/validation.ts`) — the client-side validation is
UX only, not a trust boundary.

## What's next: Stage 7 (frontend output + admin dashboard)

No design work done on this yet. It's a page (or pages) to browse past
`variance_reports` rows — the assignment's "admin dashboard / output panel."

Useful starting points:

- `generateNarrativeForInput` now returns `reportId: number | null` (the
  `variance_reports.id` just written, or `null` if the write failed) — Stage 7
  can use this to link the input-form flow straight to the persisted row, or
  show a "saved" confirmation.
- There's no read/list query for `variance_reports` yet. Follow the existing
  pattern in `src/lib/queries.ts` (server-only Supabase client, throw with a
  descriptive prefix on `error`) to add something like `getRecentReports()` /
  `getReportById()`.
- Worth deciding: a flat list of recent reports vs. something closer to the
  brief's "Portfolio Anomaly Queue" concept (Section 04 of the product brief)
  — i.e. surfacing reports by classification/confidence rather than just
  recency. Not decided yet; the brief treats the Anomaly Queue as a
  high-value/high-effort core investment, not a fill-in.

## Stage 6 summary (completed this session, 2026-07-16)

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
  filesystem), two quirks showed up and