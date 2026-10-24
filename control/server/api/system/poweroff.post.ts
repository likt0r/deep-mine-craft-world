export default defineEventHandler(async () => {
  // Mitten im Weltwechsel nicht, sonst stimmen Properties und Plätze danach nicht überein.
  if (isWorldOperationRunning())
    throw createError({ statusCode: 409, message: "Gerade läuft ein Weltvorgang" });
  // Und nicht, während apt Deep Mine Control installiert.
  if ((await updatingNow()) === "control")
    throw createError({ statusCode: 409, message: "Deep Mine Control wird gerade aktualisiert" });

  schedulePower("poweroff");
  return { ok: true };
});
