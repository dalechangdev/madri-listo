import { useSyncExternalStore } from 'react';

import {
  getSnapshot,
  refreshDatasets,
  subscribe,
  type SyncSnapshot,
} from '@/data/sync-store';

export type SyncStatus = SyncSnapshot & {
  refresh: (force?: boolean) => Promise<void>;
};

/**
 * Subscribes to the app-wide sync store. Purely a reader — the startup sync is
 * kicked off once from the root layout.
 */
export function useSync(): SyncStatus {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return { ...snapshot, refresh: refreshDatasets };
}
