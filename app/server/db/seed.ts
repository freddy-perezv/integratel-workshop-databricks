import type { AppDb } from './index.js';

/**
 * Seed function — no-op for Integratel (syncs Delta data instead).
 *
 * Integratel retención uses real Delta data from integratel_dev.gold.cliente_360,
 * synced at boot via syncFromDelta(). No synthetic seed needed.
 */

export async function seedSyntheticData(
  _db: AppDb,
  _opts: { force?: boolean } = {},
): Promise<void> {
  // No-op for Integratel: data comes from Delta sync (cliente_360).
  // This function is kept for API compatibility with the template but does nothing.
  console.log('[seed] skipping — using Delta sync for integratel_dev.gold.cliente_360');
}
