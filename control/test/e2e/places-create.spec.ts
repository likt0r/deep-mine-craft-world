import { expect, test } from "@playwright/test";

import { fake } from "./fake";

test.beforeEach(async () => {
  await fake.reset();
});

test("Modal ausfüllen → die Kachel zeigt die neue Welt als aktiv", async ({ page }) => {
  await page.goto("/welten");

  const tile = page.getByTestId("place-2");
  await expect(tile).toContainText("Frei");
  await tile.getByTestId("place-create").click();

  const modal = page.getByTestId("new-world-modal");
  await expect(modal).toBeVisible();
  await modal.getByTestId("new-world-name").fill("Bauwelt");
  await modal.getByTestId("new-world-type").getByText("Flach").click();
  await modal.getByTestId("new-world-mode").getByText("Überleben").click();
  await modal.getByTestId("new-world-submit").click();

  // Nach dem Anlegen wird die neue Welt gleich geladen und ist aktiv.
  await expect(tile.getByTestId("place-active")).toBeVisible({ timeout: 10_000 });
  await expect(tile).toContainText("Bauwelt");
  await expect(tile).toContainText("Flach");
  await expect(tile).toContainText("Überleben");
  await expect(tile.getByTestId("place-active")).toHaveText("Aktiv");
  await expect(page.getByTestId("place-1").getByTestId("place-active")).toHaveCount(0);

  // Properties wurden gesetzt, der Server neu gestartet.
  const state = await fake.get();
  expect(state.properties["level-type"]).toBe("FLAT");
  expect(state.properties["level-seed"]).toBe("");
  expect(state.properties.gamemode).toBe("survival");
  expect(state.properties.difficulty).toBe("normal");
  expect(state.calls.some((c) => c.path.endsWith("/properties/set"))).toBe(true);
  expect(state.calls.some((c) => c.path.endsWith("/restart"))).toBe(true);
});

test("Abbrechen legt keine Welt an", async ({ page }) => {
  await page.goto("/welten");

  await page.getByTestId("place-3").getByTestId("place-create").click();
  const modal = page.getByTestId("new-world-modal");
  await modal.getByTestId("new-world-name").fill("Vergessen");
  await modal.getByRole("button", { name: "Abbrechen" }).click();

  await expect(modal).toBeHidden();
  await expect(page.getByTestId("place-3")).toContainText("Frei");
  // Der Bereich Spielregeln schickt `gamerule`, das gehört nicht hierher.
  expect((await fake.commands()).filter((c) => !c.startsWith("say") && c !== "gamerule")).toEqual([]);
});

test("spielt gerade jemand, warnt das Modal und nennt die Spieler", async ({ page }) => {
  await fake.set({ players: ["Lena"] });
  await page.goto("/welten");

  await page.getByTestId("place-2").getByTestId("place-create").click();

  await expect(page.getByTestId("new-world-players-warning")).toContainText("Gerade spielen: Lena");
});

test("nach dem Anlegen sind die Spielregeln bekannt, auch wenn der Server langsam hochfährt", async ({
  page
}) => {
  // Wie auf dem echten Server: BSM meldet schnell „läuft“, Bedrock antwortet erst später.
  await fake.set({ startDelayMs: 500, outputDelayMs: 2000, gamerules: { keepInventory: "true" } });
  await page.goto("/welten");

  await page.getByTestId("place-2").getByTestId("place-create").click();
  await page.getByTestId("new-world-name").fill("Bauwelt");
  await page.getByTestId("new-world-submit").click();

  await expect(page.getByTestId("place-2").getByTestId("place-active")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("nav-regeln").click();
  await expect(page.getByTestId("rule-keepinventory")).toHaveAttribute("aria-checked", "true", {
    timeout: 10_000
  });
  await expect(page.getByTestId("rule-keepinventory-unknown")).toHaveCount(0);
});
