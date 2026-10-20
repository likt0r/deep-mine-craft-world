// Startet für Playwright Fake-BSM und App mit fester Fixture (Ports siehe test/e2e/ports.ts).
// Tests setzen den Zustand über das Fake-BSM (/__fake/…) zurück und steuern ihn.
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_APP_PORT, E2E_FAKE_PORT } from "../e2e/ports";
import { startApp } from "./app";
import { startFakeBsm } from "./fake-bsm";
import { createServerFixture } from "./fixture";

const root = join(fileURLToPath(new URL(`../../.data/e2e-${E2E_APP_PORT}`, import.meta.url)));
const fixture = createServerFixture(root);
const fake = await startFakeBsm(fixture, E2E_FAKE_PORT);
const app = await startApp(fake, fixture, E2E_APP_PORT);

async function shutdown() {
  await app.close();
  await fake.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
