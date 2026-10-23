import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { writeSystemFiles, type SystemFiles } from "../support/system-files";
import { fake } from "./fake";
import { E2E_APP_PORT } from "./ports";
import { toast } from "./toast";

/** Die feste Fixture der Seitentests (siehe test/support/e2e-server.ts). */
const ROOT = fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}`, import.meta.url));
const REBOOT_MARKER = join(ROOT, "deep-mine-control", "reboot-called");
const POWEROFF_MARKER = join(ROOT, "deep-mine-control", "poweroff-called");
const FILES = {
  procDir: join(ROOT, "proc"),
  sysDir: join(ROOT, "sys"),
  smartFile: join(ROOT, "deep-mine-control", "smart.json")
};

async function setup(files?: SystemFiles) {
  await fake.reset();
  writeSystemFiles(FILES, files);
}

test("zeigt Temperatur, Speicher, Platte, SSD und Minecraft-Infos", async ({ page }) => {
  await setup();
  await page.goto("/system");

  await expect(page.getByTestId("system-overall")).toContainText("Alles in Ordnung");
  await expect(page.getByTestId("system-cpu-temp")).toHaveText("39 °C");
  await expect(page.getByText("Gut", { exact: true })).toBeVisible();
  await expect(page.getByTestId("system-cpu-load")).toHaveText("Auslastung 12 %");
  await expect(page.getByTestId("system-memory")).toContainText("0,9 GB");
  await expect(page.getByTestId("system-memory")).toContainText("von 6,4 GB");
  await expect(page.getByTestId("system-disk")).toContainText("frei von");
  await expect(page.getByTestId("system-ssd")).toContainText("Gesund");
  await expect(page.getByTestId("system-ssd")).toContainText("Verschleiß 6 %");
  await expect(page.getByTestId("system-uptime")).toHaveText("1 Std. 9 Min.");
  await expect(page.getByTestId("system-version")).toHaveText("1.26.52.3");
  await expect(page.getByTestId("system-backup")).toHaveText("keine");
});

test("fehlende Werte stehen als „unbekannt“ da", async ({ page }) => {
  await setup({ coreTemps: null, otherChips: [], meminfo: null, smart: null });
  await page.goto("/system");

  await expect(page.getByTestId("system-cpu-temp")).toHaveText("unbekannt");
  await expect(page.getByTestId("system-memory")).toHaveText("unbekannt");
  await expect(page.getByTestId("system-ssd")).toContainText("unbekannt");
});

test("heiße CPU und kranke SSD: „Achtung“ mit Grund", async ({ page }) => {
  await setup({ coreTemps: [86000], smart: { smart_status: { passed: false } } });
  await page.goto("/system");

  const overall = page.getByTestId("system-overall");
  await expect(overall).toContainText("Achtung");
  await expect(overall).toContainText("Der Prozessor ist sehr warm.");
  await expect(overall).toContainText("Die SSD meldet Probleme.");
  await expect(page.getByTestId("system-ssd")).toContainText("Probleme");
});

const restarts = async () => (await fake.get()).calls.filter((c) => c.path.endsWith("/restart"));

test("kurzes Tippen auf „Minecraft neu starten“ startet nicht neu", async ({ page }) => {
  await setup();
  await page.goto("/system");

  await page.getByTestId("system-restart").click();
  await page.waitForTimeout(1000);

  expect(await restarts()).toEqual([]);
});

test("3 Sekunden Halten startet Minecraft neu", async ({ page }) => {
  await setup();
  await fake.set({ startDelayMs: 1500 });
  await page.goto("/system");

  await page.getByTestId("system-restart").hover();
  await page.mouse.down();
  await expect(page.getByTestId("hold-progress")).toBeVisible();
  await page.waitForTimeout(3200);
  await page.mouse.up();

  await expect(toast(page, "Minecraft startet neu …")).toBeVisible();
  await expect.poll(async () => (await restarts()).length).toBe(1);
  // Solange der Server neu startet, ist der Knopf gesperrt.
  await expect(page.getByTestId("system-restart")).toBeDisabled();
  await expect(page.getByTestId("system-restart")).toBeEnabled({ timeout: 10_000 });
});

/** Hält einen Knopf `ms` lang gedrückt. hover() wartet, bis er ruhig steht. */
async function hold(page: import("@playwright/test").Page, testId: string, ms = 3200) {
  await page.getByTestId(testId).hover();
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test("3 Sekunden Halten stoppt Minecraft, kurz Halten nicht", async ({ page }) => {
  await setup();
  await page.goto("/system");

  await hold(page, "system-stop", 800);
  await page.waitForTimeout(500);
  expect((await fake.get()).status).toBe("RUNNING");

  await hold(page, "system-stop");
  await expect(toast(page, "Minecraft wird gestoppt …")).toBeVisible();
  await expect(page.getByTestId("status-bar")).toContainText("Server ist aus", { timeout: 5000 });
  // Gestoppt lässt sich Minecraft nicht noch einmal stoppen, der Rechner aber neu starten.
  await expect(page.getByTestId("system-stop")).toBeDisabled();
  await expect(page.getByTestId("system-reboot")).toBeEnabled();
});

test("Rechner neu starten und ausschalten lösen erst nach 3 Sekunden Halten aus", async ({ page }) => {
  await setup();
  await page.goto("/system");

  await hold(page, "system-poweroff", 800);
  await page.waitForTimeout(1500);
  expect(existsSync(POWEROFF_MARKER)).toBe(false);

  await hold(page, "system-reboot");
  await expect(toast(page, "Rechner startet neu.")).toBeVisible();
  await expect.poll(() => existsSync(REBOOT_MARKER), { timeout: 3000 }).toBe(true);

  await hold(page, "system-poweroff");
  await expect(toast(page, "Rechner wird ausgeschaltet.")).toBeVisible();
  await expect.poll(() => existsSync(POWEROFF_MARKER), { timeout: 3000 }).toBe(true);
});
