import type { Application } from 'express';
import { syncFromDelta, wipeMirroredTables } from '../db/sync.js';
import { seedSyntheticData } from '../db/seed.js';
import type { AppDb } from '../db/index.js';

/**
 * Demo-only admin routes. /api/admin/reset truncates the app's writable
 * table (ops_actions) + chat state, then re-syncs the read-only mirrors
 * from Delta — click it between demos to start clean. All agent writes are
 * wiped: se borran los planes de retención y se vuelve a sincronizar cliente_360.
 */

type DataConfig = Parameters<typeof syncFromDelta>[1];

export function registerAdminRoutes(
  app: Application,
  deps: { db: AppDb; data: DataConfig | undefined },
): void {
  const { db, data } = deps;
  app.post('/api/admin/reset', async (_req, res) => {
    await wipeMirroredTables(db);
    // Synthetic mode reseeds the hero dataset; otherwise re-sync from Delta.
    if (process.env.SEED_SYNTHETIC === '1') {
      await seedSyntheticData(db, { force: true });
    } else if (data) {
      await syncFromDelta(db, data, { forceIfAnyEmpty: true });
    }
    res.json({ ok: true });
  });
}
