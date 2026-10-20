import type { FakeCall, FakeState } from "../support/fake-bsm";
import { E2E_FAKE_PORT } from "./ports";

const FAKE_URL = `http://127.0.0.1:${E2E_FAKE_PORT}`;

/** Steuert das Fake-BSM hinter der laufenden App aus Playwright-Tests heraus. */
export const fake = {
  reset: () => fetch(`${FAKE_URL}/__fake/reset`, { method: "POST" }),
  /** Legt eine Welt direkt auf einen Platz. Vorher einmal /api/places abrufen, sonst fehlt „Pandaland“. */
  seedPlace: (place: number, world: Partial<WorldInfo> & { folder: string }) =>
    fetch(`${FAKE_URL}/__fake/seed-place`, { method: "POST", body: JSON.stringify({ place, world }) }),
  set: (state: Partial<FakeState>) =>
    fetch(`${FAKE_URL}/__fake/state`, { method: "POST", body: JSON.stringify(state) }),
  get: async () =>
    (await (await fetch(`${FAKE_URL}/__fake/state`)).json()) as FakeState & { calls: FakeCall[] },
  /** Bisher gesendete Konsolenbefehle, in Reihenfolge. */
  commands: async () =>
    (await fake.get()).calls
      .filter((c) => c.path.endsWith("/send_command"))
      .map((c) => (c.body as { command: string }).command)
};
