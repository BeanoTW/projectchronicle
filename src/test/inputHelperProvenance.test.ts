import { describe, expect, it } from 'vitest';
import { createCanonicalCaptureAdapter, type CanonicalCaptureStore } from '@/chronicle/shared/canonicalCaptureAdapter';
import type { V2Record } from '@/chronicle/model/schema';

const sealedAt = '2026-08-25T16:01:00.000Z';

const baseRecord = (input: Parameters<CanonicalCaptureStore['seal']>[0]): V2Record => ({
  id: input.id,
  owner_id: input.owner_id,
  kind: input.kind,
  schema_version: 2,
  original: input.original,
  details: {
    title: null,
    category_id: null,
    context: null,
    person_ids: [],
    location: null,
    event_date: null,
    event_time: null,
    revision_count: 0,
  },
  lifecycle: { state: 'sealed' },
  dossier: { state: 'not_included' },
  captured_at: input.captured_at,
  sealed_at: input.sealed_at,
  created_at: input.sealed_at,
  updated_at: input.sealed_at,
  sync: { remote_version: null, local_revision: 0, state: { state: 'local_only' }, last_attempt_at: null },
});

describe('Phase 5 — Capture helper provenance handoff', () => {
  it('passes accepted helper state, count and version into the immutable canonical seal', async () => {
    let sealedInput: Parameters<CanonicalCaptureStore['seal']>[0] | null = null;
    const store = {
      async seal(input: Parameters<CanonicalCaptureStore['seal']>[0]) {
        sealedInput = input;
        return baseRecord(input);
      },
    } as unknown as CanonicalCaptureStore;

    const adapter = createCanonicalCaptureAdapter('owner-1', store);
    await adapter.createRecord({
      submissionId: 'record-1',
      text: 'Original user wording.',
      capturedAt: '2026-08-25T16:00:00.000Z',
      sealedAt,
      hasVoice: false,
      media: [],
      recordType: 'incident',
      inputHelper: {
        interactionState: 'SUGGESTION_ACCEPTED',
        acceptedSuggestionCount: 2,
        helperVersion: 'structure-helper/1.0',
      },
    });

    expect(sealedInput?.original.provenance).toEqual({
      schema_version: 1,
      tracking_state: 'RECORDED',
      input_helper: {
        interaction_state: 'SUGGESTION_ACCEPTED',
        accepted_suggestion_count: 2,
        helper_version: 'structure-helper/1.0',
      },
    });
  });

  it('does not invent a clean helper claim when no helper state is supplied', async () => {
    let sealedInput: Parameters<CanonicalCaptureStore['seal']>[0] | null = null;
    const store = {
      async seal(input: Parameters<CanonicalCaptureStore['seal']>[0]) {
        sealedInput = input;
        return baseRecord(input);
      },
    } as unknown as CanonicalCaptureStore;

    const adapter = createCanonicalCaptureAdapter('owner-1', store);
    await adapter.createRecord({
      submissionId: 'record-2',
      text: 'Original user wording.',
      capturedAt: '2026-08-25T16:00:00.000Z',
      sealedAt,
      hasVoice: false,
      media: [],
      recordType: 'incident',
    });

    expect(sealedInput?.original.provenance).toEqual({ schema_version: 1, tracking_state: 'NOT_RECORDED' });
  });
});
