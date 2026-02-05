import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

const SCRIPT_TO_ENTRY: Record<string, string> = {
  content: resolve(here, "src/content/content.ts"),
  injected: resolve(here, "src/content/injected.ts")
};

export default defineConfig(() => {
  const script = process.env.SCRIPT;
  if (!script || !SCRIPT_TO_ENTRY[script]) {
    throw new Error(`Set SCRIPT=content|injected (got: ${String(script)})`);
  }

  return {
    build: {
      outDir: "dist",
      emptyOutDir: false,
      rollupOptions: {
        input: { [script]: SCRIPT_TO_ENTRY[script] },
        output: {
          entryFileNames: "[name].js",
          // Content scripts + injected scripts must run as classic scripts.
          format: "iife",
          // Force a single output file for the entry (no code-splitting).
          inlineDynamicImports: true,
          manualChunks: undefined
        }
      }
    }
  };
});

