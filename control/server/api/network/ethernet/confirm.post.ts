export default defineEventHandler(async () => {
  const { change } = await readEthernet();
  if (change?.phase !== "pending" || !change.id)
    throw createError({ statusCode: 409, message: "Es gibt nichts zu bestätigen" });
  await confirmEthernet(change.id);
  return { ok: true };
});
