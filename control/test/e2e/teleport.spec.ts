import { expect, test } from "@playwright/test";

import { fake } from "./fake";
import { toast } from "./toast";

test.beforeEach(async () => {
  await fake.reset();
});

const player = (page: import("@playwright/test").Page, name: string) =>
  page.locator(`[data-testid="player-option"][data-player="${name}"]`);

test("„Alle hierher“ neben einem Spieler holt alle zu ihm", async ({ page }) => {
  await fake.set({ players: ["Lena", "Tom"] });
  await page.goto("/");

  await expect(page.getByTestId("player-option")).toHaveCount(2);

  await player(page, "Lena").getByTestId("teleport-to").click();
  await expect(toast(page, "Alle sind jetzt bei Lena.")).toBeVisible();
  expect((await fake.commands()).filter((c) => c.startsWith("tp "))).toEqual(['tp @a "Lena"']);

  await player(page, "Tom").getByRole("button", { name: "Alle zu Tom holen" }).click();
  await expect(toast(page, "Alle sind jetzt bei Tom.")).toBeVisible();
  expect((await fake.commands()).filter((c) => c.startsWith("tp "))).toEqual(['tp @a "Lena"', 'tp @a "Tom"']);
});

test("ohne online Spieler gibt es keinen Knopf", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("players-empty")).toHaveText("Niemand ist gerade online.");
  await expect(page.getByTestId("teleport-to")).toHaveCount(0);
});
