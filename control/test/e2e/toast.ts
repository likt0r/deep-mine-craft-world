import type { Page } from "@playwright/test";

/**
 * Der sichtbare Titel eines Toasts. Nur im Bereich der Toasts suchen: den Text gibt es auch in der
 * Ansage für Screenreader, und Hinweise (UAlert) haben ebenfalls einen Titel.
 */
export const toast = (page: Page, text: string) =>
  page.locator('[data-slot="viewport"] [data-slot="title"]').filter({ hasText: text });
