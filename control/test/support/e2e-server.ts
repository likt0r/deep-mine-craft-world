// Startet für Playwright Fake-BSM (Port 3901) und App (Port 3900) mit fester Fixture.
// Tests setzen den Zustand über http://127.0.0.1:3901/__fake/… zurück und steuern ihn.
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { startApp } from "./app";
import { startFakeBsm } from "./fake-bsm";
import { createServerFixture } from "./fixture";

export const E2E_APP_PORT = 3900;
export const E2E_FAKE_PORT = 3901;

const root = join(fileURLToPath(new URL("../../.data/e2e", import.meta.url)));
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
