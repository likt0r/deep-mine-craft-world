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

test("Zugang schließen und wieder öffnen", async ({ page }) => {
  await page.goto("/spieler");
  const open = page.getByTestId("access-open");
  const closed = page.getByTestId("access-closed");
  await expect(open).toHaveAttribute("aria-pressed", "true");

  await closed.click();
  await expect(toast(page, "Zugang ist geschlossen.")).toBeVisible();
  await expect(closed).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("access-explanation")).toHaveText(
    "Nur Spieler auf der Whitelist können beitreten."
  );
  expect((await fake.get()).properties["allow-list"]).toBe("true");
  expect(await fake.commands()).toEqual(["allowlist on"]);

  await open.click();
  await expect(toast(page, "Zugang ist offen.")).toBeVisible();
  await expect(open).toHaveAttribute("aria-pressed", "true");
  expect((await fake.get()).properties["allow-list"]).toBe("false");
  expect(await fake.commands()).toEqual(["allowlist on", "allowlist off"]);
});

test("beim Schließen mit Online-Spieler ohne Whitelist fragt ein Dialog", async ({ page }) => {
  await fake.set({ players: ["Lena"], allowlist: [whitelistEntry("Ben")] });
  await page.goto("/spieler");

  await page.getByTestId("access-closed").click();

  const dialog = page.getByTestId("access-close-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Lena");
  await dialog.getByTestId("access-close-whitelist").click();

  await expect(toast(page, "Zugang ist geschlossen.")).toBeVisible();
  await expect(dialog).toBeHidden();
  const state = await fake.get();
  expect(state.allowlist.map((entry) => entry.name)).toContain("Lena");
  expect(state.properties["allow-list"]).toBe("true");
  expect(await fake.commands()).toEqual(["allowlist reload", "allowlist on"]);
});

test("neue Spieler auf Besucher stellen", async ({ page }) => {
  await page.goto("/spieler");
  await expect(page.getByTestId("access-new-member")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("access-new-visitor").click();

  await expect(toast(page, "Neue Spieler sind Besucher.")).toBeVisible();
  await expect(page.getByTestId("access-new-visitor")).toHaveAttribute("aria-pressed", "true");
  expect((await fake.get()).properties["default-player-permission-level"]).toBe("visitor");
});

test("weist oben auf den Offline-Modus hin", async ({ page }) => {
  await fake.set({ properties: { "online-mode": "false" } });
  await page.goto("/spieler");

  const hint = page.getByTestId("players-offline");
  await expect(hint).toContainText("Offline-Modus ist an");
  await expect(hint).toContainText("Whitelist und Sperren lassen sich umgehen.");
});
