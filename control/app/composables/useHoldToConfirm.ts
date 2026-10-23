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
    onPointerdown: start,
    onPointerup: cancel,
    onPointerleave: cancel,
    onPointercancel: cancel,
    // Langes Drücken auf Tablets soll kein Kontextmenü öffnen.
    onContextmenu: (event: Event) => event.preventDefault()
  };

  return { holding, handlers, cancel };
}
