import { expect, test } from "@playwright/test";

import { fake } from "./fake";
import { toast } from "./toast";
import { setVisibility } from "./visibility";

test.beforeEach(async () => {
  await fake.reset();
  // Alle acht Regeln lesbar, damit die Schalter einen Zustand zeigen.
  await fake.set({
    gamerules: {
      doDayLightCycle: "true",
      doWeatherCycle: "true",
      keepInventory: "false",
      doMobSpawning: "true",
      doFireTick: "true",
      tntExplodes: "true",
      pvp: "true",
      showCoordinates: "false"
    }
  });
});

test("Schalter zeigen den Zustand und drehen ihn um", async ({ page }) => {
  await page.goto("/regeln");

  // „Zeit anhalten“ ist invertiert: doDayLightCycle=true bedeutet aus.
  await expect(page.getByTestId("rule-dodaylightcycle")).not.toBeChecked();
  await expect(page.getByTestId("rule-keepinventory")).not.toBeChecked();
  await expect(page.getByTestId("rule-pvp")).toBeChecked();

  await page.getByTestId("rule-keepinventory").click();
  await expect(page.getByTestId("rule-keepinventory")).toBeChecked();
  await expect(toast(page, "Sachen beim Sterben behalten: an")).toBeVisible();

  await expect
    .poll(async () => (await fake.get()).calls.map((c) => (c.body as { command?: string })?.command))
    .toContain("gamerule keepinventory true");
});

test("„unbekannt“ ist sichtbar unterscheidbar", async ({ page }) => {
  await fake.set({ gamerules: null });
  await page.goto("/regeln");

  await expect(page.getByTestId("rule-pvp-unknown")).toBeVisible();
  await expect(page.getByTestId("rule-pvp")).toBeVisible();
  await expect(page.getByTestId("rule-pvp")).not.toBeChecked();
});

test("die Regeln stehen in den Gruppen Welt, Gefahren und Sterben", async ({ page }) => {
  await page.goto("/regeln");

  await expect(page.getByTestId("rules-world")).toHaveText("Gelten für die aktive Welt Pandaland.");
  const group = (name: string) => page.getByTestId(`rules-group-${name}`).getByTestId(/^rule-row-/);
  await expect(group("welt")).toHaveCount(3);
  await expect(group("gefahren")).toHaveCount(4);
  await expect(group("sterben")).toHaveCount(1);
  await expect(page.getByRole("switch", { name: "Monster" })).toBeChecked();
});

test("schlägt das Umschalten fehl, springt der Schalter zurück", async ({ page }) => {
  await page.route("**/api/rules", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 500, body: "{}" }) : route.continue()
  );
  await page.goto("/regeln");

  await page.getByTestId("rule-pvp").click();

  await expect(toast(page, "Das hat nicht geklappt. Versuch es nochmal.")).toBeVisible();
  await expect(page.getByTestId("rule-pvp")).toBeChecked();
});

const reads = async () => (await fake.commands()).filter((c) => c === "gamerule").length;

test("eine am Server geänderte Regel erscheint ohne Neuladen", async ({ page }) => {
  await page.goto("/regeln");
  await expect(page.getByTestId("rule-pvp")).toBeChecked();

  // Jemand schaltet im Spiel oder in BSM den Schaden zwischen Spielern aus.
  await fake.set({
    gamerules: {
      doDayLightCycle: "true",
      doWeatherCycle: "true",
      keepInventory: "false",
      doMobSpawning: "true",
      doFireTick: "true",
      tntExplodes: "true",
      pvp: "false",
      showCoordinates: "false"
    }
  });

  await expect(page.getByTestId("rule-pvp")).not.toBeChecked({ timeout: 8000 });
});

test("im Hintergrund wird nicht gefragt, wieder sichtbar sofort", async ({ page }) => {
  await page.goto("/regeln");
  await expect(page.getByTestId("rule-pvp")).toBeChecked();

  await setVisibility(page, "hidden");
  const before = await reads();
  await page.waitForTimeout(6000);
  expect(await reads()).toBe(before);

  await setVisibility(page, "visible");
  await expect.poll(reads, { timeout: 2000 }).toBe(before + 1);
});

test("in anderen Bereichen wird nicht nach den Regeln gefragt", async ({ page }) => {
  await page.goto("/regeln");
  await expect(page.getByTestId("rule-pvp")).toBeChecked();

  await page.getByTestId("nav-spielen").click();
  const before = await reads();
  await page.waitForTimeout(6000);

  expect(await reads()).toBe(before);
});
