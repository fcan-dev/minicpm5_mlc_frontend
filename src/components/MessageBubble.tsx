import { useState } from "react";
import { ArrowClockwise, Copy, Check } from "@phosphor-icons/react";
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

  if (isUser) {
    // Soft neutral-gray pill, no border: the position (right) is what marks it
    // as the user, not a heavy frame.
    return (
      <li className="flex justify-end">
        <div className="max-w-2xl">
          <p className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-200 px-4 py-2.5 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100">
            {message.content}
          </p>
        </div>
      </li>
    );
  }

  // Assistant replies sit in a card with a SIGHTLY visible border on the gray
  // surface: present, but not a heavy frame. Same reading width as the pill.
  return (
    <li className="flex justify-start">
      <div className="max-w-2xl min-w-0">
        <div className="rounded-2xl border border-zinc-300/60 bg-white px-4 py-3 text-zinc-900 dark:border-zinc-700/60 dark:bg-zinc-950/40 dark:text-zinc-100">
          {message.reasoning && <ReasoningBlock reasoning={message.reasoning} />}
          <Markdown>{message.content}</Markdown>
        </div>
        {showActions && (
          <div className="mt-1.5 flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
            <CopyAction text={message.content} />
            <button
              type="button"
              onClick={onRegenerate}
              aria-label={en.regenerate}
              title={en.regenerate}
              className="rounded p-1 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <ArrowClockwise size={15} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? en.copied : en.copyMessage}
      title={copied ? en.copied : en.copyMessage}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {}
        );
      }}
      className="rounded p-1 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}
    </button>
  );
}
