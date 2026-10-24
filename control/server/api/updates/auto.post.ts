/**
 * Autoupdate-Lauf, aufgerufen stündlich von der systemd-Unit deep-mine-update-check. Startet ein Update nur,
 * wenn niemand spielt, und antwortet sofort (das Update läuft im Hintergrund weiter).
 */
export default defineEventHandler((): Promise<AutoUpdateResult> => runAutoUpdate());
