/**
 * Aktualisiert Deep Mine Control auf die neueste Version: schreibt die Anfrage für den root-Helfer
 * deep-mine-update, der lädt, prüft, installiert und bei Bedarf zurücksetzt. Deep Mine Control startet dabei neu.
 * Nur wenn es eine neuere Version gibt und kein Update und kein Weltvorgang läuft (sonst 409), denn der Neustart
 * würde ihn abbrechen. Eine bestimmte Version lässt sich nicht wählen.
 */
export default defineEventHandler(async () => {
  await ensureChecked();
  const { control } = await readUpdates();
  if (!control.available || !control.latest)
    throw createError({ statusCode: 409, message: "Kein Update verfügbar" });
  if (await updatingNow()) throw createError({ statusCode: 409, message: "Es läuft schon ein Update" });
  if (isWorldOperationRunning())
    throw createError({ statusCode: 409, message: "Gerade läuft ein Weltvorgang" });

  const id = await requestControlUpdate(control.latest);
  return { id, version: control.latest };
});
