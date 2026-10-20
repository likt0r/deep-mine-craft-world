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

test("Welt umbenennen: Stift-Symbol, neuer Name steht sofort auf der Kachel", async ({ page }) => {
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

  // Ein Stift gibt es nur auf belegten Kacheln.
  await expect(page.getByTestId("place-2").getByTestId("place-rename")).toHaveCount(0);

  const tile = page.getByTestId("place-1");
  await tile.getByTestId("place-rename").click();
  await tile.getByTestId("place-rename-input").fill("Panda Wiese");
  await tile.getByTestId("place-rename-save").click();

  await expect(tile).toContainText("Panda Wiese");
  await expect(tile.getByTestId("place-rename-input")).toHaveCount(0);

  // Der Name ist gespeichert und steht nach dem Neuladen weiter da.
  await page.reload();
  await expect(page.getByTestId("place-1")).toContainText("Panda Wiese");

  // Nur der Name hat sich geändert: kein Neustart und kein Befehl.
  const state = await fake.get();
  expect(state.properties["level-name"]).toBe("Pandaland");
  expect(state.calls.some((c) => /\/(start|restart|send_command)$/.test(c.path))).toBe(false);
});

test("leerer Name wird abgelehnt, der alte Name bleibt stehen", async ({ page }) => {
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

  const tile = page.getByTestId("place-1");
  await tile.getByTestId("place-rename").click();
  await tile.getByTestId("place-rename-input").fill("");
  await tile.getByTestId("place-rename-save").click();

  await expect(tile.getByTestId("place-rename-error")).toBeVisible();
  await expect(tile.getByTestId("place-rename-input")).toBeVisible();

  // Der Name ist unverändert geblieben.
  await page.reload();
  await expect(page.getByTestId("place-1")).toContainText("Pandaland");
});

test("Abbrechen verwirft die Eingabe", async ({ page }) => {
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

  const tile = page.getByTestId("place-1");
  await tile.getByTestId("place-rename").click();
  await tile.getByTestId("place-rename-input").fill("Vergessen");
  await tile.getByTestId("place-rename-cancel").click();

  await expect(tile.getByTestId("place-rename-input")).toHaveCount(0);
  await expect(tile).toContainText("Pandaland");
  await expect(tile).not.toContainText("Vergessen");
});
