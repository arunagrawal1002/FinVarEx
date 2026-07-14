"use server";

import {
  getDeptsForStore,
  getAvailableMonths,
  getWeeklyActuals,
} from "@/lib/queries";
import { validateInputForm, type FieldErrors, type InputFormPayload } from "@/lib/validation";

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
