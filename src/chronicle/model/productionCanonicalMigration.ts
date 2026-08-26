import { supabase } from '@/integrations/supabase/client';
import { ChronicleDB, localDB, type LocalFollowUpNote, type LocalIncident } from '@/local/db';
import { activateCanonicalOwner, auditCanonicalActivation, type CanonicalActivationReceipt } from './canonicalActivation';
import { applyCanonicalMigration, buildCanonicalMigration, type CanonicalMigrationBuild, type CanonicalMigrationWriteReport } from './canonicalMigration';
import { hydrateCanonicalMigrationMedia, type CanonicalMigrationMediaImportReport, type LegacyEvidenceDownloader } from './canonicalMigrationMedia';
import type { V1Snapshot } from './migrationPlan';

export class ProductionCanonicalMigrationError extends Error {
  constructor(
    public readonly code:
      | 'offline'
      | 'cloud_source_unavailable'
      | 'local_source_incomplete'
      | 'source_conflict'
      | 'owner_mismatch'
      | 'activation_blocked',
    message: string,
  ) {
    super(message);
  }
}

type CloudIncidentRevision = { id: string; version: number; updated_at: string };
type CloudLegacySources = Pick<V1Snapshot, 'evidence' | 'history'> & {
  cloudIncidents: CloudIncidentRevision[];
  cloudNotes: V1Snapshot['notes'];
};

export interface ProductionLegacySourceAdapter {
  loadCloudSources(ownerId: string): Promise<CloudLegacySources>;
}

const stripLocalIncident = (row: LocalIncident): V1Snapshot['incidents'][number] => {
  const {
    owner_user_id: _owner,
    sync_state: _syncState,
    last_sync_attempt_at: _attempt,
    last_sync_error: _error,
    local_updated_at: _localUpdated,
    conflict_detected_at: _conflictAt,
    cloud_last_modified_at: _cloudModified,
    cloud_version: _cloudVersion,
    ...legacy
  } = row;
  return structuredClone(legacy) as V1Snapshot['incidents'][number];
};

const stripLocalNote = (row: LocalFollowUpNote): V1Snapshot['notes'][number] => ({
  id: row.id,
  incident_id: row.incident_id,
  note_text: row.note_text,
  note_type: row.note_type,
  created_at: row.created_at,
});

const sameLegacyNote = (local: LocalFollowUpNote, cloud: V1Snapshot['notes'][number]): boolean =>
  local.id === cloud.id
  && local.incident_id === cloud.incident_id
  && local.note_text === cloud.note_text
  && local.note_type === cloud.note_type
  && local.created_at === cloud.created_at;

export const productionLegacySourceAdapter: ProductionLegacySourceAdapter = {
  async loadCloudSources(ownerId) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ProductionCanonicalMigrationError('offline', 'Canonical migration needs an online connection to inspect cloud-only evidence and edit history before cutover.');
    }

    const [evidenceResult, historyResult, incidentsResult, notesResult] = await Promise.all([
      supabase.from('evidence_files').select('*').eq('user_id', ownerId),
      supabase.from('edit_history').select('*').eq('user_id', ownerId),
      supabase.from('incidents').select('id,version,updated_at').eq('user_id', ownerId),
      supabase.from('follow_up_notes').select('id,incident_id,note_text,note_type,created_at').eq('user_id', ownerId),
    ]);
    const error = evidenceResult.error ?? historyResult.error ?? incidentsResult.error ?? notesResult.error;
    if (error) throw new ProductionCanonicalMigrationError('cloud_source_unavailable', `Legacy cloud sources could not be inspected safely: ${error.message}`);

    return {
      evidence: (evidenceResult.data ?? []).map(row => ({
        id: row.id,
        incident_id: row.incident_id,
        file_name: row.file_name,
        file_path: row.file_path,
        file_hash: row.file_hash,
        mime_type: row.mime_type,
        upload_date: row.upload_date,
        ...(typeof row.file_size === 'number' ? { file_size: row.file_size } : {}),
        ...(typeof row.description === 'string' ? { description: row.description } : {}),
      })) as V1Snapshot['evidence'],
      history: (historyResult.data ?? []).map(row => ({
        id: row.id,
        incident_id: row.incident_id,
        field_changed: row.field_changed,
        changed_at: row.changed_at,
        edit_source: row.edit_source,
        ...(typeof row.old_value === 'string' ? { old_value: row.old_value } : {}),
        ...(typeof row.new_value === 'string' ? { new_value: row.new_value } : {}),
      })) as V1Snapshot['history'],
      cloudIncidents: (incidentsResult.data ?? []).map(row => ({ id: row.id, version: row.version, updated_at: row.updated_at })).sort((a, b) => a.id.localeCompare(b.id)),
      cloudNotes: (notesResult.data ?? []).map(row => ({
        id: row.id,
        incident_id: row.incident_id,
        note_text: row.note_text,
        note_type: row.note_type,
        created_at: row.created_at,
      })).sort((a, b) => a.id.localeCompare(b.id)),
    };
  },
};

export interface ProductionV1SnapshotResult {
  snapshot: V1Snapshot;
  sourceCounts: {
    localIncidents: number;
    localNotes: number;
    cloudEvidence: number;
    cloudHistory: number;
  };
}

/**
 * Build the migration snapshot from the actual legacy authorities.
 *
 * Incidents and follow-up notes are local-first, because that is where Chronicle
 * may hold newer unsynced work. Evidence and edit history remain cloud-only in
 * the legacy architecture and therefore require a successful online inspection.
 *
 * Cloud incident/note rows are used only as completeness and divergence proof.
 * If cloud contains a row missing locally, a known incident conflict, a cloud
 * incident version newer than the local copy's last observed version, or a
 * same-id note with different content, cutover stops rather than choosing a
 * winner. Local-only rows are allowed and included in migration.
 */
export const loadProductionV1Snapshot = async (
  ownerId: string,
  db: ChronicleDB = localDB,
  source: ProductionLegacySourceAdapter = productionLegacySourceAdapter,
): Promise<ProductionV1SnapshotResult> => {
  if (!ownerId) throw new ProductionCanonicalMigrationError('owner_mismatch', 'Owner id is required for production migration.');

  const [localIncidents, localNotes, cloud] = await Promise.all([
    db.incidents.where('owner_user_id').equals(ownerId).toArray(),
    db.follow_up_notes.where('owner_user_id').equals(ownerId).toArray(),
    source.loadCloudSources(ownerId),
  ]);

  if (localIncidents.some(row => row.owner_user_id !== ownerId) || localNotes.some(row => row.owner_user_id !== ownerId)) {
    throw new ProductionCanonicalMigrationError('owner_mismatch', 'A local legacy row failed the owner boundary check.');
  }

  const localIncidentById = new Map(localIncidents.map(row => [row.id, row]));
  const localNoteById = new Map(localNotes.map(row => [row.id, row]));
  const missingIncidents = cloud.cloudIncidents.filter(row => !localIncidentById.has(row.id));
  const missingNotes = cloud.cloudNotes.filter(row => !localNoteById.has(row.id));
  if (missingIncidents.length || missingNotes.length) {
    throw new ProductionCanonicalMigrationError(
      'local_source_incomplete',
      `Local-first migration source is incomplete: ${missingIncidents.length} cloud record(s) and ${missingNotes.length} cloud follow-up note(s) are missing from this device. Chronicle will not guess which copy to migrate.`,
    );
  }

  const knownConflicts = localIncidents.filter(row => row.sync_state === 'conflict');
  const cloudNewer = cloud.cloudIncidents.filter(remote => {
    const local = localIncidentById.get(remote.id)!;
    const observedRemoteVersion = local.cloud_version ?? local.version ?? 0;
    return remote.version > observedRemoteVersion;
  });
  const divergentNotes = cloud.cloudNotes.filter(remote => !sameLegacyNote(localNoteById.get(remote.id)!, remote));
  if (knownConflicts.length || cloudNewer.length || divergentNotes.length) {
    throw new ProductionCanonicalMigrationError(
      'source_conflict',
      `Legacy source is not conflict-free: ${knownConflicts.length} known record conflict(s), ${cloudNewer.length} cloud-newer record(s), and ${divergentNotes.length} divergent follow-up note(s). Resolve legacy source conflicts before canonical cutover.`,
    );
  }

  const snapshot: V1Snapshot = {
    incidents: localIncidents.map(stripLocalIncident).sort((a, b) => a.id.localeCompare(b.id)),
    notes: localNotes.map(stripLocalNote).sort((a, b) => a.id.localeCompare(b.id)),
    evidence: [...cloud.evidence].sort((a, b) => a.id.localeCompare(b.id)),
    history: [...cloud.history].sort((a, b) => a.id.localeCompare(b.id)),
  };

  return {
    snapshot,
    sourceCounts: {
      localIncidents: snapshot.incidents.length,
      localNotes: snapshot.notes.length,
      cloudEvidence: snapshot.evidence.length,
      cloudHistory: snapshot.history.length,
    },
  };
};

export interface ProductionCanonicalMigrationReport {
  source: ProductionV1SnapshotResult['sourceCounts'];
  build: CanonicalMigrationBuild;
  write: CanonicalMigrationWriteReport;
  media: CanonicalMigrationMediaImportReport;
  activation: CanonicalActivationReceipt;
}

/**
 * Staged, resumable production cutover for one explicitly selected owner.
 * Nothing deletes or rewrites the legacy source. Partial canonical writes and
 * successfully verified media imports are safe to keep when a later stage
 * blocks; rerunning is deterministic/idempotent and authority does not switch
 * until the final exact audit succeeds.
 *
 * This function is intentionally not auto-invoked by normal app startup. A
 * production rollout must explicitly select an owner for staged cutover.
 */
export const migrateProductionOwnerToCanonical = async (
  ownerId: string,
  options: {
    db?: ChronicleDB;
    source?: ProductionLegacySourceAdapter;
    downloadLegacyEvidence?: LegacyEvidenceDownloader;
    clock?: () => string;
  } = {},
): Promise<ProductionCanonicalMigrationReport> => {
  const db = options.db ?? localDB;
  const clock = options.clock ?? (() => new Date().toISOString());
  const loaded = await loadProductionV1Snapshot(ownerId, db, options.source ?? productionLegacySourceAdapter);
  const build = buildCanonicalMigration(loaded.snapshot);

  // Block before any canonical write when the deterministic projection already
  // contains unresolved values requiring handling. Safe warnings remain allowed.
  const unresolved = build.issues.filter(issue => issue.severity !== 'safe');
  if (unresolved.length) {
    throw new ProductionCanonicalMigrationError(
      'activation_blocked',
      `Canonical migration has ${unresolved.length} unresolved source issue(s); no authority change was attempted.`,
    );
  }

  const write = await applyCanonicalMigration(build, db);
  const media = await hydrateCanonicalMigrationMedia(
    build,
    ownerId,
    db,
    options.downloadLegacyEvidence,
    clock,
  );
  const audit = await auditCanonicalActivation(build, ownerId, db);
  if (!audit.ok) {
    throw new ProductionCanonicalMigrationError('activation_blocked', `Canonical activation audit failed: ${audit.reasons.join('; ')}`);
  }
  const activation = await activateCanonicalOwner(build, ownerId, db, clock);
  return { source: loaded.sourceCounts, build, write, media, activation };
};
