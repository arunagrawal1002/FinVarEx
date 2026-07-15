/**
 * Stage 5 -- Language Layer entry point.
 *
 * generateNarrative() is the only export downstream code should need:
 * given Stage 4's locked VarianceBreakdown and the analyst's raw note, it
 * produces a narrative and the FINAL confidence score -- Stage 4's
 * baseline, further docked for anything this stage's own checks catch in
 * the model's output. That order (prompt -> generate -> independently
 * validate -> dock confidence) is deliberate: the checks in validate.ts
 * do not trust the prompt boundary in prompt.ts to have worked, they
 * verify the actual output.
 */
import { CONTRADICTION_PENALTY, FORBIDDEN_TOPIC_PENALTY } from "./constants";
import { callNarrativeModel } from "./generate";
import { buildUserPrompt } from "./prompt";
import type { GenerateNarrativeInput, NarrativeResult } from "./types";
import { checkContradiction, scanForbiddenTopics } from "./validate";

export * from "./types";

export async function generateNarrative({
  breakdown,
  analystNotes,
}: GenerateNarrativeInput): Promise<NarrativeResult> {
  const userPrompt = buildUserPrompt(breakdown, analystNotes);
  const narrative = await callNarrativeModel(userPrompt);

  const forbiddenTopicHits = scanForbiddenTopics(narrative, breakdown.mathematical_drivers);
  const contradicted = checkContradiction(narrative, breakdown.mathematical_drivers);

  let confidence_score = breakdown.confidence_score;
  confidence_score -= forbiddenTopicHits.length * FORBIDDEN_TOPIC_PENALTY;
  if (contradicted) confidence_score -= CONTRADICTION_PENALTY;
  confidence_score = Math.max(0, Math.min(100, confidence_score));

  const newFlags = [...forbiddenTopicHits];
  if (contradicted) newFlags.push("math_contradiction");

  return {
    narrative,
    confidence_score,
    system_flags: [...breakdown.system_flags, ...newFlags],
    forbidden_topic_hits: forbiddenTopicHits,
    contradicted,
  };
}
