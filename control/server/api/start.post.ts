export default defineEventHandler(() => {
  // BSM antwortet erst, wenn der Server läuft. Die Seite sieht den Fortschritt über den Status.
  bsm.start().catch((error) => console.error("Start fehlgeschlagen:", error));
  return { ok: true };
});
