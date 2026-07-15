import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_NARRATIVE_MODEL } from "./constants";

/**
 * Server-only Anthropic client. Mirrors src/lib/supabase-server.ts's
 * guard exactly -- this uses a secret API key and must never be imported
 * into a Client Component or exposed to the browser.
 */
function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error(
      "narrative/client.ts was imported into client code. This module uses " +
        "the Anthropic API key and must only run on the server."
    );
  }
}

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  assertServer();

  if (cachedClient) return cachedClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY environment variable. Set it in .env.local " +
        "(see .env.example)."
    );
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export function getNarrativeModel(): string {
  return process.env.ANTHROPIC_NARRATIVE_MODEL || DEFAULT_NARRATIVE_MODEL;
}
