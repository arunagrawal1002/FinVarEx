/**
 * Model choice: Haiku, deliberately. Stage 5's job is narrowly "turn an
 * already-verified JSON fact-set into 2-4 sentences at T=0" -- there is no
 * open-ended reasoning left for the model to do, Stage 4 already did all
 * of it. That is exactly the class of task the cheapest capable tier is
 * suited for, and matches the brief's own cost framework ("LLM cost is
 * bounded and predictable... a fixed-size structured prompt... no
 * multi-turn agentic loops").
 *
 * Overridable via ANTHROPIC_NARRATIVE_MODEL for later experimentation
 * without a code change.
 */
export const DEFAULT_NARRATIVE_MODEL = "claude-haiku-4-5-20251001";

/** Short by design -- a live-review sentence or two, not a report. */
export const MAX_OUTPUT_TOKENS = 300;

/** Zero creative latitude over facts, per the brief's "Creativity vs.
 *  Determinism" trade-off -- only sentence construction varies. */
export const NARRATIVE_TEMPERATURE = 0;

/**
 * Matches the product brief's Failure Mode Analysis table verbatim:
 * "Forbidden-topic scan on generated text for any driver with |z| < 1.5
 * not otherwise cited" -> "confidence docked 25 pts per forbidden hit".
 */
export const FORBIDDEN_TOPIC_PENALTY = 25;

/**
 * "Automated parse compares the narrative's directional language against
 * the computed sign" -> "Confidence docked 20 pts per contradiction".
 */
export const CONTRADICTION_PENALTY = 20;

/** Same significance bar Stage 4 uses for weather (WEATHER_Z_THRESHOLD)
 *  -- a driver below this magnitude isn't a real signal, so the model
 *  citing it as a cause is exactly the hallucination this check exists
 *  to catch. */
export const FORBIDDEN_TOPIC_Z_THRESHOLD = 1.5;
