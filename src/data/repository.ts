import type { CategoryId } from '@/constants/categories';
import { getDatabase, LAT_OFFSET, LON_OFFSET } from '@/data/db';
import type { MapMarker, ResourceRecord, SyncState } from '@/data/types';

export type Bounds = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

/**
 * Above this many points in the viewport we switch from individual pins to
 * clustered bubbles. react-native-maps degrades badly past a few hundred
 * markers, and the tap targets stop being distinguishable long before that.
 */
const MAX_INDIVIDUAL_MARKERS = 250;

/**
 * Roughly how many cluster cells span the viewport horizontally. Because the
 * grid is sized relative to the viewport it refills at every zoom level, so
 * this value alone decides how busy the map looks: at the initial region a
 * 2:1 phone renders ~278 bubbles at 12, ~84 at 6, ~44 at 4.
 */
const CLUSTER_COLUMNS = 6;

/**
 * Widest viewport (in degrees of longitude, ~10km) that still draws markers.
 *
 * Zoomed out past this the grid blankets the map and hides the one thing the
 * user needs to orient themselves — their own position — while showing
 * thousands of points they cannot act on. Above this width we draw nothing and
 * prompt them to zoom in.
 */
export const MAX_MARKER_LON_DELTA = 0.12;

type ResourceRow = {
  id: string;
  dataset_id: string;
  category: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  detail: string | null;
  schedule: string | null;
  postal_code: string | null;
  subtype: string | null;
  url: string | null;
};

function toRecord(row: ResourceRow): ResourceRecord {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    category: row.category as CategoryId,
    name: row.name,
    latitude: row.latitude - LAT_OFFSET,
    longitude: row.longitude - LON_OFFSET,
    address: row.address,
    detail: row.detail,
    schedule: row.schedule,
    postalCode: row.postal_code,
    subtype: row.subtype,
    url: row.url,
  };
}

/** Builds the shared `category IN (...)` + bounding-box predicate. */
function buildFilter(bounds: Bounds, categories: readonly CategoryId[]) {
  const placeholders = categories.map(() => '?').join(', ');
  return {
    clause:
      `category IN (${placeholders})` +
      ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?',
    params: [
      ...categories,
      bounds.minLat + LAT_OFFSET,
      bounds.maxLat + LAT_OFFSET,
      bounds.minLon + LON_OFFSET,
      bounds.maxLon + LON_OFFSET,
    ] as (string | number)[],
  };
}

/**
 * Returns what should be drawn for the current viewport: individual pins when
 * the area is sparse enough, otherwise per-category grid clusters aggregated
 * inside SQLite so we never materialise thousands of rows in JS.
 */
export async function queryMarkers(
  bounds: Bounds,
  categories: readonly CategoryId[],
): Promise<MapMarker[]> {
  if (categories.length === 0) return [];
  const db = await getDatabase();
  const { clause, params } = buildFilter(bounds, categories);

  const countRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM resources WHERE ${clause}`,
    params,
  );
  const total = countRow?.total ?? 0;
  if (total === 0) return [];

  if (total <= MAX_INDIVIDUAL_MARKERS) {
    const rows = await db.getAllAsync<ResourceRow>(
      `SELECT * FROM resources WHERE ${clause}`,
      params,
    );
    return rows.map((row) => ({
      kind: 'point' as const,
      id: row.id,
      latitude: row.latitude - LAT_OFFSET,
      longitude: row.longitude - LON_OFFSET,
      category: row.category as CategoryId,
      name: row.name,
    }));
  }

  // Cell size follows the zoom level, so bubbles stay a constant size on screen.
  const cell = Math.max((bounds.maxLon - bounds.minLon) / CLUSTER_COLUMNS, 1e-6);
  const clusters = await db.getAllAsync<{
    gx: number;
    gy: number;
    category: string;
    total: number;
    lat: number;
    lon: number;
    sample_id: string;
    sample_name: string;
  }>(
    `SELECT CAST(latitude / ? AS INTEGER)  AS gx,
            CAST(longitude / ? AS INTEGER) AS gy,
            category,
            COUNT(*)     AS total,
            AVG(latitude)  AS lat,
            AVG(longitude) AS lon,
            MIN(id)      AS sample_id,
            MIN(name)    AS sample_name
       FROM resources
      WHERE ${clause}
      GROUP BY gx, gy, category`,
    [cell, cell, ...params],
  );

  return clusters.map((cluster) => {
    const latitude = cluster.lat - LAT_OFFSET;
    const longitude = cluster.lon - LON_OFFSET;
    // A cell holding one device is just that device — keep it tappable.
    if (cluster.total === 1) {
      return {
        kind: 'point' as const,
        id: cluster.sample_id,
        latitude,
        longitude,
        category: cluster.category as CategoryId,
        name: cluster.sample_name,
      };
    }
    return {
      kind: 'cluster' as const,
      id: `c:${cluster.category}:${cluster.gx}:${cluster.gy}`,
      latitude,
      longitude,
      category: cluster.category as CategoryId,
      count: cluster.total,
    };
  });
}

export async function getResourceById(
  id: string,
): Promise<ResourceRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ResourceRow>(
    'SELECT * FROM resources WHERE id = ?',
    id,
  );
  return row ? toRecord(row) : null;
}

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in metres. */
export function haversineMeters(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type NearbyResult = ResourceRecord & { distanceMeters: number };

/**
 * Nearest resources to a point. A bounding box does the coarse filtering in
 * SQL (so the index is used), then exact haversine ordering happens in JS over
 * the small candidate set. The box grows until enough candidates turn up, which
 * keeps rural areas working without scanning the whole table in dense ones.
 */
export async function queryNearby(
  latitude: number,
  longitude: number,
  categories: readonly CategoryId[],
  limit = 50,
): Promise<NearbyResult[]> {
  if (categories.length === 0) return [];
  const db = await getDatabase();

  const latDegreesPerMeter = 1 / 111_320;
  const lonDegreesPerMeter =
    1 / (111_320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));

  for (const radiusMeters of [1000, 4000, 15000, 60000]) {
    const bounds: Bounds = {
      minLat: latitude - radiusMeters * latDegreesPerMeter,
      maxLat: latitude + radiusMeters * latDegreesPerMeter,
      minLon: longitude - radiusMeters * lonDegreesPerMeter,
      maxLon: longitude + radiusMeters * lonDegreesPerMeter,
    };
    const { clause, params } = buildFilter(bounds, categories);
    const rows = await db.getAllAsync<ResourceRow>(
      `SELECT * FROM resources WHERE ${clause} LIMIT 2000`,
      params,
    );

    // Retry wider only if this ring genuinely can't fill the list.
    if (rows.length < limit && radiusMeters !== 60000) continue;

    return rows
      .map((row) => {
        const record = toRecord(row);
        return {
          ...record,
          distanceMeters: haversineMeters(
            latitude,
            longitude,
            record.latitude,
            record.longitude,
          ),
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);
  }
  return [];
}

export async function getSyncStates(): Promise<SyncState[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    dataset_id: string;
    last_synced_at: number | null;
    record_count: number;
  }>('SELECT * FROM dataset_sync');
  return rows.map((row) => ({
    datasetId: row.dataset_id,
    lastSyncedAt: row.last_synced_at,
    recordCount: row.record_count,
  }));
}
