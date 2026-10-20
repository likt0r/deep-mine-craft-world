export default defineEventHandler(async (): Promise<PlacesResponse> => {
  return { places: await getPlaces() };
});
