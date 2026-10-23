import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { E2E_APP_PORT } from "./ports";
import { fake } from "./fake";
import { toast } from "./toast";

/** Der Server-Ordner der festen Fixture (siehe test/support/e2e-server.ts). */
const ROOT = fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}`, import.meta.url));
const DATA_DIR = join(ROOT, "deep-mine-control");
const WORLDS_DIR = join(ROOT, "servers", "Bedrock", "worlds");

/**
 * Platz 1 „Pandaland“ ist die aktive Welt, Platz 2 ein zweiter Eintrag „Bauwelt“. Der Test legt
 * die zweite Welt direkt an: für Deep Mine Control ist sie danach eine Welt wie jede andere, weil
 * nur die Plätze-Datei und der Ordner sie ausmachen.
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

/** Öffnet das Aktionsmenü von „Bauwelt“ auf Platz 2. */
async function openBauwelt(page: Page) {
  await page.goto("/welten");
  await expect(page.getByTestId("place-2")).toContainText("Bauwelt");
  await page.getByTestId("place-2").click();
  await expect(page.getByTestId("place-delete")).toBeVisible();
}

test("kurzes Tippen löscht nicht", async ({ page }) => {
  await openBauwelt(page);

  await page.getByTestId("place-delete").click();

  await expect(page.getByTestId("hold-progress")).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("place-2")).toContainText("Bauwelt");
});

test("3 Sekunden Halten löscht die Welt, der Platz ist danach frei", async ({ page }) => {
  await openBauwelt(page);
  // hover() wartet, bis das Menü fertig hereingeglitten ist.
  await page.getByTestId("place-delete").hover();
  await page.mouse.down();
  // Der Fortschritt ist sichtbar, solange gehalten wird.
  await expect(page.getByTestId("hold-progress")).toBeVisible();
  await page.waitForTimeout(3200);
  await page.mouse.up();

  await expect(toast(page, "Bauwelt wurde gelöscht.")).toBeVisible();
  await expect(page.getByTestId("place-2")).toContainText("Frei");
  await expect(page.getByTestId("place-2")).not.toContainText("Bauwelt");
});

test("loslassen vor 3 Sekunden bricht ab", async ({ page }) => {
  await openBauwelt(page);
  // hover() wartet, bis das Menü fertig hereingeglitten ist.
  await page.getByTestId("place-delete").hover();
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();

  await expect(page.getByTestId("hold-progress")).toHaveCount(0);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("place-2")).toContainText("Bauwelt");
});
