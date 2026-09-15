const OPEN = "<think>";
const CLOSE = "</think>";

/**
 * Split a raw model response into its reasoning and answer.
 *
 * MiniCPM5 emits `<think>...</think>` before the answer. While streaming, the
 * closing tag may not have arrived yet, so an unterminated block is treated as
 * reasoning too.
 */
export function splitThinking(raw: string): { reasoning: string; content: string } {
  const reasonings: string[] = [];
  let rest = raw;

  // Closed blocks.
  for (;;) {
    const start = rest.indexOf(OPEN);
    if (start === -1) break;
    const end = rest.indexOf(CLOSE, start + OPEN.length);
    if (end === -1) break; // unterminated; handled below
    reasonings.push(rest.slice(start + OPEN.length, end));
    rest = rest.slice(0, start) + rest.slice(end + CLOSE.length);
  }

  // Trailing unterminated block (mid-stream).
  const open = rest.indexOf(OPEN);
  if (open !== -1) {
    reasonings.push(rest.slice(open + OPEN.length));
    rest = rest.slice(0, open);
  }

  const reasoning = reasonings
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
  return { reasoning, content: rest.trim() };
}
