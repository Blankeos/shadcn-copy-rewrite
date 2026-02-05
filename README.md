# Shadcn Copy Rewrite

Chrome extension that rewrites import paths when you copy shadcn-style component snippets.

> Motivation: Needed it for viewing docs on shadcn, becuase I use a different path alias :D

Works on a few hardcoded docs sites. You edit simple **Find → Replace** rules.

> Motivation: I liked `@/components/ui` but shadcn uses `~/`

## Install

1. `npm install`
2. `npm run build`
3. Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

## Use

Click the extension icon → set rules → click “Copy” on a code block → paste.

Repo: [github.com/blankeos/shadcn-copy-extension](https://github.com/blankeos/shadcn-copy-extension)  
Author: blankeos
