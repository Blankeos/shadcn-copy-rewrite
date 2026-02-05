import { test as base, expect, BrowserContext, Page } from "@playwright/test";

type Fixtures = {
  isHeaded: boolean;
  sharedContext: BrowserContext;
  sharedPage: Page;
};

export const test: ReturnType<typeof base.extend<Fixtures>>;
export { expect };
