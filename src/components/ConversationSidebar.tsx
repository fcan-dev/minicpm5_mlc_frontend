import { useState } from "react";
import { Plus, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { en } from "../i18n/en";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Conversation } from "../types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  disabled?: boolean;
  /** Conversation whose LLM-generated title is still in flight. */
  namingId?: string | null;
  onSelect(id: string): void;
  onNew(): void;
  onRename(id: string, title: string): void;
  onDelete(id: string): void;
  onClose?(): void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  disabled,
  namingId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClose,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  const startRename = (c: Conversation) => {
    setEditingId(c.id);
    setDraft(c.title);
  };

  const commitRename = () => {
    if (editingId) onRename(editingId, draft);
    setEditingId(null);
  };

  return (
    <nav
      aria-label={en.chatsLabel}
      className="flex h-full w-75 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="px-4 pb-1 pt-4">
        <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {en.appName}
        </span>
      </div>

      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {en.chatsLabel}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            disabled={disabled}
            title={en.newChat}
            aria-label={en.newChat}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Plus size={16} weight="bold" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title={en.closeSidebar}
              aria-label={en.closeSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {en.emptyConversations}
          </p>
        )}
        <ul className="space-y-0.5">
          {conversations.map((c) => {
            const active = c.id === activeId;
            if (editingId === c.id) {
              return (
                <li key={c.id}>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    aria-label={en.renameConversation}
                    className="w-full rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                  />
                </li>
              );
            }
            return (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  disabled={disabled || namingId === c.id}
                  aria-current={active ? "true" : undefined}
                  className={`w-full truncate rounded-lg py-2 pl-3 pr-16 text-left text-sm transition-colors disabled:opacity-60 ${
                    active
                      ? "bg-emerald-50 font-medium text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {namingId === c.id ? (
                    <span className="italic text-zinc-500 dark:text-zinc-400">
                      {en.namingChat}
                    </span>
                  ) : (
                    c.title
                  )}
                </button>
                <div className="absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => startRename(c)}
                    disabled={disabled}
                    title={en.renameConversation}
                    aria-label={`${en.renameConversation}: ${c.title}`}
                    className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  >
                    <PencilSimple size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(c)}
                    disabled={disabled}
                    title={en.deleteConversation}
                    aria-label={`${en.deleteConversation}: ${c.title}`}
                    className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-rose-100 hover:text-rose-600 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-rose-500/20 dark:hover:text-rose-300"
                  >
                    <Trash size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={en.deleteConversationTitle}
        body={deleteTarget ? `${deleteTarget.title} - ${en.deleteConversationBody}` : ""}
        confirmLabel={en.deleteConversationConfirm}
        cancelLabel={en.cancel}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </nav>
  );
}
