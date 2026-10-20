/** Übersetzungen der Werte aus `server.properties` für die Anzeige. Unbekannte Werte bleiben stehen. */

const GAME_MODES: Record<string, string> = {
  survival: "Überleben",
  creative: "Kreativ",
  adventure: "Abenteuer"
};

const WORLD_TYPES: Record<string, string> = {
  normal: "Normal",
  flach: "Flach"
};

export function gameModeLabel(mode: string): string {
  return GAME_MODES[mode] ?? mode;
}

export function worldTypeLabel(type: string): string {
  return WORLD_TYPES[type] ?? type;
}
