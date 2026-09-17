import { Fragment, useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { ReasoningBlock } from "./ReasoningBlock";
import { Markdown } from "../lib/markdown";
import { splitThinking } from "../lib/thinking";
import { en } from "../i18n/en";
import type { Message } from "../types";

interface Props {
  messages: Message[];
  streaming: boolean;
  pending: string;
  onRegenerate(): void;
}

/**
 * A divider appears before a turn (a user message) when the conversation has
 * gone quiet for a while, so re-reading a long chat shows where each day's
 * exchange happened. Messages written before `createdAt` existed carry no
 * time, and pairs without times never produce a divider.
 */
const GAP_THRESHOLD_MS = 10 * 60 * 1000;

function showDividerBefore(messages: Message[], i: number): boolean {
  const m = messages[i];
  if (m.role !== "user" || typeof m.createdAt !== "number") return false;
  if (i === 0) return true;
  const prev = messages[i - 1];
  if (typeof prev.createdAt !== "number") return false;
  return m.createdAt - prev.createdAt >= GAP_THRESHOLD_MS;
}

function formatStamp(ts: number): string {
  const d = new Date(ts);
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} ${time}`;
}

export function MessageList({ messages, streaming, pending, onRegenerate }: Props) {
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, streaming]);

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  const live = splitThinking(pending);

  if (messages.length === 0 && !streaming) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-base font-semibold text-zinc-700 dark:text-zinc-200">{en.emptyChatTitle}</p>
      </div>
    );
  }

  return (
    // Centered column: user pill (right) and reply (left) sit close together
    // horizontally instead of hugging opposite edges of a wide screen.
    <ul className="mx-auto flex h-full w-full max-w-3xl scroll-gutter flex-col gap-3 overflow-y-auto p-4">
      {messages.map((m, i) => (
        <Fragment key={m.id}>
          {showDividerBefore(messages, i) && (
            <li aria-hidden className="my-1 self-center text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
              {formatStamp(m.createdAt!)}
            </li>
          )}
          <MessageBubble
            message={m}
            showActions={m.role === "assistant" && i === lastAssistantIdx && !streaming}
            onRegenerate={onRegenerate}
          />
        </Fragment>
      ))}

      {streaming && (
        <li className="flex justify-start">
          <div className="max-w-2xl min-w-0">
            <div className="rounded-2xl border border-zinc-300/60 bg-white px-4 py-3 text-left text-zinc-900 dark:border-zinc-700/60 dark:bg-zinc-950/40 dark:text-zinc-100">
              <ReasoningBlock reasoning={live.reasoning} streaming={!live.content} />
              {live.content ? (
                <Markdown>{live.content}</Markdown>
              ) : (
                !live.reasoning && (
                  <span className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <Spinner /> {en.streaming}
                  </span>
                )
              )}
            </div>
          </div>
        </li>
      )}
      {/* Sentinel so the scroll effect can reach the end; a <div> here would be
          invalid inside the list. */}
      <li ref={endRef} aria-hidden className="h-0" />
    </ul>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
    />
  );
}
