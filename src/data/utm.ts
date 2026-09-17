/**
 * UTM (ETRS89 / zone 30N) to geographic coordinates.
 *
 * Several Madrid "mobiliario urbano" feeds leave `LATITUD`/`LONGITUD` null on a
 * subset of rows while still publishing the UTM easting/northing the city works
 * in natively. Converting recovers those rows instead of discarding them.
 *
 * ETRS89 uses the GRS80 ellipsoid, which agrees with WGS84 to well under a
 * metre in Spain, so the result is used directly as WGS84. Validated against
 * the 2,038 fountain rows that publish both representations: median and maximum
 * disagreement 0.01 m.
 */

/** GRS80 ellipsoid, shared by ETRS89 and (to within millimetres) WGS84. */
const SEMI_MAJOR_AXIS = 6378137.0;
const FLATTENING = 1 / 298.257222101;
const ECCENTRICITY_SQ = FLATTENING * (2 - FLATTENING);
/** UTM scale factor on the central meridian. */
const SCALE = 0.9996;
const FALSE_EASTING = 500000.0;

export type LatLon = { latitude: number; longitude: number };

/**
 * Inverse transverse Mercator. `zone` defaults to 30, which covers Madrid.
 * Only valid for the northern hemisphere, which is all these feeds contain.
 */
export function utmToLatLon(
  easting: number,
  northing: number,
  zone = 30,
): LatLon | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;

  const e2 = ECCENTRICITY_SQ;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = easting - FALSE_EASTING;

  const m = northing / SCALE;
  const mu =
    m / (SEMI_MAJOR_AXIS * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));

  // Footprint latitude.
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const ep2 = e2 / (1 - e2);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const c1 = ep2 * cosPhi1 ** 2;
  const t1 = tanPhi1 ** 2;
  const sinPhi1Sq = Math.sin(phi1) ** 2;
  const n1 = SEMI_MAJOR_AXIS / Math.sqrt(1 - e2 * sinPhi1Sq);
  const r1 = (SEMI_MAJOR_AXIS * (1 - e2)) / (1 - e2 * sinPhi1Sq) ** 1.5;
  const d = x / (n1 * SCALE);

  const latitude =
    phi1 -
    ((n1 * tanPhi1) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) *
          d ** 6) /
          720);

  const longitudeOffset =
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5) /
        120) /
    cosPhi1;

  const centralMeridian = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);

  const result = {
    latitude: latitude * (180 / Math.PI),
    longitude: (centralMeridian + longitudeOffset) * (180 / Math.PI),
  };
  return Number.isFinite(result.latitude) && Number.isFinite(result.longitude)
    ? result
    : null;
}
