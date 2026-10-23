import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initialState } from "../support/fake-nmcli-state.mjs";

/**
 * Der WLAN-Wächter server/wifi-check.sh gegen Fake-nmcli, -iw und -ip. Jeder Lauf ist eine Minute
 * des Timers; die 3 Minuten bis zum Rettungsmodus stellt der Test über die Zeitmarke nach.
 */
const script = fileURLToPath(new URL("../../../server/wifi-check.sh", import.meta.url));
const fakeNmcli = fileURLToPath(new URL("../support/fake-nmcli.mjs", import.meta.url));
const fakeIp = fileURLToPath(new URL("../support/fake-ip.mjs", import.meta.url));

type NmState = ReturnType<typeof initialState>;
let dir: string;
const file = (name: string) => join(dir, name);
const nm = (): NmState => JSON.parse(readFileSync(file("nm.json"), "utf8"));
const setNm = (change: (state: NmState) => void) => {
  const state = existsSync(file("nm.json")) ? nm() : initialState();
  change(state);
  writeFileSync(file("nm.json"), JSON.stringify(state));
};
const setEnabled = (enabled: boolean) => writeFileSync(file("wifi.json"), JSON.stringify({ enabled }));
const calls = (): string[] =>
  existsSync(file("nm.json.calls"))
    ? readFileSync(file("nm.json.calls"), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l).join(" "))
    : [];
const rescue = () => existsSync(file("run/deep-mine-wifi-rescue"));
/** Tut so, als sei der Server schon seit `seconds` ohne Netz. */
const offlineFor = (seconds: number) =>
  writeFileSync(file("run/deep-mine-wifi-offline-since"), String(Math.floor(Date.now() / 1000) - seconds));

function tick() {
  const result = spawnSync("bash", [script], {
    env: {
      ...process.env,
      NMCLI: fakeNmcli,
      IW: fakeNmcli,
      IP: fakeIp,
      FAKE_NMCLI_STATE: file("nm.json"),
      WIFI_SETTINGS: file("wifi.json"),
      RUN_DIR: file("run"),
      SETTLE_SECONDS: "0"
    },
    encoding: "utf8"
  });
  expect(result.status, result.stderr).toBe(0);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dmc-wifi-check-"));
  mkdirSync(file("run"));
  setNm(() => {});
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("WLAN ausgeschaltet", () => {
  it("mit Kabel: der Funk geht aus und bleibt aus", () => {
    setEnabled(false);

    tick();
    expect(nm().radio).toBe(false);
    tick();
    expect(nm().radio).toBe(false);
    expect(rescue()).toBe(false);
  });

  it("ohne Netz: erst nach 3 Minuten Rettungsmodus, dann eigenes WLAN", () => {
    setEnabled(false);
    setNm((s) => {
      s.radio = false;
      s.active = null;
      s.wired = false;
    });

    tick();
    tick();
    expect(nm().radio).toBe(false);

    offlineFor(170);
    tick();
    expect(nm().radio).toBe(false);

    offlineFor(181);
    tick();
    expect(rescue()).toBe(true);
    expect(nm().radio).toBe(true);
    expect(nm().active).toBe("dmc-ap");
  });

  it("Rettungsmodus mit hinterlegtem WLAN: dessen Verbindung zählt nicht als Kabel, kein Hin und Her", () => {
    setEnabled(false);
    setNm((s) => {
      s.connections.push({ name: "dmc-wlan-1", ssid: "Zuhause", psk: "geheim123", mode: "infrastructure" });
      s.radio = false;
      s.active = null;
      s.wired = false;
    });
    offlineFor(200);

    tick();
    expect(nm().active).toBe("dmc-wlan-1");
    tick();
    tick();
    expect(nm().radio).toBe(true);
    expect(rescue()).toBe(true);
  });

  it("Kabel zurück, aber jemand hängt am eigenen WLAN: es bleibt an, bis niemand mehr dran ist", () => {
    setEnabled(false);
    setNm((s) => {
      s.wired = false;
    });
    offlineFor(200);
    tick();
    expect(rescue()).toBe(true);

    setNm((s) => {
      s.wired = true;
      s.stations = 2;
    });
    tick();
    expect(nm().radio).toBe(true);

    setNm((s) => {
      s.stations = 0;
    });
    tick();
    expect(nm().radio).toBe(false);
    expect(rescue()).toBe(false);
  });
});

describe("WLAN eingeschaltet", () => {
  it("ist der Funk aus, geht er an; Reste des Rettungsmodus verschwinden", () => {
    setEnabled(true);
    setNm((s) => {
      s.radio = false;
      s.active = null;
    });
    writeFileSync(file("run/deep-mine-wifi-rescue"), "");

    tick();

    expect(nm().radio).toBe(true);
    expect(rescue()).toBe(false);
  });

  it("ohne Einstellungsdatei gilt „an“, auch ohne Kabel", () => {
    setNm((s) => {
      s.wired = false;
    });

    tick();

    expect(nm().radio).toBe(true);
    expect(calls()).not.toContain("radio wifi off");
  });

  it("eigenes WLAN, hinterlegtes WLAN vorhanden, niemand verbunden: kurz herunter zum Zurückwechseln", () => {
    setNm((s) => {
      s.connections.push({ name: "dmc-wlan-1", ssid: "Zuhause", psk: "geheim123", mode: "infrastructure" });
      s.stations = 0;
    });

    tick();

    expect(calls()).toContain("connection down dmc-ap");
  });

  it("hängt jemand am eigenen WLAN, bleibt es oben", () => {
    setNm((s) => {
      s.connections.push({ name: "dmc-wlan-1", ssid: "Zuhause", psk: "geheim123", mode: "infrastructure" });
      s.stations = 1;
    });

    tick();

    expect(calls()).not.toContain("connection down dmc-ap");
  });
});
