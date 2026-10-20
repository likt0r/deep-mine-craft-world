import { open, stat } from "node:fs/promises";
import { join } from "node:path";

// BSM liefert keine Befehlsausgabe. Deshalb wird `gamerule` ohne Argumente geschickt und
// in der Server-Ausgabedatei nach den neu angehängten Zeilen gesucht.
const POLL_ROUNDS = 10;
const POLL_MS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function outputFile(): string {
  return join(useRuntimeConfig().bsmServerDir, "server_output.txt");
}

async function fileSize(): Promise<number> {
  try {
    return (await stat(outputFile())).size;
  } catch {
    return 0;
  }
}

/** Der Text, der seit `offset` Bytes an die Ausgabedatei angehängt wurde. Liest nur das Ende. */
async function appendedText(offset: number): Promise<string> {
  try {
    const file = await open(outputFile());
    try {
      const { size } = await file.stat();
      if (size <= offset) return "";
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
  const offset = await fileSize();

  try {
    await bsm.sendCommand("gamerule");
  } catch {
    // Server aus oder BSM nicht erreichbar: lieber „unbekannt“ als einen Fehler.
    return unknown;
  }

  for (let round = 0; round < POLL_ROUNDS; round++) {
    const found = parseGameruleOutput(await appendedText(offset));
    if (Object.keys(found).length > 0) return { ...unknown, ...found };
    await sleep(POLL_MS);
  }
  return unknown;
}
