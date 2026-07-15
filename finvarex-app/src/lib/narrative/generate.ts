import { getAnthropicClient, getNarrativeModel } from "./client";
import { MAX_OUTPUT_TOKENS, NARRATIVE_TEMPERATURE } from "./constants";
import { getSystemPrompt } from "./prompt";

/**
 * The one LLM call in the whole pipeline. Per the brief's cost framework:
 * one short completion per report, T=0, fixed-size prompt, no retries,
 * no multi-turn loop. If this throws, the caller's job is to surface
 * that clearly rather than silently falling back to a fabricated
 * narrative -- an absent explanation is honest, an invented one is not.
 */
export async function callNarrativeModel(userPrompt: string): Promise<string> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: getNarrativeModel(),
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: NARRATIVE_TEMPERATURE,
    system: getSystemPrompt(),
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Narrative model returned no text content.");
  }

  const narrative = textBlock.text.trim();
  if (!narrative) {
    throw new Error("Narrative model returned an empty response.");
  }

  return narrative;
}
