import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 0,
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 }
  },
  projects: [
    {
      name: "chrome",
      use: {
        browserName: "chromium",
        channel: "chrome"
      }
    }
  ]
});
