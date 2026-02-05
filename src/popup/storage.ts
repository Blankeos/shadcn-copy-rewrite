import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG, type ExtensionConfig } from "../shared/config";

function hasChromeStorageSync(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.sync;
}

function safeParseConfig(raw: unknown): ExtensionConfig | null {
  if (!raw || typeof raw !== "object") return null;

  const version = (raw as any).version;
  const rules = (raw as any).rules;
  if (version !== 1 || !Array.isArray(rules)) return null;

  const safeRules = rules
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const id = typeof (r as any).id === "string" ? (r as any).id : null;
      const enabled = typeof (r as any).enabled === "boolean" ? (r as any).enabled : true;
      const from = typeof (r as any).from === "string" ? (r as any).from : "";
      const to = typeof (r as any).to === "string" ? (r as any).to : "";
      if (!id) return null;
      return { id, enabled, from, to };
    })
    .filter(Boolean) as ExtensionConfig["rules"];

  return { version: 1, rules: safeRules };
}

export async function loadConfig(): Promise<ExtensionConfig> {
  if (hasChromeStorageSync()) {
    const stored = await new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.sync.get(CONFIG_STORAGE_KEY, resolve);
    });

    const parsed = safeParseConfig(stored[CONFIG_STORAGE_KEY]);
    if (parsed) return parsed;

    await saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  const raw = globalThis.localStorage?.getItem(CONFIG_STORAGE_KEY);
  const parsed = raw ? safeParseConfig(JSON.parse(raw)) : null;
  if (parsed) return parsed;
  globalThis.localStorage?.setItem(CONFIG_STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
  return DEFAULT_CONFIG;
}

export async function saveConfig(config: ExtensionConfig): Promise<void> {
  if (hasChromeStorageSync()) {
    await new Promise<void>((resolve) => {
      chrome.storage.sync.set({ [CONFIG_STORAGE_KEY]: config }, () => resolve());
    });
    return;
  }

  globalThis.localStorage?.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function subscribeConfig(onChange: (config: ExtensionConfig) => void): () => void {
  if (!hasChromeStorageSync()) return () => {};

  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area !== "sync") return;
    const next = changes[CONFIG_STORAGE_KEY]?.newValue;
    const parsed = safeParseConfig(next);
    if (parsed) onChange(parsed);
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

