"use server";

import {
  getDeptsForStore,
  getAvailableMonths,
  getWeeklyActuals,
} from "@/lib/queries";
import { validateInputForm, type FieldErrors, type InputFormPayload } from "@/lib/validation";
import { computeVarianceBreakdown, type VarianceBreakdown } from "@/lib/variance";

export async function fetchDepts(storeId: number) {
  return getDeptsForStore(storeId);
}

export async function fetchMonths(storeId: number, deptId: number) {
  return getAvailableMonths(storeId, deptId);
}

export async function fetchWeeklyActuals(
  storeId: number,
  deptId: number,
  targetMonth: string
) {
  return getWeeklyActuals(storeId, deptId, targetMonth);
}

export type SubmitResult =
  | { success: true; data: InputFormPayload }
  | { success: false; errors: FieldErrors };

/**
 * Pipeline stage 2 (Input Validation), run server-side.
 *
 * This is a deliberate trust boundary: the browser already ran the same
 * Zod schema for instant feedback, but a Server Action re-validates from
 * scratch because client-side checks can always be bypassed (devtools,
 * a modified request, etc). Nothing downstream (Stage 3's logic layer)
 * should ever see a payload that only passed client validation.
 *
 * This action does not persist anything yet -- variance_reports writes
 * are Stage 6 (Database persistence wiring). It only returns the
 * validated, normalized payload so the UI can confirm the input is ready
 * to hand off to the next stage.
 */
export async function submitInput(raw: unknown): Promise<SubmitResult> {
  const result = validateInputForm(raw);
  if (!result.success) {
    return { success: false, errors: result.errors };
  }
  return { success: true, data: result.data };
}

export type ComputeVarianceResult =
  | { success: true; breakdown: VarianceBreakdown }
  | { success: false; error: string };

/**
 * Pipeline stage 4 (Deterministic Logic Layer), run server-side only.
 *
 * Deliberately re-validates the raw payload rather than trusting a caller
 * to have already called submitInput -- the same "never trust the client"
 * boundary applies here, since this is the function that locks the
 * numbers and classification the LLM layer (Stage 5) will later narrate.
 * If validation fails here, there is nothing safe to compute against.
 */
export async function computeVariance(raw: unknown): Promise<ComputeVarianceResult> {
  const result = validateInputForm(raw);
  if (!result.success) {
    return { success: false, error: "Input failed validation; cannot compute variance." };
  }

  try {
    const breakdown = await computeVarianceBreakdown({
      store_id: result.data.store_id,
      dept_id: result.data.dept_id,
      target_month: result.data.target_month,
      weekly_actuals: result.data.weekly_actuals,
    });
    return { success: true, breakdown };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to compute variance breakdown.",
    };
  }
}
