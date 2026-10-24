import { expect, test } from "@playwright/test";

import { fake } from "./fake";
import { setVisibility } from "./visibility";

const AREAS = [
  { path: "/", nav: "nav-spielen" },
  { path: "/welten", nav: "nav-welten" },
  { path: "/regeln", nav: "nav-regeln" },
  { path: "/spieler", nav: "nav-spieler" },
  { path: "/system", nav: "nav-system" }
];

test.beforeEach(async () => {
  await fake.reset();
});

test("die fünf Bereiche sind über die Navigation erreichbar, der aktive ist markiert", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("nav-spielen")).toHaveAttribute("aria-current", "page");

  for (const area of AREAS.slice(1)) {
    await page.getByTestId(area.nav).click();
    await expect(page).toHaveURL(area.path);
    await expect(page.getByTestId(area.nav)).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("nav-spielen")).not.toHaveAttribute("aria-current", "page");
  }
});

test("Handy: Tab-Leiste unten, Tablet: Seitenleiste links", async ({ page }, testInfo) => {
  await page.goto("/");
  const box = (await page.getByTestId("app-nav").boundingBox())!;
  const viewport = page.viewportSize()!;

  if (testInfo.project.name === "handy") {
    expect(box.width).toBe(viewport.width);
    expect(box.y + box.height).toBeCloseTo(viewport.height, 0);
  } else {
    expect(box.x).toBe(0);
    expect(box.height).toBe(viewport.height);
    expect(box.width).toBeLessThan(viewport.width / 4);
  }
});

test("keine horizontale Scrollleiste, in keinem Bereich", async ({ page }) => {
  for (const area of AREAS) {
    await page.goto(area.path);
    await expect(page.getByTestId(area.nav)).toHaveAttribute("aria-current", "page");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, area.path).toBeLessThanOrEqual(0);
  }
});

test("die Seite lädt nichts von fremden Servern", async ({ page, baseURL }) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(baseURL!) && !request.url().startsWith("data:"))
      foreign.push(request.url());
  });

  for (const area of AREAS) {
    await page.goto(area.path);
    await page.waitForLoadState("networkidle");
  }

  expect(foreign).toEqual([]);
});

test("Server aus: außerhalb von Spielen ein Hinweis mit Weg zum Starten", async ({ page }) => {
  await fake.set({ status: "STOPPED" });
  await page.goto("/welten");

  await expect(page.getByTestId("status-bar")).toContainText("Server ist aus");
  await expect(page.getByTestId("controls")).toHaveAttribute("disabled");

  await page.getByTestId("status-bar").getByRole("link", { name: "Starten" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("server-off")).toBeVisible();
});

test("der Status pausiert im Hintergrund und lädt beim Aufwachen sofort", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("active-world")).toHaveText("Pandaland");
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/status")) requests++;
  });

  await setVisibility(page, "hidden");
  await page.waitForTimeout(4000);
  expect(requests).toBe(0);

  // Inzwischen kommt jemand dazu; aufgeweckt zeigt die Seite das gleich.
  await fake.set({ players: ["Lena"] });
  await setVisibility(page, "visible");
  await expect(page.getByTestId("player-count")).toContainText("1 online", { timeout: 1500 });
});

test("die Statusleiste steht in jedem Bereich und meldet „Verbunden“", async ({ page }) => {
  await fake.set({ players: ["Lena"] });
  for (const area of AREAS) {
    await page.goto(area.path);
    const bar = page.getByTestId("status-bar");
    await expect(bar).toContainText("Verbunden · Server läuft");
    await expect(bar).toContainText("1 online");
  }
});

test("antwortet Deep Mine Control nicht: „Keine Verbindung“, danach wieder verbunden", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("status-bar")).toHaveAttribute("data-state", "running");

  await page.route("**/api/status", (route) => route.abort("internetdisconnected"));
  await expect(page.getByTestId("status-bar")).toContainText("Keine Verbindung", { timeout: 5000 });
  await expect(page.getByTestId("controls")).toHaveAttribute("disabled");

  await page.unroute("**/api/status");
  await expect(page.getByTestId("status-bar")).toHaveAttribute("data-state", "running", { timeout: 5000 });
});

test("antwortet BSM nicht: eigene Meldung", async ({ page }) => {
  await page.goto("/welten");
  await fake.set({ failing: true });

  await expect(page.getByTestId("status-bar")).toContainText("Server-Verwaltung antwortet nicht", {
    timeout: 5000
  });

  await fake.set({ failing: false });
  await expect(page.getByTestId("status-bar")).toHaveAttribute("data-state", "running", { timeout: 5000 });
});
