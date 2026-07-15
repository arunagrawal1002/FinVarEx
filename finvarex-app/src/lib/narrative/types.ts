/**
 * Stage 5 -- Language Layer.
 *
 * Per the product brief ("Why the split is the right architecture"), this
 * layer's only job is translating Stage 4's already-locked facts into a
 * fluent sentence. It never computes a number, never picks a
 * classification, and never decides what "happened" -- Stage 4 already
 * did all of that. Everything here is either prompt-construction,
 * an LLM call, or a post-hoc check on the LLM's output.
 */
import type { VarianceBreakdown } from "@/lib/variance";

export type NarrativeResult = {
  narrative: string;
  /**
   * Final confidence score: Stage 4's baseline, further docked for any
   * forbidden-topic or contradiction hits found in this narrative. This
   * is the number that would be persisted to variance_reports.confidence_score
   * once Stage 6 wires up persistence.
   */
  confidence_score: number;
  /** Stage 4's flags plus any new ones raised by validating this narrative. */
  system_flags: string[];
  forbidden_topic_hits: string[];
  contradicted: boolean;
};

export type GenerateNarrativeInput = {
  breakdown: VarianceBreakdown;
  analystNotes: string | undefined;
};
