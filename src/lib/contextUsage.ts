/**
 * How full the context window is.
 *
 * The figure comes from WebLLM's own `usage.prompt_tokens` - the exact tokens of
 * the prompt we just sent - so this needs no tokenizer and no guessing.
 */

export type ContextLevel = "normal" | "high" | "near-limit";

/** Above this share of the window the meter warns. */
export const CONTEXT_HIGH = 0.75;
/** Above this the next turn is likely to start dropping history. */
export const CONTEXT_NEAR_LIMIT = 0.95;

export function contextRatio(used: number | null, max: number): number | null {
  if (used === null || !Number.isFinite(used) || !(max > 0)) return null;
  return Math.min(1, Math.max(0, used / max));
}

export function contextLevel(ratio: number): ContextLevel {
  if (ratio >= CONTEXT_NEAR_LIMIT) return "near-limit";
  if (ratio >= CONTEXT_HIGH) return "high";
  return "normal";
}

/** Compact token count for a tight status line: 950 -> "950", 12400 -> "12.4k". */
export function formatTokens(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens < 0) return "0";
  if (tokens < 1000) return `${Math.round(tokens)}`;
  const k = tokens / 1000;
  if (k >= 100) return `${Math.round(k)}k`;
  // One decimal, but no pointless ".0": "8k" rather than "8.0k".
  return `${k.toFixed(1).replace(/\.0$/, "")}k`;
}

/** "12.4k / 32k" - the label next to the meter. */
export function formatContextPair(used: number | null, max: number): string | null {
  if (used === null || !(max > 0)) return null;
  return `${formatTokens(used)} / ${formatTokens(max)}`;
}
