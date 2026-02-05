# Development & Local Testing

## Prereqs

- Node.js 18+ (or newer)
- Google Chrome (or Chromium)

## Install

```bash
npm install
```

## Build the Extension

```bash
npm run build
```

Vite outputs a Chrome-loadable extension bundle into `dist/`.

## Load Unpacked in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Pick `dist/`

## Test the Clipboard Rewriting

1. Open any supported site:
   - `https://ui.shadcn.com/docs/components`
   - `https://www.solid-ui.com/docs/components/carousel`
   - `https://www.shadcn-vue.com/docs/components/accordion`
    - `https://shadcn-solid.com`
    - `https://www.shadcn-svelte.com`
    - `https://starwind.dev`
2. Click the extension icon and adjust rules if needed.
3. Use the site’s **Copy** button on a component snippet (or select text and copy).
4. Paste into your editor and confirm imports were rewritten.

If the extension doesn’t seem to run:

- Reload the docs tab (content scripts only attach on page load).
- On `chrome://extensions`, click the extension’s **Reload** button.
- On the extension details page, ensure **Site access** isn’t set to “On click”.

## Iterate While Coding

Run a rebuild watcher:

```bash
npm run build:watch
```

Then after changes:

1. `chrome://extensions` → **Reload** the extension
2. Reload the docs tab you’re testing on

If you edit `src/content/injected.ts`, run a one-off build for it:

```bash
SCRIPT=injected vite build --config vite.script.config.ts
```

## Popup UI in a Regular Browser Tab (optional)

```bash
npm run dev
```

Open the dev URL Vite prints (usually `http://localhost:5173`).  
When running outside Chrome extension context, the popup uses `localStorage` as a fallback instead of `chrome.storage`.
