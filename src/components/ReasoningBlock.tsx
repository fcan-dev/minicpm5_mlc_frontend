import { useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { en } from "../i18n/en";

interface Props {
  reasoning: string;
  streaming?: boolean;
}

export function ReasoningBlock({ reasoning, streaming }: Props) {
  const [open, setOpen] = useState(false);
  if (!reasoning) return null;
  const expanded = open || !!streaming;

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <CaretRight
          size={12}
          weight="bold"
          className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        />
        <span>{streaming && !open ? en.thinking : en.reasoningTitle}</span>
        {streaming && (
          <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-zinc-200 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {reasoning}
        </div>
      )}
    </div>
  );
}
