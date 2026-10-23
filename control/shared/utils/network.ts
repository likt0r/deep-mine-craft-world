/** Prüfregeln für IPv4-Einstellungen (Seite und API; der root-Helfer prüft noch einmal selbst). */

export function isIPv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((p) => /^(0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255);
}

const toNumber = (ip: string) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);

/** Liegt das Gateway im Netz der Adresse, und sind Adresse und Gateway weder Netz- noch Broadcast-Adresse? */
export function isValidStaticIPv4(address: string, prefix: number, gateway: string): boolean {
  if (!isIPv4(address) || !isIPv4(gateway) || !Number.isInteger(prefix) || prefix < 8 || prefix > 30)
    return false;
  const size = 2 ** (32 - prefix);
  const net = Math.floor(toNumber(address) / size);
  const host = toNumber(address) % size;
  const gwHost = toNumber(gateway) % size;
  return (
    Math.floor(toNumber(gateway) / size) === net &&
    host !== 0 &&
    host !== size - 1 &&
    gwHost !== 0 &&
    gwHost !== size - 1 &&
    address !== gateway
  );
}
