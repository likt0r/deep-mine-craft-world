// Weltvorgänge (Laden, Anlegen, Löschen, Zurückspielen, Minecraft-Update) laufen nie gleichzeitig.
// Die langen dauern mit Countdown und Neustart 30 s und länger, deshalb laufen sie im Hintergrund
// weiter, während die Seite über `busy` im Status sieht, dass gerade etwas passiert.

let running = false;
/** Ziel des laufenden Weltwechsels (Laden, Anlegen), damit die Seite es zeigen kann. */
let switching: WorldSwitch | null = null;

export function isWorldOperationRunning(): boolean {
  return running;
}

export function currentWorldSwitch(): WorldSwitch | null {
  return switching;
}

function claim() {
  if (running) throw createError({ statusCode: 409, message: "Gerade läuft schon ein Weltvorgang" });
  running = true;
}

/** Führt einen kurzen Weltvorgang (z. B. Löschen) unter der Sperre aus. Läuft schon einer: 409. */
export async function runWorldOperation<T>(operation: () => Promise<T>): Promise<T> {
  claim();
  try {
    return await operation();
  } finally {
    running = false;
  }
}

/**
 * Startet einen langen Weltvorgang (Laden, Anlegen) im Hintergrund und kehrt sofort zurück.
 * Läuft schon einer: 409. Die Sperre gilt, bis der Vorgang fertig ist.
 */
export function startWorldOperation(
  /** Welt, die geladen wird (Laden, Anlegen). `null`: kein Weltwechsel, z. B. Backup zurückspielen, Minecraft-Update. */
  target: { place: number; world: string } | null,
  operation: () => Promise<void>
): void {
  claim();
  switching = target ? { ...target, phase: "countdown" } : null;
  operation()
    .catch((error) =>
      console.error(
        target ? `Weltvorgang „${target.world}“ fehlgeschlagen:` : "Weltvorgang fehlgeschlagen:",
        error
      )
    )
    .finally(() => {
      running = false;
      switching = null;
    });
}

const COUNTDOWN = [10, 5, 3, 2, 1];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Spielt jemand, zählt im Chat 10 s herunter, bevor der Server angehalten wird (Laden, Minecraft-Update).
 * Spielt niemand, geht es sofort weiter. `text` bildet die Nachricht aus den verbleibenden Sekunden.
 */
export async function countdownInChat(text: (seconds: number) => string): Promise<void> {
  const { players } = await bsm.summary();
  if (players.length === 0) return;
  const step = Number(useRuntimeConfig().countdownStepMs);
  for (const [i, seconds] of COUNTDOWN.entries()) {
    await bsm.sendCommand(`say ${text(seconds)}`);
    await sleep((seconds - (COUNTDOWN[i + 1] ?? 0)) * step);
  }
}

/**
 * Wechselt die aktive Welt: Spielt jemand, erst 10 s Countdown im Chat; sonst gleich. Dann die bisherige
 * Welt sichern (wenn eingestellt), Properties setzen und neu starten. BSM antwortet auf den Neustart erst, wenn der Server wieder läuft.
 */
export async function switchWorld(worldName: string, properties: Record<string, string>): Promise<void> {
  await countdownInChat((seconds) => `Gleich geht es nach „${worldName}“! Neustart in ${seconds} s.`);
  // Die bisherige Welt sichern, mit dem letzten Stand direkt vor dem Neustart.
  if ((await readBackupSettings()).onWorldEnd) {
    if (switching) switching.phase = "backup";
    // Ein gescheitertes Backup darf den Wechsel nicht aufhalten.
    await backupActiveWorld().catch((error) =>
      console.error("Backup vor dem Weltwechsel fehlgeschlagen:", error)
    );
  }
  if (switching) switching.phase = "restart";
  await bsm.setProperties(properties);
  await bsm.restart();
}
