import { expect, test, type Page } from "@playwright/test";

import { fake } from "./fake";
import { toast } from "./toast";

const INSTALLED = "1.26.52.3";
const NEWER = "1.26.60.1";

/** Mojang bietet `latest` an; die App prüft gleich neu, denn ihr Ergebnis bleibt sonst eine Stunde. */
async function offer(page: Page, latest: string, mojangDown = false) {
  await fake.set({ latestVersion: latest, mojangDown });
  await page.request.post("/api/updates/check");
}

test.beforeEach(async () => {
  await fake.reset();
});

test("kein Hinweis ohne Update", async ({ page }) => {
  await offer(page, INSTALLED);
  await page.goto("/");
  await expect(page.getByTestId("update-hint")).toBeHidden();
  await page.goto("/system");
  await expect(page.getByTestId("update-hint")).toBeHidden();
});

test("Hinweis mit Knopf auf Spielen und Übersicht", async ({ page }) => {
  await offer(page, NEWER);
  await page.goto("/");
  await expect(page.getByTestId("update-hint")).toBeVisible();
  await expect(page.getByTestId("update-hint")).toContainText(`Minecraft ${NEWER}`);
  await expect(page.getByTestId("update-hint-update")).toBeVisible();
  await page.goto("/system");
  await expect(page.getByTestId("update-hint")).toBeVisible();
  await expect(page.getByTestId("update-hint-update")).toBeVisible();
});

test("Punkt in Navigation und Tab solange Update verfügbar", async ({ page }) => {
  await offer(page, NEWER);
  await page.goto("/");
  await expect(page.getByTestId("nav-update-dot")).toBeVisible();
  await page.goto("/system");
  await expect(page.getByTestId("nav-update-dot")).toBeVisible();
  await expect(page.getByTestId("system-tab-updates-dot")).toBeVisible();
});

test("Knopf → Menü → Halten → Update startet", async ({ page }) => {
  await offer(page, NEWER);
  await fake.set({ startDelayMs: 2500 });
  await page.goto("/");

  await page.getByTestId("update-hint-update").click();
  await expect(page.getByTestId("update-hint-sheet")).toBeVisible();

  await page.getByTestId("update-hint-confirm").hover();
  await page.mouse.down();
  await page.waitForTimeout(3200);
  await page.mouse.up();

  await expect(toast(page, `Minecraft ${NEWER} wird installiert …`)).toBeVisible();
  const bar = page.getByTestId("status-bar");
  await expect(bar).toHaveAttribute("data-state", "updating");
  await expect(bar).toContainText("Minecraft wird aktualisiert");
  await expect((await fake.get()).calls.filter((c) => c.path.endsWith("/update"))).toHaveLength(1);
  // Erst fertig werden lassen: Während eines Updates zeigt keine Seite Hinweise.
  await expect(bar).not.toHaveAttribute("data-state", "updating", { timeout: 15_000 });
});

test("Später blendet aus, nach Neuladen weiterhin aus, Punkt bleibt", async ({ page }) => {
  await offer(page, NEWER);
  await page.goto("/");

  await expect(page.getByTestId("update-hint")).toBeVisible();
  await page.getByTestId("update-hint-later").click();
  await expect(page.getByTestId("update-hint")).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("nav-update-dot")).toBeVisible();
  await expect(page.getByTestId("update-hint")).toBeHidden();

  // Punkt bleibt
  await expect(page.getByTestId("nav-update-dot")).toBeVisible();
  await page.goto("/system");
  await expect(page.getByTestId("system-tab-updates-dot")).toBeVisible();
});

test("Autoupdate an: Hinweis ohne Knopf", async ({ page }) => {
  await offer(page, NEWER);
  await page.request.put("/api/updates/auto", { data: { minecraft: true } });
  await page.goto("/");

  const hint = page.getByTestId("update-hint");
  await expect(hint).toContainText("Wird automatisch installiert, sobald niemand spielt.");
  await expect(page.getByTestId("update-hint-update")).toBeHidden();
  // Die Einstellung liegt in der App, nicht im Fake: für die übrigen Tests wieder aus.
  await page.request.put("/api/updates/auto", { data: { minecraft: false } });
});
