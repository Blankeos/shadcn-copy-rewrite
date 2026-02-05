const EXT_SOURCE = "copy-rewriter";
const CONFIG_STORAGE_KEY = "shadcnCopyRewriterConfig";
const REWRITE_ATTR = "data-shadcn-copy-rewrite";

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

function injectMainWorldPatch() {
  try {
    const id = "shadcn-copy-rewrite-injected";
    if (document.getElementById(id)) return;

    const s = document.createElement("script");
    s.id = id;
    s.src = chrome.runtime.getURL("injected.js");
    s.async = false;
    (document.head || document.documentElement || document).appendChild(s);
    s.remove();
  } catch {
    // ignore
  }
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

function postConfig() {
  window.postMessage({ source: EXT_SOURCE, type: "CONFIG", config: currentConfig }, "*");
}

type TextSnapshot = { nodes: Text[]; values: string[] };
const codeSnapshots = new WeakMap<Element, TextSnapshot>();

function findCodeForElement(el: Element | null): Element | null {
  if (!el) return null;

  const fragment = el.closest?.("[data-rehype-pretty-code-fragment]");
  if (fragment) {
    const code = fragment.querySelector("pre code, pre, code");
    if (code) return code;
  }

  const pre = el.closest?.("pre");
  if (pre) return pre.querySelector("code") ?? pre;

  const figure = el.closest?.("figure");
  if (figure) {
    const code = figure.querySelector("pre code, pre, code");
    if (code) return code;
  }

  const nearest = el.closest?.("div, section, article");
  if (nearest) {
    const code = nearest.querySelector("pre code, pre");
    if (code) return code;
  }

  return null;
}

function isLikelyCopyButton(button: Element): boolean {
  const el = button.closest("button, [role='button']") ?? button;
  const aria = (el.getAttribute("aria-label") ?? "").toLowerCase();
  const title = (el.getAttribute("title") ?? "").toLowerCase();
  if (`${aria} ${title}`.includes("copy")) return true;

  const text = (el.textContent ?? "").trim().toLowerCase();
  if (text === "copy") return true;
  if (text === "copy code") return true;

  // Some shadcn-style sites use an icon-only copy button with no aria-label/title/text.
  const inPrettyCode = !!el.closest?.("[data-rehype-pretty-code-fragment]");
  if (inPrettyCode) {
    const className = (el.getAttribute("class") ?? "").toLowerCase();
    const looksTopRight = className.includes("absolute") && className.includes("right-") && className.includes("top-");
    const hasSvgIcon = !!el.querySelector?.("svg");
    if (looksTopRight && hasSvgIcon) return true;
  }

  return false;
}

async function tryOverrideCopyButtonClick(target: Element): Promise<boolean> {
  const btn = target.closest("button, [role='button']");
  if (!btn) return false;
  if (!isLikelyCopyButton(btn)) return false;

  const code = findCodeForElement(btn);
  if (!code) return false;

  const original = (code as HTMLElement).innerText ?? code.textContent ?? "";
  if (!original) return false;

  const rewritten = applyRules(original);
  if (rewritten === original) return false;

  try {
    await navigator.clipboard.writeText(rewritten);
    return true;
  } catch {
    return false;
  }
}

function snapshotTextNodes(root: Element): TextSnapshot {
  const nodes: Text[] = [];
  const values: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node as Text;
      nodes.push(t);
      values.push(t.data);
    }
    node = walker.nextNode();
  }
  return { nodes, values };
}

function rewriteRenderedCode(codeEl: Element) {
  try {
    const existing = codeSnapshots.get(codeEl) ?? snapshotTextNodes(codeEl);
    if (!codeSnapshots.has(codeEl)) codeSnapshots.set(codeEl, existing);

    for (let i = 0; i < existing.nodes.length; i++) {
      const original = existing.values[i] ?? "";
      const next = applyRules(original);
      if (existing.nodes[i].data !== next) existing.nodes[i].data = next;
    }

    codeEl.setAttribute(REWRITE_ATTR, "1");
  } catch {
    // ignore
  }
}

function rewriteAllVisibleCode() {
  const codes = document.querySelectorAll(
    "pre code, [data-rehype-pretty-code-fragment] code, [data-rehype-pretty-code-fragment] pre"
  );
  for (const code of codes) rewriteRenderedCode(code);
}

let rewriteScheduled = false;
function scheduleRewriteAllVisibleCode() {
  if (rewriteScheduled) return;
  rewriteScheduled = true;

  const run = () => {
    rewriteScheduled = false;
    rewriteAllVisibleCode();
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", run, { once: true });
    return;
  }

  // Let frameworks finish layout/hydration.
  window.setTimeout(run, 0);
}

function storageGet(key: string): Promise<unknown> {
  return new Promise((resolve) => chrome.storage.sync.get(key, (items) => resolve(items[key])));
}

function storageSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => chrome.storage.sync.set(items, () => resolve()));
}

function getSelectedText(): string {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    if (end > start) return active.value.slice(start, end);
  }
  return document.getSelection()?.toString() ?? "";
}

function whenDocumentElement(): Promise<HTMLElement> {
  if (document.documentElement) return Promise.resolve(document.documentElement);

  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      if (!document.documentElement) return;
      resolved = true;
      obs.disconnect();
      clearInterval(interval);
      resolve(document.documentElement);
    };

    const obs = new MutationObserver(() => finish());
    try {
      obs.observe(document, { childList: true, subtree: true });
    } catch {
      // ignore
    }

    const interval = window.setInterval(finish, 10);
    finish();
  });
}

async function refreshConfig() {
  const stored = await storageGet(CONFIG_STORAGE_KEY);
  const parsed = safeParseConfig(stored);
  if (parsed) {
    const mergedRules = mergeDefaultRules(parsed.rules);
    const didMerge = mergedRules.length !== parsed.rules.length;
    currentConfig = { ...parsed, rules: mergedRules };
    if (didMerge) {
      await storageSet({ [CONFIG_STORAGE_KEY]: currentConfig });
    }
    postConfig();
    scheduleRewriteAllVisibleCode();
    return;
  }

  currentConfig = DEFAULT_CONFIG;
  await storageSet({ [CONFIG_STORAGE_KEY]: DEFAULT_CONFIG });
  postConfig();
  scheduleRewriteAllVisibleCode();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  const next = changes[CONFIG_STORAGE_KEY]?.newValue;
  const parsed = safeParseConfig(next);
  if (!parsed) return;
  currentConfig = { ...parsed, rules: mergeDefaultRules(parsed.rules) };
  postConfig();
  scheduleRewriteAllVisibleCode();
});

document.addEventListener(
  "copy",
  (event) => {
    const data = event.clipboardData;
    if (!data) return;

    const original = getSelectedText();
    if (!original) return;

    const rewritten = applyRules(original);
    if (rewritten === original) return;

    data.setData("text/plain", rewritten);
    event.preventDefault();
  },
  true
);

void refreshConfig();

document.addEventListener(
  "click",
  (event) => {
    const target = event.target as Element | null;
    if (!target) return;

    void (async () => {
      const did = await tryOverrideCopyButtonClick(target);
      if (!did) return;
      event.preventDefault();
      (event as any).stopImmediatePropagation?.();
      event.stopPropagation();
    })();
  },
  true
);

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type !== "childList") continue;
    for (const n of Array.from(m.addedNodes)) {
      if (!(n instanceof HTMLElement)) continue;
      if (n.querySelector?.("pre code, [data-rehype-pretty-code-fragment] code, [data-rehype-pretty-code-fragment] pre")) {
        scheduleRewriteAllVisibleCode();
      }
    }
  }
});

void (async () => {
  const root = await whenDocumentElement();

  try {
    root.setAttribute(REWRITE_ATTR, "loaded");
  } catch {
    // ignore
  }

  injectMainWorldPatch();
  scheduleRewriteAllVisibleCode();

  observer.observe(root, { childList: true, subtree: true });
})();
