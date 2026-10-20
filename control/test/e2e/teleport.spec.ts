import { expect, test } from "@playwright/test";

import { fake } from "./fake";

test.beforeEach(async () => {
  await fake.reset();
});

test("Ziel antippen und alle hierher holen", async ({ page }) => {
  await fake.set({ players: ["Lena", "Tom"] });
  await page.goto("/");

  const teleport = page.getByTestId("teleport-all");
  await expect(page.getByTestId("player-option")).toHaveCount(2);
  await expect(teleport).toBeDisabled();

  const lena = page.locator('[data-testid="player-option"][data-player="Lena"]');
  await lena.click();
  await expect(lena).toHaveAttribute("aria-pressed", "true");
  await expect(teleport).toBeEnabled();

  await teleport.click();

  await expect(page.getByTestId("teleport-sent")).toBeVisible();
  expect(await fake.commands()).toEqual(['tp @a "Lena"']);

  // Ein zweites Ziel wählen und erneut holen.
  const tom = page.locator('[data-testid="player-option"][data-player="Tom"]');
  await tom.click();
  await expect(lena).toHaveAttribute("aria-pressed", "false");
  await teleport.click();
  await expect(page.getByTestId("teleport-sent")).toBeVisible();
  expect(await fake.commands()).toEqual(['tp @a "Lena"', 'tp @a "Tom"']);
});

test("ohne online Spieler ist der Knopf gesperrt", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("players-empty")).toBeVisible();
  await expect(page.getByTestId("teleport-all")).toBeDisabled();
});
