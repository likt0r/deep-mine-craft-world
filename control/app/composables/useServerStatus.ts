/** Serverstatus für die ganze Seite, wird alle 3 s neu geladen. */
export function useServerStatus() {
  const { data, refresh, error } = useFetch<Status>("/api/status", { key: "status" });

  onMounted(() => {
    const timer = setInterval(() => refresh(), 3000);
    onBeforeUnmount(() => clearInterval(timer));
  });

  /** Steuerung ist nur möglich, wenn der Server läuft und kein Weltvorgang läuft. */
  const locked = computed(() => data.value?.state !== "running" || data.value.busy);

  return { status: data, refresh, error, locked };
}
