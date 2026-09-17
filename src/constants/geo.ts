/**
 * Bounding box of the Comunidad de Madrid with a small margin.
 *
 * Used to reject rows whose coordinates are zeroed, swapped, or projected in
 * the wrong CRS at the source — all of which occur in these feeds. Sized to
 * the region rather than the city so that regional datasets (the AED register)
 * keep their suburban entries.
 */
export const MADRID_BOUNDS = {
  minLat: 39.8,
  maxLat: 41.3,
  minLon: -4.7,
  maxLon: -3.0,
} as const;

export function isWithinMadrid(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= MADRID_BOUNDS.minLat &&
    latitude <= MADRID_BOUNDS.maxLat &&
    longitude >= MADRID_BOUNDS.minLon &&
    longitude <= MADRID_BOUNDS.maxLon
  );
}
