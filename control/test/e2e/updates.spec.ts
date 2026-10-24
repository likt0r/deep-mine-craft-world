import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { fake } from "./fake";
import { E2E_APP_PORT } from "./ports";
import { toast } from "./toast";

const DATA = fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}/deep-mine-control`, import.meta.url));

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

/** Hält den Knopf 3 s gedrückt. */
async function hold(page: Page, testId: string) {
  await page.getByTestId(testId).hover();
  await page.mouse.down();
  await page.waitForTimeout(3200);
  await page.mouse.up();
}

const notBusy = async (page: Page) => !(await (await page.request.get("/api/status")).json()).busy;

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

  await hold(page, "updates-minecraft-update");

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

test("Autoupdate-Schalter: an zeigt den Hinweis statt des Knopfs, aus wieder den Knopf", async ({ page }) => {
  await offer(page, NEWER);
  await page.goto("/system/updates");
  const auto = page.getByTestId("update-auto-minecraft");
  await expect(auto).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("updates-minecraft-update")).toBeVisible();
  await expect(page.getByTestId("updates-minecraft-auto-hint")).toBeHidden();

  await auto.click();

  await expect(toast(page, "Minecraft wird automatisch aktualisiert.")).toBeVisible();
  await expect(auto).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("updates-minecraft-auto-hint")).toHaveText(
    "Wird automatisch installiert, sobald niemand spielt."
  );
  await expect(page.getByTestId("updates-minecraft-update")).toBeHidden();
  expect(JSON.parse(readFileSync(join(DATA, "update-settings.json"), "utf8"))).toEqual({
    control: false,
    minecraft: true
  });

  await auto.click();

  await expect(toast(page, "Minecraft wird nicht mehr automatisch aktualisiert.")).toBeVisible();
  await expect(auto).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("updates-minecraft-update")).toBeVisible();
});

test("Autoupdate an, aber die Version ist gescheitert: Grund und „Erneut versuchen“", async ({ page }) => {
  await page.request.put("/api/updates/auto", { data: { minecraft: true } });
  await offer(page, NEWER);
  await fake.set({ tasksFail: true });
  await page.request.post("/api/updates/auto");
  await expect.poll(() => notBusy(page)).toBe(true);
  await fake.set({ tasksFail: false });

  await page.goto("/system/updates");

  await expect(page.getByTestId("updates-minecraft-failed")).toContainText(
    `Update auf ${NEWER} ist fehlgeschlagen`
  );
  await expect(page.getByTestId("updates-minecraft-failed")).toContainText("Fehler im Fake");
  await expect(page.getByTestId("updates-minecraft-auto-hint")).toBeHidden();
  await expect(page.getByTestId("updates-minecraft-update")).toContainText("Erneut versuchen");

  await hold(page, "updates-minecraft-update");

  await expect(toast(page, "Minecraft wird aktualisiert …")).toBeVisible();
  await expect(page.getByTestId("updates-minecraft-current")).toHaveText(NEWER, { timeout: 10_000 });
  await expect(page.getByTestId("updates-minecraft-failed")).toBeHidden();
  await expect(page.getByTestId("updates-minecraft-uptodate")).toBeVisible();
});
