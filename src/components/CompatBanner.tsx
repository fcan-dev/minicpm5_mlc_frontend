import { WarningCircle } from "@phosphor-icons/react";
import { en } from "../i18n/en";

export function CompatBanner() {
  return (
    <div
      role="alert"
      className="flex max-w-2xl flex-col items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-5 text-zinc-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-zinc-100"
    >
      <div className="flex items-center gap-2 font-semibold">
        <WarningCircle size={20} className="text-amber-600 dark:text-amber-400" />
        {en.noWebgpuTitle}
      </div>
      <p className="text-sm leading-relaxed">{en.noWebgpuBody}</p>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{en.hardwareNote}</p>
    </div>
  );
}
