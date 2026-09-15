/**
 * WebLLM reports model-load progress in three independent phases, each of
 * which restarts its own fraction at 0:
 *
 *   1. "Fetching param cache[i/N]"       - one report per param shard
 *   2. "Loading model from cache[i/N]"   - one report per shard, resets to 0
 *   3. "Loading GPU shader modules[i/N]" - throttled to one report per second
 *
 * Painting those raw fractions on a single bar makes it fill, snap back to
 * zero, then fill again, which reads as "stuck, then it jumped". This module
 * folds them into one monotonic 0..1 bar, keeps a per-phase ceiling so the UI
 * can creep between WebLLM's chunky reports without ever entering the next
 * phase early, and parses the real megabyte figure out of WebLLM's own text
 * (the fraction alone carries no byte count).
 */

export type LoadPhase = "fetch" | "cache" | "shaders" | "unknown";

export interface LoadProgressView {
  phase: LoadPhase;
  /** Monotonic 0..1 completion across all three phases. Never decreases. */
  overall: number;
  /** Highest 0..1 the current phase can justify; creep never passes it. */
  ceiling: number;
  /** Real MB WebLLM reported, or null when its text carries no figure. */
  loadedMb: number | null;
}

/** Share of the whole load that each phase accounts for, as [start, end]. */
const BANDS: Record<LoadPhase, [number, number]> = {
  fetch: [0, 0.6],
  cache: [0.6, 0.85],
  shaders: [0.85, 1],
  unknown: [0, 0],
};

/**
 * How far past the last real report the bar may creep. Small on purpose: it
 * buys visible motion between reports without ever overstating the load by
 * more than this much before WebLLM's next report corrects it.
 */
export const CREEP_LOOKAHEAD = 0.02;

/** Identify the phase from WebLLM's progress text. */
export function loadPhase(text: string): LoadPhase {
  const t = text.toLowerCase();
  // "shader" first: the shader phase's text also contains "loading".
  if (t.includes("shader")) return "shaders";
  if (t.includes("loading model from cache")) return "cache";
  if (t.includes("fetch")) return "fetch";
  return "unknown";
}

/** WebLLM phrases its figure as "NNNMB fetched" or "NNNMB loaded". */
export function parseLoadedMb(text: string): number | null {
  const m = /(\d+)\s*MB\s+(?:fetched|loaded)/i.exec(text);
  return m ? Number(m[1]) : null;
}

export function initialLoadProgress(): LoadProgressView {
  return { phase: "unknown", overall: 0, ceiling: 0, loadedMb: null };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Fold one WebLLM report into the view. Pure, and monotonic by construction so
 * a phase change (or a re-sent shard report) can never drag the bar backwards.
 */
export function reduceLoadProgress(
  prev: LoadProgressView,
  report: { text: string; progress: number }
): LoadProgressView {
  const phase = loadPhase(report.text);
  const [start, end] = BANDS[phase];
  const frac = clamp01(report.progress);
  const overall = Math.max(prev.overall, start + frac * (end - start));
  const ceiling = Math.max(prev.ceiling, phase === "unknown" ? overall : end);
  return { phase, overall, ceiling, loadedMb: parseLoadedMb(report.text) ?? prev.loadedMb };
}

/** Where the displayed bar may creep to: just ahead of the last real report. */
export function creepTarget(view: LoadProgressView): number {
  return Math.min(view.ceiling, view.overall + CREEP_LOOKAHEAD);
}

/**
 * Advance a displayed 0..1 value toward `target` at a steady rate, so the bar
 * keeps moving between WebLLM's chunky reports. Never runs backwards and never
 * passes `target`.
 */
export function creepToward(
  displayed: number,
  target: number,
  dtMs: number,
  ratePerSec = 0.01
): number {
  if (!(dtMs > 0)) return displayed;
  if (displayed >= target) return target;
  return Math.min(target, displayed + ratePerSec * (dtMs / 1000));
}

/** Human-readable byte pair for the progress readout, e.g. "85 MB / 1.4 GB". */
export function formatMbPair(loadedMb: number | null, totalMb: number): string | null {
  if (loadedMb === null || !(totalMb > 0)) return null;
  const one = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(2)} GB` : `${Math.round(n)} MB`);
  return `${one(loadedMb)} / ${one(totalMb)}`;
}
