import { useEffect, useRef, useState } from "react";
import { List, Lightning } from "@phosphor-icons/react";
import { useConversations } from "./hooks/useConversations";
import { useSettings } from "./hooks/useSettings";
import { useChat } from "./hooks/useChat";
import { useBenchmarkState } from "./hooks/useBenchmark";
import { useModelCache } from "./hooks/useModelCache";
import { SettingsPanel } from "./components/SettingsPanel";
import { Composer } from "./components/Composer";
import { MessageList } from "./components/MessageList";
import { BenchmarkPanel } from "./components/BenchmarkPanel";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { CompatBanner } from "./components/CompatBanner";
import { ContextMeter } from "./components/ContextMeter";
import { isWebGPUSupported, isWasmSupported } from "./lib/webgpu";
import { creepTarget, creepToward, formatMbPair, type LoadPhase, type LoadProgressView } from "./lib/loadProgress";
import { findDescriptor } from "./runtime/registry";
import { en } from "./i18n/en";

const PHASE_LABEL: Record<LoadPhase, string> = {
  fetch: en.loadPhaseFetch,
  cache: en.loadPhaseCache,
  shaders: en.loadPhaseShaders,
  unknown: en.loadPhasePrepare,
};

/**
 * Whether the user asked for reduced motion. Read once, then kept in sync, so
 * the load bar can drop its easing instead of animating against their wishes.
 */
function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduce;
}

/**
 * Drives the load bar's width imperatively.
 *
 * WebLLM only reports a handful of times during a 1.4 GB load, so between those
 * reports the bar would sit still and read as frozen. A rAF loop eases it
 * forward instead - writing `style.width` directly, because re-rendering the
 * whole app at 60fps to move one bar is not a trade worth making.
 *
 * It never falls behind WebLLM's last real report, and never creeps past the
 * small lookahead `creepTarget` allows, so the motion is never a lie. Under
 * reduced motion the easing is dropped entirely and the bar shows the last real
 * value, which is the honest reading anyway.
 */
function useCreepingBar(view: LoadProgressView | null) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef(0);
  const floorRef = useRef(0);
  targetRef.current = view ? creepTarget(view) : 0;
  floorRef.current = view ? view.overall : 0;
  const real = view ? view.overall : 0;
  const active = view !== null;
  const reduce = usePrefersReducedMotion();

  // Reduced motion: the real figure only. No creep, no rAF loop.
  useEffect(() => {
    if (!reduce || !active) return;
    const bar = barRef.current;
    if (bar) bar.style.width = `${(real * 100).toFixed(2)}%`;
  }, [reduce, active, real]);

  useEffect(() => {
    const bar = barRef.current;
    if (reduce || !active || !bar) return;
    let raf = 0;
    let shown = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      shown = Math.max(floorRef.current, creepToward(shown, targetRef.current, dt));
      bar.style.width = `${(shown * 100).toFixed(2)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, active]);

  return barRef;
}

function ModelLoadStatus({ view, totalMb }: { view: LoadProgressView | null; totalMb: number }) {
  const barRef = useCreepingBar(view);
  const ratio = view ? formatMbPair(view.loadedMb, totalMb) : null;
  return (
    <div className="mb-2">
      <p className="flex items-center justify-between gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          {view ? PHASE_LABEL[view.phase] : en.loadPhasePrepare}
        </span>
        {ratio && (
          <span className="shrink-0 font-mono text-xs">{ratio}</span>
        )}
      </p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-300/70 dark:bg-zinc-700">
        <div ref={barRef} className="h-full w-0 rounded-full bg-emerald-500" />
      </div>
    </div>
  );
}

export default function App() {
  const conv = useConversations();
  const { settings, update } = useSettings();
  const chat = useChat(conv, settings);
  const bench = useBenchmarkState();
  // One instance, covering every quant: the metrics panel and the header must
  // agree, and a second copy would probe the cache all over again.
  const cache = useModelCache(settings.context);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supportChecked, setSupportChecked] = useState(false);
  const supported = isWebGPUSupported() && isWasmSupported();

  useEffect(() => setSupportChecked(true), []);

  // Bridge chat observation callbacks into the benchmark store, and record a
  // successful load so the cache card can tell "never downloaded" apart from
  // "the browser evicted it".
  useEffect(() => {
    chat.onGeneration = (id, r) => {
      bench.recordGeneration(id, r);
    };
    chat.onLoad = (id, r) => {
      bench.recordLoad(id, r);
      cache.markLoaded(id);
    };
  }, [chat, bench, cache]);

  if (supportChecked && !supported) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <CompatBanner />
      </div>
    );
  }

  const disabled = chat.status === "loading" || chat.status === "generating";
  const totalMb = findDescriptor(settings.model)?.approxSizeMb ?? 0;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {sidebarOpen && (
        <button
          type="button"
          aria-label={en.closeSidebar}
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-zinc-950/40 md:hidden"
        />
      )}
      <div className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"} md:static md:z-auto md:flex`}>
        <ConversationSidebar
          conversations={conv.list}
          activeId={conv.activeId}
          disabled={chat.busy}
          namingId={chat.namingId}
          onSelect={(id) => {
            void conv.select(id);
            setSidebarOpen(false);
          }}
          onNew={() => {
            void conv.create();
            setSidebarOpen(false);
          }}
          onRename={(id, title) => void conv.rename(id, title)}
          onDelete={(id) => void conv.remove(id)}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The app name lives at the top of the left bar and the Settings
            button at the top of the right bar; on mobile only the sidebar
            toggle remains in the header. */}
        <header className="flex items-center gap-2 border-b border-zinc-200 bg-white/80 px-4 py-2.5 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/80">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label={en.openSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <List size={18} />
          </button>
        </header>

        {/* One gray surface holds BOTH the conversation and the composer:
            the text box is part of the conversation, not a separate bar. */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          <div className="flex-1 overflow-hidden">
            <MessageList
              messages={conv.messages}
              streaming={chat.streaming}
              pending={chat.pending}
              onRegenerate={() => void chat.regenerate()}
            />
          </div>

          <footer className="scroll-gutter p-3 pt-1">
            <div className="mx-auto max-w-3xl">
              {chat.status === "loading" && (
                <ModelLoadStatus view={chat.loadView} totalMb={totalMb} />
              )}
              {chat.streaming && chat.live && (
                <p className="mb-2 flex items-center justify-end gap-1.5 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Lightning size={12} weight="fill" />
                  {chat.live.tokensPerSec.toFixed(1)} {en.liveSpeed}
                </p>
              )}
              {chat.errorMessage && (
                <p role="alert" className="mb-2 text-sm text-rose-600 dark:text-rose-400">
                  {chat.errorMessage}
                </p>
              )}
              <ContextMeter used={chat.contextUsed} max={settings.context} />
              <Composer
                onSend={(t) => void chat.send(t)}
                disabled={disabled}
                generating={chat.status === "generating"}
                onStop={chat.abort}
              />
            </div>
          </footer>
        </main>
      </div>

      <BenchmarkPanel
        model={settings.model}
        cache={cache}
        onSelect={(id) => update({ model: id })}
        settingsPanel={
          <SettingsPanel
            temperature={settings.temperature}
            topP={settings.topP}
            maxTokens={settings.maxTokens}
            systemMessage={settings.systemMessage}
            reasoning={settings.reasoning}
            model={settings.model}
            context={settings.context}
            onTemperature={(v) => update({ temperature: v })}
            onTopP={(v) => update({ topP: v })}
            onMaxTokens={(v) => update({ maxTokens: v })}
            onSystem={(v) => update({ systemMessage: v })}
            onReasoning={(v) => update({ reasoning: v })}
            onModel={(v) => update({ model: v })}
            onContext={(v) => update({ context: v })}
            onNewChat={() => void conv.create()}
            disabled={disabled}
          />
        }
        onDownload={(id) => {
          // Select the quant first so the load (and any later turn) targets it,
          // then fetch its weights without generating.
          update({ model: id });
          void chat.preload(id);
        }}
        loadingModel={chat.status === "loading" ? settings.model : null}
        disabled={disabled}
      />
    </div>
  );
}
