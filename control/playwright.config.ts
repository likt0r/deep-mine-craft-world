import { defineConfig, devices } from "@playwright/test";

import { E2E_APP_PORT } from "./test/e2e/ports";

// Alle Tests teilen sich ein Fake-BSM, deshalb nacheinander.
export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${E2E_APP_PORT}`,
    trace: "retain-on-failure"
  },
  projects: [
    { name: "handy", use: { ...devices["Pixel 7"] } },
    { name: "tablet", use: { ...devices["iPad Mini"], browserName: "chromium" } }
  ],
  webServer: {
    command: "tsx test/support/e2e-server.ts",
    url: `http://127.0.0.1:${E2E_APP_PORT}`,
    reuseExistingServer: false,
    timeout: 30_000
  }
});
