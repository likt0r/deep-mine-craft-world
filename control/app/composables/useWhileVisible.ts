/**
 * Ruft `task` alle `ms` auf, aber nur solange die Seite sichtbar ist: im Hintergrund oder im Standby
 * des Tablets wird nicht gefragt. Wird die Seite wieder sichtbar, gleich einmal. Ein Aufruf beginnt
 * erst, wenn der vorige fertig ist. Läuft, solange die aufrufende Komponente da ist.
 */
export function useWhileVisible(task: () => unknown, ms: number, { immediate = true } = {}) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let running = false;

  async function run() {
    if (running) return;
    running = true;
    try {
      await task();
    } catch {
      // Beim nächsten Mal wieder versuchen.
    } finally {
      running = false;
    }
  }

  function stop() {
    clearInterval(timer);
    timer = undefined;
  }

  function onVisibilityChange() {
    stop();
    if (document.visibilityState !== "visible") return;
    void run();
    timer = setInterval(run, ms);
  }

  onMounted(() => {
    if (immediate) void run();
    if (document.visibilityState === "visible") timer = setInterval(run, ms);
    document.addEventListener("visibilitychange", onVisibilityChange);
  });

  onBeforeUnmount(() => {
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });
}
