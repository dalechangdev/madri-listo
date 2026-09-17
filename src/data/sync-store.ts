import { getSyncStates } from '@/data/repository';
import { syncAll, type SyncProgress } from '@/data/sync';
import type { SyncState } from '@/data/types';

export type SyncSnapshot = {
  /** True while a refresh is in flight. */
  busy: boolean;
  /** Latest phase reported by the sync engine, for the status banner. */
  progress: SyncProgress | null;
  /** Set only when everything failed and there is no cache to fall back on. */
  error: string | null;
  /** True when the last refresh failed for at least one dataset. */
  updateFailed: boolean;
  states: SyncState[];
  /** True once there is data on device, freshly fetched or previously cached. */
  ready: boolean;
};

/**
 * Sync is app-wide state, not screen state: the map and the About tab both need
 * it, and it must not restart because a tab remounted. Keeping it in a module
 * store behind `useSyncExternalStore` means exactly one refresh runs no matter
 * how many components are listening.
 */
let snapshot: SyncSnapshot = {
  busy: true,
  progress: null,
  error: null,
  updateFailed: false,
  states: [],
  ready: false,
};

const listeners = new Set<() => void>();
let started = false;
let inFlight: Promise<void> | null = null;

function emit(patch: Partial<SyncSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  snapshot.ready = snapshot.states.some((state) => state.recordCount > 0);
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): SyncSnapshot {
  return snapshot;
}

/**
 * Refreshes every dataset. Concurrent callers share the in-flight run rather
 * than queuing a second download.
 */
export function refreshDatasets(force = false): Promise<void> {
  if (inFlight) return inFlight;

  emit({ busy: true, error: null });
  inFlight = (async () => {
    try {
      const summary = await syncAll({
        force,
        onProgress: (progress) => emit({ progress }),
      });
      const states = await getSyncStates();
      const hasCachedData = states.some((state) => state.recordCount > 0);
      emit({
        states,
        updateFailed: summary.failed.length > 0,
        error:
          summary.failed.length > 0 && !hasCachedData
            ? summary.failed[0].error
            : null,
      });
    } catch (caught) {
      emit({
        updateFailed: true,
        error: caught instanceof Error ? caught.message : String(caught),
      });
    } finally {
      emit({ busy: false, progress: null });
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Kicks off the one-time startup sync. Safe to call more than once. */
export function startInitialSync(): void {
  if (started) return;
  started = true;
  void refreshDatasets(false);
}
