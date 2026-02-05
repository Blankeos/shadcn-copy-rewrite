import { test as base, chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const extensionPath = path.resolve(process.cwd(), "dist");
const manifestPath = path.join(extensionPath, "manifest.json");
const isHeadless = !(process.env.PW_HEADFUL === "1" || process.env.HEADFUL === "1");

if (!fs.existsSync(manifestPath)) {
  throw new Error("Extension build missing. Run `npm run build` to generate dist before tests.");
}

export const test = base.extend({
  sharedContext: [
    async ({}, use) => {
      const context = await chromium.launchPersistentContext("", {
        channel: "chromium",
        headless: isHeadless,
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
      });
      await use(context);
      await context.close();
    },
    { scope: "worker" }
  ],
  sharedPage: [
    async ({ sharedContext }, use) => {
      const page = await sharedContext.newPage();
      await use(page);
    },
    { scope: "worker" }
  ],
  isHeaded: async ({}, use) => {
    await use(!isHeadless);
  }
});

export { expect };
