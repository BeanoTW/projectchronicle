// Phase 6C — Capture migration tests (pure logic + adapter contract + flag safety).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  canSealCapture, captureIsDirty, parsePeople, productionDraftKey,
  PREVIEW_DRAFT_KEY, describeFailures,
  type CaptureAdapter, type CaptureMediaItem, type MediaFailure,
} from '@/chronicle/shared/captureModel';
import {
  FLAG_DEFAULTS, isFeatureEnabled, setFeatureOverride, clearFeatureOverrides,
  setAllV2Override,
} from '@/lib/featureFlags';

/* ---------------- Seal validation ---------------- */

describe('capture seal validation', () => {
  it('allows a text-only seal', () => {
    expect(canSealCapture({ text: 'It happened', hasVoice: false, recordingActive: false })).toBe(true);
  });
  it('allows a voice-only seal', () => {
    expect(canSealCapture({ text: '   ', hasVoice: true, recordingActive: false })).toBe(true);
  });
  it('rejects attachments alone (no text, no voice)', () => {
    expect(canSealCapture({ text: '', hasVoice: false, recordingActive: false })).toBe(false);
  });
  it('blocks sealing while a recording is live', () => {
    expect(canSealCapture({ text: 'words', hasVoice: false, recordingActive: true })).toBe(false);
  });
  it('treats staged attachments and live recordings as dirty', () => {
    expect(captureIsDirty({ sealed: false, text: '', hasVoice: false, attachmentCount: 1, recordingActive: false })).toBe(true);
    expect(captureIsDirty({ sealed: false, text: '', hasVoice: false, attachmentCount: 0, recordingActive: true })).toBe(true);
    expect(captureIsDirty({ sealed: true, text: 'x', hasVoice: true, attachmentCount: 3, recordingActive: false })).toBe(false);
  });
});

/* ---------------- Draft keys ---------------- */

describe('draft keys', () => {
  it('scopes production drafts per signed-in account', () => {
    expect(productionDraftKey('user-a')).not.toBe(productionDraftKey('user-b'));
    expect(productionDraftKey('user-a')).not.toBe(PREVIEW_DRAFT_KEY);
  });
  it('falls back to an anonymous key without a user', () => {
    expect(productionDraftKey(null)).toBe('chronicle.capture.draft:anon');
  });
});

describe('review details parsing', () => {
  it('splits and trims people, dropping blanks', () => {
    expect(parsePeople(' Sam , , Line manager ')).toEqual(['Sam', 'Line manager']);
  });
});

/* ---------------- Feature flags ---------------- */

describe('v2Capture feature flag', () => {
  // Phase 8: tester hosts default to V2, so tests pin an explicit V1 baseline.
  beforeEach(() => { clearFeatureOverrides(); setAllV2Override(false); });

  it('defaults off so V1 capture remains the fallback', () => {
    expect(FLAG_DEFAULTS.v2Capture).toBe(false);   // V1 remains the public default
    expect(isFeatureEnabled('v2Capture')).toBe(false);
  });

  it('is independent of the notebook, entry and dossier flags', () => {
    setFeatureOverride('v2Capture', true);
    expect(isFeatureEnabled('v2Capture')).toBe(true);
    expect(isFeatureEnabled('v2Notebook')).toBe(false);
    expect(isFeatureEnabled('v2Entry')).toBe(false);
    expect(isFeatureEnabled('v2Dossier')).toBe(false);
  });

  it('supports every documented flag combination', () => {
    const combos: Array<[boolean, boolean, boolean]> = [
      [false, false, false], [false, true, false], [true, false, false],
      [true, true, false], [true, false, true], [true, true, true],
    ];
    for (const [capture, notebook, entry] of combos) {
      setFeatureOverride('v2Capture', capture);
      setFeatureOverride('v2Notebook', notebook);
      setFeatureOverride('v2Entry', entry);
      expect(isFeatureEnabled('v2Capture')).toBe(capture);
      expect(isFeatureEnabled('v2Notebook')).toBe(notebook);
      expect(isFeatureEnabled('v2Entry')).toBe(entry);
    }
  });

  it('restores V1 capture with one configuration change', () => {
    setFeatureOverride('v2Capture', true);
    setFeatureOverride('v2Capture', null);
    expect(isFeatureEnabled('v2Capture')).toBe(false);
  });
});

/* ---------------- Adapter contract (fake adapter, mirrors the real ones) ---------------- */

const makeFakeAdapter = (opts: { mediaFails?: boolean; detailsFails?: boolean } = {}) => {
  const records = new Map<string, { text: string; sealedAt: string; details?: unknown }>();
  const media: CaptureMediaItem[] = [];
  const createSpy = vi.fn();
  const adapter: CaptureAdapter = {
    capabilities: { voice: true, attachments: true, storageCopy: '', voicePrivacyNote: '' },
    draftKey: productionDraftKey('u1'),
    async createRecord(input) {
      createSpy();
      const id = input.submissionId;                 // idempotency key == record id
      if (!records.has(id)) records.set(id, { text: input.text, sealedAt: input.sealedAt });
      const row = records.get(id)!;
      return { recordId: id, sealedAt: row.sealedAt };
    },
    async saveMedia(recordId, items) {
      const failures: MediaFailure[] = [];
      for (const item of items) {
        if (opts.mediaFails) failures.push({ item, message: 'Upload failed.' });
        else media.push(item);
      }
      return failures;
    },
    async saveDetails(recordId, details) {
      if (opts.detailsFails) throw new Error('Details save failed.');
      records.get(recordId)!.details = details;
    },
    detailsPath: id => `/record/details/${id}`,
    recordPath: id => `/incident/${id}`,
    notebookPath: '/timeline',
  };
  return { adapter, records, media, createSpy };
};

const item = (id: string): CaptureMediaItem => ({
  id, kind: 'attachment', name: `${id}.png`, mime: 'image/png', blob: new Blob(['x']),
});

describe('capture adapter contract', () => {
  it('creating twice with the same submission id yields one record', async () => {
    const { adapter, records } = makeFakeAdapter();
    const input = { submissionId: 'sub-1', text: 'a', capturedAt: 'now', sealedAt: 'now', hasVoice: false, recordType: 'incident' as const };
    const a = await adapter.createRecord(input);
    const b = await adapter.createRecord(input);
    expect(a.recordId).toBe(b.recordId);
    expect(records.size).toBe(1);
  });

  it('reports failed media without losing the sealed record', async () => {
    const { adapter, records } = makeFakeAdapter({ mediaFails: true });
    const { recordId } = await adapter.createRecord({
      submissionId: 'sub-2', text: 'kept', capturedAt: 'n', sealedAt: 'n', hasVoice: false, recordType: 'incident' as const,
    });
    const failures = await adapter.saveMedia(recordId, [item('f1'), item('f2')]);
    expect(failures).toHaveLength(2);
    expect(records.get(recordId)!.text).toBe('kept');
    expect(describeFailures(failures)).toContain('The record was sealed');
  });

  it('retrying only the failed items can succeed later', async () => {
    const failing = makeFakeAdapter({ mediaFails: true });
    const { recordId } = await failing.adapter.createRecord({
      submissionId: 'sub-3', text: 't', capturedAt: 'n', sealedAt: 'n', hasVoice: false, recordType: 'incident' as const,
    });
    const failures = await failing.adapter.saveMedia(recordId, [item('f1')]);
    const working = makeFakeAdapter();
    const retried = await working.adapter.saveMedia(recordId, failures.map(f => f.item));
    expect(retried).toHaveLength(0);
    expect(working.media.map(m => m.id)).toEqual(['f1']);
  });

  it('review details are optional and can be skipped', async () => {
    const { adapter, records } = makeFakeAdapter();
    const { recordId } = await adapter.createRecord({
      submissionId: 'sub-4', text: 't', capturedAt: 'n', sealedAt: 'n', hasVoice: false, recordType: 'incident' as const,
    });
    expect(records.get(recordId)!.details).toBeUndefined();
  });

  it('a failing review save leaves the sealed record intact', async () => {
    const { adapter, records } = makeFakeAdapter({ detailsFails: true });
    const { recordId } = await adapter.createRecord({
      submissionId: 'sub-5', text: 'original wording', capturedAt: 'n', sealedAt: 'sealed-ts', hasVoice: false, recordType: 'incident' as const,
    });
    await expect(adapter.saveDetails(recordId, {
      category: 'x', context: null, people: [], eventDate: null, eventTime: null,
    })).rejects.toThrow();
    expect(records.get(recordId)).toMatchObject({ text: 'original wording', sealedAt: 'sealed-ts' });
  });

  it('navigation targets point at the created record or the notebook', async () => {
    const { adapter } = makeFakeAdapter();
    expect(adapter.recordPath('abc')).toBe('/incident/abc');
    expect(adapter.detailsPath('abc')).toBe('/record/details/abc');
    expect(adapter.notebookPath).toBe('/timeline');
  });
});

/* ---------------- Source isolation ---------------- */

describe('source isolation', () => {
  /** Source with comments stripped — prose mentions are fine, imports are not. */
  const imports = (p: string) =>
    readFileSync(p, 'utf8')
      .split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
      .join('\n');

  it('the production adapter never imports the preview database', () => {
    const src = imports('src/v2/shared/productionCaptureAdapter.ts');
    expect(src).not.toMatch(/chronicle_prototype|v2\/db|from '\.\.\/db'|dexie/i);
  });

  it('shared capture views never import Dexie, Supabase or production hooks', () => {
    for (const f of ['src/v2/shared/CaptureView.tsx', 'src/v2/shared/ReviewView.tsx', 'src/v2/shared/captureModel.ts']) {
      const src = imports(f);
      expect(src).not.toMatch(/dexie|supabase|@\/hooks\//i);
      expect(src).not.toMatch(/from '\.\.\/db'|from '\.\.\/media\/media'/);
    }
  });
});
