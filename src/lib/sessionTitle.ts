import { splitThinking } from "./thinking";

/**
 * Automatic chat titles, mirroring the `@nicknisi/pi-session-name` extension:
 * one LLM call after the first exchange with a heuristic fallback.
 */

export const TITLE_MAX_LENGTH = 60;
export const TITLE_MAX_WORDS = 6;

export const TITLE_SYSTEM_PROMPT =
  `You name chat sessions. Given the user's question and the ` +
  `assistant's reply (which may include a reasoning block), reply with ONLY a ` +
  `short title of at most ${TITLE_MAX_WORDS} words, written in English. No ` +
  `quotes, no trailing punctuation, no explanation.`;

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** First non-empty line, whitespace-collapsed, capped. */
export function heuristicTitle(text: string, max = TITLE_MAX_LENGTH): string {
  const firstLine = text
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  const name = (firstLine ?? text).replace(/\s+/g, " ").trim();
  if (!name) return "";
  return truncate(name, max);
}

/** First line only, quotes and trailing punctuation stripped, capped. */
export function cleanTitle(raw: string, max = TITLE_MAX_LENGTH): string {
  const firstLine = raw.split(/\n/)[0]?.trim() ?? "";
  const title = firstLine
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (!title) return "";
  return truncate(title, max);
}

export function buildTitlePrompt(question: string, reasoning: string, answer: string): string {
  const parts = [`User's question:\n${truncate(question, 1000)}`];
  if (reasoning.trim()) {
    parts.push(`Assistant's reasoning:\n${truncate(reasoning, 800)}`);
  }
  parts.push(`Assistant's answer:\n${truncate(answer, 800)}`);
  return parts.join("\n\n");
}

/**
 * Turn a raw model response into a title. WebLLM's `enable_thinking: false`
 * path can echo an empty `<think>
 * block, so strip reasoning first; an empty result means "no usable title"
 * (caller falls back).
 */
export function titleFromModelOutput(raw: string, max = TITLE_MAX_LENGTH): string {
  const { content } = splitThinking(raw);
  return cleanTitle(content, max);
}

// Longest first, so "why does" is stripped before a bare "why" could leave
// "does ..." behind.
const INTERROGATIVES = [
  "what is the",
  "what is a",
  "what is",
  "what are",
  "what's",
  "what",
  "how do i",
  "how does",
  "how do",
  "how can i",
  "how can",
  "how to",
  "how",
  "why does",
  "why do",
  "why is",
  "why",
] as const;

const FALLBACK_MAX_WORDS = 4;
const FALLBACK_MAX_LENGTH = 40;

// Words a title must not end on: a 4-word slice of a longer question can stop
// mid-phrase - "center a div in" - so walk back over such dangles.
const DANGLING = new Set([
  "the", "a", "an", "in", "on", "at", "to", "of", "for", "with",
  "and", "or", "but", "is", "are", "was", "were", "be", "it", "its",
]);

/**
 * Last-resort chat title when the model returns nothing usable. It contracts
 * the question (or the answer, when the question is blank) into a label:
 * interrogative openers dropped, capped at a few words, first letter
 * capitalised. A title should read as a label, not as an echo of the question.
 */
export function fallbackTitle(question: string, answer = ""): string {
  let base = question.trim();
  if (!base) base = answer.trim();
  if (!base) return "";
  base = base.replace(/[.!?]+$/, "").trim();
  const lower = base.toLowerCase();
  for (const lead of INTERROGATIVES) {
    if (lower.startsWith(lead)) {
      base = base.slice(lead.length).trim();
      break;
    }
  }
  const words = base.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const capped = words.slice(0, FALLBACK_MAX_WORDS);
  while (
    capped.length > 1 &&
    DANGLING.has(capped[capped.length - 1].toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))
  ) {
    capped.pop();
  }
  const text = capped.join(" ");
  if (!text) return "";
  const title = text.charAt(0).toUpperCase() + text.slice(1);
  return truncate(title, FALLBACK_MAX_LENGTH);
}
