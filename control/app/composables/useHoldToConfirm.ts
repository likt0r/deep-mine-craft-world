/** Bestätigen durch Gedrückthalten: erst nach `ms` Halten wird `onConfirm` ausgelöst, Loslassen bricht ab. */
export function useHoldToConfirm(ms: number, onConfirm: () => void) {
  const holding = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function start() {
    if (holding.value) return;
    holding.value = true;
    timer = setTimeout(() => {
      holding.value = false;
      onConfirm();
    }, ms);
  }

  function cancel() {
    clearTimeout(timer);
    holding.value = false;
  }

  onBeforeUnmount(cancel);

  /** Auf den Knopf binden: v-bind="handlers" */
  const handlers = {
    // Der Knopf hält den Zeiger fest: Verschiebt sich das Layout darunter (z. B. weil Daten neu
    // geladen werden), bricht das Halten nicht ab. Nur Loslassen bricht ab.
    onPointerdown: (event: PointerEvent) => {
      (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
      start();
    },
    onPointerup: cancel,
    onPointerleave: cancel,
    onPointercancel: cancel,
    // Langes Drücken auf Tablets soll kein Kontextmenü öffnen.
    onContextmenu: (event: Event) => event.preventDefault()
  };

  return { holding, handlers, cancel };
}
