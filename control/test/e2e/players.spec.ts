import { expect, test, type Page } from "@playwright/test";

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

  await row.click();
  await page.getByTestId("player-whitelist").click();
  await expect(toast(page, "Steve steht nicht mehr auf der Whitelist.")).toBeVisible();
  // Steve war nie da: ohne Whitelist steht er nirgends mehr, das Sheet geht zu.
  await expect(page.getByTestId("player-sheet")).toBeHidden();
  await expect(row).toHaveCount(0);
  expect((await fake.get()).allowlist).toEqual([]);
});

test("im Spieler-Sheet die Whitelist an- und ausschalten", async ({ page }) => {
  await fake.set({ knownPlayers: [{ name: "Tom", xuid: "2000" }] });
  await page.goto("/spieler");

  await page.getByText("Schon mal da gewesen (1)").click();
  await page.getByTestId("players-seen").getByTestId("player-row").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Tom" })).toBeVisible();
  await expect(sheet.getByTestId("player-sheet-online")).toHaveText("Nicht online");
  const whitelist = sheet.getByTestId("player-whitelist");
  await expect(whitelist).not.toBeChecked();

  await whitelist.click();
  await expect(toast(page, "Tom steht jetzt auf der Whitelist.")).toBeVisible();
  await expect(whitelist).toBeChecked();
  await expect(page.getByTestId("players-whitelist").getByTestId("player-row")).toHaveAttribute(
    "data-player",
    "Tom"
  );
  await expect(page.getByTestId("players-seen")).toHaveCount(0);

  await whitelist.click();
  await expect(toast(page, "Tom steht nicht mehr auf der Whitelist.")).toBeVisible();
  await expect(whitelist).not.toBeChecked();
  expect((await fake.get()).allowlist).toEqual([]);
});

test("Offline-Spieler kann man nicht kicken", async ({ page }) => {
  await fake.set({ allowlist: [whitelistEntry("Ben")] });
  await page.goto("/spieler");

  await page.getByTestId("players-whitelist").getByTestId("player-row").click();

  await expect(page.getByTestId("player-sheet")).toBeVisible();
  await expect(page.getByTestId("player-whitelist")).toBeChecked();
  await expect(page.getByTestId("player-kick")).toHaveCount(0);
});

test("einen Online-Spieler mit Nachricht kicken", async ({ page }) => {
  await fake.set({ players: ["Lena", "Tom"] });
  await page.goto("/spieler");

  await page.locator('[data-testid="player-row"][data-player="Lena"]').click();
  await expect(page.getByRole("dialog").getByTestId("player-sheet-online")).toHaveText("Online");
  await page.getByTestId("player-kick").click();

  const reason = page.getByTestId("player-kick-reason");
  const confirm = page.getByTestId("player-kick-confirm");
  await reason.fill('Sag "Tschüss"');
  await expect(confirm).toBeDisabled();
  await reason.fill("Zeit fürs Abendessen!");
  await confirm.click();

  await expect(toast(page, "Lena wurde gekickt.")).toBeVisible();
  await expect(page.getByTestId("player-sheet")).toBeHidden();
  expect((await fake.commands()).filter((c) => c.startsWith("kick "))).toEqual([
    'kick "Lena" Zeit fürs Abendessen!'
  ]);
  // Lena ist nicht mehr online, aber schon mal da gewesen.
  await expect(page.getByTestId("players-online").getByTestId("player-row")).toHaveAttribute(
    "data-player",
    "Tom"
  );
});

test("Antippen eines Spielers auf Spielen öffnet sein Spieler-Sheet", async ({ page }) => {
  await fake.set({ players: ["Lena", "Tom"] });
  await page.goto("/");

  await page.locator('[data-testid="player-option"][data-player="Tom"]').getByTestId("player-open").click();

  await expect(page).toHaveURL(/\/spieler\?spieler=Tom$/);
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Tom" })).toBeVisible();
  await expect(sheet.getByTestId("player-kick")).toBeVisible();

  // Schließen nimmt den Spieler aus der Adresse, damit Neuladen das Sheet nicht wieder öffnet.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("player-sheet")).toBeHidden();
  await expect(page).toHaveURL(/\/spieler$/);
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

  // Öffnen startet neu, weil BSM `allowlist off` sperrt. Abbrechen lässt alles, wie es ist.
  await open.click();
  await page.getByTestId("access-open-cancel").click();
  await expect(closed).toHaveAttribute("aria-pressed", "true");
  expect((await fake.get()).properties["allow-list"]).toBe("true");

  await open.click();
  await page.getByTestId("access-open-confirm").click();
  await expect(toast(page, "Zugang ist offen. Minecraft startet neu …")).toBeVisible();
  await expect(open).toHaveAttribute("aria-pressed", "true");
  const state = await fake.get();
  expect(state.properties["allow-list"]).toBe("false");
  expect(state.calls.some((c) => c.path.endsWith("/restart"))).toBe(true);
  expect(await fake.commands()).toEqual(["allowlist on"]);
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

test.describe("Sperren", () => {
  /** Hält einen Knopf 3 s gedrückt. hover() wartet, bis er ruhig steht. */
  async function hold(page: Page, testId: string) {
    await page.getByTestId(testId).hover();
    await page.mouse.down();
    await page.waitForTimeout(3200);
    await page.mouse.up();
  }

  test("einen Online-Spieler mit Grund per Halten sperren", async ({ page }) => {
    await fake.set({
      players: ["Lena", "Tom"],
      knownPlayers: [
        { name: "Lena", xuid: "2000" },
        { name: "Tom", xuid: "3000" }
      ],
      allowlist: [whitelistEntry("Lena")]
    });
    await page.goto("/spieler");

    await page.locator('[data-testid="player-row"][data-player="Lena"]').click();
    await page.getByTestId("player-ban").click();
    await expect(page.getByTestId("player-sheet")).toContainText(
      "Lena fliegt sofort raus und kann nicht mehr beitreten, auch nicht über die Whitelist."
    );
    const reason = page.getByTestId("player-ban-reason");
    const confirm = page.getByTestId("player-ban-confirm");
    await reason.fill('Sag "Tschüss"');
    await expect(confirm).toBeDisabled();
    await reason.fill("Hat alles angezündet");
    await hold(page, "player-ban-confirm");

    await expect(toast(page, "Lena ist gesperrt.")).toBeVisible();
    await expect(page.getByTestId("player-sheet")).toBeHidden();
    const state = await fake.get();
    expect(state.bans).toEqual([
      { player_name: "Lena", xuid: "2000", reason: "Hat alles angezündet", banned_at: expect.any(String) }
    ]);
    expect(state.allowlist).toEqual([]);
    expect(await fake.commands()).toEqual(["allowlist reload", 'kick "Lena" Hat alles angezündet']);

    const row = page.getByTestId("players-banned").getByTestId("player-row");
    await expect(row).toHaveAttribute("data-player", "Lena");
    await expect(row).toContainText("Hat alles angezündet");
    await expect(page.getByTestId("players-online").getByTestId("player-row")).toHaveAttribute(
      "data-player",
      "Tom"
    );
  });

  test("kurz Halten sperrt nicht", async ({ page }) => {
    await fake.set({ knownPlayers: [{ name: "Tom", xuid: "3000" }] });
    await page.goto("/spieler");

    await page.getByText("Schon mal da gewesen (1)").click();
    await page.getByTestId("players-seen").getByTestId("player-row").click();
    await page.getByTestId("player-ban").click();
    await page.getByTestId("player-ban-confirm").hover();
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForTimeout(500);

    expect((await fake.get()).bans).toEqual([]);
    await expect(page.getByTestId("player-ban-confirm")).toBeVisible();
  });

  test("Gesperrt zeigt Grund und Datum, Entsperren setzt nicht auf die Whitelist", async ({ page }) => {
    await fake.set({
      knownPlayers: [{ name: "Tom", xuid: "3000" }],
      bans: [{ player_name: "Tom", xuid: "3000", reason: "Gemein", banned_at: "2026-10-20T12:00:00" }]
    });
    await page.goto("/spieler");

    const row = page.getByTestId("players-banned").getByTestId("player-row");
    await expect(row).toContainText("Gemein · seit 20.10.2026");
    await expect(page.getByTestId("players-seen")).toHaveCount(0);

    await row.click();
    await expect(page.getByTestId("player-banned")).toContainText("Grund: Gemein · seit 20.10.2026");
    await expect(page.getByTestId("player-whitelist")).toHaveCount(0);
    await expect(page.getByTestId("player-ban")).toHaveCount(0);

    await page.getByTestId("player-unban").click();
    await expect(toast(page, "Tom ist entsperrt.")).toBeVisible();
    await expect(page.getByTestId("player-whitelist")).not.toBeChecked();
    await expect(page.getByTestId("player-ban")).toBeEnabled();
    await expect(page.getByTestId("players-banned")).toHaveCount(0);
    const state = await fake.get();
    expect(state.bans).toEqual([]);
    expect(state.allowlist).toEqual([]);
  });

  test("ohne XUID ist Sperren ausgegraut und erklärt", async ({ page }) => {
    await fake.set({ allowlist: [whitelistEntry("Ben")] });
    await page.goto("/spieler");

    await page.getByTestId("players-whitelist").getByTestId("player-row").click();

    await expect(page.getByTestId("player-ban")).toBeDisabled();
    await expect(page.getByTestId("player-ban-hint")).toHaveText(
      "Erst möglich, wenn der Spieler einmal da war."
    );
  });
});

test.describe("Spielerrechte", () => {
  test("Besucher setzen", async ({ page }) => {
    await fake.set({ knownPlayers: [{ name: "Tom", xuid: "2000" }] });
    await page.goto("/spieler");

    await page.getByText("Schon mal da gewesen (1)").click();
    await page.getByTestId("players-seen").getByTestId("player-row").click();

    const sheet = page.getByRole("dialog");
    await expect(sheet.getByTestId("player-permission-member")).toHaveAttribute("aria-pressed", "true");
    await sheet.getByTestId("player-permission-visitor").click();

    await expect(sheet.getByTestId("player-permission-visitor")).toHaveAttribute("aria-pressed", "true");
    await expect(sheet.getByText("Kann nur zuschauen, nichts abbauen oder bauen.")).toBeVisible();
    await expect(toast(page, "Tom ist jetzt Besucher.")).toBeVisible();
    expect((await fake.get()).permissions[0]?.permission_level).toBe("visitor");
    expect(await fake.commands()).toContain("permission reload");
    await expect(page.getByTestId("players-seen").getByTestId("player-row")).toContainText("Besucher");
  });

  test("Operator nur per Halten", async ({ page }) => {
    await fake.set({ knownPlayers: [{ name: "Tom", xuid: "2000" }] });
    await page.goto("/spieler");

    await page.getByText("Schon mal da gewesen (1)").click();
    await page.getByTestId("players-seen").getByTestId("player-row").click();

    const sheet = page.getByRole("dialog");
    await sheet.getByTestId("player-permission-operator").click();
    await expect(sheet.getByText("Tom darf als Operator Befehle nutzen", { exact: false })).toBeVisible();
    expect((await fake.get()).permissions).toEqual([]);

    const hold = sheet.getByRole("button", { name: /Halten: Operator machen/ });
    const box = await hold.boundingBox();
    if (!box) throw new Error("missing hold button");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3400);
    await page.mouse.up();

    await expect(sheet.getByTestId("player-permission-operator")).toHaveAttribute("aria-pressed", "true");
    await expect(sheet.getByText("Darf Befehle nutzen und Einstellungen ändern.")).toBeVisible();
    await expect(toast(page, "Tom ist jetzt Operator.")).toBeVisible();
    expect((await fake.get()).permissions[0]?.permission_level).toBe("operator");
    await expect(page.getByTestId("players-seen").getByTestId("player-row")).toContainText("Operator");
  });

  test("ohne eigenen Eintrag gilt das Recht für neue Spieler", async ({ page }) => {
    await fake.set({
      knownPlayers: [{ name: "Tom", xuid: "2000" }],
      properties: { ...(await fake.get()).properties, "default-player-permission-level": "visitor" }
    });
    await page.goto("/spieler");

    await page.getByText("Schon mal da gewesen (1)").click();
    await page.getByTestId("players-seen").getByTestId("player-row").click();

    await expect(page.getByRole("dialog").getByTestId("player-permission-visitor")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("ohne XUID ausgegraut", async ({ page }) => {
    await fake.set({ allowlist: [whitelistEntry("Ben")] });
    await page.goto("/spieler");

    await page.getByTestId("players-whitelist").getByTestId("player-row").click();

    const sheet = page.getByRole("dialog");
    await expect(
      sheet.getByTestId("player-permission").getByText("Erst möglich, wenn der Spieler einmal da war.")
    ).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Besucher" })).toBeDisabled();
    await expect(sheet.getByRole("button", { name: "Mitglied" })).toBeDisabled();
    await expect(sheet.getByRole("button", { name: "Operator" })).toBeDisabled();
  });
});
