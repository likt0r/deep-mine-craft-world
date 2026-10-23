import { expect, test } from "@playwright/test";

import { fake } from "./fake";

// Tablet quer wie im Design. Nur im Tablet-Projekt, das Handy hat dafür keine Breite.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet", "nur Tablet");
  await fake.reset();
  await page.setViewportSize({ width: 1180, height: 820 });
  // Erst migrieren („Pandaland“ auf Platz 1), dann eine zweite Welt auf Platz 2.
  await page.request.get("/api/places");
  await fake.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt", type: "flach", mode: "survival" });
});

test("Spielen ist zweispaltig: links Steuerung, rechts Spieler und „Welt wechseln“", async ({ page }) => {
  await fake.set({ players: ["Lena"] });
  await page.goto("/");

  const main = (await page.getByTestId("play-main").boundingBox())!;
  const aside = (await page.getByTestId("play-aside").boundingBox())!;
  expect(aside.x).toBeGreaterThan(main.x + main.width - 1);
  expect(Math.abs(aside.y - main.y)).toBeLessThan(2);
  await expect(page.getByTestId("play-aside").getByTestId("players")).toBeVisible();
  await expect(page.getByTestId("world-switch")).toBeVisible();
  // Die aktive Welt steht nicht in „Welt wechseln“.
  await expect(page.getByTestId("world-switch-1")).toHaveCount(0);
  await expect(page.getByTestId("world-switch-2")).toContainText("Bauwelt");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("„Laden“ in „Welt wechseln“ lädt ohne Spieler sofort", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("world-switch-2").getByTestId("world-switch-load").click();

  await expect(page.getByTestId("active-world")).toHaveText("Bauwelt", { timeout: 10_000 });
  await expect(page.getByTestId("world-switch-1")).toContainText("Pandaland");
});

test("mit Spielern kommt erst die Warnung; Abbrechen lädt nicht", async ({ page }) => {
  await fake.set({ players: ["Lena", "Tom"] });
  await page.goto("/");

  await page.getByTestId("world-switch-2").getByTestId("world-switch-load").click();
  await expect(page.getByTestId("switch-warning-players")).toHaveText("Lena, Tom");
  await page.getByTestId("place-sheet").getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByTestId("place-sheet")).toBeHidden();
  expect((await fake.get()).calls.some((c) => c.path.endsWith("/restart"))).toBe(false);

  await page.getByTestId("world-switch-2").getByTestId("world-switch-load").click();
  await page.getByTestId("switch-confirm").click();
  await expect(page.getByTestId("active-world")).toHaveText("Bauwelt", { timeout: 10_000 });
});

test("unter 1024 px bleibt Spielen einspaltig, ohne „Welt wechseln“", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");

  await expect(page.getByTestId("world-switch")).toBeHidden();
  const main = (await page.getByTestId("play-main").boundingBox())!;
  const aside = (await page.getByTestId("play-aside").boundingBox())!;
  expect(main.y).toBeGreaterThan(aside.y + aside.height - 1);
});
