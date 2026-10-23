/** Sichert die aktive Welt. Antwortet, wenn das Backup fertig ist. */
export default defineEventHandler(() =>
  runWorldOperation(async () => {
    await backupActiveWorld();
    return { ok: true };
  })
);
