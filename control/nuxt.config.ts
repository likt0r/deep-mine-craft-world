// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui"],

  // Alle Werte lassen sich per NUXT_<NAME> überschreiben, z. B. NUXT_BSM_URL.
  runtimeConfig: {
    bsmUrl: "http://127.0.0.1:11325",
    bsmUser: "deep-mine-control",
    bsmPassword: "",
    bsmServer: "Bedrock",
    bsmServerDir: "/var/lib/bsm/data/servers/Bedrock",
    bsmBackupDir: "/var/lib/bsm/data/backups/Bedrock",
    dataDir: "/var/lib/bsm/deep-mine-control",
    /** Versionsdatei aus dem Paket (packaging/build-deb.sh). Fehlt sie, meldet der Status „dev“. */
    versionFile: "/usr/lib/deep-mine-control/app/version.json",
    /** Für den Bereich System. Tests legen eigene Dateien unter. */
    procDir: "/proc",
    sysDir: "/sys",
    /** `smartctl --json -x` der Systemplatte, geschrieben vom Timer deep-mine-smart (Paket) */
    smartFile: "/var/lib/bsm/deep-mine-control/smart.json",
    /** Rechner neu starten und ausschalten. Darf `bsm` per polkit (Paket). Tests setzen harmlose Befehle. */
    rebootCommand: "systemctl reboot",
    poweroffCommand: "systemctl poweroff",
    /** WLAN über NetworkManager (Paket). Tests setzen ein Fake-nmcli. */
    nmcliPath: "nmcli",
    iwPath: "iw",
    wifiDevice: "wlp3s0",
    /** WLAN an/aus (Deep Mine Control schreibt, der Wächter deep-mine-wifi-check liest) */
    wifiSettingsFile: "/var/lib/bsm/deep-mine-control/wifi.json",
    /** Legt der Wächter an, solange der Rettungsmodus das WLAN eingeschaltet hat */
    wifiRescueFile: "/run/deep-mine-wifi-rescue",
    /** Ethernet (System → Netzwerk). Ändern tut der root-Helfer deep-mine-ethernet. */
    ethernetDevice: "enp1s0",
    ipPath: "ip",
    resolvectlPath: "resolvectl",
    /** Zum Entpacken von Backups (python3 -m zipfile) */
    pythonPath: "python3",
    /** Höchstens so groß darf eine Welt ausgepackt sein (Schutz vor ZIP-Bomben, 4 GB). */
    worldMaxBytes: 4 * 1024 ** 3,
    /** Download-Links von Mojang. Daraus kommt die neueste Version des Minecraft-Servers (Linux). */
    mojangLinksUrl: "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links",
    /** GitHub-API und Repo: Das neueste Release mit Paket ist die neueste Version von Deep Mine Control. */
    githubApi: "https://api.github.com",
    updateRepo: "likt0r/deep-mine-craft-world",
    /** Länge einer Countdown-Sekunde beim Weltwechsel. Tests setzen 0. */
    countdownStepMs: 1000,
    /** So lange wartet das Auslesen der Spielregeln auf die Ausgabe von `gamerule`. */
    rulesWaitMs: 15000
  },

  // Der Unterbereich hieß früher WLAN.
  routeRules: {
    "/system/wlan": { redirect: "/system/netzwerk" }
  },

  devtools: { enabled: true },

  css: ["~/assets/css/main.css"],

  colorMode: {
    preference: "dark",
    fallback: "dark"
  },

  // Die Seite ist offline im LAN: keine Icons vom CDN nachladen.
  icon: {
    serverBundle: "local",
    clientBundle: { scan: true }
  },

  // Nuxt UI lädt sonst Schriften von Google Fonts.
  fonts: { providers: { google: false, googleicons: false } },

  compatibilityDate: "2026-10-01"
});
