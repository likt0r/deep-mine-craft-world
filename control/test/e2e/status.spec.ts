import { expect, test } from "@playwright/test";

import { fake } from "./fake";

test.beforeEach(async () => {
  await fake.reset();
});

test("zeigt aktive Welt, Status und Spielerzahl", async ({ page }) => {
  await fake.set({ players: ["Lena"] });
  await page.goto("/");

  await expect(page.getByTestId("active-world")).toHaveText("Pandaland");
  await expect(page.getByTestId("server-state")).toHaveText("Läuft");
  await expect(page.getByTestId("player-count")).toContainText("1 online");
  await expect(page.getByTestId("server-off")).toBeHidden();
});

test("keine horizontale Scrollleiste", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("status-header")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Server aus: roter Hinweis, Steuerung gesperrt, Starten startet", async ({ page }) => {
  await fake.set({ status: "STOPPED", startDelayMs: 1500 });
  await page.goto("/");

  await expect(page.getByTestId("server-off")).toBeVisible();
  await expect(page.getByTestId("controls")).toHaveAttribute("disabled");

  await page.getByRole("button", { name: "Starten" }).click();

  await expect(page.getByTestId("server-state")).toHaveText("Startet …");
  await expect(page.getByTestId("server-state")).toHaveText("Läuft", { timeout: 10_000 });
  await expect(page.getByTestId("server-off")).toBeHidden();
  await expect(page.getByTestId("controls")).not.toHaveAttribute("disabled");
});
