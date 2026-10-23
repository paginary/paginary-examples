import { expect, test, type Page } from "@playwright/test";
import type { CalloutBlock } from "./callout-window.ts";

async function clickCalloutText(page: Page, needle: string, calloutIndex = 0): Promise<void> {
  const content = page.locator(".pg-callout-content").nth(calloutIndex);
  const segment = content.locator(".pg-seg").filter({ hasText: needle }).first();
  await expect(segment).toBeVisible();
  await segment.scrollIntoViewIfNeeded();
  const box = await segment.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) throw new Error(`No box for callout text ${JSON.stringify(needle)}`);
  await page.mouse.click(box.x + 2, box.y + box.height / 2);
}

const modelBlocks = (page: Page): Promise<CalloutBlock[]> =>
  page.evaluate(() => window.calloutBlocks?.() ?? []);

async function writeRichParagraphs(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const item = new ClipboardItem({
      "text/html": new Blob(["<p>One</p><p>Two</p>"], { type: "text/html" }),
      "text/plain": new Blob(["One\nTwo"], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
  });
}

test("Enter inserts a warning line break inside the callout", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.calloutReady === true);

  await clickCalloutText(page, "Warning:");
  await page.keyboard.press("Home");
  for (let index = 0; index < 8; index += 1) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Inserted ");

  await expect.poll(async () => (await modelBlocks(page)).length).toBe(2);
  const blocks = await modelBlocks(page);
  expect(blocks[0]?.type).toBe("example-callout");
  expect(blocks[0]?.variant).toBe("warning");
  expect(blocks[0]?.text).toContain("\nInserted ");
});

test("pasting rich paragraphs keeps order and puts remaining callout text after the last line", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.calloutReady === true);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });

  await clickCalloutText(page, "Warning:");
  await page.keyboard.press("Home");
  for (let index = 0; index < 8; index += 1) await page.keyboard.press("ArrowRight");
  await writeRichParagraphs(page);
  await page.keyboard.press("ControlOrMeta+V");

  await expect.poll(async () => (await modelBlocks(page)).length).toBe(3);
  const blocks = await modelBlocks(page);
  expect(blocks.map(({ type }) => type)).toEqual(["example-callout", "paragraph", "example-callout"]);
  expect(blocks[0]?.variant).toBe("warning");
  expect(blocks[0]?.text).toBe("Warning:One");
  expect(blocks[1]?.text).toBe("Two check the package before publishing.");
});

test("pasting rich paragraphs at the callout start keeps order", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.calloutReady === true);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });

  await clickCalloutText(page, "Warning:");
  await page.keyboard.press("Home");
  await writeRichParagraphs(page);
  await page.keyboard.press("ControlOrMeta+V");

  await expect.poll(async () => (await modelBlocks(page)).length).toBe(3);
  const blocks = await modelBlocks(page);
  expect(blocks.map(({ type }) => type)).toEqual(["example-callout", "paragraph", "example-callout"]);
  expect(blocks[0]?.variant).toBe("warning");
  expect(blocks[0]?.text).toBe("One");
  expect(blocks[1]?.text).toBe("TwoWarning: check the package before publishing.");
});

test("Enter on an empty last line leaves the callout and starts a paragraph", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.calloutReady === true);

  await clickCalloutText(page, "Warning:");
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("After");

  await expect.poll(async () => (await modelBlocks(page)).length).toBe(3);
  const blocks = await modelBlocks(page);
  expect(blocks.map(({ type }) => type)).toEqual(["example-callout", "paragraph", "example-callout"]);
  expect(blocks[0]?.variant).toBe("warning");
  expect(blocks[0]?.text).toBe("Warning: check the package before publishing.");
  expect(blocks[1]?.text).toBe("After");
});

test("Enter at the start of an adjacent callout creates a paragraph between the callouts", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.calloutReady === true);

  await clickCalloutText(page, "Sentence 1", 1);
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Between");

  await expect.poll(async () => (await modelBlocks(page)).length).toBe(3);
  const blocks = await modelBlocks(page);
  expect(blocks.map(({ type }) => type)).toEqual(["example-callout", "paragraph", "example-callout"]);
  expect(blocks[1]?.text).toBe("Between");
});

test("draws callout bands and preserves their variants across pages", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.calloutReady === true);

  const pages = page.locator(".pg-page");
  await expect.poll(() => pages.count()).toBeGreaterThanOrEqual(2);
  // #region count-bands
  const bandCounts = await pages.evaluateAll((pageElements) =>
    pageElements.map((pageElement) =>
      pageElement.querySelectorAll(".pg-callout-band").length,
    ),
  );
  expect(bandCounts).not.toContain(0);
  const variants = await pages.evaluateAll((pageElements) =>
    pageElements.flatMap((pageElement) =>
      Array.from(
        pageElement.querySelectorAll<HTMLElement>(".pg-callout-band"),
        (band) => band.dataset.calloutVariant,
      ),
    ),
  );
  expect(variants[0]).toBe("warning");
  expect(variants.slice(1)).toEqual(
    variants.slice(1).map(() => "note"),
  );
  // #endregion count-bands

  // #region join-text
  const segments = await page.locator(".pg-callout-content .pg-seg").allTextContents();
  const numbers = Array.from(
    segments.join("").matchAll(/Sentence\s*(\d+)\s*of\s*the\s*note\s*\./g),
    (match) => Number(match[1]),
  );
  expect(numbers).toEqual(Array.from({ length: 150 }, (_, index) => index + 1));
  // #endregion join-text
});
