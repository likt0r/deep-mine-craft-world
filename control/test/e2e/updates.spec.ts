import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { fake } from "./fake";
import { E2E_APP_PORT } from "./ports";
import { toast } from "./toast";

const ROOT = fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}`, import.meta.url));
const DATA = join(ROOT, "deep-mine-control");

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

// --- Deep Mine Control ---

const CONTROL_INSTALLED = "1.2.3";
const CONTROL_NEWER = "1.3.0";

/** GitHub bietet `latest` an, dann gleich neu prüfen. */
async function offerControl(page: Page, latest: string) {
  await fake.set({ controlLatest: latest });
  await page.request.post("/api/updates/check");
}
/** Stand, wie ihn der root-Helfer deep-mine-update schreibt */
function helperState(phase: string, error: string | null = null) {
  writeFileSync(
    join(DATA, "update-state.json"),
    JSON.stringify({ id: "u1", version: CONTROL_NEWER, phase, error, startedAt: new Date().toISOString() })
  );
}

test("Deep Mine Control: Versionen über Minecraft, Änderungsliste zum Aufklappen", async ({ page }) => {
  await offerControl(page, CONTROL_NEWER);
  await page.goto("/system/updates");

  const card = page.getByTestId("updates-control");
  await expect(page.getByTestId("updates-control-current")).toHaveText(CONTROL_INSTALLED);
  await expect(page.getByTestId("updates-control-latest")).toHaveText(CONTROL_NEWER);
  await expect(page.getByTestId("updates-control-available")).toContainText(
    `Version ${CONTROL_NEWER} ist da`
  );
  await expect(card).toContainText("Deep Mine Control startet dabei neu, die Seite lädt danach von selbst.");
  await expect(page.getByTestId("updates-control-update")).toBeEnabled();
  const control = (await card.boundingBox())!;
  const minecraft = (await page.getByTestId("updates-minecraft").boundingBox())!;
  expect(control.y).toBeLessThan(minecraft.y);

  const notes = page.getByTestId("updates-control-notes-text");
  await expect(notes).toBeHidden();
  await page.getByTestId("updates-control-notes").getByText(`Änderungen in ${CONTROL_NEWER}`).click();
  await expect(notes).toBeVisible();
  // Zeilen bleiben Zeilen, der Text bleibt Text.
  expect(await notes.innerText()).toBe(
    "* Updates: Deep Mine Control per Knopf aktualisieren (abc1234)\n* Design: Grün wie in Minecraft (def5678)"
  );
});

test("Deep Mine Control aktuell oder GitHub weg", async ({ page }) => {
  await offerControl(page, CONTROL_INSTALLED);
  await page.goto("/system/updates");
  await expect(page.getByTestId("updates-control-uptodate")).toHaveText("Deep Mine Control ist aktuell.");
  await expect(page.getByTestId("updates-control-update")).toBeHidden();

  await fake.set({ githubDown: true });
  await page.getByTestId("updates-check").click();

  await expect(page.getByTestId("updates-control-error")).toContainText("GitHub ist nicht erreichbar");
  await expect(page.getByTestId("updates-control-latest")).toHaveText("unbekannt");
  await expect(page.getByTestId("updates-control-uptodate")).toBeHidden();
  // Minecraft ist davon nicht betroffen.
  await expect(page.getByTestId("updates-error")).toBeHidden();
  await expect(page.getByTestId("updates-minecraft-uptodate")).toBeVisible();
});

test("Deep Mine Control per Halten: Anfrage geschrieben, Fortschritt und Statusleiste", async ({ page }) => {
  await offerControl(page, CONTROL_NEWER);
  await page.goto("/system/updates");

  await hold(page, "updates-control-update");

  await expect(toast(page, "Deep Mine Control wird aktualisiert …")).toBeVisible();
  const request = JSON.parse(readFileSync(join(DATA, "update-request.json"), "utf8"));
  expect(request).toEqual({ id: expect.any(String), version: CONTROL_NEWER });
  const running = page.getByTestId("updates-control-running");
  await expect(running).toContainText("Wird geladen");
  const bar = page.getByTestId("status-bar");
  await expect(bar).toHaveAttribute("data-state", "updating");
  await expect(bar).toContainText("Deep Mine Control wird aktualisiert");
  await expect(page.getByTestId("updates-minecraft-update")).toBeHidden();

  // Der Helfer holt die Anfrage ab und meldet sich.
  rmSync(join(DATA, "update-request.json"));
  helperState("installing");
  await expect(running).toContainText("Wird installiert", { timeout: 10_000 });
  helperState("verifying");
  await expect(running).toContainText("Wartet auf die neue Version", { timeout: 10_000 });
  await expect(bar).toContainText("Deep Mine Control wird aktualisiert");
});

test("Deep Mine Control zurückgesetzt: Grund und „Erneut versuchen“", async ({ page }) => {
  await offerControl(page, CONTROL_NEWER);
  helperState(
    "rolled-back",
    "Version 1.3.0 hat sich nach 60 s nicht gemeldet. Version 1.2.3 ist wieder installiert."
  );
  await page.goto("/system/updates");

  const failed = page.getByTestId("updates-control-failed");
  await expect(failed).toContainText(`Update auf ${CONTROL_NEWER} ist fehlgeschlagen`);
  await expect(failed).toContainText("Version 1.2.3 ist wieder installiert.");
  await expect(page.getByTestId("status-bar")).toHaveAttribute("data-state", "running");
  await expect(page.getByTestId("updates-control-update")).toContainText("Erneut versuchen");

  await hold(page, "updates-control-update");

  await expect(toast(page, "Deep Mine Control wird aktualisiert …")).toBeVisible();
  expect(existsSync(join(DATA, "update-request.json"))).toBe(true);
  await expect(page.getByTestId("updates-control-running")).toBeVisible();
});

test("ändert sich die Version im Status, lädt die Seite von selbst neu", async ({ page }) => {
  await offerControl(page, CONTROL_NEWER);
  await page.goto("/system/updates");
  await expect(page.getByTestId("updates-control-current")).toHaveText(CONTROL_INSTALLED);
  await page.evaluate(() => ((window as unknown as { vorher: boolean }).vorher = true));
  const reloaded = page.waitForEvent("load", { timeout: 10_000 });

  writeFileSync(
    join(ROOT, "version.json"),
    JSON.stringify({ version: CONTROL_NEWER, commit: "1".repeat(40) })
  );

  await reloaded;
  await expect(page.getByTestId("updates-control-current")).toHaveText(CONTROL_NEWER);
  expect(await page.evaluate(() => (window as unknown as { vorher?: boolean }).vorher)).toBeUndefined();
  await expect(page.getByTestId("updates-control-uptodate")).toBeVisible();
});
