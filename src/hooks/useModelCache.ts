import { useCallback, useEffect, useState } from "react";
import { MLC_REPO, mlcAppConfig, mlcUrls, mlcVariant } from "../runtime/mlc";
import { MODEL_IDS, type ModelId, type ContextPreset } from "../types";
import {
  clearLoadedModel,
  markLoadedModel,
  readLoadedModels,
  type LoadedModels,
} from "../lib/modelCacheRecord";

export interface StorageUsage {
  usage: number | null;
  quota: number | null;
}

export interface ModelCacheState {
  /** Per quant, from WebLLM's own cache check; null while still unknown. */
  cached: Record<ModelId, boolean | null>;
  /** Per quant, those that have completed a load on this device. */
  loadedHere: LoadedModels;
  storage: StorageUsage;
  /** The quant currently being cleared, if any. */
  clearing: ModelId | null;
  /** True while a full (all-quants) cache purge is in flight. */
  clearingAll: boolean;
  refresh(): Promise<void>;
  clear(id: ModelId): Promise<void>;
  /** Wipe every WebLLM weight/config entry for this app, including orphans. */
  clearAll(): Promise<void>;
  /** Record a successful load, then re-check the cache. */
  markLoaded(id: ModelId): void;
}

const UNKNOWN = Object.fromEntries(MODEL_IDS.map((id) => [id, null])) as Record<
  ModelId,
  boolean | null
>;

async function readStorage(): Promise<StorageUsage> {
  try {
    const est = await navigator.storage?.estimate?.();
    return { usage: est?.usage ?? null, quota: est?.quota ?? null };
  } catch {
    return { usage: null, quota: null };
  }
}

/**
 * Delete every cache entry across all of this origin's caches whose URL
 * matches. WebLLM's `deleteModelAllInfoInCache` is index-driven: it only
 * removes the shards listed in `tensor-cache.json`. Shards left behind by an
 * interrupted download - or by a browser-evicted index - become orphans it can
 * never reach, and they are what keep `storage.estimate().usage` high long
 * after the UI reports "not downloaded". Matching on the URL is the only way
 * to reach those bytes.
 */
async function purgeCaches(match: (url: string) => boolean): Promise<void> {
  if (typeof caches === "undefined") return;
  const names = await caches.keys();
  await Promise.all(
    names.map(async (name) => {
      const cache = await caches.open(name);
      const hits = (await cache.keys()).filter((req) => match(req.url));
      await Promise.all(hits.map((req) => cache.delete(req)));
    }),
  );
}

/** Purge everything cached for one model's subdir: weights, wasm, tokenizer, index. */
function purgeModelCache(id: ModelId): Promise<void> {
  const base = mlcUrls(id).model; // "…/resolve/main/<subdir>", no trailing slash
  return purgeCaches((u) => u === base || u.startsWith(base + "/"));
}

/** Purge every WebLLM artifact for this app, across all quants at once. */
function purgeAllModelCaches(): Promise<void> {
  const marker = `${MLC_REPO}/resolve/main/`;
  return purgeCaches((u) => u.includes(marker));
}

/**
 * Reports, for every quant rather than only the selected one, whether its
 * weights are still in the browser cache - plus how much storage the origin is
 * actually using, which is the figure that explains a cache that went away.
 *
 * Two independent signals are kept, because WebLLM's alone is not trustworthy
 * on its own: `hasModelInCache` needs *every* param shard present, so a browser
 * that evicted Cache Storage under pressure reports "not downloaded" for a
 * quant this device has loaded many times. Our own record tells those apart.
 */
export function useModelCache(context: ContextPreset): ModelCacheState {
  const [cached, setCached] = useState<Record<ModelId, boolean | null>>(UNKNOWN);
  const [loadedHere, setLoadedHere] = useState<LoadedModels>(() => readLoadedModels());
  const [storage, setStorage] = useState<StorageUsage>({ usage: null, quota: null });
  const [clearing, setClearing] = useState<ModelId | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { hasModelInCache } = await import("@mlc-ai/web-llm");
      const results = await Promise.all(
        MODEL_IDS.map(async (id) => {
          try {
            const hit = await hasModelInCache(
              mlcVariant(id).cacheLabel,
              mlcAppConfig(id, context)
            );
            return [id, hit] as const;
          } catch {
            return [id, null] as const;
          }
        })
      );
      setCached(Object.fromEntries(results) as Record<ModelId, boolean | null>);
    } catch {
      setCached({ ...UNKNOWN });
    }
    setLoadedHere(readLoadedModels());
    setStorage(await readStorage());
  }, [context]);

  const clear = useCallback(
    async (id: ModelId) => {
      setClearing(id);
      try {
        const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
        await deleteModelAllInfoInCache(mlcVariant(id).cacheLabel, mlcAppConfig(id, context));
      } catch {
        /* nothing cached to remove */
      }
      // WebLLM's delete only removes what its index lists; also purge any shards
      // still sitting under this model's subdir so usage actually drops.
      await purgeModelCache(id).catch(() => {
        /* best-effort */
      });
      // Forget our own record too: after an explicit clear the honest status is
      // "not downloaded", not "evicted".
      setLoadedHere(clearLoadedModel(id));
      await refresh();
      setClearing(null);
    },
    [context, refresh]
  );

  const clearAll = useCallback(async () => {
    setClearingAll(true);
    try {
      await purgeAllModelCaches();
      // Forget our own load records so every quant reads "not downloaded".
      let rec = readLoadedModels();
      for (const id of MODEL_IDS) rec = clearLoadedModel(id);
      setLoadedHere(rec);
    } catch {
      /* storage unavailable; the usage re-read below reflects reality */
    }
    await refresh();
    setClearingAll(false);
  }, [refresh]);

  const markLoaded = useCallback(
    (id: ModelId) => {
      setLoadedHere(markLoadedModel(id));
      void refresh();
    },
    [refresh]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { cached, loadedHere, storage, clearing, clearingAll, refresh, clear, clearAll, markLoaded };
}
