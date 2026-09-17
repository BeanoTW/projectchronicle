import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ChronicleDB } from '@/local/db';
import { buildScaleDataset } from '@/chronicle/model/fixtures/scaleDataset';
import { applyCanonicalMigration, buildCanonicalMigration } from '@/chronicle/model/canonicalMigration';
import { auditCanonicalActivation } from '@/chronicle/model/canonicalActivation';
import type { V1Snapshot } from '@/chronicle/model/migrationPlan';

const cleanScaleSnapshot = (count: number): V1Snapshot => {
  const generated = buildScaleDataset(count);
  const ids = new Set(generated.incidents.map(row => row.id));
  return {
    incidents: generated.incidents.map((row, index) => ({
      ...row,
      // The scale fixture intentionally contains malformed times for UI/error
      // testing. This gate fixture exercises the clean migration path instead.
      incident_time: `${String(8 + (index % 10)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
    })),
    notes: generated.notes.filter(row => ids.has(row.incident_id)),
    // Synthetic scale evidence has metadata only, not real bytes/hashes. Media
    // cutover is now proven separately by the verified legacy-evidence import
    // tests; including fake evidence here would incorrectly claim activation
    // readiness without recoverable attachment bytes.
    evidence: [],
    history: generated.history.filter(row => ids.has(row.incident_id)),
  } as V1Snapshot;
};

describe('canonical migration release-gate scale proof', () => {
  let db: ChronicleDB | null = null;
  afterEach(async () => {
    if (!db) return;
    db.close();
    await db.delete();
    db = null;
  });

  it('projects, writes, re-runs and audits 1,000 clean legacy records without unexplained loss', async () => {
    const source = cleanScaleSnapshot(1000);
    const originalSource = JSON.stringify(source);
    const build = buildCanonicalMigration(source);

    expect(build.inspected.incidents).toBe(1000);
    expect(build.records).toHaveLength(1000);
    expect(build.issues.filter(issue => issue.severity !== 'safe')).toEqual([]);
    expect(JSON.stringify(source)).toBe(originalSource);
    expect(build.records.every(record => record.original.text === source.incidents.find(row => row.id === record.id)?.raw_narrative)).toBe(true);

    db = new ChronicleDB(`chronicle_migration_scale_${crypto.randomUUID()}`);
    const first = await applyCanonicalMigration(build, db);
    expect(first.written.records).toBe(1000);
    expect(await db.canonical_records.count()).toBe(1000);

    const second = await applyCanonicalMigration(build, db);
    expect(second.written.records).toBe(0);
    expect(second.already_present.records).toBe(1000);
    expect(await db.canonical_records.count()).toBe(1000);

    const audit = await auditCanonicalActivation(build, 'test-user', db);
    expect(audit.ok).toBe(true);
    if (audit.ok) expect(audit.counts.records).toBe(1000);
  });
});
