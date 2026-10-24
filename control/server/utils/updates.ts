import { z } from "zod";

// Updates prüfen und ausführen. Das Ergebnis der Prüfung liegt nur im Speicher: Es wird beim ersten Abruf
// geholt und, wenn es älter als eine Stunde ist, neu. „Jetzt prüfen“ holt es sofort.

const CHECK_MAX_AGE_MS = 60 * 60 * 1000;
/** BSM stoppt, sichert, lädt und installiert: Das dauert deutlich länger als ein Backup. */
const MINECRAFT_UPDATE_TIMEOUT_MS = 15 * 60 * 1000;

/** `1.26.60.1` > `1.26.52.3`, Stelle für Stelle als Zahl. Positiv, wenn `a` neuer ist. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const linksSchema = z.object({
  result: z.object({ links: z.array(z.object({ downloadType: z.string(), downloadUrl: z.string() })) })
});

/** Neueste Version des Minecraft-Servers für Linux, aus dem Dateinamen des Downloads (ohne Preview). */
async function fetchLatestMinecraft(): Promise<string> {
  const links = linksSchema.parse(await $fetch(useRuntimeConfig().mojangLinksUrl, { timeout: 10_000 }));
  const url = links.result.links.find((l) => l.downloadType === "serverBedrockLinux")?.downloadUrl ?? "";
  const version = url.match(/bedrock-server-(\d+(?:\.\d+)+)\.zip$/)?.[1];
  if (!version) throw new Error(`Keine Linux-Version in den Download-Links: ${url}`);
  return version;
}

interface Check {
  minecraft: string | null;
  checkedAt: string;
  error: string | null;
}

let check: Check | null = null;
/** Laufende Prüfung, damit gleichzeitige Abrufe Mojang nur einmal fragen. */
let pendingCheck: Promise<void> | null = null;
let run: UpdateRun | null = null;
/** Bis zum Neustart von Deep Mine Control. Autoupdate (später) merkt es sich dauerhaft. */
let failedMinecraft: string | null = null;

/** Fragt Mojang jetzt. Scheitert das (z. B. ohne Internet), ist die neueste Version unbekannt. */
export function checkNow(): Promise<void> {
  pendingCheck ??= (async () => {
    try {
      check = { minecraft: await fetchLatestMinecraft(), checkedAt: new Date().toISOString(), error: null };
    } catch (error) {
      console.error("Update-Prüfung bei Mojang fehlgeschlagen:", error);
      check = {
        minecraft: null,
        checkedAt: new Date().toISOString(),
        error: "Mojang ist nicht erreichbar. Hat der Server Internet?"
      };
    } finally {
      pendingCheck = null;
    }
  })();
  return pendingCheck;
}

/** Prüft nur, wenn noch nie geprüft wurde oder die letzte Prüfung über eine Stunde her ist. */
export async function ensureChecked(): Promise<void> {
  if (!check || Date.now() - Date.parse(check.checkedAt) > CHECK_MAX_AGE_MS) await checkNow();
}

/** Stand der Updates. Die installierte Minecraft-Version kommt jedes Mal frisch von BSM. */
export async function readUpdates(): Promise<UpdatesInfo> {
  const current = (await bsm.summary().catch(() => null))?.version || null;
  const latest = check?.minecraft ?? null;
  return {
    minecraft: {
      current,
      latest,
      available: !!current && !!latest && compareVersions(latest, current) > 0,
      failed: failedMinecraft
    },
    checkedAt: check?.checkedAt ?? null,
    error: check?.error ?? null,
    running: run
  };
}

/** Was gerade aktualisiert wird; ein gescheitertes Update zählt nicht mehr. */
export function updatingNow(): UpdateKind | null {
  return run && run.phase !== "failed" ? run.kind : null;
}

/**
 * Aktualisiert den Minecraft-Server auf `version`. Läuft als Weltvorgang (startWorldOperation): Spielt
 * jemand, erst 10 s Countdown im Chat, dann übernimmt BSM (stoppen, sichern, installieren, starten).
 * Scheitert es, bleibt der Grund in `running` stehen, bis das nächste Update beginnt.
 */
export async function updateMinecraft(version: string): Promise<void> {
  run = { kind: "minecraft", phase: "countdown", error: null };
  try {
    await countdownInChat((seconds) => `Minecraft wird aktualisiert! Neustart in ${seconds} s.`);
    run.phase = "updating";
    const { task_id } = await bsm.updateServer();
    await waitForTask(task_id, MINECRAFT_UPDATE_TIMEOUT_MS);
    run = null;
    failedMinecraft = null;
  } catch (error) {
    run = {
      kind: "minecraft",
      phase: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
    failedMinecraft = version;
    throw error;
  }
}
