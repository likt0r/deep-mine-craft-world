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

async function openPage(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("place-2")).toContainText("Bauwelt");
}

test("ohne Spieler lädt „Laden“ sofort, die Seite zeigt den Wechsel und danach die neue Welt", async ({
  page
}) => {
  await fake.set({ startDelayMs: 1500 });
  await openPage(page);

  await page.getByTestId("place-2").getByTestId("place-load").click();

  await expect(page.getByTestId("server-state")).toHaveText("Welt wird gewechselt …");
  await expect(page.getByTestId("controls")).toHaveAttribute("disabled");
  await expect(page.getByTestId("active-world")).toHaveText("Bauwelt", { timeout: 10_000 });
  await expect(page.getByTestId("server-state")).toHaveText("Läuft");
  await expect(page.getByTestId("place-2").getByTestId("place-active")).toBeVisible();
  await expect(page.getByTestId("place-1").getByTestId("place-load")).toBeVisible();
});

test("mit Spielern warnt ein Dialog und nennt sie; Abbrechen lädt nicht, Wechseln schon", async ({
  page
}) => {
  await fake.set({ players: ["Lena", "Tom"] });
  await openPage(page);

  await page.getByTestId("place-2").getByTestId("place-load").click();
  await expect(page.getByTestId("switch-warning-players")).toHaveText("Lena, Tom");
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByTestId("switch-warning")).toBeHidden();
  expect(await loadCalls()).toEqual([]);

  await page.getByTestId("place-2").getByTestId("place-load").click();
  await page.getByTestId("switch-confirm").click();

  await expect(page.getByTestId("active-world")).toHaveText("Bauwelt", { timeout: 10_000 });
  expect((await loadCalls()).map((c) => c.path.split("/").pop())).toEqual(["set", "restart"]);
});

test("die aktive Welt hat keinen Laden-Knopf", async ({ page }) => {
  await openPage(page);

  await expect(page.getByTestId("place-1").getByTestId("place-active")).toBeVisible();
  await expect(page.getByTestId("place-1").getByTestId("place-load")).toHaveCount(0);
});
