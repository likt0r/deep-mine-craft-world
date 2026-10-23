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
    /** Für den Bereich System. Tests legen eigene Dateien unter. */
    procDir: "/proc",
    sysDir: "/sys",
    /** `smartctl --json -x` der Systemplatte, geschrieben vom Timer deep-mine-smart (install.sh) */
    smartFile: "/var/lib/bsm/deep-mine-control/smart.json",
    /** Rechner neu starten und ausschalten. Darf `bsm` per polkit (install.sh). Tests setzen harmlose Befehle. */
    rebootCommand: "systemctl reboot",
    poweroffCommand: "systemctl poweroff",
    /** WLAN über NetworkManager (install.sh). Tests setzen ein Fake-nmcli. */
    nmcliPath: "nmcli",
    iwPath: "iw",
    wifiDevice: "wlp3s0",
    /** Länge einer Countdown-Sekunde beim Weltwechsel. Tests setzen 0. */
    countdownStepMs: 1000,
    /** So lange wartet das Auslesen der Spielregeln auf die Ausgabe von `gamerule`. */
    rulesWaitMs: 15000
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
