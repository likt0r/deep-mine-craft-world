import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { makeMcworld } from "../support/mcworld";
import { fake } from "./fake";
import { toast } from "./toast";

const tmp = mkdtempSync(join(tmpdir(), "dmc-import-e2e-"));
function mcworld(files: Record<string, string>) {
  const path = join(tmp, `${Math.random().toString(36).slice(2)}.mcworld`);
  makeMcworld(path, files);
  return readFileSync(path);
}

test.beforeEach(async () => {
  await fake.reset();
});

test("freien Platz antippen, Importieren, Datei wählen: die Welt liegt danach auf dem Platz", async ({
  page
}) => {
  await page.goto("/welten");
  await page.getByTestId("place-3").click();
  await page.getByTestId("free-import").click();

  await page.getByTestId("import-file").setInputFiles({
    name: "Inselwelt.mcworld",
    mimeType: "application/octet-stream",
    buffer: mcworld({ "level.dat": "x" })
  });
  // Der Name kommt aus dem Dateinamen.
  await expect(page.getByTestId("import-name")).toHaveValue("Inselwelt");
  await page.getByTestId("import-mode").getByText("Überleben").click();
  await page.getByTestId("import-submit").click();

  await expect(toast(page, "Inselwelt importiert.")).toBeVisible();
  const tile = page.getByTestId("place-3");
  await expect(tile).toContainText("Inselwelt");
  await expect(tile).toContainText("Überleben");
  await expect(tile.getByTestId("place-active")).toHaveCount(0);
  // Nichts geladen: kein Neustart.
  expect((await fake.get()).calls.some((c) => c.path.endsWith("/restart"))).toBe(false);
});

test("eine kaputte Datei wird mit Grund abgelehnt, der Platz bleibt frei", async ({ page }) => {
  await page.goto("/welten");
  await page.getByTestId("place-3").click();
  await page.getByTestId("free-import").click();

  await page.getByTestId("import-file").setInputFiles({
    name: "kaputt.mcworld",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("Hallo")
  });
  await page.getByTestId("import-submit").click();

  await expect(page.getByTestId("import-error")).toContainText("keine ZIP-Datei");
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByTestId("place-3")).toContainText("Frei");
});
