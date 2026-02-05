export type ReplacementRule = {
  id: string;
  enabled: boolean;
  from: string;
  to: string;
};

export type ExtensionConfig = {
  version: 1;
  rules: ReplacementRule[];
};

export const CONFIG_STORAGE_KEY = "shadcnCopyRewriterConfig";

export const SUPPORTED_SITE_MATCHES = [
  "https://ui.shadcn.com/*",
  "https://ui.shadcn.com/docs/*",
  "https://www.solid-ui.com/*",
  "https://solid-ui.com/*",
  "https://www.shadcn-vue.com/*",
  "https://shadcn-vue.com/*",
  "https://next.shadcn-vue.com/*",
  "https://v3.shadcn-vue.com/*",
  "https://radix.shadcn-vue.com/*",
  "https://shadcn-solid.com/*",
  "https://www.shadcn-svelte.com/*",
  "https://svelte-4.shadcn-svelte.com/*",
  "https://starwind.dev/*"
] as const;

export const DEFAULT_CONFIG: ExtensionConfig = {
  version: 1,
  rules: [
    { id: "alias-tilde-to-at", enabled: true, from: "~/", to: "@/" },
    { id: "alias-lib-components-to-at", enabled: true, from: "$lib/components", to: "@/components" },
    { id: "alias-at-to-tilde", enabled: false, from: "@/", to: "~/" },
    { id: "utils-cn", enabled: false, from: "@/lib/utils", to: "@/utils/cn" }
  ]
};
