import type { FakeCall, FakeState } from "../support/fake-bsm";

const FAKE_URL = "http://127.0.0.1:3901";

/** Steuert das Fake-BSM hinter der laufenden App aus Playwright-Tests heraus. */
export const fake = {
  reset: () => fetch(`${FAKE_URL}/__fake/reset`, { method: "POST" }),
  set: (state: Partial<FakeState>) =>
    fetch(`${FAKE_URL}/__fake/state`, { method: "POST", body: JSON.stringify(state) }),
  get: async () =>
    (await (await fetch(`${FAKE_URL}/__fake/state`)).json()) as FakeState & { calls: FakeCall[] }
};
