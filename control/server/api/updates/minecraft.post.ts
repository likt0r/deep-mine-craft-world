/**
 * Aktualisiert den Minecraft-Server auf die neueste Version, im Hintergrund als Weltvorgang.
 * Nur wenn es eine neuere Version gibt (sonst 409) und kein anderer Weltvorgang läuft (sonst 409).
 * Eine bestimmte Version lässt sich nicht wählen: BSM installiert immer die neueste.
 */
export default defineEventHandler(async () => {
  await ensureChecked();
  const { minecraft } = await readUpdates();
  if (!minecraft.available || !minecraft.latest)
    throw createError({ statusCode: 409, message: "Kein Update verfügbar" });
  if ((await updatingNow()) === "control")
    throw createError({ statusCode: 409, message: "Deep Mine Control wird gerade aktualisiert" });

  const version = minecraft.latest;
  startWorldOperation(null, () => updateMinecraft(version));
  return { ok: true };
});
