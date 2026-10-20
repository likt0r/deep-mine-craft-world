/** Die 10 Plätze für die Seite, wird alle 3 s neu geladen. */
export function usePlaces() {
  const { data, refresh } = useFetch<PlacesResponse>("/api/places", { key: "places" });

  onMounted(() => {
    const timer = setInterval(() => refresh(), 3000);
    onBeforeUnmount(() => clearInterval(timer));
  });

  return { places: data, refresh };
}
