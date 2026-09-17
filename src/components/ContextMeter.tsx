import { en } from "../i18n/en";
import { contextLevel, contextRatio, formatContextPair } from "../lib/contextUsage";

interface Props {
  /** Real prompt tokens of the last request, or null before any turn has run. */
  used: number | null;
  /** The selected context window, in tokens. */
  max: number;
}

const TONES = {
  normal: "bg-emerald-500",
  high: "bg-amber-500",
  "near-limit": "bg-rose-500",
} as const;

const TEXT_TONES = {
  normal: "text-zinc-500 dark:text-zinc-400",
  high: "text-amber-600 dark:text-amber-400",
  "near-limit": "text-rose-600 dark:text-rose-400",
} as const;

/**
 * Fill-as-you-go meter for the context window. It stays out of the way until the
 * model has actually reported a prompt-token count, so it never shows a guess.
 */
export function ContextMeter({ used, max }: Props) {
  const ratio = contextRatio(used, max);
  const pair = formatContextPair(used, max);
  if (ratio === null || pair === null) return null;

  const level = contextLevel(ratio);
  const label = `${en.contextUsageLabel}: ${pair}`;

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={used ?? 0}
      aria-label={level === "normal" ? label : `${label} - ${en.contextHintRaise}`}
      title={level === "normal" ? label : `${label} - ${en.contextHintRaise}`}
      className="mb-2 flex items-center gap-2"
    >
      <span className={`shrink-0 font-mono text-[11px] font-medium ${TEXT_TONES[level]}`}>
        {pair}
      </span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-300/70 dark:bg-zinc-700">
        <span
          className={`block h-full rounded-full transition-[width] duration-500 ${TONES[level]}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      {level !== "normal" && (
        <span className={`shrink-0 text-[11px] font-medium ${TEXT_TONES[level]}`}>
          {en.contextNearLimit}
        </span>
      )}
    </div>
  );
}
