export default defineEventHandler(() =>
  withWifi(async () => {
    if (!(await vpnConfigured())) throw createError({ statusCode: 404, message: "Kein VPN eingerichtet" });
    await deleteVpn();
    return { ok: true };
  })
);
