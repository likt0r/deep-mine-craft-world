/** Die 10 Plätze für die Seite. Neu geladen wird zusammen mit dem Status (useServerStatus). */
export function usePlaces() {
  const { data, refresh } = useFetch<PlacesResponse>("/api/places", { key: "places" });
  return { places: data, refresh };
}
