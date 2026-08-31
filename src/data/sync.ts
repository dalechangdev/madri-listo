import { DATASETS } from '@/data/datasets';
import { replaceDatasetRecords } from '@/data/db';
import { getSyncStates } from '@/data/repository';
import type { DatasetDescriptor, ResourceRecord } from '@/data/types';

/** How long a cached dataset stays fresh. These feeds change slowly. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type SyncProgress = {
  datasetId: string;
  phase: 'downloading' | 'parsing' | 'storing' | 'done' | 'error';
  /** Populated once the rows have been normalised. */
  recordCount?: number;
  error?: string;
};

/** Runs a descriptor's extract/normalize pair over a decoded payload. */
export function normalizePayload(
  dataset: DatasetDescriptor<any>,
  payload: unknown,
): ResourceRecord[] {
  const seenKeys = new Set<string>();
  const records: ResourceRecord[] = [];
  for (const row of dataset.extract(payload)) {
    const record = dataset.normalize(row, seenKeys);
    if (record) records.push(record);
  }
  return records;
}

async function syncDataset(
  dataset: DatasetDescriptor<any>,
  onProgress?: (progress: SyncProgress) => void,
): Promise<number> {
  try {
    onProgress?.({ datasetId: dataset.id, phase: 'downloading' });
    const response = await fetch(dataset.downloadUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${dataset.downloadUrl}`);
    }

    onProgress?.({ datasetId: dataset.id, phase: 'parsing' });
    const payload = await response.json();
    const records = normalizePayload(dataset, payload);
    if (records.length === 0) {
      // Never let an empty or reshaped response blow away a good cache.
      throw new Error('Source returned no usable records');
    }

    onProgress?.({
      datasetId: dataset.id,
      phase: 'storing',
      recordCount: records.length,
    });
    await replaceDatasetRecords(dataset.id, records);

    onProgress?.({
      datasetId: dataset.id,
      phase: 'done',
      recordCount: records.length,
    });
    return records.length;
  } catch (error) {
    onProgress?.({
      datasetId: dataset.id,
      phase: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export type SyncSummary = {
  synced: string[];
  skipped: string[];
  failed: { datasetId: string; error: string }[];
};

/**
 * Brings the local cache up to date. Datasets are independent: one failing
 * feed leaves the others (and the previous cache of the failed one) intact,
 * so the map keeps working offline.
 */
export async function syncAll(options?: {
  force?: boolean;
  onProgress?: (progress: SyncProgress) => void;
}): Promise<SyncSummary> {
  const states = await getSyncStates();
  const summary: SyncSummary = { synced: [], skipped: [], failed: [] };

  await Promise.all(
    DATASETS.map(async (dataset) => {
      const state = states.find((s) => s.datasetId === dataset.id);
      const isFresh =
        !options?.force &&
        state?.lastSyncedAt != null &&
        state.recordCount > 0 &&
        Date.now() - state.lastSyncedAt < MAX_AGE_MS;

      if (isFresh) {
        summary.skipped.push(dataset.id);
        return;
      }
      try {
        await syncDataset(dataset, options?.onProgress);
        summary.synced.push(dataset.id);
      } catch (error) {
        summary.failed.push({
          datasetId: dataset.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return summary;
}
