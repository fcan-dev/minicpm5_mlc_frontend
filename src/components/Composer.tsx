import { useEffect, useRef, useState } from "react";
import { PaperPlaneRight, Square } from "@phosphor-icons/react";
import { en } from "../i18n/en";

interface Props {
  onSend(text: string): void;
  disabled?: boolean;
  placeholder?: string;
  /** When true, the send button is replaced by a stop button. */
  generating?: boolean;
  onStop?(): void;
}

export function Composer({ onSend, disabled, placeholder, generating, onStop }: Props) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Stay exactly one line tall until the text needs more room, then grow to
  // max-h-40 and scroll. Reset to `auto` first so deleting text shrinks the box
  // instead of leaving it stuck at its tallest. `offsetHeight - clientHeight`
  // recovers the border width, which `scrollHeight` leaves out.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    if (ta.scrollHeight > 0) {
      ta.style.height = `${ta.scrollHeight + (ta.offsetHeight - ta.clientHeight)}px`;
    }
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  // The button stretches to the box's height (items-stretch, no fixed py on
  // the button) so the two always line up exactly, even on one line.
  return (
    <div className="flex items-stretch gap-2">
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder={placeholder ?? en.inputPlaceholder}
        aria-label={en.inputPlaceholder}
        className="max-h-40 min-h-[3.25rem] flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400"
      />
      {generating ? (
        <button
          type="button"
          onClick={onStop}
          aria-label={en.stop}
          title={en.stop}
          className="flex shrink-0 items-center justify-center rounded-2xl bg-rose-600 px-5 text-white transition-[background-color,transform] duration-150 ease-out hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-100 active:translate-y-px dark:hover:bg-rose-500 dark:focus-visible:ring-offset-zinc-900"
        >
          <Square size={20} weight="fill" />
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          aria-label={en.send}
          title={en.send}
          className="flex shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-white transition-[background-color,transform] duration-150 ease-out hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-100 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-emerald-500 dark:focus-visible:ring-offset-zinc-900"
        >
          <PaperPlaneRight size={20} />
        </button>
      )}
    </div>
  );
}
