import { defibrillatorsDataset } from '@/data/datasets/defibrillators';
import type { DatasetDescriptor } from '@/data/types';

/**
 * Every dataset the app knows how to ingest. Register new Madrid feeds here —
 * the sync engine, storage layer and UI all read from this list.
 */
export const DATASETS: DatasetDescriptor<any>[] = [defibrillatorsDataset];

export function getDataset(id: string): DatasetDescriptor<any> | undefined {
  return DATASETS.find((dataset) => dataset.id === id);
}
