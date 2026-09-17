import * as SQLite from 'expo-sqlite';

import type { ResourceRecord } from '@/data/types';

const DATABASE_NAME = 'madrilisto.db';
const SCHEMA_VERSION = 2;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Coordinates are stored offset into positive space so grid clustering can use
 * integer division. SQLite's CAST truncates toward zero rather than flooring,
 * so on negative coordinates cell boundaries shift by one and the two cells
 * straddling zero merge into a single double-width cell. Madrid sits entirely
 * west of the meridian without crossing it, so this is defensive rather than
 * load-bearing today — but it costs nothing and keeps the scheme correct for
 * any dataset added later.
 */
export const LAT_OFFSET = 90;
export const LON_OFFSET = 180;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  if (current === 0) {
    await createSchema(db);
  } else {
    await upgradeSchema(db, current);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

/**
 * Incremental upgrades from an already-populated cache. Kept additive so a
 * schema bump never forces users back online to see their saved data.
 */
async function upgradeSchema(
  db: SQLite.SQLiteDatabase,
  from: number,
): Promise<void> {
  if (from < 2) {
    await db.execAsync('ALTER TABLE resources ADD COLUMN url TEXT;');
    // Existing rows predate the column and would stay null until the cache
    // aged out, so drop the freshness stamps to trigger one refresh. The rows
    // themselves survive, and stay usable offline in the meantime.
    await db.execAsync('DELETE FROM dataset_sync;');
  }
}

async function createSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS resources (
      id           TEXT PRIMARY KEY NOT NULL,
      dataset_id   TEXT NOT NULL,
      category     TEXT NOT NULL,
      name         TEXT NOT NULL,
      latitude     REAL NOT NULL,
      longitude    REAL NOT NULL,
      address      TEXT,
      detail       TEXT,
      schedule     TEXT,
      postal_code  TEXT,
      subtype      TEXT,
      url          TEXT
    );

    -- Serves the viewport query: filter by category, then range-scan latitude.
    CREATE INDEX IF NOT EXISTS idx_resources_cat_geo
      ON resources (category, latitude, longitude);

    CREATE TABLE IF NOT EXISTS dataset_sync (
      dataset_id     TEXT PRIMARY KEY NOT NULL,
      last_synced_at INTEGER,
      record_count   INTEGER NOT NULL DEFAULT 0
    );
  `);
}

/** Opens (once) and migrates the local cache database. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(
      async (db) => {
        await migrate(db);
        return db;
      },
    );
  }
  return databasePromise;
}

/**
 * Replaces every cached record for one dataset inside a single transaction, so
 * a failed refresh can never leave the map half-populated.
 */
export async function replaceDatasetRecords(
  datasetId: string,
  records: ResourceRecord[],
): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM resources WHERE dataset_id = ?', datasetId);

    const statement = await tx.prepareAsync(
      `INSERT INTO resources
         (id, dataset_id, category, name, latitude, longitude,
          address, detail, schedule, postal_code, subtype, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    try {
      for (const record of records) {
        await statement.executeAsync([
          record.id,
          record.datasetId,
          record.category,
          record.name,
          record.latitude + LAT_OFFSET,
          record.longitude + LON_OFFSET,
          record.address,
          record.detail,
          record.schedule,
          record.postalCode,
          record.subtype,
          record.url,
        ]);
      }
    } finally {
      await statement.finalizeAsync();
    }

    await tx.runAsync(
      `INSERT INTO dataset_sync (dataset_id, last_synced_at, record_count)
       VALUES (?, ?, ?)
       ON CONFLICT(dataset_id) DO UPDATE
         SET last_synced_at = excluded.last_synced_at,
             record_count   = excluded.record_count`,
      [datasetId, Date.now(), records.length],
    );
  });
}

/** Wipes the cache. Exposed for the "reset data" affordance in Settings. */
export async function clearCache(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM resources; DELETE FROM dataset_sync;');
}
