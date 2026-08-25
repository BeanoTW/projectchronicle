import { describe, expect, it } from 'vitest';
import { CaptureHelperAuthorityChangedError, createCaptureWriteRouter } from '@/chronicle/shared/canonicalCaptureAdapter';
import type { CaptureAdapter, CaptureSealInput } from '@/chronicle/shared/captureModel';

const fakeAdapter = (name: string, calls: string[]): CaptureAdapter => ({
  capabilities: { voice: true, attachments: true, storageCopy: '', voicePrivacyNote: '' },
  draftKey: `${name}-draft`,
  async createRecord(input) { calls.push(`${name}:create`); return { recordId: input.submissionId, sealedAt: input.sealedAt }; },
  async saveMedia() { return []; },
  async saveDetails() {},
  detailsPath: id => `/details/${id}`,
  recordPath: id => `/record/${id}`,
  notebookPath: '/records',
});

const input: CaptureSealInput = {
  submissionId: 'record-1',
  text: 'Original wording.',
  capturedAt: '2026-08-25T16:00:00.000Z',
  sealedAt: '2026-08-25T16:01:00.000Z',
  hasVoice: false,
  recordType: 'incident',
  inputHelper: { interactionState: 'SHOWN_NO_INTERACTION', helperVersion: 'structure-helper/1.0' },
};

describe('Phase 5 — helper authority fail-safe', () => {
  it('refuses a legacy fallback if helper participation was recorded', async () => {
    const calls: string[] = [];
    const router = createCaptureWriteRouter({
      legacy: fakeAdapter('legacy', calls),
      canonical: fakeAdapter('canonical', calls),
      canonicalEnabled: async () => false,
      canonicalRecordExists: async () => false,
    });

    await expect(router.createRecord(input)).rejects.toBeInstanceOf(CaptureHelperAuthorityChangedError);
    expect(calls).toEqual([]);
  });

  it('allows the same helper state when canonical authority is active', async () => {
    const calls: string[] = [];
    const router = createCaptureWriteRouter({
      legacy: fakeAdapter('legacy', calls),
      canonical: fakeAdapter('canonical', calls),
      canonicalEnabled: async () => true,
      canonicalRecordExists: async () => true,
    });

    await router.createRecord(input);
    expect(calls).toEqual(['canonical:create']);
  });
});
