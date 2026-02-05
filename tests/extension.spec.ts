import { test, expect } from "./fixtures";
import type { Locator } from "@playwright/test";
import { SUPPORTED_SITE_MATCHES } from "../src/shared/config";

const extensionName = "Shadcn Copy Rewrite";
const clipboardOptionalOrigins = new Set([
  "https://www.shadcn-vue.com",
  "https://shadcn-vue.com",
  "https://next.shadcn-vue.com",
  "https://v3.shadcn-vue.com",
  "https://radix.shadcn-vue.com",
  "https://www.shadcn-svelte.com",
  "https://svelte-4.shadcn-svelte.com"
]);
function buildAccordionTarget(match: string): string {
  const base = match.replace("*", "");
  const origin = new URL(base).origin;
  const pathBase = base.endsWith("/docs/")
    ? `${base}`
    : base.endsWith("/docs")
      ? `${base}/`
      : base.endsWith("/")
        ? `${base}docs/`
        : `${base}/docs/`;

  if (origin === "https://ui.shadcn.com") {
    return `${origin}/docs/components/radix/accordion`;
  }

  return `${pathBase}components/accordion`;
}

const accordionTargets = Array.from(
  new Set(SUPPORTED_SITE_MATCHES.map((match) => buildAccordionTarget(match)))
);

async function findCopyButtonForCodeBlock(codeBlock: Locator) {
  const handle = await codeBlock.evaluateHandle((node) => {
    const isVisible = (button: Element) => {
      const el = button as HTMLElement;
      const style = window.getComputedStyle(el);
      if (!style || style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const matchesCopy = (button: Element) => {
      const ariaLabel = button.getAttribute("aria-label") ?? "";
      const title = button.getAttribute("title") ?? "";
      const text = button.textContent ?? "";
      const label = `${ariaLabel} ${title} ${text}`.toLowerCase().trim();
      if (label.includes("copy page")) return false;
      if (label === "copy" || label === "copy code" || label.includes("copy code")) return true;
      if (label.includes("copy") && label.split(" ").length === 1) return true;

      const className = (button.getAttribute("class") ?? "").toLowerCase();
      const looksTopRight = className.includes("absolute") && className.includes("right-") && className.includes("top-");
      const hasSvgIcon = !!button.querySelector("svg");
      return looksTopRight && hasSvgIcon;
    };

    const findInRoot = (root: Element | null) => {
      if (!root) return null;
      const buttons = Array.from(root.querySelectorAll("button"));
      return buttons.find((button) => matchesCopy(button) && isVisible(button)) ?? null;
    };

    const roots: Element[] = [];
    const addRoot = (root: Element | null) => {
      if (root && !roots.includes(root)) roots.push(root);
    };

    const element = node instanceof Element ? node : null;
    addRoot(element);
    addRoot(element ? element.closest("figure") : null);
    addRoot(element ? element.closest("[data-rehype-pretty-code-fragment]") : null);
    addRoot(element ? element.closest("div.group.relative") : null);
    addRoot(element ? element.closest("div.code") : null);
    addRoot(element ? element.parentElement : null);

    for (const root of roots) {
      const button = findInRoot(root);
      if (button) return button;
    }

    let current: Element | null = element;
    for (let depth = 0; depth <= 6 && current; depth += 1) {
      const button = findInRoot(current);
      if (button) return button;
      current = current.parentElement;
    }

    return null;
  });

  return handle.asElement();
}

function applyDefaultRules(text: string): string {
  return text
    .split("$lib/components")
    .join("@/components")
    .split("~/")
    .join("@/");
}

async function getExpectedImportLine(codeBlock: Locator): Promise<string> {
  const raw = (await codeBlock.textContent()) ?? "";
  const line =
    raw
      .split("\n")
      .find((entry) => /accordion/i.test(entry) && /components/i.test(entry)) ?? raw;
  return applyDefaultRules(line).trim();
}

async function expectAccordionRewrite(codeBlock: Locator, expectedLine: string) {
  await expect
    .poll(async () => (await codeBlock.textContent()) ?? "", { timeout: 15000 })
    .toContain(expectedLine);
}

test.describe.serial("extension", () => {
  test("extension is loaded", async ({ sharedPage, isHeaded }) => {
    await sharedPage.goto("chrome://extensions/");

    await expect.poll(async () => {
      return await sharedPage.evaluate(() => {
        const manager = document.querySelector("extensions-manager");
        const managerRoot = manager?.shadowRoot;
        const list = managerRoot?.querySelector("extensions-item-list");
        const listRoot = list?.shadowRoot;
        const items = listRoot ? Array.from(listRoot.querySelectorAll("extensions-item")) : [];

        return items
          .map((item) => item.shadowRoot?.querySelector("#name")?.textContent?.trim() ?? "")
          .filter(Boolean);
      });
    }).toContain(extensionName);

    if (isHeaded) {
      await sharedPage.waitForTimeout(3000);
    }
  });

  test("rewrites accordion code copy on supported sites", async ({ sharedPage, sharedContext, isHeaded }) => {
    test.setTimeout(180000);
    for (const targetUrl of accordionTargets) {
      console.log(`Visiting ${targetUrl}`);
      const targetOrigin = new URL(targetUrl).origin;
      await sharedContext.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: targetOrigin
      });

      await sharedPage.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      const codeToggle = sharedPage
        .getByRole("tab", { name: /^code$/i })
        .or(sharedPage.getByRole("button", { name: /^code$/i }))
        .or(sharedPage.getByRole("link", { name: /^code$/i }))
        .or(sharedPage.getByRole("button", { name: /^view code$/i }))
        .or(sharedPage.getByRole("link", { name: /^view code$/i }));
      if ((await codeToggle.count()) > 0) {
        await codeToggle.first().click({ noWaitAfter: true });
      }

      const codeBlocks = sharedPage
        .locator("pre")
        .filter({ hasText: /accordion/i })
        .filter({ hasText: /components/i });
      await expect
        .poll(async () => await codeBlocks.count(), { timeout: 15000 })
        .toBeGreaterThan(0);

      const codeBlockCount = await codeBlocks.count();
      let codeBlock: Locator | null = null;
      for (let i = 0; i < codeBlockCount; i += 1) {
        const candidate = codeBlocks.nth(i);
        if (await candidate.isVisible()) {
          codeBlock = candidate;
          break;
        }
      }

      if (!codeBlock) {
        throw new Error(`No visible accordion code block found on ${targetUrl}.`);
      }

      const expectedLine = await getExpectedImportLine(codeBlock);
      const copyButton = await findCopyButtonForCodeBlock(codeBlock);

      await expect
        .poll(
          async () =>
            await sharedPage.evaluate(
              () => document.documentElement.getAttribute("data-shadcn-copy-rewrite")
            ),
          { timeout: 15000 }
        )
        .toBe("loaded");

      if (!copyButton || clipboardOptionalOrigins.has(targetOrigin)) {
        await expectAccordionRewrite(codeBlock, expectedLine);
        continue;
      }

      await sharedPage.bringToFront();
      await sharedPage.focus("body");
      await sharedPage.evaluate((button) => {
        button.scrollIntoView?.({ block: "center", inline: "center" });
        button.click();
      }, copyButton);

      if (!isHeaded) {
        await expectAccordionRewrite(codeBlock, expectedLine);
        continue;
      }

      await expect
        .poll(
          async () => {
            try {
              return await sharedPage.evaluate(() => navigator.clipboard.readText());
            } catch {
              return "";
            }
          },
          { timeout: 15000 }
        )
        .toContain(expectedLine);
    }

    if (isHeaded) {
      await sharedPage.waitForTimeout(3000);
    }
  });
});
