export default defineEventHandler(() => {
  // Mitten im Weltwechsel nicht, sonst stimmen Properties und Plätze danach nicht überein.
  if (isWorldOperationRunning())
    throw createError({ statusCode: 409, message: "Gerade läuft ein Weltvorgang" });

  schedulePower("reboot");
  return { ok: true };
});
