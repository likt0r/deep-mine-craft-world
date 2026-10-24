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

const DIFFICULTIES: Record<string, string> = {
  peaceful: "Friedlich",
  easy: "Leicht",
  normal: "Normal",
  hard: "Schwer"
};

export function gameModeLabel(mode: string): string {
  return GAME_MODES[mode] ?? mode;
}

export function worldTypeLabel(type: string): string {
  return WORLD_TYPES[type] ?? type;
}

export function difficultyLabel(difficulty: string): string {
  return DIFFICULTIES[difficulty] ?? difficulty;
}

const SWITCH_PHASES: Record<WorldSwitch["phase"], string> = {
  countdown: "Countdown im Spiel",
  backup: "Alte Welt wird gesichert",
  restart: "Server startet neu"
};

export function switchPhaseLabel(phase: WorldSwitch["phase"]): string {
  return SWITCH_PHASES[phase];
}

const UPDATING: Record<UpdateKind, string> = {
  minecraft: "Minecraft wird aktualisiert",
  control: "Deep Mine Control wird aktualisiert"
};

export function updatingLabel(kind: UpdateKind): string {
  return UPDATING[kind];
}

const UPDATE_PHASES: Record<UpdateRun["phase"], string> = {
  countdown: "Countdown im Spiel",
  updating: "BSM sichert, installiert und startet neu",
  failed: "Fehlgeschlagen"
};

export function updatePhaseLabel(phase: UpdateRun["phase"]): string {
  return UPDATE_PHASES[phase];
}
