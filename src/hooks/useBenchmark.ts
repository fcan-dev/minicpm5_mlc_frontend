import { useSyncExternalStore } from "react";
import type { ModelId, GenerationResult, LoadResult } from "../types";

export interface ModelMetrics {
  id: ModelId;
  loadTimeMs: number;
  generations: number;
  totalTokens: number;
  totalMs: number;
}

const KEY = "minicpm5-bench:metrics";
export type MetricsStore = Record<string, ModelMetrics>;

const listeners = new Set<() => void>();
let cache: MetricsStore | null = null;

/** Coerce a stored value to a finite number; anything else is 0. */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Parse and normalize the stored store: fields a newer build no longer writes
 * (like the retired quality rating) are dropped, and corrupted numbers are
 * zeroed, so stale or damaged storage can never poison a figure.
 */
function parse(raw: string | null): MetricsStore {
  if (!raw) return {};
  try {
    const stored = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    const out: MetricsStore = {};
    for (const [id, r] of Object.entries(stored)) {
      out[id] = {
        id: id as ModelId,
        loadTimeMs: num(r.loadTimeMs),
        generations: num(r.generations),
        totalTokens: num(r.totalTokens),
        totalMs: num(r.totalMs),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function load(): MetricsStore {
  if (!cache) cache = parse(localStorage.getItem(KEY));
  return cache;
}

/**
 * Replace the cache with a NEW object and notify subscribers. The cached store
 * is never mutated in place: `useSyncExternalStore` bails out when
 * `getSnapshot()` returns the same reference, and in-place mutation is exactly
 * how the panel stopped re-rendering after a load or a turn.
 */
function write(next: MetricsStore) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable; keep in memory */
  }
  listeners.forEach((l) => l());
}

export function readMetrics(id: ModelId): ModelMetrics {
  return load()[id] ?? { id, loadTimeMs: 0, generations: 0, totalTokens: 0, totalMs: 0 };
}

export function recordLoad(id: ModelId, r: LoadResult) {
  write({ ...load(), [id]: { ...readMetrics(id), loadTimeMs: r.downloadTimeMs } });
}

export function recordGeneration(id: ModelId, r: GenerationResult) {
  const cur = readMetrics(id);
  write({
    ...load(),
    [id]: {
      ...cur,
      generations: cur.generations + 1,
      totalTokens: cur.totalTokens + r.generatedTokens,
      totalMs: cur.totalMs + r.elapsedMs,
    },
  });
}

/**
 * Drop the in-memory cache so the next read re-parses (and re-normalizes)
 * storage. Deliberately leaves localStorage untouched: callers own what is
 * stored, and a test may have seeded storage it wants parsed, not erased.
 */
export function resetMetrics() {
  cache = null;
  listeners.forEach((l) => l());
}

export function getAvgTokPerSec(id: ModelId): number {
  const m = readMetrics(id);
  return m.totalMs > 0 ? m.totalTokens / (m.totalMs / 1000) : 0;
}

/** Component-facing: returns the full metrics map + mutators that trigger re-render. */
export function useBenchmarkState(): {
  metrics: MetricsStore;
  recordLoad: typeof recordLoad;
  recordGeneration: typeof recordGeneration;
} {
  const metrics = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => load()
  );
  return { metrics, recordLoad, recordGeneration };
}
