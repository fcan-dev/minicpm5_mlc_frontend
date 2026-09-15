import type {
  Message,
  ModelId,
  GenerationResult,
  LoadResult,
  LoadOpts,
} from "../types";

export interface GenerateInput {
  /** Full prompt: system message (if any) followed by the conversation. */
  messages: Message[];
  temperature: number;
  topP: number;
  maxTokens: number;
  /** Whether the model should emit a `<think>` reasoning block. */
  enableThinking: boolean;
  onToken(token: string): void;
  /**
   * Live decode-rate report, fired per decoded token. Throttling before React
   * is the consumer's job; the runtime reports raw.
   */
  onRate?(report: { tokens: number; elapsedMs: number }): void;
}

export interface ModelRuntime {
  readonly id: ModelId;
  load(opts?: LoadOpts): Promise<LoadResult>;
  generate(input: GenerateInput): Promise<GenerationResult>;
  abort(): void;
  unload(): Promise<void>;
}
