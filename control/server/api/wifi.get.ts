export default defineEventHandler((): Promise<WifiInfo> => withWifi(readWifi));
