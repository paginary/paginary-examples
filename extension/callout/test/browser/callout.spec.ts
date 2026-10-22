import { expect, test } from "@playwright/test";

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
