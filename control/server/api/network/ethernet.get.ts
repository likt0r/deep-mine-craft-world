export default defineEventHandler((): Promise<EthernetInfo> => readEthernet());
