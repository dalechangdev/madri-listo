import type { CategoryId } from '@/constants/categories';

/**
 * A single point of interest, normalised away from whatever shape the
 * originating Madrid dataset happened to use.
 */
export type ResourceRecord = {
  /** Stable and globally unique: `<datasetId>:<sourceKey>`. */
  id: string;
  datasetId: string;
  category: CategoryId;
  /** Human-readable headline for the marker callout. */
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  /** Free-text placement note, e.g. "planta baja - recepción". */
  detail: string | null;
  schedule: string | null;
  postalCode: string | null;
  /** Dataset-specific classification, shown as a chip in the detail sheet. */
  subtype: string | null;
};

/** A marker to draw: either one resource, or a bubble standing for many. */
export type MapMarker =
  | { kind: 'point'; id: string; latitude: number; longitude: number; category: CategoryId; name: string }
  | { kind: 'cluster'; id: string; latitude: number; longitude: number; category: CategoryId; count: number };

export type Attribution = {
  /** Publisher, shown verbatim in the About screen. */
  publisher: string;
  datasetTitle: string;
  /** Landing page a user can open to inspect the source. */
  sourceUrl: string;
  license: string;
};

/**
 * Describes how to pull one remote dataset and flatten it into
 * `ResourceRecord`s. Implementations must be pure and side-effect free so they
 * can be unit tested against a captured fixture.
 */
export type DatasetDescriptor<TRow = unknown> = {
  id: string;
  category: CategoryId;
  /** Key into the i18n `datasets` namespace. */
  labelKey: string;
  downloadUrl: string;
  attribution: Attribution;
  /** Pulls the row array out of whatever envelope the endpoint returns. */
  extract: (payload: unknown) => TRow[];
  /**
   * Converts one row, or returns null to drop it (out of scope, unusable
   * coordinates, ...). `seenKeys` lets the descriptor disambiguate source keys
   * that are not as unique as the publisher believes.
   */
  normalize: (row: TRow, seenKeys: Set<string>) => ResourceRecord | null;
};

export type SyncState = {
  datasetId: string;
  lastSyncedAt: number | null;
  recordCount: number;
};
