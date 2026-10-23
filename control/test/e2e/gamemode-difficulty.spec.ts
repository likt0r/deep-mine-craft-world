import { expect, test } from "@playwright/test";

import { fake } from "./fake";
import { toast } from "./toast";

test.beforeEach(async () => {
  await fake.reset();
});

test("Spielmodus und Schwierigkeit sind hervorgehoben und ein Tipp ändert sie", async ({ page }) => {
  await fake.set({
    properties: {
      "level-name": "Pandaland",
      gamemode: "creative",
      difficulty: "easy",
      "level-type": "DEFAULT",
      "level-seed": ""
    }
  });
  await page.goto("/");

  const creative = page.getByTestId("gamemode-creative");
  const survival = page.getByTestId("gamemode-survival");
  const adventure = page.getByTestId("gamemode-adventure");

  await expect(creative).toBeVisible();
  await expect(survival).toBeVisible();
  await expect(adventure).toBeVisible();

  await expect(creative).toHaveAttribute("aria-pressed", "true");
  await expect(survival).toHaveAttribute("aria-pressed", "false");

  await survival.click();
  await expect(survival).toHaveAttribute("aria-pressed", "true");
  await expect(toast(page, "Spielmodus: Überleben.")).toBeVisible();
  await expect(creative).toHaveAttribute("aria-pressed", "false");

  const peaceful = page.getByTestId("difficulty-peaceful");
  const easy = page.getByTestId("difficulty-easy");
  const normal = page.getByTestId("difficulty-normal");
  const hard = page.getByTestId("difficulty-hard");

  await expect(peaceful).toBeVisible();
  await expect(easy).toBeVisible();
  await expect(normal).toBeVisible();
  await expect(hard).toBeVisible();

  await expect(easy).toHaveAttribute("aria-pressed", "true");

  await hard.click();
  await expect(hard).toHaveAttribute("aria-pressed", "true");
  await expect(toast(page, "Schwierigkeit: Schwer.")).toBeVisible();
  await expect(easy).toHaveAttribute("aria-pressed", "false");

  const own = (await fake.commands()).filter((c) => /^(gamemode|difficulty) /.test(c));
  expect(own).toEqual(["gamemode survival @a", "difficulty hard"]);
});
