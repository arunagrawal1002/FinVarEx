/**
 * Stage 6 -- Database Persistence.
 *
 * Writes the locked Stage 4 breakdown and the validated Stage 5 narrative
 * to variance_reports as a single audit record. Per the product brief
 * ("Reports are cached, not regenerated" -- Section 07, Cost & Sustainability
 * Framework), variance_reports persists inputs, computed math, and the
 * narrative together as one record; this module is that write.
 *
 * Uses the service-role Supabase client (src/lib/supabase-server.ts), not
 * the anon key -- RLS is enabled on all 7 tables with zero policies
 * (see supabase/migrations/20260714192300_enable_rls_no_policies.sql), so
 * only the server-only service-role client can write here.
 */
import { getSupabaseServerClient } from "./supabase-server";
import type { InputFormPayload } from "./validation";
import type { VarianceBreakdown } from "./variance";
import type { NarrativeResult } from "./narrative";

export type PersistedReport = {
  id: number;
};

/**
 * Inserts one variance_reports row.
 *
 * `input` is the raw validated Stage 3 payload (input_snapshot -- kept for
 * audit/reproducibility, so a report can be traced back to exactly what the
 * analyst submitted). `breakdown` is Stage 4's locked math and
 * classification. `narrativeResult` is Stage 5's narrative and *final*
 * confidence score (Stage 4's baseline, further docked for anything Stage
 * 5's own validation caught -- see NarrativeResult.confidence_score).
 */
export async function persistVarianceReport(
  input: InputFormPayload,
  breakdown: VarianceBreakdown,
  narrativeResult: NarrativeResult
): Promise<PersistedReport> {
  const supabase = getSupabaseServerClient();

  // No generated Database schema type exists in this project (see the other
  // src/lib/*.ts Supabase callers, which all cast reads with
  // `as unknown as X` for the same reason) -- supabase-js's insert() typing
  // falls back to `never` without one. Cast at this one boundary rather
  // than generating a full schema type just for a single insert.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("variance_reports") as any)
    .insert({
      store_id: input.store_id,
      dept_id: input.dept_id,
      target_month: input.target_month,
      input_snapshot: input,
      mathematical_drivers: breakdown.mathematical_drivers,
      classification: breakdown.classification,
      rubric_bucket: breakdown.rubric_bucket,
      ai_explanation: narrativeResult.narrative,
      confidence_score: narrativeResult.confidence_score,
      system_flags: narrativeResult.system_flags,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to persist variance report: ${error.message}`);
  return data as unknown as PersistedReport;
}
