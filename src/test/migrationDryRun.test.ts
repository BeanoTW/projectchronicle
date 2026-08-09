// Phase 8 — migration dry-run + idempotency validation.
// Nothing here touches a real store: the planner is pure.
import { describe, it, expect } from 'vitest';
import { planMigration, WARNING_CLASS } from '@/v2/model/migrationPlan';
import { buildScaleDataset } from '@/v2/model/fixtures/scaleDataset';

const snapshot = buildScaleDataset(1000);

describe('Phase 8 — migration dry run', () => {
  it('inspects every record and maps all that are valid', () => {
    const { report } = planMigration(snapshot);
    expect(report.phase).toBe('dry_run');
    expect(report.counts.records_inspected).toBe(snapshot.incidents.length);
    expect(report.counts.records_migrated + report.counts.records_skipped_invalid + report.counts.records_skipped_already_migrated)
      .toBe(snapshot.incidents.length);
    expect(report.counts.records_skipped_invalid).toBe(0);
    expect(report.errors).toHaveLength(0);
  });

  it('preserves record identity, wording, timestamps and evidence references', () => {
    const { report, plans } = planMigration(snapshot);
    // identity
    expect(plans.map(p => p.id)).toEqual([...snapshot.incidents].map(i => i.id).sort());
    // wording + timestamps are transform-counted for every migrated record
    const byField = new Map(report.fields_transformed.map(f => [f.field, f.count]));
    expect(byField.get('raw_narrative → original.text')).toBe(report.counts.records_migrated);
    expect(byField.get('created_at → sealed_at')).toBe(report.counts.records_migrated);
    expect(byField.get('original_created_at → captured_at')).toBe(report.counts.records_migrated);
    // evidence references: every parented file is linked, none silently dropped
    const parented = snapshot.evidence.filter(e => e.incident_id && e.incident_id.startsWith('rec-')).length;
    expect(report.counts.media_linked).toBe(parented);
    const orphans = snapshot.evidence.length - parented;
    expect(report.warnings.filter(w => w.code === 'orphan_attachment')).toHaveLength(orphans);
  });

  it('carries daily records, incomplete records and clarifications', () => {
    const { report } = planMigration(snapshot);
    expect(report.counts.clarifications_created).toBe(snapshot.notes.filter(n => n.incident_id.startsWith('rec-')).length);
    expect(report.counts.history_events_created).toBe(snapshot.history.filter(h => h.incident_id.startsWith('rec-')).length);
    // empty narratives are migrated as details-only, with a warning, never dropped
    const empties = snapshot.incidents.filter(i => !(i.raw_narrative ?? '').trim()).length;
    expect(report.warnings.filter(w => w.code === 'empty_narrative')).toHaveLength(empties);
  });

  it('records unmapped values instead of dropping them', () => {
    const { report } = planMigration(snapshot);
    expect(report.unmapped.some(u => u.field === 'incidents.ai_summary')).toBe(true);
    expect(report.unmapped.some(u => u.field === 'incidents.incident_time')).toBe(true);
  });

  it('classifies every warning', () => {
    const { report, warningsByClass } = planMigration(snapshot);
    report.warnings.forEach(w => expect(WARNING_CLASS[w.code]).toBeDefined());
    expect(warningsByClass.blocker).toBe(0);
    expect(warningsByClass.safe + warningsByClass.requires_handling).toBe(report.warnings.length);
  });

  it('never mutates the snapshot it is given', () => {
    const before = JSON.stringify(snapshot);
    planMigration(snapshot);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});

describe('Phase 8 — migration idempotency', () => {
  it('produces byte-identical output when run repeatedly', () => {
    const a = planMigration(snapshot, { now: '2026-01-01T00:00:00.000Z' });
    const b = planMigration(snapshot, { now: '2026-01-01T00:00:00.000Z' });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('creates nothing a second time when records are already migrated', () => {
    const first = planMigration(snapshot);
    const migrated = new Set(first.plans.filter(p => p.action === 'migrate').map(p => p.id));
    const second = planMigration(snapshot, { alreadyMigratedIds: migrated });

    expect(second.report.counts.records_migrated).toBe(0);
    expect(second.report.counts.records_skipped_already_migrated).toBe(migrated.size);
    expect(second.report.counts.clarifications_created).toBe(0);   // no duplicate clarifications
    expect(second.report.counts.media_linked).toBe(0);             // no duplicate evidence links
    expect(second.report.counts.history_events_created).toBe(0);
    expect(second.report.errors).toHaveLength(0);
  });

  it('keeps ids and inclusion state stable across runs', () => {
    const a = planMigration(snapshot).plans.map(p => p.id);
    const b = planMigration(snapshot).plans.map(p => p.id);
    expect(b).toEqual(a);
    const inclusion = snapshot.incidents.map(i => !i.excluded_from_rep);
    planMigration(snapshot);
    expect(snapshot.incidents.map(i => !i.excluded_from_rep)).toEqual(inclusion);
  });
});
