const EXT_SOURCE = "copy-rewriter";

type ReplacementRule = {
  id: string;
  enabled: boolean;
  from: string;
  to: string;
};

type ExtensionConfig = {
  version: 1;
  rules: ReplacementRule[];
};

const DEFAULT_CONFIG: ExtensionConfig = {
  version: 1,
  rules: [
    { id: "alias-tilde-to-at", enabled: true, from: "~/", to: "@/" },
    { id: "alias-lib-components-to-at", enabled: true, from: "$lib/components", to: "@/components" },
    { id: "alias-at-to-tilde", enabled: false, from: "@/", to: "~/" },
    { id: "utils-cn", enabled: false, from: "@/lib/utils", to: "@/utils/cn" }
  ]
};

let currentConfig: ExtensionConfig = DEFAULT_CONFIG;

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
    .filter(Boolean) as ReplacementRule[];

  const mergedRules = mergeDefaultRules(safeRules);
  return { version: 1, rules: mergedRules };
}

function mergeDefaultRules(rules: ReplacementRule[]): ReplacementRule[] {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const merged = [...rules];
  for (const rule of DEFAULT_CONFIG.rules) {
    if (!byId.has(rule.id)) merged.push(rule);
  }
  return merged;
}

function applyRules(text: string): string {
  let out = text;
  for (const rule of currentConfig.rules) {
    if (!rule.enabled) continue;
    if (!rule.from) continue;
    out = out.split(rule.from).join(rule.to ?? "");
  }
  return out;
}

function patchClipboard() {
  const clip = navigator.clipboard;
  if (!clip) return;

  const anyWindow = window as any;
  if (anyWindow.__copyRewriterPatched) return;
  anyWindow.__copyRewriterPatched = true;

  if (typeof clip.writeText === "function") {
    const original = clip.writeText.bind(clip);
    clip.writeText = async (text: string) => original(applyRules(String(text)));
  }

  if (typeof (clip as any).write === "function" && typeof (window as any).ClipboardItem === "function") {
    const originalWrite = (clip as any).write.bind(clip);
    (clip as any).write = async (items: any[]) => {
      try {
        const ClipboardItemCtor = (window as any).ClipboardItem as any;
        const rewriteable = new Set(["text/plain", "text/html"]);

        const rewritten = await Promise.all(
          (items ?? []).map(async (item) => {
            if (!item || typeof item.getType !== "function" || !Array.isArray(item.types)) return item;
            if (!item.types.some((t: string) => t === "text/plain" || t === "text/html")) return item;
            if (!item.types.every((t: string) => rewriteable.has(t))) return item;

            const parts: Record<string, Blob> = {};
            let changed = false;

            for (const type of item.types as string[]) {
              const blob: Blob = await item.getType(type);
              const text = await blob.text();
              const next = applyRules(text);
              parts[type] = next === text ? blob : new Blob([next], { type });
              changed ||= next !== text;
            }

            return changed ? new ClipboardItemCtor(parts) : item;
          })
        );

        return await originalWrite(rewritten);
      } catch {
        return await originalWrite(items);
      }
    };
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if ((data as any).source !== EXT_SOURCE) return;
  if ((data as any).type !== "CONFIG") return;
  const parsed = safeParseConfig((data as any).config);
  if (parsed) currentConfig = parsed;
});

patchClipboard();
