// Weltvorgänge (Laden, Anlegen, Löschen) laufen nie gleichzeitig. Laden und Anlegen dauern mit
// Countdown und Neustart 30 s und länger, deshalb laufen sie im Hintergrund weiter, während die
// Seite über `busy` im Status sieht, dass gerade etwas passiert.

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
  target: { place: number; world: string },
  operation: () => Promise<void>
): void {
  claim();
  switching = { ...target, phase: "countdown" };
  operation()
    .catch((error) => console.error(`Weltvorgang „${target.world}“ fehlgeschlagen:`, error))
    .finally(() => {
      running = false;
      switching = null;
    });
}

const COUNTDOWN = [10, 5, 3, 2, 1];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wechselt die aktive Welt: 10 s Countdown im Chat, dann Properties setzen und neu starten.
 * BSM antwortet auf den Neustart erst, wenn der Server wieder läuft.
 */
export async function switchWorld(worldName: string, properties: Record<string, string>): Promise<void> {
  const step = Number(useRuntimeConfig().countdownStepMs);
  for (const [i, seconds] of COUNTDOWN.entries()) {
    await bsm.sendCommand(`say Gleich geht es nach „${worldName}“! Neustart in ${seconds} s.`);
    await sleep((seconds - (COUNTDOWN[i + 1] ?? 0)) * step);
  }
  if (switching) switching.phase = "restart";
  await bsm.setProperties(properties);
  await bsm.restart();
}
