/** Sichert die aktive Welt. BSM kann nur die aktive Welt sichern. Antwortet, wenn das Backup fertig ist. */
export default defineEventHandler(() =>
  runWorldOperation(async () => {
    const { task_id } = await bsm.backupWorld();
    await waitForTask(task_id);
    return { ok: true };
  })
);
