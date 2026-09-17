import { useCallback, useEffect, useRef, useState } from "react";
import type { Message, ModelId, Settings, GenerationResult, LoadResult } from "../types";
import type { ModelRuntime } from "../runtime/ModelRuntime";
import { createRuntime } from "../runtime/registry";
import { splitThinking } from "../lib/thinking";
import { initialLoadProgress, reduceLoadProgress, type LoadProgressView } from "../lib/loadProgress";
import { buildTitlePrompt, fallbackTitle, titleFromModelOutput, TITLE_SYSTEM_PROMPT } from "../lib/sessionTitle";
import { en } from "../i18n/en";
import type { UseConversations } from "./useConversations";

interface ChatCallbacks {
  onGeneration: (id: ModelId, r: GenerationResult) => void;
  onLoad: (id: ModelId, r: LoadResult) => void;
}

export type ChatStatus = "idle" | "loading" | "generating" | "error";

interface NameRequest {
  conversationId: string;
  question: string;
  reasoning: string;
  answer: string;
}

/** Live decode rate while an answer streams. */
export interface LiveRate {
  tokens: number;
  tokensPerSec: number;
}

export interface UseChat {
  streaming: boolean;
  /** Raw streamed text (may contain a reasoning block). */
  pending: string;
  /** Folded WebLLM load phases, or null when not loading. */
  loadView: LoadProgressView | null;
  status: ChatStatus;
  errorMessage: string | null;
  runtime: ModelRuntime | null;
  busy: boolean;
  /** Real decode rate, sampled while generating. */
  live: LiveRate | null;
  /** Real prompt tokens of the last request: how full the context window is. */
  contextUsed: number | null;
  /** Conversation currently being auto-named, if any. */
  namingId: string | null;
  onGeneration: ChatCallbacks["onGeneration"];
  onLoad: ChatCallbacks["onLoad"];
  send(text: string): Promise<void>;
  regenerate(): Promise<void>;
  /**
   * Load `id`'s weights now (downloading them into the browser cache) without
   * generating anything. Used by the model cards' download button.
   */
  preload(id: ModelId): Promise<void>;
  abort(): void;
}

export function useChat(conv: UseConversations, settings: Settings): UseChat {
  const [pending, setPending] = useState("");
  const [loadView, setLoadView] = useState<LoadProgressView | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [live, setLive] = useState<LiveRate | null>(null);
  const [contextUsed, setContextUsed] = useState<number | null>(null);
  const [namingId, setNamingId] = useState<string | null>(null);

  const runtimeRef = useRef<ModelRuntime | null>(null);
  const abortedRef = useRef(false);
  // Keep latest values available to async closures without stale captures.
  const messagesRef = useRef(conv.messages);
  messagesRef.current = conv.messages;
  const setMessagesRef = useRef(conv.setMessages);
  setMessagesRef.current = conv.setMessages;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const autoTitleRef = useRef(conv.autoTitle);
  autoTitleRef.current = conv.autoTitle;
  const needsAutoTitleRef = useRef(conv.needsAutoTitle);
  needsAutoTitleRef.current = conv.needsAutoTitle;
  const statusRef = useRef(status);
  statusRef.current = status;
  const callbacksRef = useRef<ChatCallbacks>({ onGeneration: () => {}, onLoad: () => {} });

  // When the user switches quantization or context in Settings, the on-device
  // engine must be rebuilt with the new app config. Weights stay cached per
  // quant (model_id is unchanged within a quant), so a context change is only
  // a re-init, not a re-download. The loaded engine is dropped and re-created
  // lazily on the next turn.
  const appliedModelRef = useRef(settings.model);
  const appliedContextRef = useRef(settings.context);
  useEffect(() => {
    const modelChanged = appliedModelRef.current !== settings.model;
    const contextChanged = appliedContextRef.current !== settings.context;
    if (modelChanged || contextChanged) {
      appliedModelRef.current = settings.model;
      appliedContextRef.current = settings.context;
      void runtimeRef.current?.unload().catch(() => {});
      runtimeRef.current = null;
      setStatus("idle");
      setErrorMessage(null);
      setLoadView(null);
    }
  }, [settings.model, settings.context]);

  // Both figures describe the conversation that is open, so they must not leak
  // across a switch.
  useEffect(() => {
    setContextUsed(null);
    setLive(null);
  }, [conv.activeId]);

  /** The in-flight title completion, if any. It shares the engine with chat. */
  const namingRef = useRef<Promise<void> | null>(null);

  /**
   * Load the runtime for `id` if it is not already in hand.
   *
   * The target id is claimed on the "applied" refs BEFORE the old engine is
   * touched: a download click updates `settings.model` in the same tick, and
   * the settings-swap effect that then runs must see the new id as already
   * applied, or it would unload the engine we are loading.
   */
  const ensureLoadedFor = useCallback(async (id: ModelId): Promise<ModelRuntime> => {
    if (runtimeRef.current?.id === id) return runtimeRef.current;
    appliedModelRef.current = id;
    appliedContextRef.current = settingsRef.current.context;
    if (runtimeRef.current) {
      const old = runtimeRef.current;
      runtimeRef.current = null;
      void old.unload().catch(() => {});
    }
    const rt = createRuntime(id, settingsRef.current.context);
    runtimeRef.current = rt;
    setStatus("loading");
    setLoadView(initialLoadProgress());
    setErrorMessage(null);
    const res = await rt.load({
      onProgress: (report) =>
        setLoadView((prev) => reduceLoadProgress(prev ?? initialLoadProgress(), report)),
    });
    setLoadView(null);
    callbacksRef.current.onLoad(rt.id, res);
    setStatus("idle");
    return rt;
  }, []);

  const ensureLoaded = useCallback(
    async (): Promise<ModelRuntime> => ensureLoadedFor(settingsRef.current.model),
    [ensureLoadedFor]
  );

  const preload = useCallback(
    async (id: ModelId) => {
      try {
        await ensureLoadedFor(id);
      } catch (e) {
        runtimeRef.current = null;
        setLoadView(null);
        setStatus("error");
        setErrorMessage((e instanceof Error ? e.message : "") || en.errorLoad);
      }
    },
    [ensureLoadedFor]
  );

  /**
   * Finish off a title completion before starting a user turn. The title call
   * answers from the same engine, so it is interrupted rather than awaited to
   * completion - a stalled title must never delay a real message.
   */
  const settleNaming = useCallback(async () => {
    const inFlight = namingRef.current;
    if (!inFlight) return;
    runtimeRef.current?.abort();
    await inFlight.catch(() => {});
  }, []);

  /**
   * Name a chat from its first exchange. This is a separate completion with
   * its own system/user messages: it never touches the session history or the
   * UI state. It runs the moment the first exchange finishes, and a title is
   * always produced - the heuristic below is the only fallback, so a model
   * that answers with nothing cannot leave the chat unnamed.
   */
  const nameConversation = useCallback(async (req: NameRequest) => {
    setNamingId(req.conversationId);
    try {
      let title = "";
      const rt = runtimeRef.current;
      if (rt) {
        try {
          const res = await rt.generate({
            messages: [
              { id: "title-sys", role: "system", content: TITLE_SYSTEM_PROMPT },
              {
                id: "title-user",
                role: "user",
                content: buildTitlePrompt(req.question, req.reasoning, req.answer),
              },
            ],
            temperature: 0.3,
            topP: 0.9,
            maxTokens: 24,
            enableThinking: false,
            onToken: () => {},
          });
          title = titleFromModelOutput(res.text);
        } catch {
          /* interrupted or failed; the heuristic below still names the chat */
        }
      }
      if (!title) title = fallbackTitle(req.question, req.answer);
      if (title) await autoTitleRef.current(req.conversationId, title);
    } finally {
      setNamingId(null);
    }
  }, []);

  const runGeneration = useCallback(
    async (msgs: Message[]) => {
      // Never let a title call overlap a user turn on the same engine.
      await settleNaming();
      let rt: ModelRuntime;
      try {
        rt = await ensureLoaded();
      } catch (e) {
        runtimeRef.current = null;
        setLoadView(null);
        setStatus("error");
        setErrorMessage((e instanceof Error ? e.message : "") || en.errorLoad);
        throw e;
      }
      if (statusRef.current === "generating") await rt.abort();
      setStreaming(true);
      setErrorMessage(null);
      setStatus("generating");
      setLive(null);
      abortedRef.current = false;
      let acc = "";
      let finalReasoning = "";
      let finalContent = "";
      let result: GenerationResult | null = null;
      let lastRateEmit = 0;
      const s = settingsRef.current;
      const prompt: Message[] = [{ id: "sys", role: "system", content: s.systemMessage }, ...msgs];
      try {
        result = await rt.generate({
          messages: prompt,
          temperature: s.temperature,
          topP: s.topP,
          maxTokens: s.maxTokens,
          enableThinking: s.reasoning,
          onToken: (t) => {
            acc += t;
            setPending(acc);
          },
          onRate: (r) => {
            // Throttled: the runtime reports per token, React should not.
            const now = performance.now();
            const secs = r.elapsedMs / 1000;
            if (now - lastRateEmit < 250 || secs < 0.25) return;
            lastRateEmit = now;
            setLive({ tokens: r.tokens, tokensPerSec: r.tokens / secs });
          },
        });
        if (abortedRef.current) {
          // A stopped run keeps whatever already streamed as a normal turn;
          // stopping before the first token leaves no trace. Metrics and
          // auto-naming are skipped: the exchange was not accepted.
          if (acc) {
            const { reasoning, content } = splitThinking(acc);
            setMessagesRef.current([
              ...msgs,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content,
                reasoning: reasoning || undefined,
                createdAt: Date.now(),
              },
            ]);
          }
          return;
        }
        const { reasoning, content } = splitThinking(acc);
        finalReasoning = reasoning;
        finalContent = content;
        setMessagesRef.current([
          ...msgs,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content,
            reasoning: reasoning || undefined,
            createdAt: Date.now(),
          },
        ]);
        // Real prompt tokens from the pipeline: this is the context window fill.
        setContextUsed(result.promptTokens);
        callbacksRef.current.onGeneration(rt.id, result);
      } catch (e) {
        if (!abortedRef.current) {
          setStatus("error");
          setErrorMessage(e instanceof Error ? e.message : en.errorGenerate);
        }
        throw e;
      } finally {
        setStreaming(false);
        setPending("");
        setLive(null);
        if (!abortedRef.current) setStatus("idle");
      }

      if (abortedRef.current) return;

      // Name the chat from the FIRST exchange, as soon as it exists.
      const firstUser = msgs.find((m) => m.role === "user");
      const conversationId = conv.activeId;
      if (firstUser && conversationId && needsAutoTitleRef.current()) {
        const priorAssistant = msgs.find((m) => m.role === "assistant");
        const req: NameRequest = priorAssistant
          ? {
              conversationId,
              question: firstUser.content,
              reasoning: priorAssistant.reasoning ?? "",
              answer: priorAssistant.content,
            }
          : { conversationId, question: firstUser.content, reasoning: finalReasoning, answer: finalContent || acc };
        const inflight = nameConversation(req);
        namingRef.current = inflight;
        void inflight.finally(() => {
          if (namingRef.current === inflight) namingRef.current = null;
        });
      }
    },
    [ensureLoaded, nameConversation, settleNaming, conv.activeId]
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || statusRef.current === "loading" || statusRef.current === "generating") return;
      const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
      const next = [...messagesRef.current, userMsg];
      setMessagesRef.current(next);
      await runGeneration(next);
    },
    [runGeneration]
  );

  const regenerate = useCallback(async () => {
    const msgs = messagesRef.current;
    let lastUser = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        lastUser = i;
        break;
      }
    }
    if (lastUser === -1) return;
    const next = msgs.slice(0, lastUser + 1);
    setMessagesRef.current(next);
    await runGeneration(next);
  }, [runGeneration]);

  const abort = useCallback(() => {
    abortedRef.current = true;
    runtimeRef.current?.abort();
    setStatus("idle");
    setStreaming(false);
    setPending("");
    setLive(null);
  }, []);

  // A title completion left running past unmount would keep the engine busy.
  useEffect(
    () => () => {
      runtimeRef.current?.abort();
    },
    []
  );

  return {
    streaming,
    pending,
    loadView,
    status,
    errorMessage,
    runtime: runtimeRef.current,
    busy: status === "loading" || status === "generating",
    live,
    contextUsed,
    namingId,
    get onGeneration() {
      return callbacksRef.current.onGeneration;
    },
    set onGeneration(v: ChatCallbacks["onGeneration"]) {
      callbacksRef.current.onGeneration = v;
    },
    get onLoad() {
      return callbacksRef.current.onLoad;
    },
    set onLoad(v: ChatCallbacks["onLoad"]) {
      callbacksRef.current.onLoad = v;
    },
    send,
    regenerate,
    preload,
    abort,
  };
}
