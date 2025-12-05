// Lightweight projection helpers for converting between coordinate systems.
// GovMap expects Israel Transverse Mercator (EPSG:2039) meters, while Google
// returns WGS84 longitude/latitude. This utility converts Google results to
// GovMap-friendly XY without adding heavy dependencies.

const DEG_TO_RAD = Math.PI / 180;

// EPSG:2039 parameters (ITM on GRS80 ellipsoid)
const SEMI_MAJOR = 6378137; // meters
const SEMI_MINOR = 6356752.31414; // meters
const CENTRAL_MERIDIAN = 35.20451694444444 * DEG_TO_RAD; // lon0
const LAT_OF_ORIGIN = 31.73439361111111 * DEG_TO_RAD; // lat0
const SCALE = 1.0000067;
const FALSE_EASTING = 219529.584;
const FALSE_NORTHING = 626907.39;

const FLATTENING = (SEMI_MAJOR - SEMI_MINOR) / SEMI_MAJOR;
const E_SQUARED = 2 * FLATTENING - FLATTENING * FLATTENING;
const E_PRIME_SQUARED = E_SQUARED / (1 - E_SQUARED);

function meridionalArc(latRad: number): number {
  const e2 = E_SQUARED;
  const e4 = e2 * e2;
  const e6 = e4 * e2;

  return (
    SEMI_MAJOR *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * latRad) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latRad) -
      ((35 * e6) / 3072) * Math.sin(6 * latRad))
  );
}

const MERIDIAN_ARC_AT_ORIGIN = meridionalArc(LAT_OF_ORIGIN);

export function wgs84ToItm(lon: number, lat: number): { x: number; y: number } | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  const latRad = lat * DEG_TO_RAD;
  const lonRad = lon * DEG_TO_RAD;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const N = SEMI_MAJOR / Math.sqrt(1 - E_SQUARED * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = E_PRIME_SQUARED * cosLat * cosLat;
  const A = (lonRad - CENTRAL_MERIDIAN) * cosLat;

  const M = meridionalArc(latRad);

  const easting =
    FALSE_EASTING +
    SCALE *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * E_PRIME_SQUARED) * Math.pow(A, 5)) / 120);

  const northing =
    FALSE_NORTHING +
    SCALE *
      (M -
        MERIDIAN_ARC_AT_ORIGIN +
        N *
          tanLat *
          (A * A / 2 +
            ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * E_PRIME_SQUARED) * Math.pow(A, 6)) /
              720));

  return { x: easting, y: northing };
}
