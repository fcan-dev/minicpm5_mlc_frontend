export type Role = "system" | "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Reasoning extracted from a `<think>...</think>` block, if any. */
  reasoning?: string;
  /** Unix ms when the message was added; absent on messages from before it existed. */
  createdAt?: number;
}

export interface Conversation {
  id: string;
  title: string;
  /** User and assistant turns only; the system prompt lives in Settings. */
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  /** True once a title has been generated automatically. */
  autoTitled?: boolean;
  /** True when the user renamed the chat; auto-titling is disabled. */
  titleLocked?: boolean;
}

export interface Settings {
  systemMessage: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  reasoning: boolean;
  /** Which MiniCPM5 quantization variant to run (Selectable in Settings). */
  model: ModelId;
  /** Context window in tokens; chosen at runtime via WebLLM overrides. */
  context: ContextPreset;
}

export interface LoadOpts {
  /**
   * Raw WebLLM progress reports. Deliberately unprocessed: WebLLM runs three
   * load phases that each restart their own fraction at 0, so folding them into
   * one bar is `lib/loadProgress`'s job, not the runtime's.
   */
  onProgress?(report: { text: string; progress: number }): void;
}

export interface LoadResult {
  /** Wall-clock time for the load, including any download. */
  downloadTimeMs: number;
}

export interface GenerationOpts {
  temperature: number;
  maxTokens: number;
  onToken(token: string): void;
}

export interface GenerationResult {
  text: string;
  /** Real prompt tokens from the pipeline (falls back to an estimate). */
  promptTokens: number;
  /** Real decoded tokens from the pipeline (falls back to streamed deltas). */
  generatedTokens: number;
  elapsedMs: number;
  tokensPerSec: number;
}

// MiniCPM5-2B in MLC, available as quantization tiers, all compiled from source
// and hosted on our own Hugging Face repo. Source of truth for the ids we ship;
// persisted settings are validated against this so a retired quant cannot
// resurrect itself from localStorage.
//
// q3f16_1 was retired: MLC's int3 (group_size=40) WebGPU kernels return token
// soup, in the same browser/GPU where q4f16_1 is coherent. Its weights are fine
// (per-shard md5s match tensor-cache.json, and dequantized layer-0 `down_proj`
// correlates 0.97 with the base model's real weights), so the fault is in the
// compiled int3 kernels. Re-add only after a rebuild passes the browser smoke
// test - see scripts/smoke-test.md.
export const MODEL_IDS = ["minicpm5-q4f16", "minicpm5-q4f16-awq"] as const;
export type ModelId = (typeof MODEL_IDS)[number];

/** True when `value` is a model id this build actually ships. */
export function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && (MODEL_IDS as readonly string[]).includes(value);
}

/** Context window presets offered in Settings (runtime override of the 32k wasm). */
export const CONTEXT_PRESETS = [4096, 8192, 16384, 32768] as const;
export type ContextPreset = (typeof CONTEXT_PRESETS)[number];

/** What a model does. The status bar groups its cards under these sections. */
export type ModelCategory = "language" | "embedder" | "tts";

export interface ModelDescriptor {
  id: ModelId;
  labelI18n: string;
  engine: "mlc";
  quant: string;
  /** Declared model size, used to warn about the download before it happens. */
  approxSizeMb: number;
  vramRequiredMb: number;
  /** Which section of the status bar this card belongs to. */
  category: ModelCategory;
  /** True for the quant we suggest to new users; shown as a badge on the card. */
  recommended?: boolean;
  /** Short line under the card's name, e.g. a variant's trade-off. */
  hint?: string;
}
