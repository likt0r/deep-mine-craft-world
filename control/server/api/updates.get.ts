/** Installierte und neueste Versionen. Geprüft wird beim ersten Abruf und danach höchstens stündlich. */
export default defineEventHandler(async (): Promise<UpdatesInfo> => {
  await ensureChecked();
  return readUpdates();
});
