import { useSyncExternalStore } from 'react';

import type { SyncProgress } from '@/data/sync';
import {
  getSnapshot,
  refreshDatasets,
  subscribe,
  type SyncSnapshot,
} from '@/data/sync-store';
import type { TranslationKey } from '@/i18n/keys';

export type SyncStatus = SyncSnapshot & {
  refresh: (force?: boolean) => Promise<void>;
  /** What to show while `busy`. */
  progressLabelKey: TranslationKey;
};

/**
 * Datasets sync in parallel and the last one to report wins, so `done` or
 * `error` for one feed can arrive while others are still running.
 */
const PHASE_LABELS: Record<SyncProgress['phase'], TranslationKey> = {
  downloading: 'sync.downloading',
  parsing: 'sync.parsing',
  storing: 'sync.storing',
  done: 'sync.inProgress',
  error: 'sync.inProgress',
};

/**
 * Subscribes to the app-wide sync store. Purely a reader — the startup sync is
 * kicked off once from the root layout.
 */
export function useSync(): SyncStatus {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return {
    ...snapshot,
    refresh: refreshDatasets,
    progressLabelKey: PHASE_LABELS[snapshot.progress?.phase ?? 'downloading'],
  };
}
