import { useCallback, useState } from "react";
import type { Settings } from "../types";
import { CONTEXT_PRESETS, isModelId } from "../types";
import { en } from "../i18n/en";

const KEY = "minicpm5:settings";

export const defaultSettings: Settings = {
  systemMessage: en.systemMessageDefault,
  // Aligned with the model card: temperature 1.0, top_p 0.95.
  temperature: 1.0,
  topP: 0.95,
  maxTokens: 1024,
  reasoning: true,
  model: "minicpm5-q4f16",
  context: 32768,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    const stored = { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) };
    // A retired quant or a removed context preset must not resurrect itself
    // from localStorage; those two fields fall back to the defaults.
    if (!isModelId(stored.model)) stored.model = defaultSettings.model;
    if (!(CONTEXT_PRESETS as readonly number[]).includes(stored.context)) {
      stored.context = defaultSettings.context;
    }
    return stored;
  } catch {
    return defaultSettings;
  }
}

export interface UseSettings {
  settings: Settings;
  update(patch: Partial<Settings>): void;
  reset(): void;
}

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(load);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable; keep in memory */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setSettings(defaultSettings);
  }, []);

  return { settings, update, reset };
}
