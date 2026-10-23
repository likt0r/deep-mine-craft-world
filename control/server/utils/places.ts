import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gespeicherte Welt auf einem Platz. Der Aktiv-Zustand wird pro Aufruf berechnet. */
interface StoredPlace {
  place: number;
  world: WorldInfo;
}

const ALL_PLACES = Array.from({ length: 10 }, (_, i) => i + 1);

function placesFile(): string {
  return join(useRuntimeConfig().dataDir, "places.json");
}

function readStored(): StoredPlace[] | null {
  const path = placesFile();
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as StoredPlace[];
}

function writeStored(stored: StoredPlace[]): void {
  mkdirSync(useRuntimeConfig().dataDir, { recursive: true });
  writeFileSync(placesFile(), JSON.stringify(stored, null, 2) + "\n");
}

/**
 * Fehlt die Datei, wird die laufende Welt als Platz 1 „Pandaland“ eingetragen,
 * mit Modus und Schwierigkeit aus den Properties. Kein Ordner wird umbenannt.
 */
function migrate(properties: Record<string, string>): StoredPlace[] {
  const stored: StoredPlace[] = [
    {
      place: 1,
      world: {
        name: "Pandaland",
        folder: properties["level-name"] ?? "",
        type: properties["level-type"] === "FLAT" ? "flach" : "normal",
        mode: properties["gamemode"] ?? "",
        difficulty: properties["difficulty"] ?? "",
        createdAt: new Date().toISOString()
      }
    }
  ];
  writeStored(stored);
  return stored;
}

/** Die Welt auf einem Platz, `null` wenn er leer ist. */
export function getStoredWorld(place: number): WorldInfo | null {
  return readStored()?.find((entry) => entry.place === place)?.world ?? null;
}

/** Legt eine Welt auf einen Platz oder macht ihn mit `null` frei. */
export async function setStoredWorld(place: number, world: WorldInfo | null): Promise<void> {
  const current = readStored() ?? migrate(await bsm.getProperties());
  const stored = current.filter((entry) => entry.place !== place);
  if (world) stored.push({ place, world });
  stored.sort((a, b) => a.place - b.place);
  writeStored(stored);
}

/** Prüft, ob die Nummer zu den 10 Plätzen gehört. */
export function isPlace(place: number): boolean {
  return ALL_PLACES.includes(place);
}

/**
 * Ändert nur den Anzeigename der Welt auf einem Platz: kein BSM-Aufruf, kein Neustart.
 * Liefert false, wenn der Platz leer ist oder noch keine Plätze-Datei existiert.
 */
export function renamePlace(place: number, name: string): boolean {
  const stored = readStored();
  const entry = stored?.find((item) => item.place === place);
  if (!stored || !entry) return false;
  entry.world.name = name;
  writeStored(stored);
  return true;
}

/** Die 10 Plätze. Aktiv ist die Welt, deren Ordner dem aktuellen `level-name` entspricht. */
export async function getPlaces(properties?: Record<string, string>): Promise<Place[]> {
  properties ??= await bsm.getProperties();
  const stored = readStored() ?? migrate(properties);
  const levelName = properties["level-name"] ?? "";
  return ALL_PLACES.map((place) => {
    const world = stored.find((entry) => entry.place === place)?.world ?? null;
    return { place, world, active: world !== null && world.folder === levelName };
  });
}

/** Aktualisiert Modus oder Schwierigkeit der aktiven Welt in der Plätze-Datei. */
export async function updateActiveWorld(update: Partial<Pick<WorldInfo, "mode" | "difficulty">>) {
  const properties = await bsm.getProperties();
  const levelName = properties["level-name"] ?? "";
  const stored = readStored() ?? migrate(properties);
  const placeIndex = stored.findIndex((entry) => entry.world.folder === levelName);
  if (placeIndex === -1) return;
  const current = stored[placeIndex];
  if (!current) return;
  stored[placeIndex] = {
    place: current.place,
    world: {
      ...current.world,
      ...update
    }
  };
  writeStored(stored);
}

/** Eindeutiger Ordnername mit Zeitstempel, damit er nie wiederverwendet wird. */
export function newWorldFolder(): string {
  return `world-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
