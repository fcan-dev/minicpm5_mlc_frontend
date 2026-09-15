import { MODEL_IDS, type ModelId } from "../types";

const KEY = "minicpm5:loaded-models";

/** Quants that have completed a load on this device, mapped to a timestamp. */
export type LoadedModels = Partial<Record<ModelId, number>>;

export type QuantStatus = "ready" | "not-downloaded" | "evicted" | "unknown";

/**
 * Our own record of which quants have actually loaded here.
 *
 * WebLLM's `hasModelInCache` is the only other signal available, and it answers
 * "are every one of the param shards still in Cache Storage". That can be false
 * on a machine that has happily loaded the quant before, because the browser
 * evicts Cache Storage under pressure while the HTTP cache still serves the
 * shards. Remembering the successful load ourselves is what lets us tell that
 * apart from a genuine first visit.
 */
export function readLoadedModels(): LoadedModels {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    const out: LoadedModels = {};
    for (const id of MODEL_IDS) {
      const v = raw[id];
      if (typeof v === "number" && Number.isFinite(v)) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function write(next: LoadedModels): LoadedModels {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable; caller still gets the in-memory value */
  }
  return next;
}

export function markLoadedModel(id: ModelId, at = Date.now()): LoadedModels {
  return write({ ...readLoadedModels(), [id]: at });
}

export function clearLoadedModel(id: ModelId): LoadedModels {
  const next = { ...readLoadedModels() };
  delete next[id];
  return write(next);
}

/**
 * Reconcile WebLLM's cache check with what has actually run here.
 * `evicted` is the interesting case: WebLLM reports the shards gone while this
 * device loaded that quant before.
 */
export function quantStatus(cached: boolean | null, loadedAt: number | undefined): QuantStatus {
  if (cached === null) return "unknown";
  if (cached) return "ready";
  return loadedAt ? "evicted" : "not-downloaded";
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${Math.round(bytes)} B`;
}
