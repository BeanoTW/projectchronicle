import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readMigration = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

describe('canonical cloud SQL authority boundary', () => {
  const writeBoundary = readMigration('20260825232300_canonical_cloud_write_boundary.sql');
  const textIds = readMigration('20260825232500_canonical_text_ids.sql');

  it('removes normal authenticated direct writes and keeps RPC writes authenticated', () => {
    expect(writeBoundary).toContain('drop policy if exists "canonical_records_insert_own"');
    expect(writeBoundary).toContain('drop policy if exists "canonical_records_update_own"');
    expect(writeBoundary).toContain('drop policy if exists "canonical_records_delete_own"');
    expect(writeBoundary).toContain('drop policy if exists "canonical_children_insert_own"');
    expect(textIds).toContain("uid uuid := auth.uid()");
    expect(textIds).toContain("if uid is null then raise exception 'authentication required'");
  });

  it('preserves opaque text ids and scopes primary identity by owner', () => {
    expect(textIds).toContain('alter column id type text using id::text');
    expect(textIds).toContain('primary key (owner_id, id)');
    expect(textIds).toContain('primary key (owner_id, kind, id)');
    expect(textIds).toContain('row_id text');
    expect(textIds).toContain('row_record_id text');
  });

  it('binds media metadata to the exact owner/record/media storage path and integrity hash', () => {
    expect(textIds).toContain("expected_media_path := uid::text || '/' || row_record_id || '/' || row_id");
    expect(textIds).toContain('canonical media path mismatch');
    expect(textIds).toContain('canonical media integrity hash required');
  });

  it('enforces sealed-original immutability and relationship entity existence server-side', () => {
    expect(textIds).toContain("current_row.payload -> 'original' is distinct from row_payload -> 'original'");
    expect(textIds).toContain('sealed canonical record fields are immutable');
    expect(textIds).toContain('canonical relationship entity not found');
  });

  it('keeps record acknowledgement retries idempotent after a committed server update', () => {
    expect(textIds).toContain('current_row.local_revision = row_local_revision');
    expect(textIds).toContain("(current_row.payload - 'sync') = (row_payload - 'sync')");
    expect(textIds).toContain("return jsonb_build_object('status', 'ok', 'remote_revision', current_remote_revision)");
  });
});
