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

test("Tab Updates: Handy 2×2, Tablet in einer Reihe", async ({ page }, testInfo) => {
  await offer(page, INSTALLED);
  await page.goto("/system");

  await page.getByTestId("system-tab-updates").click();

  await expect(page).toHaveURL("/system/updates");
  await expect(page.getByTestId("system-tab-updates")).toHaveAttribute("aria-current", "page");
  const first = (await page.getByTestId("system-tab-overview").boundingBox())!;
  const last = (await page.getByTestId("system-tab-updates").boundingBox())!;
  if (testInfo.project.name === "handy") expect(last.y).toBeGreaterThan(first.y + first.height - 1);
  else expect(last.y).toBe(first.y);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("zeigt installierte und neueste Version, Knopf zum Aktualisieren", async ({ page }) => {
  await offer(page, NEWER);
  await page.goto("/system/updates");

  await expect(page.getByTestId("updates-minecraft-current")).toHaveText(INSTALLED);
  await expect(page.getByTestId("updates-minecraft-latest")).toHaveText(NEWER);
  await expect(page.getByTestId("updates-checked-at")).toContainText("heute");
  await expect(page.getByTestId("updates-minecraft-available")).toContainText(`Version ${NEWER} ist da`);
  await expect(page.getByTestId("updates-minecraft-update")).toBeEnabled();
  await expect(page.getByTestId("updates-minecraft-uptodate")).toBeHidden();
});

test("aktuell: kein Knopf; „Jetzt prüfen“ findet eine neue Version", async ({ page }) => {
  await offer(page, INSTALLED);
  await page.goto("/system/updates");
  await expect(page.getByTestId("updates-minecraft-uptodate")).toBeVisible();
  await expect(page.getByTestId("updates-minecraft-update")).toBeHidden();

  await fake.set({ latestVersion: NEWER });
  await page.getByTestId("updates-check").click();

  await expect(page.getByTestId("updates-minecraft-latest")).toHaveText(NEWER);
  await expect(page.getByTestId("updates-minecraft-update")).toBeVisible();
});

test("Mojang nicht erreichbar: verständlicher Hinweis statt „aktuell“", async ({ page }) => {
  await offer(page, INSTALLED, true);
  await page.goto("/system/updates");

  await expect(page.getByTestId("updates-error")).toContainText("Mojang ist nicht erreichbar");
  await expect(page.getByTestId("updates-minecraft-latest")).toHaveText("unbekannt");
  await expect(page.getByTestId("updates-minecraft-uptodate")).toBeHidden();
});

test("Update per 3 s Halten: Statusleiste meldet es, danach ist die neue Version da", async ({ page }) => {
  await offer(page, NEWER);
  await fake.set({ startDelayMs: 2500 });
  await page.goto("/system/updates");

  await page.getByTestId("updates-minecraft-update").hover();
  await page.mouse.down();
  await page.waitForTimeout(3200);
  await page.mouse.up();

  await expect(toast(page, "Minecraft wird aktualisiert …")).toBeVisible();
  const bar = page.getByTestId("status-bar");
  await expect(bar).toHaveAttribute("data-state", "updating");
  await expect(bar).toContainText("Minecraft wird aktualisiert");
  await expect(page.getByTestId("updates-minecraft-running")).toBeVisible();

  await expect(page.getByTestId("updates-minecraft-current")).toHaveText(NEWER, { timeout: 10_000 });
  await expect(page.getByTestId("updates-minecraft-uptodate")).toBeVisible();
  await expect(bar).toHaveAttribute("data-state", "running", { timeout: 5000 });
  expect((await fake.get()).calls.filter((c) => c.path.endsWith("/update"))).toHaveLength(1);
});
