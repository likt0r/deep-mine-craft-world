import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { E2E_APP_PORT } from "./ports";
import { fake } from "./fake";

/** Der Server-Ordner der festen Fixture (siehe test/support/e2e-server.ts). */
const ROOT = fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}`, import.meta.url));
const DATA_DIR = join(ROOT, "deep-mine-control");
const WORLDS_DIR = join(ROOT, "servers", "Bedrock", "worlds");

/**
 * Platz 1 „Pandaland“ ist die aktive Welt, Platz 2 ein zweiter Eintrag „Bauwelt“. Solange das
 * Anlegen (#10) noch fehlt, legt der Test die zweite Welt direkt an: für Deep Mine Control ist
 * sie danach eine Welt wie jede andere, weil nur die Plätze-Datei und der Ordner sie ausmachen.
 */
function addWorld(folder: string, place: number, name: string): void {
  mkdirSync(join(WORLDS_DIR, folder, "db"), { recursive: true });
  writeFileSync(join(WORLDS_DIR, folder, "levelname.txt"), folder);

  const now = new Date().toISOString();
  const places = [
    {
      place: 1,
      world: {
        name: "Pandaland",
        folder: "Pandaland",
        type: "normal",
        mode: "creative",
        difficulty: "easy",
        createdAt: now
      }
    },
    { place, world: { name, folder, type: "normal", mode: "creative", difficulty: "normal", createdAt: now } }
  ];
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, "places.json"), JSON.stringify(places, null, 2) + "\n");
}

test.beforeEach(async () => {
  await fake.reset();
  await fake.set({
    properties: {
      "level-name": "Pandaland",
      gamemode: "creative",
      difficulty: "easy",
      "level-type": "DEFAULT",
      "level-seed": ""
    }
  });
  addWorld("Bauwelt", 2, "Bauwelt");
});

test("kurzes Tippen löscht nicht", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByTestId("place-2");
  await expect(tile).toContainText("Bauwelt");

  await tile.getByTestId("place-delete").click();

  await expect(tile.getByTestId("place-delete-progress")).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(tile).toContainText("Bauwelt");
});

test("3 Sekunden Halten löscht die Welt, der Platz ist danach frei", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByTestId("place-2");
  await expect(tile).toContainText("Bauwelt");
  const box = (await tile.getByTestId("place-delete").boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Der Fortschritt ist sichtbar, solange gehalten wird.
  await expect(tile.getByTestId("place-delete-progress")).toBeVisible();
  await page.waitForTimeout(3200);
  await page.mouse.up();

  await expect(tile).toContainText("Frei");
  await expect(tile).not.toContainText("Bauwelt");
});

test("loslassen vor 3 Sekunden bricht ab", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByTestId("place-2");
  await expect(tile).toContainText("Bauwelt");
  const box = (await tile.getByTestId("place-delete").boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();

  await expect(tile.getByTestId("place-delete-progress")).toHaveCount(0);
  await page.waitForTimeout(3000);
  await expect(tile).toContainText("Bauwelt");
});

test("auf der aktiven Welt ist der Löschen-Knopf gesperrt", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByTestId("place-1");
  await expect(tile).toContainText("Pandaland");

  await expect(tile.getByTestId("place-delete")).toBeDisabled();
});
