import { useState } from "react";
import { SlidersHorizontal, Plus, ArrowSquareOut } from "@phosphor-icons/react";
import { en } from "../i18n/en";
import { getModelDescriptors } from "../runtime/registry";
import { MLC_REPO, MLC_REPO_URL } from "../runtime/mlc";
import { CONTEXT_PRESETS } from "../types";
import type { ModelId, ContextPreset } from "../types";

interface Props {
  temperature: number;
  topP: number;
  maxTokens: number;
  systemMessage: string;
  reasoning: boolean;
  model: ModelId;
  context: ContextPreset;
  onTemperature(v: number): void;
  onTopP(v: number): void;
  onMaxTokens(v: number): void;
  onSystem(content: string): void;
  onReasoning(v: boolean): void;
  onModel(v: ModelId): void;
  onContext(v: ContextPreset): void;
  onNewChat(): void;
  disabled?: boolean;
}

export function SettingsPanel({
  temperature,
  topP,
  maxTokens,
  systemMessage,
  reasoning,
  model,
  context,
  onTemperature,
  onTopP,
  onMaxTokens,
  onSystem,
  onReasoning,
  onModel,
  onContext,
  onNewChat,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  // The shipped quants change over time (q3f16_1 was retired), so the segmented
  // control derives its column count instead of hardcoding `grid-cols-3` -
  // otherwise a removed tier leaves a dead column and the buttons stop filling
  // the row.
  const quants = getModelDescriptors();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={en.settingsLabel}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-emerald-500/60 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        <SlidersHorizontal size={16} />
        <span className="hidden sm:inline">{en.settingsLabel}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg shadow-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="minicpm-system" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {en.systemMessageLabel}
            </label>
            <button
              type="button"
              onClick={onNewChat}
              disabled={disabled}
              className="flex items-center gap-1 rounded-md text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
            >
              <Plus size={14} /> {en.newChat}
            </button>
          </div>
          <textarea
            id="minicpm-system"
            value={systemMessage}
            onChange={(e) => onSystem(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />

          {/* Quantization / model variant */}
          <div className="mt-4">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{en.modelLabel}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{en.modelHint}</p>
            <div
              className="mt-1.5 grid gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
              style={{ gridTemplateColumns: `repeat(${quants.length}, minmax(0, 1fr))` }}
            >
              {quants.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onModel(d.id)}
                  disabled={disabled}
                  title={d.quant}
                  className={`rounded-md px-1 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                    model === d.id
                      ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-900 dark:text-emerald-400"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {d.quant}
                </button>
              ))}
            </div>
            <a
              href={MLC_REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              title={`${en.repoLabel}: ${MLC_REPO}`}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 transition-colors hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400"
            >
              <ArrowSquareOut size={12} />
              {MLC_REPO}
            </a>
          </div>

          {/* Context window */}
          <div className="mt-3">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{en.contextLabel}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{en.contextHint}</p>
            <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              {CONTEXT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onContext(c)}
                  disabled={disabled}
                  className={`rounded-md px-1 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    context === c
                      ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-900 dark:text-emerald-400"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {c >= 1024 ? `${c / 1024}k` : c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <Slider
              id="minicpm-temp"
              label={en.temperatureLabel}
              value={temperature}
              min={0}
              max={2}
              step={0.05}
              onChange={onTemperature}
            />
            <Slider
              id="minicpm-topp"
              label={en.topPLabel}
              value={topP}
              min={0}
              max={1}
              step={0.05}
              onChange={onTopP}
            />
            <div>
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="minicpm-maxtok" className="font-medium text-zinc-700 dark:text-zinc-300">
                  {en.maxTokensLabel}
                </label>
                <input
                  id="minicpm-maxtok"
                  type="number"
                  min={16}
                  max={4096}
                  step={16}
                  value={maxTokens}
                  onChange={(e) => onMaxTokens(Number(e.target.value))}
                  className="w-24 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-right font-mono text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{en.reasoningLabel}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{en.reasoningHint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reasoning}
                aria-label={en.reasoningLabel}
                onClick={() => onReasoning(!reasoning)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  reasoning ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                {/**
                 * The knob needs an explicit `left`: absolutely positioned with
                 * `left: auto` it resolves to its static position, which lands at
                 * the button's right content edge - so "off" sat flush right and
                 * "on" pushed the knob 20px clean outside the pill.
                 */}
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    reasoning ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(v: number): void;
}

function Slider({ id, label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{value.toFixed(2)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-emerald-600"
      />
    </div>
  );
}
