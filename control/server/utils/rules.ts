import { open, stat } from "node:fs/promises";
import { join } from "node:path";

// BSM liefert keine Befehlsausgabe. Deshalb wird `gamerule` ohne Argumente geschickt und
// in der Server-Ausgabedatei nach den neu angehängten Zeilen gesucht.
// Nach einem Neustart meldet BSM „läuft“, sobald der Prozess da ist. Bedrock lädt dann noch
// mehrere Sekunden und arbeitet Befehle erst danach ab, deshalb lange warten (rulesWaitMs).
const POLL_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function outputFile(): string {
  return join(useRuntimeConfig().bsmServerDir, "server_output.txt");
}

/** Wo die Datei gerade endet. Der Inode zeigt, ob sie seitdem neu angelegt wurde. */
interface Position {
  ino: number;
  size: number;
}

async function endOfFile(): Promise<Position> {
  try {
    const { ino, size } = await stat(outputFile());
    return { ino, size };
  } catch {
    return { ino: -1, size: 0 };
  }
}

/**
 * Der Text, der seit `since` an die Ausgabedatei angehängt wurde. Liest nur das Ende.
 * Hat der Server die Datei inzwischen neu begonnen (Neustart), wird sie ganz gelesen.
 */
async function appendedText(since: Position): Promise<string> {
  try {
    const file = await open(outputFile());
    try {
      const { ino, size } = await file.stat();
      const offset = ino === since.ino && size >= since.size ? since.size : 0;
      if (size === offset) return "";
      const buffer = Buffer.alloc(size - offset);
      await file.read(buffer, 0, buffer.length, offset);
      return buffer.toString("utf8");
    } finally {
      await file.close();
    }
  } catch {
    return "";
  }
}

/** Wertet `gamerule`-Ausgabe aus, z. B. „doDayLightCycle = true, keepInventory = false“. */
function parseGameruleOutput(text: string): Partial<Rules> {
  const found: Partial<Rules> = {};
  for (const [, name, value] of text.matchAll(/\b(\w+) = (true|false)/g)) {
    const rule = (name ?? "").toLowerCase();
    if ((RULE_NAMES as readonly string[]).includes(rule)) found[rule as RuleName] = value === "true";
  }
  return found;
}

function emptyRules(): Rules {
  return Object.fromEntries(RULE_NAMES.map((name) => [name, null])) as Rules;
}

/** Liest die acht Regeln der aktiven Welt. Was nicht gelesen werden kann, bleibt `null`. */
export async function readRules(): Promise<Rules> {
  const unknown = emptyRules();
  const since = await endOfFile();

  try {
    await bsm.sendCommand("gamerule");
  } catch {
    // Server aus oder BSM nicht erreichbar: lieber „unbekannt“ als einen Fehler.
    return unknown;
  }

  const rounds = Math.ceil(Number(useRuntimeConfig().rulesWaitMs) / POLL_MS);
  for (let round = 0; round < rounds; round++) {
    const found = parseGameruleOutput(await appendedText(since));
    if (Object.keys(found).length > 0) return { ...unknown, ...found };
    await sleep(POLL_MS);
  }
  return unknown;
}
