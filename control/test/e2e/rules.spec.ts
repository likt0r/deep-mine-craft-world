import { expect, test } from "@playwright/test";

import { fake } from "./fake";

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
