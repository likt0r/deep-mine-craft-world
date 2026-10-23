export default defineEventHandler(() => {
  // Ein Weltvorgang startet den Server gleich neu, ein Stopp käme dazwischen.
  if (isWorldOperationRunning())
    throw createError({ statusCode: 409, message: "Gerade läuft ein Weltvorgang" });

  // BSM antwortet erst, wenn der Server aus ist. Die Seite sieht den Fortschritt über den Status.
  bsm.stop().catch((error) => console.error("Stoppen fehlgeschlagen:", error));
  return { ok: true };
});
