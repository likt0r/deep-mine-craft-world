import { expect, test } from "@playwright/test";

import { fake } from "./fake";
import { toast } from "./toast";

const BUTTONS: [string, string, string][] = [
  ["time-morgen", "time set sunrise", "Morgen eingestellt."],
  ["time-mittag", "time set noon", "Mittag eingestellt."],
  ["time-abend", "time set sunset", "Abend eingestellt."],
  ["time-nacht", "time set midnight", "Nacht eingestellt."],
  ["weather-sonne", "weather clear", "Wetter auf Sonne gestellt."],
  ["weather-regen", "weather rain", "Wetter auf Regen gestellt."],
  ["weather-gewitter", "weather thunder", "Wetter auf Gewitter gestellt."]
];

test.beforeEach(async () => {
  await fake.reset();
});

test("jeder Knopf für Zeit und Wetter sendet seinen Befehl und meldet es als Toast", async ({ page }) => {
  await page.goto("/");

  for (const [testid, command, message] of BUTTONS) {
    await page.getByTestId(testid).click();
    await expect(toast(page, message)).toBeVisible();
    await expect.poll(() => fake.commands()).toContain(command);
  }

  expect(await fake.commands()).toEqual(BUTTONS.map(([, command]) => command));
});

test("schlägt das Senden fehl, sagt ein Toast das", async ({ page }) => {
  await page.route("**/api/weather", (route) => route.fulfill({ status: 500, body: "{}" }));
  await page.goto("/");

  await page.getByTestId("weather-regen").click();

  await expect(toast(page, "Hat nicht geklappt. Bitte nochmal tippen.")).toBeVisible();
  await expect(toast(page, "Wetter auf Regen gestellt.")).toHaveCount(0);
});
