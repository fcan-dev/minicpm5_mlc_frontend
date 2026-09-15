import { useEffect, useRef } from "react";
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
    <ul className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      {messages.map((m, i) => (
        <MessageBubble
          key={m.id}
          message={m}
          showActions={m.role === "assistant" && i === lastAssistantIdx && !streaming}
          onRegenerate={onRegenerate}
        />
      ))}

      {streaming && (
        <li className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-4 py-2.5 text-left text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
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
