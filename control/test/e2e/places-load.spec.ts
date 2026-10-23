import { expect, test, type Page } from "@playwright/test";

import { fake } from "./fake";

test.beforeEach(async ({ page }) => {
  await fake.reset();
  // Erst migrieren („Pandaland“ auf Platz 1), dann eine zweite Welt auf Platz 2.
  await page.request.get("/api/places");
  await fake.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt", type: "flach", mode: "survival" });
});

const loadCalls = async () =>
  (await fake.get()).calls.filter((c) => c.path.endsWith("/properties/set") || c.path.endsWith("/restart"));

async function openBauwelt(page: Page) {
  await page.goto("/welten");
  await expect(page.getByTestId("place-2")).toContainText("Bauwelt");
  await page.getByTestId("place-2").click();
  await expect(page.getByTestId("place-sheet")).toBeVisible();
}

test("ohne Spieler lädt „Diese Welt laden“ sofort, die Seite zeigt den Wechsel und danach die neue Welt", async ({
  page
}) => {
  await fake.set({ startDelayMs: 1500 });
  await openBauwelt(page);

  await page.getByTestId("place-load").click();

  await expect(page.getByTestId("place-sheet")).toBeHidden();
  // Leiste und Ziel-Platz zeigen, dass Bauwelt gerade kommt.
  await expect(page.getByTestId("status-bar")).toContainText("Welt wird geladen: Bauwelt");
  await expect(page.getByTestId("place-2").getByTestId("place-switching")).toContainText("Wird geladen …");
  await expect(page.getByTestId("controls")).toHaveAttribute("disabled");
  await expect(page.getByTestId("place-2").getByTestId("place-active")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("place-2").getByTestId("place-switching")).toHaveCount(0);
  await expect(page.getByTestId("status-bar")).toHaveAttribute("data-state", "running");
  await expect(page.getByTestId("place-1").getByTestId("place-active")).toHaveCount(0);
});

test("mit Spielern warnt das Menü und nennt sie; Abbrechen lädt nicht, „Trotzdem laden“ schon", async ({
  page
}) => {
  await fake.set({ players: ["Lena", "Tom"] });
  await openBauwelt(page);

  await page.getByTestId("place-load").click();
  await expect(page.getByTestId("switch-warning-players")).toHaveText("Lena, Tom");
  await page.getByTestId("place-sheet").getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByTestId("switch-warning")).toBeHidden();
  expect(await loadCalls()).toEqual([]);

  await page.getByTestId("place-load").click();
  await page.getByTestId("switch-confirm").click();

  await expect(page.getByTestId("place-2").getByTestId("place-active")).toBeVisible({ timeout: 10_000 });
  expect((await loadCalls()).map((c) => c.path.split("/").pop())).toEqual(["set", "restart"]);
});

test("die aktive Welt bietet weder Laden noch Löschen an", async ({ page }) => {
  await page.goto("/welten");
  await page.getByTestId("place-1").click();

  await expect(page.getByTestId("place-sheet")).toContainText("Auf dieser Welt wird gerade gespielt.");
  await expect(page.getByTestId("place-load")).toHaveCount(0);
  await expect(page.getByTestId("place-delete")).toHaveCount(0);
});

test("die Karte auf Spielen zeigt den Wechsel", async ({ page }) => {
  await fake.set({ startDelayMs: 4000 });
  await page.goto("/");

  await page.request.post("/api/places/2/load");

  await expect(page.getByTestId("card-switching")).toContainText("Wechsel zu Bauwelt …");
  await expect(page.getByTestId("active-world")).toHaveText("Bauwelt", { timeout: 10_000 });
  await expect(page.getByTestId("card-switching")).toBeHidden();
});
