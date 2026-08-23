// Phase 2 — the first implementation of the canonical read port.
// It reads existing local V1 rows and projects them in memory only.
import type { CanonicalRecordReader } from './adapters';
import { projectLegacyIncident, projectLegacyIncidents } from './legacyCompatibility';
import { localDB } from '@/local/db';

export const legacyCompatibilityReader: CanonicalRecordReader = {
  async get(ownerId, recordId) {
    const row = await localDB.incidents.get(recordId);
    if (!row || row.owner_user_id !== ownerId) return null;
    return projectLegacyIncident(row);
  },

  async list(ownerId) {
    const rows = await localDB.incidents.where('owner_user_id').equals(ownerId).toArray();
    return projectLegacyIncidents(rows, ownerId);
  },
};
