import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { fake } from "./fake";
import { E2E_APP_PORT } from "./ports";
import { toast } from "./toast";

/** Datenordner der festen Fixture: hier tauschen Deep Mine Control und der root-Helfer Dateien aus. */
const DATA = join(
  fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}`, import.meta.url)),
  "deep-mine-control"
);
const REQUEST = join(DATA, "ethernet-request.json");
const CONFIRM = join(DATA, "ethernet-confirm.json");
/** Schreibt den Stand so, wie der root-Helfer es täte. */
const helperState = (state: object) =>
  writeFileSync(join(DATA, "ethernet-state.json"), JSON.stringify(state));

test.beforeEach(async () => {
  await fake.reset();
});

test("zeigt Kabel, Adresse mit DHCP, Gateway und DNS", async ({ page }) => {
  await page.goto("/system/netzwerk");

  const status = page.getByTestId("ethernet-status");
  await expect(status).toContainText("steckt");
  await expect(status).toContainText("192.168.0.110/24");
  await expect(status).toContainText("DHCP");
  await expect(status).toContainText("192.168.0.1");
  await expect(status).toContainText("192.168.0.5");
});

test("feste IP eintragen: ungültige Werte gehen nicht, gültige werden als Anfrage geschrieben", async ({
  page
}) => {
  await page.goto("/system/netzwerk");

  await page.getByTestId("ethernet-edit").click();
  await page.getByTestId("ethernet-mode-static").click();
  await page.getByTestId("ethernet-address").fill("192.168.0.50");
  await page.getByTestId("ethernet-gateway").fill("10.0.0.1");
  await expect(page.getByTestId("ethernet-save")).toBeDisabled();

  await page.getByTestId("ethernet-gateway").fill("192.168.0.1");
  await page.getByTestId("ethernet-dns").fill("192.168.0.5, 1.1.1.1");
  await page.getByTestId("ethernet-save").click();

  await expect(toast(page, "Wird übernommen …")).toBeVisible();
  await expect(page.getByTestId("ethernet-change")).toContainText("Wird übernommen");
  await expect(page.getByTestId("ethernet-edit")).toBeDisabled();
  expect(JSON.parse(readFileSync(REQUEST, "utf8"))).toMatchObject({
    mode: "static",
    address: "192.168.0.50",
    prefix: 24,
    gateway: "192.168.0.1",
    dns: ["192.168.0.5", "1.1.1.1"]
  });
});

test("angewendet: Countdown, Link zur neuen Adresse, Bestätigen", async ({ page }) => {
  helperState({
    id: "r1",
    phase: "pending",
    deadline: Math.floor(Date.now() / 1000) + 90,
    setting: { mode: "static", address: "192.168.0.50", prefix: 24, gateway: "192.168.0.1", dns: [] },
    newAddress: "192.168.0.50"
  });
  await page.goto("/system/netzwerk");

  const change = page.getByTestId("ethernet-change");
  await expect(change).toContainText(/noch (8\d|90) s zum Bestätigen/);
  await expect(change.getByRole("link", { name: "http://192.168.0.50" })).toHaveAttribute(
    "href",
    "http://192.168.0.50/system/netzwerk"
  );

  await page.getByTestId("ethernet-confirm").click();

  await expect(toast(page, "Netzwerk-Einstellung bestätigt.")).toBeVisible();
  await expect.poll(() => existsSync(CONFIRM)).toBe(true);
  expect(JSON.parse(readFileSync(CONFIRM, "utf8"))).toEqual({ id: "r1" });
});

test("nicht bestätigt: Hinweis, dass die alte Einstellung wieder gilt", async ({ page }) => {
  helperState({ id: "r1", phase: "rolled-back" });
  await page.goto("/system/netzwerk");

  await expect(page.getByTestId("ethernet-change")).toContainText("wieder die alte Einstellung");
  await expect(page.getByTestId("ethernet-edit")).toBeEnabled();
});
