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
  // Platz, Welttyp, Spielmodus und Schwierigkeit der aktiven Welt
  const card = page.getByTestId("status-header");
  await expect(card).toContainText("Platz 1");
  await expect(card).toContainText("Normal");
  await expect(card).toContainText("Kreativ");
  await expect(card).toContainText("Leicht");
  await expect(page.getByTestId("server-off")).toBeHidden();
});

test("Server aus: roter Hinweis, Steuerung gesperrt, Starten startet", async ({ page }) => {
  await fake.set({ status: "STOPPED", startDelayMs: 1500 });
  await page.goto("/");

  await expect(page.getByTestId("server-off")).toBeVisible();
  await expect(page.getByTestId("controls")).toHaveAttribute("disabled");

  await page.getByRole("button", { name: "Server starten" }).click();

  await expect(page.getByTestId("server-state")).toHaveText("Startet …");
  await expect(page.getByTestId("server-state")).toHaveText("Läuft", { timeout: 10_000 });
  await expect(page.getByTestId("server-off")).toBeHidden();
  await expect(page.getByTestId("controls")).not.toHaveAttribute("disabled");
});
