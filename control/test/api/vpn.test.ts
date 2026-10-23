import { existsSync, readdirSync, readFileSync } from "node:fs";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";
import { PRIVATE_KEY, wireguardConfig } from "../support/wireguard";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

const nm = () => JSON.parse(readFileSync(h.fixture.nmcliState, "utf8"));
const vpnProfile = () => nm().connections.find((c: { name: string }) => c.name === "dmc-vpn");
const upload = (config: string, autoconnect = true) =>
  h.request("/api/network/vpn", { method: "PUT", body: { config, autoconnect } });

describe("VPN", () => {
  it("ohne Konfiguration: nicht eingerichtet", async () => {
    const res = await h.request("/api/network/vpn");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ configured: false, active: false });
  });

  it("Hochladen importiert über nmcli, verbindet und zeigt die Angaben ohne Schlüssel", async () => {
    const res = await upload(wireguardConfig());

    expect(res.status).toBe(200);
    expect(vpnProfile()).toMatchObject({ mode: "wireguard", autoconnect: "yes" });
    await expect.poll(() => vpnProfile().up).toBe(true);

    const info = await h.request("/api/network/vpn");
    expect(info.body).toEqual({
      configured: true,
      active: true,
      autoconnect: true,
      address: ["10.8.0.2/24"],
      endpoints: ["vpn.example.org:51820"],
      dns: ["10.8.0.1"],
      allowsAll: false,
      routeAll: false
    });
    expect(JSON.stringify(info.body)).not.toContain(PRIVATE_KEY);
  });

  it("die Datei mit dem privaten Schlüssel bleibt nicht liegen, auch nicht in den Angaben", async () => {
    await upload(wireguardConfig());

    expect(readdirSync(h.fixture.dataDir).filter((f) => f.endsWith(".conf"))).toEqual([]);
    expect(readFileSync(`${h.fixture.dataDir}/vpn.json`, "utf8")).not.toContain(PRIVATE_KEY);
  });

  it("VPN-Routen haben weniger Vorrang als das Kabel", async () => {
    await upload(wireguardConfig());

    expect(vpnProfile()).toMatchObject({ metric4: "1000", metric6: "1000" });
  });

  it("erlaubt die Konfiguration allen Verkehr, geht das Internet trotzdem standardmäßig direkt", async () => {
    await upload(wireguardConfig("0.0.0.0/0, ::/0"));

    expect(vpnProfile()).toMatchObject({ neverDefault4: "yes", neverDefault6: "yes" });
    expect((await h.request("/api/network/vpn")).body).toMatchObject({ allowsAll: true, routeAll: false });
  });

  it("Internetverkehr durchs VPN lässt sich einschalten; die Verbindung wird neu aufgebaut", async () => {
    await upload(wireguardConfig("0.0.0.0/0"));
    await expect.poll(() => vpnProfile().up).toBe(true);
    const ups = () =>
      readFileSync(`${h.fixture.nmcliState}.calls`, "utf8")
        .split("\n")
        .filter((l) => l === JSON.stringify(["connection", "up", "dmc-vpn"])).length;
    const before = ups();

    const res = await h.request("/api/network/vpn/route-all", { method: "PUT", body: { enabled: true } });

    expect(res.status).toBe(200);
    expect(vpnProfile()).toMatchObject({ neverDefault4: "no", neverDefault6: "no" });
    expect((await h.request("/api/network/vpn")).body.routeAll).toBe(true);
    await expect.poll(ups).toBe(before + 1);
  });

  it("ein neuer Upload ersetzt die alte Konfiguration", async () => {
    await upload(wireguardConfig());
    await upload(wireguardConfig("0.0.0.0/0"), false);

    expect(nm().connections.filter((c: { name: string }) => c.name === "dmc-vpn")).toHaveLength(1);
    expect((await h.request("/api/network/vpn")).body).toMatchObject({ autoconnect: false, allowsAll: true });
  });

  it.each([
    ["kein Interface", wireguardConfig().replace("[Interface]", "")],
    ["kaputter Schlüssel", wireguardConfig().replace(/PrivateKey = .*/, "PrivateKey = abc")],
    ["ohne Peer", wireguardConfig().split("[Peer]")[0]!],
    ["ohne Endpoint", wireguardConfig().replace(/Endpoint = .*\n/, "")],
    ["PostUp-Skript", wireguardConfig().replace("DNS = 10.8.0.1", "DNS = 10.8.0.1\nPostUp = rm -rf /")],
    ["zu groß", wireguardConfig() + "#".repeat(17_000)],
    ["keine WireGuard-Datei", "Hallo Welt"]
  ])("lehnt %s mit 400 ab und importiert nichts", async (_, config) => {
    const res = await upload(config);

    expect(res.status).toBe(400);
    expect(existsSync(h.fixture.nmcliState) ? vpnProfile() : undefined).toBeUndefined();
  });

  it("trennen, verbinden, „beim Start verbinden“ und entfernen", async () => {
    await upload(wireguardConfig());
    await expect.poll(() => vpnProfile().up).toBe(true);

    await h.request("/api/network/vpn/connect", { method: "POST", body: { active: false } });
    await expect.poll(() => vpnProfile().up).toBe(false);
    expect((await h.request("/api/network/vpn")).body.active).toBe(false);

    await h.request("/api/network/vpn/autoconnect", { method: "PUT", body: { enabled: false } });
    expect(vpnProfile().autoconnect).toBe("no");

    expect((await h.request("/api/network/vpn", { method: "DELETE" })).status).toBe(200);
    expect(vpnProfile()).toBeUndefined();
    expect(existsSync(`${h.fixture.dataDir}/vpn.json`)).toBe(false);
  });

  it("ohne VPN: verbinden und entfernen ergeben 404", async () => {
    expect(
      (await h.request("/api/network/vpn/connect", { method: "POST", body: { active: true } })).status
    ).toBe(404);
    expect((await h.request("/api/network/vpn", { method: "DELETE" })).status).toBe(404);
  });

  it("das WLAN zeigt das VPN nicht als hinterlegtes WLAN", async () => {
    await upload(wireguardConfig());

    const wifi = await h.request("/api/wifi");
    expect(wifi.body.saved).toEqual([]);
    expect(wifi.body.mode).toBe("ap");
  });
});
