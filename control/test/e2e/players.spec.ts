import { expect, test } from "@playwright/test";

import { fake } from "./fake";
import { toast } from "./toast";

const whitelistEntry = (name: string) => ({ name, xuid: null, ignoresPlayerLimit: false });

test.beforeEach(async () => {
  await fake.reset();
});

test("zeigt Online-Spieler, Whitelist und eingeklappt, wer schon mal da war", async ({ page }) => {
  await fake.set({
    players: ["Lena"],
    knownPlayers: [{ name: "Tom", xuid: "2000" }],
    allowlist: [whitelistEntry("Lena"), whitelistEntry("Ben")]
  });
  await page.goto("/spieler");

  await expect(page.getByTestId("players-online").getByTestId("player-row")).toHaveText(
    /Lena\s*Auf der Whitelist/
  );
  await expect(page.getByTestId("players-whitelist").getByTestId("player-row")).toHaveAttribute(
    "data-player",
    "Ben"
  );
  const seen = page.getByTestId("players-seen");
  await expect(seen.getByTestId("player-row")).toBeHidden();
  await seen.getByText("Schon mal da gewesen (1)").click();
  await expect(seen.getByTestId("player-row")).toHaveAttribute("data-player", "Tom");
  await expect(page.getByTestId("players-search")).toHaveCount(0);
});

test("Gamertag auf die Whitelist setzen und wieder entfernen", async ({ page }) => {
  await page.goto("/spieler");
  const submit = page.getByTestId("whitelist-submit");

  await page.getByTestId("whitelist-input").fill('Steve"');
  await expect(submit).toBeDisabled();

  await page.getByTestId("whitelist-input").fill("Steve");
  await submit.click();
  await expect(toast(page, "Steve steht jetzt auf der Whitelist.")).toBeVisible();
  await expect(page.getByTestId("whitelist-input")).toHaveValue("");
  const row = page.getByTestId("players-whitelist").getByTestId("player-row");
  await expect(row).toHaveAttribute("data-player", "Steve");

  await row.getByTestId("whitelist-remove").click();
  await expect(toast(page, "Steve steht nicht mehr auf der Whitelist.")).toBeVisible();
  await expect(row).toHaveCount(0);
  expect((await fake.get()).allowlist).toEqual([]);
});

test("wer schon mal da war, kommt mit einem Tipp auf die Whitelist", async ({ page }) => {
  await fake.set({ knownPlayers: [{ name: "Tom", xuid: "2000" }] });
  await page.goto("/spieler");

  await page.getByText("Schon mal da gewesen (1)").click();
  await page.getByTestId("whitelist-add-known").click();

  await expect(page.getByTestId("players-whitelist").getByTestId("player-row")).toHaveAttribute(
    "data-player",
    "Tom"
  );
  await expect(page.getByTestId("players-seen")).toHaveCount(0);
});

test("ab 11 Spielern gibt es eine Suche, sie öffnet auch die früheren Spieler", async ({ page }) => {
  const names = ["Anna", "Ben", "Carla", "David", "Emil", "Frieda", "Greta", "Hugo", "Ida", "Jonas", "Karl"];
  await fake.set({ knownPlayers: names.map((name, i) => ({ name, xuid: String(2000 + i) })) });
  await page.goto("/spieler");

  await page.getByTestId("players-search").fill("gre");

  await expect(page.getByTestId("player-row")).toHaveCount(1);
  await expect(page.getByTestId("player-row")).toHaveAttribute("data-player", "Greta");
});
