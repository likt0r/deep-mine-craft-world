import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { makeMcworld } from "../support/mcworld";
import { fake } from "./fake";
import { E2E_APP_PORT } from "./ports";
import { toast } from "./toast";

const ROOT = fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}`, import.meta.url));
const BACKUPS = join(ROOT, "backups", "Bedrock");
const WORLDS = join(ROOT, "servers", "Bedrock", "worlds");
const ACTIVE = "Bedrock level_backup_20261022_183000_ab12.mcworld";
const INACTIVE = "w-bauwelt_backup_20261020_100000_cd34.mcworld";

test.beforeEach(async ({ page }) => {
  await fake.reset();
  await page.request.get("/api/places");
  await fake.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt" });
  mkdirSync(BACKUPS, { recursive: true });
  writeFileSync(join(BACKUPS, ACTIVE), "x".repeat(2048));
  makeMcworld(join(BACKUPS, INACTIVE), { "level.dat": "aus dem Backup" });
});

async function hold(page: Page, testId: string) {
  await page.getByTestId(testId).hover();
  await page.mouse.down();
  await page.waitForTimeout(3200);
  await page.mouse.up();
}

test("zeigt Ordner, Backups je Welt und Download-Links", async ({ page }) => {
  await page.goto("/system");
  await page.getByTestId("system-tab-backups").click();

  await expect(page).toHaveURL("/system/backups");
  await expect(page.getByTestId("backups-dir")).toHaveText(BACKUPS);
  const active = page.getByTestId("backups-world-Bedrock level");
  await expect(active).toContainText("Platz 1 · Pandaland");
  await expect(active).toContainText("Aktiv");
  await expect(active.getByTestId("backup-row")).toHaveCount(1);
  await expect(active.getByTestId("backup-download")).toHaveAttribute(
    "href",
    `/api/backups/download/${encodeURIComponent(ACTIVE)}`
  );
  await expect(page.getByTestId("backups-world-w-bauwelt").getByTestId("backup-row")).toHaveCount(1);
});

test("Jetzt sichern legt ein Backup der aktiven Welt an", async ({ page }) => {
  await page.goto("/system/backups");

  await page.getByTestId("backup-now").click();

  await expect(toast(page, "Pandaland gesichert.")).toBeVisible();
  await expect(page.getByTestId("backups-world-Bedrock level").getByTestId("backup-row")).toHaveCount(2);
});

test("Backup einer anderen Welt zurückspielen: Warnung, 3 s halten", async ({ page }) => {
  writeFileSync(join(WORLDS, "w-bauwelt", "level.dat"), "jetziger Stand");
  await page.goto("/system/backups");

  await page.getByTestId("backups-world-w-bauwelt").getByTestId("backup-restore").click();
  await expect(page.getByTestId("backup-sheet")).toContainText("Bauwelt");
  await expect(page.getByTestId("backup-sheet")).toContainText("geht verloren");
  await hold(page, "backup-restore-confirm");

  await expect(toast(page, "Bauwelt zurückgespielt.")).toBeVisible();
  expect(readFileSync(join(WORLDS, "w-bauwelt", "level.dat"), "utf8")).toBe("aus dem Backup");
});

test("Backup der aktiven Welt: Hinweis auf Neustart, dann über BSM", async ({ page }) => {
  await page.goto("/system/backups");

  await page.getByTestId("backups-world-Bedrock level").getByTestId("backup-restore").click();
  await expect(page.getByTestId("backup-sheet")).toContainText("Minecraft startet neu");
  await hold(page, "backup-restore-confirm");

  await expect(toast(page, "Pandaland wird zurückgespielt")).toBeVisible();
  await expect
    .poll(async () => (await fake.get()).calls.some((c) => c.path.endsWith("/restore/action")))
    .toBe(true);
});

test("Vor jedem Start sichern: Schalter; ohne Admin-Rechte gesperrt mit Hinweis", async ({ page }) => {
  await page.goto("/system/backups");
  const auto = page.getByTestId("backups-auto-switch");
  await expect(auto).toHaveAttribute("aria-checked", "false");

  await auto.click();

  await expect(auto).toHaveAttribute("aria-checked", "true");
  expect((await fake.get()).plugins.backup_on_start).toBe(true);

  await fake.set({ admin: false });
  await page.reload();
  await expect(page.getByTestId("backups-auto-unknown")).toBeVisible();
  await expect(page.getByTestId("backups-auto-switch")).toBeDisabled();
});

test("Sichern, wenn eine Welt beendet wird: an, lässt sich ausschalten", async ({ page }) => {
  await page.goto("/system/backups");
  const worldEnd = page.getByTestId("backups-world-end-switch");
  await expect(worldEnd).toHaveAttribute("aria-checked", "true");

  await worldEnd.click();

  await expect(toast(page, "Beim Beenden einer Welt wird nicht mehr gesichert.")).toBeVisible();
  await expect(worldEnd).toHaveAttribute("aria-checked", "false");
  expect(JSON.parse(readFileSync(join(ROOT, "deep-mine-control", "backup-settings.json"), "utf8"))).toEqual({
    onWorldEnd: false
  });
});
