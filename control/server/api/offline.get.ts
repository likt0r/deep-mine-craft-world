/** Offline-Modus: Spieler müssen nicht bei Xbox Live angemeldet sein (`online-mode=false`). */
export default defineEventHandler(async (): Promise<{ offline: boolean }> => ({
  offline: (await bsm.getProperties())["online-mode"] === "false"
}));
