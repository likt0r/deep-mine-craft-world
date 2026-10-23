import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Der root-Helfer server/ethernet.py gegen nachgebaute netplan, systemd-run und systemctl
 * (Shell-Skripte, die ihre Aufrufe mitschreiben) und das Fake-ip.
 */
const helper = fileURLToPath(new URL("../../../server/ethernet.py", import.meta.url));
const fakeIp = fileURLToPath(new URL("../support/fake-ip.mjs", import.meta.url));

let dir: string;
const data = (name: string) => join(dir, "data", name);
const netplanFile = () => join(dir, "netplan", "60-deep-mine-ethernet.yaml");
const log = () =>
  existsSync(join(dir, "log")) ? readFileSync(join(dir, "log"), "utf8").trim().split("\n") : [];
const state = () => JSON.parse(readFileSync(data("ethernet-state.json"), "utf8"));

function fakeCommand(name: string) {
  const path = join(dir, "bin", name);
  // Schreibt den Aufruf mit; „netplan generate“ scheitert, wenn FAIL_GENERATE gesetzt ist.
  writeFileSync(
    path,
    `#!/usr/bin/env bash\necho "${name} $*" >> "${join(dir, "log")}"\n` +
      `[ "${name} $1" = "netplan generate" ] && [ -n "$FAIL_GENERATE" ] && { echo "Fehler in YAML" >&2; exit 1; }\nexit 0\n`
  );
  chmodSync(path, 0o755);
  return path;
}

function helperRun(command = "run", env: Record<string, string> = {}) {
  const result = spawnSync("python3", [helper, command], {
    env: {
      ...process.env,
      DATA_DIR: join(dir, "data"),
      NETPLAN_DIR: join(dir, "netplan"),
      NETPLAN: join(dir, "bin", "netplan"),
      SYSTEMD_RUN: join(dir, "bin", "systemd-run"),
      SYSTEMCTL: join(dir, "bin", "systemctl"),
      IP: fakeIp,
      FAKE_NMCLI_STATE: join(dir, "nm.json"),
      SELF: "/usr/local/bin/deep-mine-ethernet",
      ...env
    },
    encoding: "utf8"
  });
  expect(result.status, result.stderr).toBe(0);
}

const STATIC = {
  mode: "static",
  address: "192.168.0.50",
  prefix: 24,
  gateway: "192.168.0.1",
  dns: ["192.168.0.5"]
};
const ask = (setting: object, id = "r1") =>
  writeFileSync(data("ethernet-request.json"), JSON.stringify({ id, ...setting }));
const confirm = (id = "r1") => writeFileSync(data("ethernet-confirm.json"), JSON.stringify({ id }));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dmc-ethernet-"));
  for (const sub of ["data", "netplan", "bin"]) mkdirSync(join(dir, sub));
  for (const name of ["netplan", "systemd-run", "systemctl"]) fakeCommand(name);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("feste IP", () => {
  it("schreibt die netplan-Datei, wendet an, startet die Rücknahme und wartet auf Bestätigung", () => {
    ask(STATIC);

    helperRun();

    expect(readFileSync(netplanFile(), "utf8")).toContain(
      [
        "    enp1s0:",
        "      dhcp4: false",
        "      addresses: [192.168.0.50/24]",
        "      routes:",
        "        - to: default",
        "          via: 192.168.0.1",
        "      nameservers:",
        "        addresses: [192.168.0.5]"
      ].join("\n")
    );
    expect(log()).toEqual([
      "netplan generate",
      "systemctl stop deep-mine-ethernet-rollback.timer",
      "systemd-run --unit=deep-mine-ethernet-rollback --on-active=120 /usr/local/bin/deep-mine-ethernet rollback",
      "netplan apply"
    ]);
    expect(state()).toMatchObject({
      id: "r1",
      phase: "pending",
      setting: STATIC,
      newAddress: "192.168.0.110"
    });
    expect(existsSync(data("ethernet-request.json"))).toBe(false);
  });

  it("bestätigt: Timer weg, Einstellung bleibt", () => {
    ask(STATIC);
    helperRun();

    confirm();
    helperRun();

    expect(state().phase).toBe("confirmed");
    expect(log().at(-1)).toBe("systemctl stop deep-mine-ethernet-rollback.timer");
    expect(existsSync(netplanFile())).toBe(true);
  });

  it("eine Bestätigung mit falscher id zählt nicht", () => {
    ask(STATIC);
    helperRun();

    confirm("andere");
    helperRun();

    expect(state().phase).toBe("pending");
  });

  it("ohne Bestätigung: Rücknahme stellt den alten Stand (DHCP) wieder her", () => {
    ask(STATIC);
    helperRun();

    helperRun("rollback");

    expect(existsSync(netplanFile())).toBe(false);
    expect(state().phase).toBe("rolled-back");
    expect(log().at(-1)).toBe("netplan apply");
  });

  it("Rücknahme nach einer zweiten Änderung bringt die erste feste IP zurück", () => {
    ask(STATIC);
    helperRun();
    confirm();
    helperRun();

    ask({ ...STATIC, address: "192.168.0.60" }, "r2");
    helperRun();
    expect(readFileSync(netplanFile(), "utf8")).toContain("192.168.0.60/24");

    helperRun("rollback");
    expect(readFileSync(netplanFile(), "utf8")).toContain("192.168.0.50/24");
  });
});

describe("DHCP und Fehler", () => {
  it("DHCP löscht die eigene Datei", () => {
    ask(STATIC);
    helperRun();
    confirm();
    helperRun();

    ask({ mode: "dhcp" }, "r2");
    helperRun();

    expect(existsSync(netplanFile())).toBe(false);
    expect(state()).toMatchObject({ id: "r2", phase: "pending" });
  });

  it.each([
    [{ ...STATIC, address: "192.168.0.50\n      dhcp4: true" }],
    [{ ...STATIC, gateway: "10.0.0.1" }],
    [{ ...STATIC, prefix: "24" }],
    [{ ...STATIC, dns: ["1.1.1.1", "x"] }],
    [{ mode: "irgendwas" }]
  ])("prüft selbst noch einmal und lehnt %j ab, ohne netplan anzufassen", (setting) => {
    ask(setting);

    helperRun();

    expect(state()).toMatchObject({ id: "r1", phase: "failed" });
    expect(existsSync(netplanFile())).toBe(false);
    expect(log()).toEqual([]);
  });

  it("scheitert netplan generate, bleibt der alte Stand und nichts wird angewendet", () => {
    ask(STATIC);

    helperRun("run", { FAIL_GENERATE: "1" });

    expect(state()).toMatchObject({ phase: "failed", error: "Fehler in YAML" });
    expect(existsSync(netplanFile())).toBe(false);
    expect(log()).toEqual(["netplan generate"]);
  });

  it("solange eine Änderung offen ist, wird eine neue Anfrage verworfen", () => {
    ask(STATIC);
    helperRun();

    ask({ mode: "dhcp" }, "r2");
    helperRun();

    expect(state()).toMatchObject({ id: "r1", phase: "pending" });
    expect(existsSync(netplanFile())).toBe(true);
  });
});
