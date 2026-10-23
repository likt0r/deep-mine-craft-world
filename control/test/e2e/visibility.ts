import type { Page } from "@playwright/test";

/** Tut so, als ginge der Tab in den Hintergrund (Standby) oder käme wieder nach vorn. */
export async function setVisibility(page: Page, state: "visible" | "hidden") {
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", { value, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}
