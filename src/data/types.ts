import type { CategoryId } from '@/constants/categories';
import type { TranslationKey } from '@/i18n/keys';
import type { Language } from '@/i18n/language';

/**
 * A single point of interest, normalised away from whatever shape the
 * originating Madrid dataset happened to use.
 */
export type ResourceRecord = {
  /** Stable and globally unique: `<datasetId>:<sourceKey>`. */
  id: string;
  datasetId: string;
  category: CategoryId;
  /**
   * Human-readable headline taken from the source. Null when the source has
   * nothing identifying; the UI then shows the dataset's translated type label
   * rather than a placeholder frozen in one language at sync time.
   */
  name: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  /** Free-text placement note, e.g. "planta baja - recepción". */
  detail: string | null;
  schedule: string | null;
  postalCode: string | null;
  /**
   * Per-record classification. Null when every row in the dataset is the same
   * kind of thing — the detail sheet then falls back to the dataset's own type
   * label, which has the advantage of being translated.
   */
  subtype: string | null;
  /** Canonical page for this facility, when the source publishes one. */
  url: string | null;
};

/** A marker to draw: either one resource, or a bubble standing for many. */
export type MapMarker =
  | { kind: 'point'; id: string; datasetId: string; latitude: number; longitude: number; category: CategoryId; name: string | null }
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
  /** Key into the i18n `datasets` namespace (plural, e.g. "Libraries"). */
  labelKey: TranslationKey;
  /** Key for the singular type shown in the detail sheet ("Library"). */
  typeLabelKey?: TranslationKey;
  /**
   * What this dataset's free-text `detail` field actually means. Defaults to
   * a placement description; facility feeds use it for services instead.
   */
  detailLabelKey?: TranslationKey;
  /**
   * Language of the free text the source publishes (names, schedules,
   * services). It is shown as published, so the UI flags it when this differs
   * from the app language and tells screen readers how to pronounce it.
   */
  sourceLanguage: Language;
  /** Last-known-good download URL; also the fallback if resolution fails. */
  downloadUrl: string;
  /**
   * Resolves the current download URL at sync time. Present only for datasets
   * whose publisher rotates the filename. Failures fall back to `downloadUrl`.
   */
  resolveDownloadUrl?: () => Promise<string>;
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
