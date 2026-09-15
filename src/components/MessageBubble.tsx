import { ArrowClockwise } from "@phosphor-icons/react";
import { Markdown } from "../lib/markdown";
import { ReasoningBlock } from "./ReasoningBlock";
import { en } from "../i18n/en";
import type { Message } from "../types";

interface Props {
  message: Message;
  showActions?: boolean;
  onRegenerate?(): void;
}

export function MessageBubble({ message, showActions, onRegenerate }: Props) {
  const isUser = message.role === "user";

  return (
    <li className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${isUser ? "text-right" : "text-left"}`}>
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-md bg-emerald-600 px-4 py-2.5 text-white"
              : "rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              {message.reasoning && <ReasoningBlock reasoning={message.reasoning} />}
              <Markdown>{message.content}</Markdown>
            </>
          )}
        </div>
        {!isUser && showActions && (
          <div className="mt-1.5 flex items-center justify-end gap-1 text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={onRegenerate}
              aria-label={en.regenerate}
              title={en.regenerate}
              className="rounded p-1 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <ArrowClockwise size={16} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
