import { randomUUID } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

// Updates prüfen und ausführen. Das Ergebnis der Prüfung (GitHub und Mojang) liegt nur im Speicher: Es wird
// beim ersten Abruf geholt und, wenn es älter als eine Stunde ist, neu. „Jetzt prüfen“ holt es sofort.
// Dauerhaft im Datenordner liegen die Autoupdate-Schalter (update-settings.json) und gescheiterte Versionen
// (updates.json).
// Deep Mine Control aktualisiert der root-Helfer deep-mine-update (server/update.py): Deep Mine Control
// schreibt nur die Anfrage (update-request.json) und liest den Stand (update-state.json).

const CHECK_MAX_AGE_MS = 60 * 60 * 1000;
/** BSM stoppt, sichert, lädt und installiert: Das dauert deutlich länger als ein Backup. */
const MINECRAFT_UPDATE_TIMEOUT_MS = 15 * 60 * 1000;
/** So lange gilt eine Anfrage als unterwegs, bis der Helfer sie abholt. Danach ist er wohl nicht da. */
const CONTROL_REQUEST_MAX_AGE_MS = 60 * 1000;
/** Länger dauert kein Control-Update. Steht der Stand dann noch auf „läuft“, war der Rechner wohl aus. */
const CONTROL_UPDATE_MAX_MS = 30 * 60 * 1000;
const CONTROL_REQUEST = "update-request.json";
const CONTROL_STATE = "update-state.json";
const RELEASE_VERSION = /^\d+\.\d+\.\d+$/;

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

/** Ein Grund, der so in der Oberfläche stehen kann. */
class CheckProblem extends Error {}

const releaseSchema = z.object({
  tag_name: z.string(),
  body: z.string().nullish(),
  published_at: z.string().nullish(),
  assets: z.array(z.object({ name: z.string() }))
});

interface ControlRelease {
  version: string;
  notes: string | null;
  publishedAt: string | null;
}

/** Neueste Version von Deep Mine Control: GitHub `releases/latest`, zählt nur mit Paket-Anhang. */
async function fetchLatestControl(): Promise<ControlRelease> {
  const { githubApi, updateRepo } = useRuntimeConfig();
  const release = releaseSchema.parse(
    await $fetch(`${githubApi}/repos/${updateRepo}/releases/latest`, {
      timeout: 10_000,
      headers: { Accept: "application/vnd.github+json", "User-Agent": "deep-mine-control" }
    })
  );
  const version = release.tag_name.replace(/^v/, "");
  if (!RELEASE_VERSION.test(version)) throw new Error(`Unbekannte Release-Bezeichnung: ${release.tag_name}`);
  // Die Pipeline hängt das Paket erst ein paar Minuten nach dem Release an.
  if (!release.assets.some((a) => a.name === `deep-mine-control_${version}_amd64.deb`))
    throw new CheckProblem(
      `Das neueste Release ${release.tag_name} hat noch kein Paket. Gleich noch einmal prüfen.`
    );
  return { version, notes: release.body?.trim() || null, publishedAt: release.published_at ?? null };
}

interface Check {
  control: ControlRelease | null;
  minecraft: string | null;
  checkedAt: string;
  errors: Record<UpdateKind, string | null>;
}

let check: Check | null = null;
/** Laufende Prüfung, damit gleichzeitige Abrufe Mojang nur einmal fragen. */
let pendingCheck: Promise<void> | null = null;
let run: UpdateRun | null = null;

function dataFile(name: string) {
  return join(useRuntimeConfig().dataDir, name);
}

/** Liest eine JSON-Datei aus dem Datenordner. Fehlt sie oder ist sie kaputt: `fallback`. */
async function readStored<T>(name: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  try {
    return schema.parse(JSON.parse(await readFile(dataFile(name), "utf8")));
  } catch {
    return fallback;
  }
}

const settingsSchema = z.object({ control: z.boolean().catch(false), minecraft: z.boolean().catch(false) });

export function readAutoUpdateSettings(): Promise<AutoUpdateSettings> {
  return readStored("update-settings.json", settingsSchema, { control: false, minecraft: false });
}

/** Setzt die angegebenen Schalter, die anderen bleiben. */
export async function writeAutoUpdateSettings(
  change: Partial<AutoUpdateSettings>
): Promise<AutoUpdateSettings> {
  const settings = { ...(await readAutoUpdateSettings()), ...change };
  await writeFile(dataFile("update-settings.json"), JSON.stringify(settings) + "\n");
  return settings;
}

/** Je Teil die Version, deren Update zuletzt gescheitert ist. */
const failedSchema = z.object({
  failed: z.object({
    control: z.string().nullable().catch(null),
    minecraft: z.string().nullable().catch(null)
  })
});
type Failed = z.infer<typeof failedSchema>["failed"];

async function readFailed(): Promise<Failed> {
  return (await readStored("updates.json", failedSchema, { failed: { control: null, minecraft: null } }))
    .failed;
}

async function writeFailed(kind: UpdateKind, version: string | null): Promise<void> {
  const failed = { ...(await readFailed()), [kind]: version };
  await writeFile(dataFile("updates.json"), JSON.stringify({ failed }) + "\n");
}

/** Grund für die Oberfläche; Unerwartetes landet im Log. */
function checkError(source: string, error: unknown): string {
  if (error instanceof CheckProblem) return error.message;
  console.error(`Update-Prüfung bei ${source} fehlgeschlagen:`, error);
  return `${source} ist nicht erreichbar. Hat der Server Internet?`;
}

/**
 * Fragt GitHub und Mojang jetzt, unabhängig voneinander. Scheitert eine Prüfung (z. B. ohne Internet), ist
 * nur dort die neueste Version unbekannt.
 */
export function checkNow(): Promise<void> {
  pendingCheck ??= (async () => {
    try {
      const [control, minecraft] = await Promise.allSettled([fetchLatestControl(), fetchLatestMinecraft()]);
      check = {
        control: control.status === "fulfilled" ? control.value : null,
        minecraft: minecraft.status === "fulfilled" ? minecraft.value : null,
        checkedAt: new Date().toISOString(),
        errors: {
          control: control.status === "rejected" ? checkError("GitHub", control.reason) : null,
          minecraft: minecraft.status === "rejected" ? checkError("Mojang", minecraft.reason) : null
        }
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

const controlStateSchema = z.object({
  version: z.string().nullable().catch(null),
  phase: z.enum(["downloading", "installing", "verifying", "done", "failed", "rolled-back"]),
  error: z.string().nullable().catch(null),
  startedAt: z.string().nullable().catch(null)
});

/**
 * Stand des Control-Updates aus Anfrage- und Zustandsdatei. Eine frische Anfrage zählt schon als „wird
 * geladen“. Gescheitert (auch zurückgesetzt oder unterbrochen) bleibt es, bis das nächste Update beginnt.
 * Die gescheiterte Version kommt wie bei Minecraft nach updates.json, ein geglücktes Update löscht sie.
 */
async function readControlRun(): Promise<UpdateRun | null> {
  const request = await stat(dataFile(CONTROL_REQUEST)).catch(() => null);
  if (request && Date.now() - request.mtimeMs < CONTROL_REQUEST_MAX_AGE_MS)
    return { kind: "control", phase: "downloading", error: null };

  const state = await readStored(CONTROL_STATE, controlStateSchema.nullable(), null);
  if (!state) return null;
  let controlRun: UpdateRun | null = null;
  if (state.phase === "downloading" || state.phase === "installing" || state.phase === "verifying") {
    controlRun =
      Date.now() - Date.parse(state.startedAt ?? "") < CONTROL_UPDATE_MAX_MS
        ? { kind: "control", phase: state.phase, error: null }
        : { kind: "control", phase: "failed", error: "Das Update wurde unterbrochen." };
  } else if (state.phase !== "done") {
    controlRun = { kind: "control", phase: "failed", error: state.error ?? "Das Update ist fehlgeschlagen." };
  }

  const failedVersion = controlRun?.phase === "failed" ? state.version : controlRun ? undefined : null;
  if (failedVersion !== undefined && (await readFailed()).control !== failedVersion)
    await writeFailed("control", failedVersion);
  return controlRun;
}

const isActive = (r: UpdateRun | null) => !!r && r.phase !== "failed";

/**
 * Stand der Updates. Die installierte Minecraft-Version kommt jedes Mal frisch von BSM, die von Deep Mine
 * Control aus der Versionsdatei.
 */
export async function readUpdates(): Promise<UpdatesInfo> {
  const [summary, controlCurrent, controlRun] = await Promise.all([
    bsm.summary().catch(() => null),
    readVersion(),
    readControlRun()
  ]);
  const current = summary?.version || null;
  const latest = check?.minecraft ?? null;
  const available = !!current && !!latest && compareVersions(latest, current) > 0;
  const release = check?.control ?? null;
  // Ohne Paket („dev“) gibt es kein Update per Knopf.
  const controlAvailable =
    !!release && RELEASE_VERSION.test(controlCurrent) && compareVersions(release.version, controlCurrent) > 0;
  const [failed, auto] = await Promise.all([readFailed(), readAutoUpdateSettings()]);
  const errors = check?.errors ?? { control: null, minecraft: null };
  return {
    // Gemerkt wird nur, solange es um genau diese Version geht: Eine neuere hebt die Sperre auf.
    control: {
      current: controlCurrent,
      latest: release?.version ?? null,
      available: controlAvailable,
      failed: controlAvailable && failed.control === release!.version ? release!.version : null,
      notes: release?.notes ?? null,
      publishedAt: release?.publishedAt ?? null
    },
    minecraft: {
      current,
      latest,
      available,
      failed: available && failed.minecraft === latest ? latest : null
    },
    checkedAt: check?.checkedAt ?? null,
    errors,
    error: [errors.control, errors.minecraft].filter(Boolean).join(" ") || null,
    running: [run, controlRun].find(isActive) ?? run ?? controlRun,
    auto
  };
}

/** Was gerade aktualisiert wird; ein gescheitertes Update zählt nicht mehr. */
export async function updatingNow(): Promise<UpdateKind | null> {
  if (isActive(run)) return run!.kind;
  return isActive(await readControlRun()) ? "control" : null;
}

/** Fragt beim root-Helfer das Update von Deep Mine Control auf `version` an. Der prüft selbst noch einmal. */
export async function requestControlUpdate(version: string): Promise<string> {
  const id = randomUUID();
  await writeFile(dataFile(CONTROL_REQUEST), JSON.stringify({ id, version }) + "\n");
  return id;
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
  } catch (error) {
    run = {
      kind: "minecraft",
      phase: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
    await writeFailed("minecraft", version);
    throw error;
  }
  run = null;
  await writeFailed("minecraft", null);
}

/**
 * Autoupdate-Lauf (stündlich vom Timer deep-mine-update-check): prüft neu und startet das Minecraft-Update im
 * Hintergrund, wenn Autoupdate an ist, eine neuere Version da ist, die nicht schon gescheitert ist, niemand
 * spielt und kein Weltvorgang läuft. Antwortet sofort mit dem, was getan wurde, oder warum nicht.
 */
export async function runAutoUpdate(): Promise<AutoUpdateResult> {
  await checkNow();
  if (!(await readAutoUpdateSettings()).minecraft) return { action: "none", reason: "off" };

  const { minecraft, errors } = await readUpdates();
  if (errors.minecraft || !minecraft.current) return { action: "none", reason: "check-failed" };
  if (!minecraft.available || !minecraft.latest) return { action: "none", reason: "up-to-date" };
  if (minecraft.failed) return { action: "none", reason: "failed" };
  const summary = await bsm.summary().catch(() => null);
  if (!summary) return { action: "none", reason: "check-failed" };
  if (summary.players.length > 0) return { action: "none", reason: "players-online" };
  // Direkt vor dem Start, ohne await dazwischen: Sonst könnte noch ein Weltvorgang dazwischenkommen.
  if (isWorldOperationRunning()) return { action: "none", reason: "world-operation" };

  const version = minecraft.latest;
  startWorldOperation(null, () => updateMinecraft(version));
  return { action: "minecraft", version };
}
