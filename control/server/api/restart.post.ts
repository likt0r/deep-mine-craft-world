export default defineEventHandler(() => {
  // Während eines Weltvorgangs startet der Server ohnehin neu, ein zweiter Neustart käme dazwischen.
  if (isWorldOperationRunning())
    throw createError({ statusCode: 409, message: "Gerade läuft ein Weltvorgang" });

  // BSM antwortet erst, wenn der Server wieder läuft. Die Seite sieht den Fortschritt über den Status.
  bsm.restart().catch((error) => console.error("Neustart fehlgeschlagen:", error));
  return { ok: true };
});
