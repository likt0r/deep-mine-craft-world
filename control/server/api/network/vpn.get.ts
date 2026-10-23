export default defineEventHandler((): Promise<VpnInfo> => withWifi(readVpn));
