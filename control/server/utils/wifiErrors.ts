/** Fehlt NetworkManager oder antwortet nmcli nicht, sagt die API das als 503, statt mit 500 abzubrechen. */
export async function withWifi<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("WLAN-Verwaltung:", error);
    throw createError({ statusCode: 503, message: "WLAN-Verwaltung antwortet nicht" });
  }
}
