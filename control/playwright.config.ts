import { defineConfig, devices } from "@playwright/test";

// Alle Tests teilen sich ein Fake-BSM, deshalb nacheinander.
export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3900",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "handy", use: { ...devices["Pixel 7"] } },
    { name: "tablet", use: { ...devices["iPad Mini"], browserName: "chromium" } }
  ],
  webServer: {
    command: "tsx test/support/e2e-server.ts",
    url: "http://127.0.0.1:3900",
    reuseExistingServer: false,
    timeout: 30_000
  }
});
