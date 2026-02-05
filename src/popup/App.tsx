import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { DEFAULT_CONFIG, SUPPORTED_SITE_MATCHES, type ExtensionConfig } from "../shared/config";
import { loadConfig, saveConfig, subscribeConfig } from "./storage";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `rule_${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [config, setConfig] = createStore<ExtensionConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal<number | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const next = await loadConfig();
      setConfig(reconcile(next));
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load config.");
    }
  }

  async function persist(next: ExtensionConfig) {
    try {
      setSaving(true);
      setError(null);
      await saveConfig(next);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save config.");
    } finally {
      setSaving(false);
    }
  }

  onMount(() => {
    void refresh();
    const unsubscribe = subscribeConfig((next) => setConfig(reconcile(next)));
    onCleanup(unsubscribe);
  });

  return (
    <div class="shell">
      <header class="top">
        <div class="brand">
          <div class="brandText">
            <div class="title">Shadcn Copy Rewrite</div>
            <div class="subtitle">Rewrite imports when you copy code</div>
          </div>
        </div>

        <div class="status">
          <Show when={saving()}>
            <span class="pill">Saving…</span>
          </Show>
          <Show when={!saving() && savedAt()}>
            <span class="pill ghost">Saved</span>
          </Show>
        </div>
      </header>

      <main class="main">
        <Show when={error()}>
          {(msg) => (
            <div class="alert" role="alert">
              <div class="alertTitle">Something went sideways</div>
              <div class="alertBody">{msg()}</div>
            </div>
          )}
        </Show>

        <details class="card collapsible">
          <summary class="cardHead collapsibleHead">
            <div>
              <div class="cardTitle">Sites affected</div>
              <div class="cardHint">Only runs on these domains. Want more? Open a PR.</div>
            </div>
            <div class="chevron" aria-hidden="true">
              ▾
            </div>
          </summary>
          <ul class="sites">
            <For each={SUPPORTED_SITE_MATCHES}>{(m) => <li>{m.replace("https://", "")}</li>}</For>
          </ul>
        </details>

        <section class="card">
          <div class="cardHead">
            <div>
              <div class="cardTitle">Rewrite Rules</div>
              <div class="cardHint">Plain text Find → Replace, top → bottom.</div>
            </div>

            <div class="cardActions">
              <button
                class="btn ghost"
                type="button"
                onClick={() => {
                  setConfig(reconcile(DEFAULT_CONFIG));
                  void persist(DEFAULT_CONFIG);
                }}
                disabled={!loaded()}
                title="Reset to the built-in defaults"
              >
                Reset
              </button>
              <button
                class="btn"
                type="button"
                onClick={() => {
                  const next: ExtensionConfig = {
                    ...config,
                    rules: [...config.rules, { id: newId(), enabled: true, from: "", to: "" }]
                  };
                  setConfig(reconcile(next));
                  void persist(next);
                }}
                disabled={!loaded()}
              >
                Add Rule
              </button>
            </div>
          </div>

          <div class="rules">
            <For each={config.rules}>
              {(rule) => (
                <div class="rule">
                  <label class="toggle" title={rule.enabled ? "Enabled" : "Disabled"}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onInput={(e) => {
                        const enabled = (e.currentTarget as HTMLInputElement).checked;
                        const next: ExtensionConfig = {
                          ...config,
                          rules: config.rules.map((r) => (r.id === rule.id ? { ...r, enabled } : r))
                        };
                        setConfig(reconcile(next));
                        void persist(next);
                      }}
                    />
                    <span class="knob" aria-hidden="true" />
                  </label>

                  <div class="pair">
                    <div class="field">
                      <div class="label">Find</div>
                      <input
                        class="input mono"
                        value={rule.from}
                        placeholder="e.g. ~/ or @/lib/utils"
                        onInput={(e) => {
                          const from = (e.currentTarget as HTMLInputElement).value;
                          const next: ExtensionConfig = {
                            ...config,
                            rules: config.rules.map((r) => (r.id === rule.id ? { ...r, from } : r))
                          };
                          setConfig(reconcile(next));
                          void persist(next);
                        }}
                      />
                    </div>

                    <div class="arrow" aria-hidden="true">
                      →
                    </div>

                    <div class="field">
                      <div class="label">Replace</div>
                      <input
                        class="input mono"
                        value={rule.to}
                        placeholder="e.g. @/ or @/utils/cn"
                        onInput={(e) => {
                          const to = (e.currentTarget as HTMLInputElement).value;
                          const next: ExtensionConfig = {
                            ...config,
                            rules: config.rules.map((r) => (r.id === rule.id ? { ...r, to } : r))
                          };
                          setConfig(reconcile(next));
                          void persist(next);
                        }}
                      />
                    </div>
                  </div>

                  <button
                    class="iconBtn"
                    type="button"
                    title="Delete rule"
                    onClick={() => {
                      const next: ExtensionConfig = { ...config, rules: config.rules.filter((r) => r.id !== rule.id) };
                      setConfig(reconcile(next));
                      void persist(next);
                    }}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              )}
            </For>
          </div>
        </section>
        <footer class="foot">
          <div class="footRow">
            Tip: to flip <span class="mono">~/</span> ↔ <span class="mono">@/</span>, just swap Find/Replace.
          </div>
        </footer>
      </main>
    </div>
  );
}
