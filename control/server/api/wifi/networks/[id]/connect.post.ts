export default defineEventHandler((event) =>
  withWifi(async () => {
    const name = await savedProfile(Number(getRouterParam(event, "id")));
    if (!name) throw createError({ statusCode: 404, message: "Kein hinterlegtes WLAN" });
    // Klappt das Verbinden nicht, holt NetworkManager das eigene WLAN zurück.
    connectSavedNetwork(name);
    return { ok: true };
  })
);
