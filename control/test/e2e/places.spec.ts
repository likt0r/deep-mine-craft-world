import { expect, test, type Page } from "@playwright/test";

import { fake } from "./fake";
import { toast } from "./toast";

const PANDALAND = {
  "level-name": "Pandaland",
  gamemode: "creative",
  difficulty: "easy",
  "level-type": "DEFAULT",
  "level-seed": ""
};

test.beforeEach(async () => {
  await fake.reset();
  await fake.set({ properties: PANDALAND });
});

/** Öffnet das Aktionsmenü eines Platzes. */
async function openPlace(page: Page, place: number) {
  await page.getByTestId(`place-${place}`).click();
  await expect(page.getByTestId("place-sheet")).toBeVisible();
}

test("zeigt 10 Plätze, „Pandaland“ belegt und als aktiv markiert", async ({ page }) => {
  await page.goto("/welten");

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

test("ein freier Platz bietet „Neue Welt“ an, kein Umbenennen", async ({ page }) => {
  await page.goto("/welten");
  await openPlace(page, 2);

  await expect(page.getByTestId("new-world-form")).toBeVisible();
  await expect(page.getByTestId("place-rename")).toHaveCount(0);
});

test("Welt umbenennen: neuer Name steht sofort in der Liste", async ({ page }) => {
  await page.goto("/welten");
  await openPlace(page, 1);

  await page.getByTestId("place-rename").click();
  await page.getByTestId("place-rename-input").fill("Panda Wiese");
  await page.getByTestId("place-rename-save").click();

  await expect(toast(page, "Umbenannt in Panda Wiese.")).toBeVisible();
  await expect(page.getByTestId("place-1")).toContainText("Panda Wiese");
  await expect(page.getByTestId("place-rename-input")).toHaveCount(0);

  // Der Name ist gespeichert und steht nach dem Neuladen weiter da.
  await page.reload();
  await expect(page.getByTestId("place-1")).toContainText("Panda Wiese");

  // Nur der Name hat sich geändert: kein Neustart und kein Befehl.
  const state = await fake.get();
  expect(state.properties["level-name"]).toBe("Pandaland");
  expect(state.calls.some((c) => /\/(start|restart|properties\/set)$/.test(c.path))).toBe(false);
  expect(await fake.commands()).toEqual([]);
});

test("leerer Name wird abgelehnt, der alte Name bleibt stehen", async ({ page }) => {
  await page.goto("/welten");
  await openPlace(page, 1);

  await page.getByTestId("place-rename").click();
  await page.getByTestId("place-rename-input").fill("");
  await page.getByTestId("place-rename-save").click();

  await expect(page.getByTestId("place-rename-error")).toBeVisible();
  await expect(page.getByTestId("place-rename-input")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("place-1")).toContainText("Pandaland");
});

test("Abbrechen verwirft die Eingabe", async ({ page }) => {
  await page.goto("/welten");
  await openPlace(page, 1);

  await page.getByTestId("place-rename").click();
  await page.getByTestId("place-rename-input").fill("Vergessen");
  await page.getByTestId("place-rename-cancel").click();

  await expect(page.getByTestId("place-rename-input")).toHaveCount(0);
  await expect(page.getByTestId("place-1")).toContainText("Pandaland");
  await expect(page.getByTestId("place-1")).not.toContainText("Vergessen");
});
