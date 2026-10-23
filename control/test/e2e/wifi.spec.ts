import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { initialState } from "../support/fake-nmcli-state.mjs";
import { fake } from "./fake";
import { E2E_APP_PORT } from "./ports";
import { toast } from "./toast";

/** Zustand des Fake-nmcli in der festen Fixture (siehe test/support/e2e-server.ts). */
const NM_STATE = join(
  fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}`, import.meta.url)),
  "nmcli.json"
);
type NmState = ReturnType<typeof initialState>;
const nm = (): NmState =>
  existsSync(NM_STATE) ? JSON.parse(readFileSync(NM_STATE, "utf8")) : initialState();
const setNm = (change: (state: NmState) => void) => {
  const state = nm();
  change(state);
  writeFileSync(NM_STATE, JSON.stringify(state));
};

test.beforeEach(async () => {
  // Setzt auch den Zustand des Fake-nmcli zurück.
  await fake.reset();
});

async function hold(page: Page, testId: string) {
  await page.getByTestId(testId).hover();
  await page.mouse.down();
  await page.waitForTimeout(3200);
  await page.mouse.up();
}

test("System hat die Unter-Tabs Übersicht und WLAN", async ({ page }) => {
  await page.goto("/system");
  await expect(page.getByTestId("system-tab-overview")).toHaveAttribute("aria-current", "page");

  await page.getByTestId("system-tab-wlan").click();

  await expect(page).toHaveURL("/system/wlan");
  await expect(page.getByTestId("system-tab-wlan")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("system-tab-overview")).not.toHaveAttribute("aria-current", "page");
  // In der Hauptnavigation bleibt System markiert.
  await expect(page.getByTestId("nav-system")).toHaveClass(/router-link-active/);
});

test("eigenes WLAN: Status, Passwort zum Aufdecken und QR-Code", async ({ page }) => {
  await page.goto("/system/wlan");

  await expect(page.getByTestId("wifi-status")).toContainText("Eigenes WLAN „MINECRAFT-World“ ist an");
  await expect(page.getByTestId("wifi-status")).toContainText("2 Geräte verbunden");
  await expect(page.getByTestId("wifi-ap-password")).not.toContainText("deep-mine-craft");
  await expect(page.getByTestId("wifi-ap-qr")).toHaveCount(0);

  await page.getByTestId("wifi-ap-reveal").click();

  await expect(page.getByTestId("wifi-ap-password")).toHaveText("deep-mine-craft");
  await expect(page.getByTestId("wifi-ap-qr").locator("svg")).toBeVisible();
});

test("ein WLAN aus der Nähe hinzufügen, dann entfernen", async ({ page }) => {
  await page.goto("/system/wlan");
  await expect(page.getByTestId("wifi-saved")).toContainText("Noch keine");

  await page.locator('[data-testid="wifi-available-network"][data-ssid="Zuhause"]').click();
  await expect(page.getByTestId("wifi-sheet")).toContainText("gleich kurz getrennt");
  await expect(page.getByTestId("wifi-add-save")).toBeDisabled();
  await page.getByTestId("wifi-add-password").fill("geheim123");
  await page.getByTestId("wifi-add-save").click();

  await expect(toast(page, "Zuhause hinterlegt.")).toBeVisible();
  await expect(page.getByTestId("wifi-saved-1")).toContainText("Zuhause");
  await expect(page.getByTestId("wifi-saved-1")).toContainText("Verbunden", { timeout: 8000 });
  await expect(page.getByTestId("wifi-status")).toContainText("Verbunden mit Zuhause");
  expect(nm().connections.find((c) => c.name === "dmc-wlan-1")).toMatchObject({
    ssid: "Zuhause",
    psk: "geheim123"
  });

  // Während des Haltens lädt die Seite neu und der Hinweis oben im Menü fällt weg: Das darf nicht abbrechen.
  await page.getByTestId("wifi-saved-1").click();
  await hold(page, "wifi-remove");

  await expect(toast(page, "Zuhause entfernt.")).toBeVisible();
  await expect(page.getByTestId("wifi-saved")).toContainText("Noch keine");
  expect(nm().connections.map((c) => c.name)).toEqual(["dmc-ap"]);
});

test("ein WLAN von Hand hinzufügen: zu kurzes Passwort geht nicht", async ({ page }) => {
  await page.goto("/system/wlan");

  await page.getByTestId("wifi-add-manual").click();
  await page.getByTestId("wifi-add-ssid").fill("Ferienhaus");
  await page.getByTestId("wifi-add-password").fill("kurz");
  await expect(page.getByTestId("wifi-add-save")).toBeDisabled();

  await page.getByTestId("wifi-add-password").fill("lang-genug");
  await page.getByTestId("wifi-add-save").click();

  // Nicht in Reichweite: hinterlegt, aber das eigene WLAN bleibt an.
  await expect(page.getByTestId("wifi-saved-1")).toContainText("Ferienhaus");
  await expect(page.getByTestId("wifi-status")).toContainText("Eigenes WLAN");
});

test("eigenes WLAN ändern", async ({ page }) => {
  await page.goto("/system/wlan");

  await page.getByTestId("wifi-ap-edit").click();
  await page.getByTestId("wifi-ap-ssid-input").fill("Deep Mine");
  await page.getByTestId("wifi-ap-password-input").fill("neues-passwort");
  await page.getByTestId("wifi-ap-save").click();

  await expect(toast(page, "Eigenes WLAN geändert.")).toBeVisible();
  await expect(page.getByTestId("wifi-ap-ssid")).toHaveText("Deep Mine");
  expect(nm().connections[0]).toMatchObject({ ssid: "Deep Mine", psk: "neues-passwort" });
});

test("Offline-Modus umschalten setzt online-mode und startet neu", async ({ page }) => {
  await page.goto("/system/wlan");
  const offline = page.getByTestId("wifi-offline-switch");
  await expect(offline).toHaveAttribute("aria-checked", "false");

  await offline.click();

  await expect(toast(page, "Offline-Modus an.")).toBeVisible();
  await expect(offline).toHaveAttribute("aria-checked", "true");
  const state = await fake.get();
  expect(state.properties["online-mode"]).toBe("false");
  expect(state.calls.some((c) => c.path.endsWith("/restart"))).toBe(true);
});

test("läuft NetworkManager nicht, sagt die Seite das; der Offline-Modus bleibt bedienbar", async ({
  page
}) => {
  setNm((s) => {
    s.broken = true;
  });
  await page.goto("/system/wlan");

  await expect(page.getByTestId("wifi-error")).toContainText("WLAN-Verwaltung antwortet nicht");
  await expect(page.getByTestId("wifi-offline-switch")).toBeEnabled();
});
