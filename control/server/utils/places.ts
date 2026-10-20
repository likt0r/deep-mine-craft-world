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
