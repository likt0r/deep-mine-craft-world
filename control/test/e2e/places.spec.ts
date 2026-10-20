import { expect, test } from "@playwright/test";

import { fake } from "./fake";

test.beforeEach(async () => {
  await fake.reset();
});

test("zeigt 10 Plätze, „Pandaland“ belegt und als aktiv markiert", async ({ page }) => {
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

  await expect(page.getByTestId(/^place-\d+$/)).toHaveCount(10);
  await expect(page.getByTestId("place-1")).toContainText("Platz 1");
  await expect(page.getByTestId("place-1")).toContainText("Pandaland");
  await expect(page.getByTestId("place-1")).toContainText("Normal");
  await expect(page.getByTestId("place-1")).toContainText("Kreativ");
  await expect(page.getByTestId("place-1").getByTestId("place-active")).toHaveText("Aktiv");

  for (let place = 2; place <= 10; place++) {
    await expect(page.getByTestId(`place-${place}`)).toContainText("Frei");
    await expect(page.getByTestId(`place-${place}`).getByTestId("place-active")).toHaveCount(0);
  }
});
