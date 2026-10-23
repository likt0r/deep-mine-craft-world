import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { wireguardConfig } from "../support/wireguard";
import { fake } from "./fake";
import { E2E_APP_PORT } from "./ports";
import { toast } from "./toast";

const NM_STATE = join(
  fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}`, import.meta.url)),
  "nmcli.json"
);
const vpnProfile = () =>
  JSON.parse(readFileSync(NM_STATE, "utf8")).connections.find((c: { name: string }) => c.name === "dmc-vpn");

test.beforeEach(async () => {
  await fake.reset();
});

async function uploadConfig(page: Page, text: string) {
  await page
    .getByTestId("vpn-file")
    .setInputFiles({ name: "mein-vpn.conf", mimeType: "text/plain", buffer: Buffer.from(text) });
}

test("Konfiguration hochladen, Angaben sehen, trennen und entfernen", async ({ page }) => {
  await page.goto("/system/netzwerk");
  await expect(page.getByTestId("vpn-empty")).toBeVisible();

  await uploadConfig(page, wireguardConfig());

  await expect(toast(page, "VPN eingerichtet")).toBeVisible();
  await expect(page.getByTestId("vpn-details")).toContainText("10.8.0.2/24");
  await expect(page.getByTestId("vpn-details")).toContainText("vpn.example.org:51820");
  await expect(page.getByTestId("vpn-state")).toHaveText("an");
  await expect(page.getByTestId("vpn-full-tunnel")).toHaveCount(0);

  await page.getByTestId("vpn-active-switch").click();
  await expect(page.getByTestId("vpn-state")).toHaveText("aus");
  expect(vpnProfile().up).toBe(false);

  await page.getByTestId("vpn-remove").hover();
  await page.mouse.down();
  await page.waitForTimeout(3200);
  await page.mouse.up();

  await expect(toast(page, "VPN entfernt.")).toBeVisible();
  await expect(page.getByTestId("vpn-empty")).toBeVisible();
});

test("Internetverkehr durchs VPN: standardmäßig aus, eingeschaltet mit Warnung", async ({ page }) => {
  await page.goto("/system/netzwerk");

  await uploadConfig(page, wireguardConfig("0.0.0.0/0"));

  const routeAll = page.getByTestId("vpn-route-all-switch");
  await expect(routeAll).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("vpn-full-tunnel")).toHaveCount(0);

  await routeAll.click();

  await expect(routeAll).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("vpn-full-tunnel")).toContainText("Aller Verkehr läuft durchs VPN");
});

test("bei einer Konfiguration nur fürs Heimnetz gibt es den Schalter nicht", async ({ page }) => {
  await page.goto("/system/netzwerk");

  await uploadConfig(page, wireguardConfig("192.168.0.0/24"));

  await expect(page.getByTestId("vpn-details")).toBeVisible();
  await expect(page.getByTestId("vpn-route-all")).toHaveCount(0);
});

test("eine kaputte Datei wird mit Grund abgelehnt", async ({ page }) => {
  await page.goto("/system/netzwerk");

  await uploadConfig(page, wireguardConfig().replace(/PrivateKey = .*/, "PrivateKey = falsch"));

  await expect(toast(page, "Datei nicht übernommen: PrivateKey fehlt oder ist ungültig")).toBeVisible();
  await expect(page.getByTestId("vpn-empty")).toBeVisible();
});
