import { expect, test } from "@playwright/test";

import { fake } from "./fake";

const BUTTONS: [string, string][] = [
  ["time-morgen", "time set sunrise"],
  ["time-mittag", "time set noon"],
  ["time-abend", "time set sunset"],
  ["time-nacht", "time set midnight"],
  ["weather-sonne", "weather clear"],
  ["weather-regen", "weather rain"],
  ["weather-gewitter", "weather thunder"]
];

test.beforeEach(async () => {
  await fake.reset();
});

test("jeder Knopf für Zeit und Wetter sendet seinen Befehl und meldet zurück", async ({ page }) => {
  await page.goto("/");

  for (const [testid, command] of BUTTONS) {
    await page.getByTestId(testid).click();
    await expect(page.getByTestId("time-weather-feedback")).toBeVisible();
    await expect.poll(() => fake.commands()).toContain(command);
  }

  // Die Spielregeln auf derselben Seite schicken `gamerule`, das zählt hier nicht.
  await expect
    .poll(async () => (await fake.commands()).filter((c) => c !== "gamerule"))
    .toEqual(BUTTONS.map(([, command]) => command));
});

test("die Rückmeldung nennt das Eingestellte", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("time-morgen").click();
  await expect(page.getByTestId("time-weather-feedback")).toHaveText("Morgen eingestellt.");

  await page.getByTestId("weather-regen").click();
  await expect(page.getByTestId("time-weather-feedback")).toHaveText("Wetter auf Regen gestellt.");
});
