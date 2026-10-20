/** Eine Welt auf einem Platz, wie Deep Mine Control sie kennt. */
export interface WorldInfo {
  /** Anzeigename der Welt, nur Deep Mine Control kennt ihn. */
  name: string;
  /** Weltordner unter `worlds/`, so wie `level-name` ihn nennt. */
  folder: string;
  /** Welttyp: normal oder flach. */
  type: "normal" | "flach";
  /** Spielmodus, wie `server.properties` ihn speichert, z. B. creative. */
  mode: string;
  /** Schwierigkeit, wie `server.properties` sie speichert, z. B. normal. */
  difficulty: string;
  /** Anlagedatum der Welt als ISO-Zeitstempel. */
  createdAt: string;
}

/** Einer von 10 festen Plätzen: leer oder mit einer Welt. */
export interface Place {
  place: number;
  world: WorldInfo | null;
  /** Die Welt liegt auf der aktiven Welt (Ordner = aktuelles `level-name`). */
  active: boolean;
}

export interface PlacesResponse {
  places: Place[];
}
