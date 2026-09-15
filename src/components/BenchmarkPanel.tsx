import type { ReactNode } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  Clock,
  CloudArrowDown,
  Gauge,
  HardDrives,
  SpinnerGap,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { useBenchmarkState, getAvgTokPerSec } from "../hooks/useBenchmark";
import { getModelDescriptors } from "../runtime/registry";
import { formatBytes, quantStatus, type QuantStatus } from "../lib/modelCacheRecord";
import { en } from "../i18n/en";
import type { ModelId } from "../types";
import type { ModelCacheState } from "../hooks/useModelCache";

export function BenchmarkPanel({
  model,
  cache,
  onSelect,
  disabled = false,
}: {
  model: ModelId;
  cache: ModelCacheState;
  onSelect(id: ModelId): void;
  disabled?: boolean;
}) {
  const { metrics } = useBenchmarkState();
  const models = getModelDescriptors();

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-4 lg:flex dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {en.benchmarkTitle}
        </h2>
        <button
          type="button"
          onClick={() => void cache.refresh()}
          title={en.recheck}
          aria-label={en.recheck}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <ArrowClockwise size={13} />
        </button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {en.storageTitle}
        </h3>
        <div className="mt-2 space-y-1.5">
          <Metric
            layout="row"
            icon={<CloudArrowDown size={14} />}
            label={en.storageUsed}
            value={formatBytes(cache.storage.usage)}
          />
          <Metric
            layout="row"
            icon={<HardDrives size={14} />}
            label={en.storageQuota}
            value={formatBytes(cache.storage.quota)}
          />
        </div>
        {typeof cache.storage.usage === "number" && cache.storage.usage > 0 && (
          <button
            type="button"
            onClick={() => void cache.clearAll()}
            disabled={cache.clearingAll || disabled}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-rose-400 hover:text-rose-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-500/60 dark:hover:text-rose-300"
          >
            {cache.clearingAll ? (
              <SpinnerGap size={13} className="animate-spin" />
            ) : (
              <Trash size={13} />
            )}
            {cache.clearingAll ? en.clearingAllModelCache : en.clearAllModelCache}
          </button>
        )}
      </section>

      {models.map((m) => {
        const md = metrics[m.id];
        const avgTok = getAvgTokPerSec(m.id);
        const status = quantStatus(cache.cached[m.id], cache.loadedHere[m.id]);
        const clearing = cache.clearing === m.id;
        const isSelected = model === m.id;
        return (
          <section
            key={m.id}
            className={[
              // The frame carries every visual state; the inner button is the
              // interaction and stays visually inert, so hover, focus and the
              // press never light up a smaller rectangle inside the card.
              "relative rounded-xl border p-3 transition-[border-color,box-shadow,transform] duration-150 ease-out",
              // Tactile press: transform-only, on the whole card.
              "has-[>button:first-child:active]:scale-[0.99]",
              // Keyboard-only focus ring, offset so it never fuses with the
              // border (and never with the selected border either).
              "has-[>button:first-child:focus-visible]:ring-2 has-[>button:first-child:focus-visible]:ring-emerald-600",
              "ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950",
              isSelected
                ? "border-emerald-600/50 bg-emerald-600/[0.05] dark:border-emerald-500/50 dark:bg-emerald-500/10"
                : disabled
                  ? "border-zinc-200 bg-white opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600",
            ].join(" ")}
          >
            {/*
              The card body is the select control: one real button, so it is
              clickable, keyboard-reachable, and screen-readable as a single
              action. The clear-cache row below is its sibling - a button can
              never contain another button.
            */}
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              disabled={disabled}
              aria-label={`${en.selectModel} ${m.labelI18n}`}
              aria-current={isSelected ? "true" : undefined}
              className="w-full cursor-pointer text-left focus:outline-none disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {m.labelI18n}
                </span>
                <StatusChip status={status} />
              </div>
              {status === "evicted" && (
                <p className="mt-1.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                  {en.evictedHint}
                </p>
              )}
              <div className="mt-3">
                {/*
                  The size is a static property of the model descriptor, so it
                  shows in every cache state - "Not downloaded" included.
                  Full-width row layout: one figure across the card, while the
                  dynamic metrics keep their two-column grid below.
                */}
                <Metric
                  icon={<HardDrives size={14} />}
                  label={en.sizeLabel}
                  value={`~${formatBytes(m.approxSizeMb * 1024 ** 2)}`}
                  layout="row"
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <Metric
                  icon={<Clock size={14} />}
                  label={en.loadTime}
                  value={md && md.loadTimeMs > 0 ? `${(md.loadTimeMs / 1000).toFixed(1)}s` : "-"}
                />
                <Metric
                  icon={<Gauge size={14} />}
                  label={en.avgSpeed}
                  value={avgTok > 0 ? `${avgTok.toFixed(1)} tok/s` : "-"}
                  accent
                />
              </div>
            </button>
            {/*
              The "In use" tag rides the card's top-right corner, outside the
              content flow. It must not be the section's first child: the
              press/focus selectors target `>button:first-child`, which would
              silently stop matching otherwise.
            */}
            {isSelected && (
              <span
                aria-hidden
                className="pointer-events-none absolute -top-2.5 right-3 rounded-full bg-emerald-700 px-2 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-wide text-white dark:bg-emerald-500 dark:text-emerald-950"
              >
                {en.inUseLabel}
              </span>
            )}
            {status !== "not-downloaded" && status !== "unknown" && (
              <button
                type="button"
                onClick={() => void cache.clear(m.id)}
                disabled={clearing || disabled}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-rose-400 hover:text-rose-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-500/60 dark:hover:text-rose-300"
              >
                {clearing ? <SpinnerGap size={13} className="animate-spin" /> : <Trash size={13} />}
                {clearing ? en.clearingModelCache : en.clearModelCache}
              </button>
            )}
          </section>
        );
      })}
    </aside>
  );
}

const CHIP: Record<QuantStatus, { icon: ReactNode; label: string; tone: string }> = {
  ready: {
    icon: <CheckCircle size={14} weight="fill" />,
    label: en.downloadedLabel,
    tone: "text-emerald-700 dark:text-emerald-400",
  },
  "not-downloaded": {
    icon: <CloudArrowDown size={14} />,
    label: en.notDownloadedLabel,
    tone: "text-zinc-500 dark:text-zinc-400",
  },
  evicted: {
    icon: <WarningCircle size={14} weight="fill" />,
    label: en.evictedLabel,
    tone: "text-amber-600 dark:text-amber-400",
  },
  unknown: {
    icon: <SpinnerGap size={13} className="animate-spin" />,
    label: "…",
    tone: "text-zinc-500 dark:text-zinc-400",
  },
};

function StatusChip({ status }: { status: QuantStatus }) {
  const chip = CHIP[status];
  return (
    <span
      className={`flex shrink-0 items-center gap-1 text-[11px] font-medium ${chip.tone}`}
      title={chip.label}
    >
      <span aria-hidden>{chip.icon}</span>
      {chip.label}
    </span>
  );
}

/**
 * One figure with its label. The label is deliberately visible text rather than
 * a tooltip: these numbers are meaningless on their own, and an icon alone does
 * not say whether "6.89 GB" is what is being used or what is available.
 *
 * `row` puts the label and value on one line (for the storage card, where the
 * labels are long); the default stacks them, which is what fits two per row in
 * the per-quant grid.
 */
function Metric({
  icon,
  label,
  value,
  accent,
  layout = "stack",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  layout?: "stack" | "row";
}) {
  const tone = accent
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-zinc-900 dark:text-zinc-100";
  const caption =
    "flex min-w-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

  if (layout === "row") {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className={caption}>
          <span className="shrink-0" aria-hidden>
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </span>
        <span className={`shrink-0 font-mono text-sm font-medium ${tone}`}>{value}</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={caption}>
        <span className="shrink-0" aria-hidden>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className={`truncate font-mono text-sm font-medium ${tone}`}>{value}</span>
    </div>
  );
}
