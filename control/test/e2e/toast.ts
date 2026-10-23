import type { Page } from "@playwright/test";

/** Der sichtbare Titel eines Toasts. (Der Text steht zusätzlich in der Ansage für Screenreader.) */
export const toast = (page: Page, text: string) =>
  page.locator('[data-slot="title"]').filter({ hasText: text });
