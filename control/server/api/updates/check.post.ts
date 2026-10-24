/** „Jetzt prüfen“: fragt sofort nach der neuesten Version. */
export default defineEventHandler(async (): Promise<UpdatesInfo> => {
  await checkNow();
  return readUpdates();
});
