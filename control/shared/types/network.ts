/** Eine Ethernet-Einstellung: DHCP oder feste IPv4-Adresse. */
export type EthernetSetting =
  { mode: "dhcp" } | { mode: "static"; address: string; prefix: number; gateway: string; dns: string[] };

/** Ethernet-Anschluss des Servers (System → Netzwerk). */
export interface EthernetInfo {
  device: string;
  /** Kabel steckt und Gegenstelle ist da */
  carrier: boolean;
  /** Mbit/s, `null` ohne Kabel */
  speed: number | null;
  mac: string | null;
  /** DHCP, wenn die Adresse vom Router kommt */
  mode: "dhcp" | "static";
  address: string | null;
  prefix: number | null;
  gateway: string | null;
  dns: string[];
  /**
   * Letzte Änderung über Deep Mine Control. `requested`: der root-Helfer hat sie noch nicht übernommen;
   * `pending`: angewendet, bis `deadline` (Unix-Sekunden) bestätigen, sonst wird sie zurückgenommen.
   */
  change: {
    id: string | null;
    phase: "requested" | "pending" | "confirmed" | "rolled-back" | "failed";
    deadline: number | null;
    setting: EthernetSetting | null;
    /** IPv4-Adresse nach dem Anwenden, unter der bestätigt werden muss */
    newAddress: string | null;
    error: string | null;
  } | null;
}
