import type { ModelRuntime, GenerateInput } from "./ModelRuntime";
import type { ModelId, ContextPreset, GenerationResult, LoadResult, LoadOpts } from "../types";
import type { MLCEngine } from "@mlc-ai/web-llm";

/**
 * MLC / WebLLM build of MiniCPM5-2B (q4f16_1 / q4f16_autoawq).
 *
 * Each quantization lives in its own subfolder of our Hugging Face repo. Each wasm
 * is compiled for a 32768-token context window; the runtime "shrinks" to the
 * requested context via `overrides.context_window_size`.
 *
 * NOTE: the wasm filenames below are exactly what `mlc_llm` emitted at build time,
 * so they differ per quant (`...q4f16_1-MLC-webgpu.wasm` vs
 * `...q4f16_autoawq-webgpu.wasm`). They must match the uploaded files
 * byte-for-byte, so do not normalize them; `mlc.test.ts` pins every one.
 *
 * q3f16_1 is deliberately not shipped. It dequantizes to token soup on every
 * device we tried, while q4f16_1 answers coherently in the same browser/GPU -
 * so the fault is in MLC's compiled int3 (group_size=40) WebGPU kernels, not in
 * the weights or the config. The weights were verified against the base model
 * (per-shard md5s match `tensor-cache.json`; layer-0 `down_proj` dequantizes to
 * 0.97 correlation with `openbmb/MiniCPM5-2B`). Re-adding it means rebuilding
 * int3 and re-running the browser smoke test in `scripts/smoke-test.md`.
 *
 * The repo must be public: these URLs are fetched from the browser without
 * credentials, so a private repo returns HTTP 401 and every load fails.
 */
export const MLC_REPO = "fatih-can/MiniCPM5-2B-MLC";
/** Human-facing link to the weights, shown in Settings. */
export const MLC_REPO_URL = `https://huggingface.co/${MLC_REPO}`;
export const MLC_MAX_COMPILED_CONTEXT = 32768;

export interface MlcVariant {
  /** Subfolder inside MLC_REPO that holds this quant's artifacts. */
  subdir: string;
  /** WebLLM cache key / model_id for this quant. */
  cacheLabel: string;
  /**
   * Filename of the wasm under `<subdir>/libs/`, exactly as emitted by `mlc_llm` -
   * deliberately not uniform across quants. Do not normalize.
   */
  wasmLib: string;
  approxSizeMb: number;
  vramRequiredMb: number;
}

export const MLC_VARIANTS: Record<ModelId, MlcVariant> = {
  "minicpm5-q4f16": {
    subdir: "q4f16_1",
    cacheLabel: "MiniCPM5-2B-q4f16_1-MLC",
    wasmLib: "MiniCPM5-2B-q4f16_1-MLC-webgpu.wasm",
    approxSizeMb: 1420,
    vramRequiredMb: 2000,
  },
  "minicpm5-q4f16-awq": {
    subdir: "q4f16_autoawq",
    cacheLabel: "MiniCPM5-2B-q4f16_autoawq-MLC",
    wasmLib: "MiniCPM5-2B-q4f16_autoawq-webgpu.wasm",
    approxSizeMb: 2116,
    vramRequiredMb: 2800,
  },
};

export function mlcVariant(id: ModelId): MlcVariant {
  const v = MLC_VARIANTS[id];
  if (!v) throw new Error(`unknown model: ${id}`);
  return v;
}

/** URLs WebLLM needs: the artifact base (repo subfolder) and the compiled kernel. */
export function mlcUrls(id: ModelId): { model: string; modelLib: string } {
  const v = mlcVariant(id);
  const base = `https://huggingface.co/${MLC_REPO}/resolve/main/${v.subdir}`;
  return { model: base, modelLib: `${base}/libs/${v.wasmLib}` };
}

/**
 * The app config WebLLM uses for a model+context pair. Exported so cache checks
 * (`hasModelInCache`) and cache clearing use the exact same definition.
 */
export function mlcAppConfig(id: ModelId, context: ContextPreset) {
  const v = mlcVariant(id);
  const { model, modelLib } = mlcUrls(id);
  return {
    model_list: [
      {
        model,
        model_id: v.cacheLabel,
        model_lib: modelLib,
        vram_required_MB: v.vramRequiredMb,
        overrides: { context_window_size: context },
      },
    ],
  };
}

export class MlcRuntime implements ModelRuntime {
  constructor(
    readonly id: ModelId,
    private readonly context: ContextPreset,
  ) {}

  async load(opts: LoadOpts = {}): Promise<LoadResult> {
    const t0 = performance.now();
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    const v = mlcVariant(this.id);
    // WebLLM's own progress text is passed through untouched: it runs three
    // separate phases whose fractions each restart at 0, and `lib/loadProgress`
    // folds them into one monotonic bar. Reporting bytes here would mean
    // inventing them, which is what this used to do.
    const engine = await CreateMLCEngine(v.cacheLabel, {
      appConfig: mlcAppConfig(this.id, this.context),
      initProgressCallback: (report) => opts.onProgress?.(report),
    });
    this.engine = engine;
    return { downloadTimeMs: performance.now() - t0 };
  }

  private engine: MLCEngine | null = null;

  async generate(input: GenerateInput): Promise<GenerationResult> {
    if (!this.engine) throw new Error("model not loaded");
    // WebLLM has a "multi-round" KV-reuse path: when this request's
    // conversation (messages[:-1]) is identical to the previous request's, it
    // skips the reset and prefills only the new tail - and
    // usage.prompt_tokens then counts just that tail. Regenerate resends the
    // exact previous prompt, so it hits that path and the context meter would
    // collapse to one message's worth of tokens. Resetting makes every request
    // a clean full prefill; normal turns already pay a full prefill (the
    // equality check never matches while the history grows), so this costs
    // nothing but an honest measurement on the regenerate turn.
    await this.engine.resetChat();
    const start = performance.now();
    const stream = await this.engine.chat.completions.create({
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: input.temperature,
      top_p: input.topP,
      max_tokens: input.maxTokens,
      extra_body: { enable_thinking: input.enableThinking },
      stream: true,
      // The last chunk then carries the pipeline's real token counters, so the
      // metrics card and the context meter are measured instead of estimated
      // from string length.
      stream_options: { include_usage: true },
    });
    let text = "";
    let streamedTokens = 0;
    let firstTokenAt = 0;
    let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        streamedTokens += 1;
        const now = performance.now();
        if (!firstTokenAt) firstTokenAt = now;
        input.onToken(delta);
        // Time-to-first-token is excluded: prefill latency is not decode speed.
        input.onRate?.({ tokens: streamedTokens, elapsedMs: now - firstTokenAt });
      }
      // The usage chunk arrives last, with an empty `choices` array.
      if (chunk.usage) usage = chunk.usage;
    }
    const elapsedMs = performance.now() - start;
    const generatedTokens = usage?.completion_tokens ?? Math.max(1, streamedTokens);
    const promptTokens =
      usage?.prompt_tokens ?? estimateTokens(input.messages.map((m) => m.content).join(" "));
    return {
      text,
      promptTokens,
      generatedTokens,
      elapsedMs,
      tokensPerSec: generatedTokens / (elapsedMs / 1000 || 1),
    };
  }

  abort() {
    void this.engine?.interruptGenerate();
  }

  async unload() {
    await this.engine?.unload();
    this.engine = null;
  }
}

/** Last-resort token estimate, used only when WebLLM returns no `usage`. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
