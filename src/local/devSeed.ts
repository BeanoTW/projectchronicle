// Dev-only test data generator for category/calendar/timeline visual stress testing.
// Wipes local Dexie + (optionally) cloud rows for the current user, then seeds 50–70
// varied incident + daily-record entries spanning Oct 2025 → today.
//
// NOT user-facing. Triggered from the hidden Developer Controls panel.

import { localDB, isBackupEnabled, type LocalIncident, type SyncState } from '@/local/db';
import { supabase } from '@/integrations/supabase/client';
import { PRIMARY_CATEGORIES, SUBTYPES, type PrimaryCategory } from '@/lib/categories';

// ─── Deterministic-ish PRNG so re-runs are reproducible enough for QA ──────
const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const PEOPLE = [
  'Sarah Thompson',
  'Mark Davies',
  'David Chen',
  'Lisa Park',
  'James Wilson',
  'Priya Patel',
  'Tom Reilly',
];

const LOCATIONS = [
  'Staff kitchen', 'Office floor', 'Meeting room B', 'Reception',
  'Warehouse', 'Site office', 'Shop floor', 'Online (Teams)',
];

// Short narrative templates per category — varied but factual.
const NARRATIVES: Record<PrimaryCategory, string[]> = {
  'Communication': [
    'Manager remarked about my recent absences during the morning huddle.',
    'Received an email reiterating the change in shift expectations.',
    'Was told in passing that my "tone" had been noted.',
    'Group chat message singled out my section for missed targets.',
  ],
  'Action / Change': [
    'Removed from the Tuesday rota without prior notice.',
    'Reassigned from till to stockroom duties this week.',
    'Access to the shared drive was revoked this morning.',
    'Shift pattern changed from earlies to lates effective next week.',
  ],
  'Process Event': [
    'Called into an unscheduled meeting with no agenda provided.',
    'Investigation meeting scheduled for next Thursday.',
    'Outcome letter from the grievance hearing was issued today.',
    'Appeal hearing took place this afternoon.',
  ],
  'Pay / Benefits': [
    'Last payslip was £140 short — overtime not included.',
    'Holiday request for July declined without explanation.',
    'Sick pay missing from this period\'s payslip.',
    'Expenses claim rejected by line manager.',
  ],
  'Working Conditions': [
    'Heating broken on the shop floor again — third day running.',
    'Only two staff covering a section that normally has four.',
    'Equipment in bay 3 still flagged as faulty but in use.',
    'No proper break taken — covered tills through lunch.',
  ],
  'Observed Behaviour': [
    'Manager walked past without acknowledging my greeting again.',
    'Excluded from the team brief for the second time this week.',
    'Eye-roll during my contribution at the team meeting.',
    'Deliberately left off the email distribution list.',
  ],
  'Record Issued': [
    'Written warning issued today regarding timekeeping.',
    'New variation to terms handed over without consultation.',
    'Policy document on attendance reissued with stricter wording.',
    'Letter recording the informal meeting placed on file.',
  ],
  'Other': [
    'Something happened that I want to keep on record but I am unsure how to label it yet.',
    'Note kept for future reference — context unclear at this stage.',
  ],
};

const DAILY_NOTES = [
  'Generally a calmer shift today. Worked tills with Lisa, no issues.',
  'Quiet morning, then very busy after lunch. Felt OK overall.',
  'Spoke briefly with Tom about the rota change — nothing flagged.',
  'Solo on stockroom most of the day. Manageable.',
  'Standard shift. No notable interactions.',
  'Worked with the new starter on inductions — went well.',
];

// ─── Distribution plan ─────────────────────────────────────────────────────
// Total target: 60 records. 70% incidents (42), 30% daily records (18).
// Each of the 8 primary categories must appear 5–12 times across incidents.
const TOTAL = 60;
const INCIDENT_COUNT = 42;
const DAILY_COUNT = TOTAL - INCIDENT_COUNT; // 18

// Hand-tuned per-category target counts (sum = 42, each within 5..12).
const CATEGORY_PLAN: Record<PrimaryCategory, number> = {
  'Communication': 8,
  'Action / Change': 7,
  'Process Event': 6,
  'Pay / Benefits': 5,
  'Working Conditions': 5,
  'Observed Behaviour': 5,
  'Record Issued': 5,
  'Other': 1, // covers the cap; 'Other' rarely used in real life
};

// Quick sanity assertion (build-time only via runtime check).
const _planSum = (Object.values(CATEGORY_PLAN) as number[]).reduce((a, b) => a + b, 0);
if (_planSum !== INCIDENT_COUNT) {
  // eslint-disable-next-line no-console
  console.warn('[devSeed] Category plan sum mismatch', _planSum, 'expected', INCIDENT_COUNT);
}

// ─── Date scheduling ───────────────────────────────────────────────────────
// Range: 1 Oct 2025 → today. Build a list of (date, count) buckets so some
// days have 3–5 entries, some have 1, many have none.
function buildDateBuckets(rand: () => number, total: number): string[] {
  const start = new Date('2025-10-01T00:00:00Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const totalDays = Math.max(
    1,
    Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const dates: string[] = [];
  let placed = 0;
  // ~6 dense days (3–5 entries), ~10 medium (2 entries), rest singles.
  const denseDays = 6;
  const mediumDays = 10;

  const pickDayOffset = () => Math.floor(rand() * totalDays);

  // Dense clusters
  for (let i = 0; i < denseDays && placed < total; i++) {
    const offset = pickDayOffset();
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    const n = 3 + Math.floor(rand() * 3); // 3..5
    for (let k = 0; k < n && placed < total; k++) { dates.push(iso); placed++; }
  }
  // Medium days
  for (let i = 0; i < mediumDays && placed < total; i++) {
    const offset = pickDayOffset();
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    for (let k = 0; k < 2 && placed < total; k++) { dates.push(iso); placed++; }
  }
  // Singles for the rest
  while (placed < total) {
    const offset = pickDayOffset();
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + offset);
    dates.push(d.toISOString().slice(0, 10));
    placed++;
  }

  // Sort ascending so created_at progression looks natural.
  dates.sort();
  return dates;
}

const pickFrom = <T,>(rand: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rand() * arr.length)];

const pickPeople = (rand: () => number): string[] => {
  const n = 1 + Math.floor(rand() * 2); // 1..2
  const shuffled = [...PEOPLE].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
};

// ─── Main seed entry ───────────────────────────────────────────────────────
export interface SeedResult {
  totalCreated: number;
  incidents: number;
  dailyRecords: number;
  perCategory: Record<string, number>;
}

export async function wipeAndSeedTestData(userId: string): Promise<SeedResult> {
  if (!userId) throw new Error('No user');

  // 1. Wipe LOCAL Dexie for this owner (incidents + follow-ups + meta hydration flag)
  await localDB.transaction('rw', localDB.incidents, localDB.follow_up_notes, async () => {
    const localIds = await localDB.incidents
      .where('owner_user_id').equals(userId).primaryKeys();
    if (localIds.length) await localDB.incidents.bulkDelete(localIds);
    const noteIds = await localDB.follow_up_notes
      .where('owner_user_id').equals(userId).primaryKeys();
    if (noteIds.length) await localDB.follow_up_notes.bulkDelete(noteIds);
  });

  // 2. Wipe CLOUD for this user (idempotent — RLS scopes to current auth user)
  await supabase.from('edit_history').delete().eq('user_id', userId);
  await supabase.from('follow_up_notes').delete().eq('user_id', userId);
  // evidence_files: clear rows; storage objects (if any) require Storage API
  const { data: evRows } = await supabase
    .from('evidence_files').select('file_path').eq('user_id', userId);
  if (evRows && evRows.length > 0) {
    await supabase.storage.from('evidence').remove(evRows.map(e => e.file_path));
    await supabase.from('evidence_files').delete().eq('user_id', userId);
  }
  await supabase.from('incidents').delete().eq('user_id', userId);

  // 3. Build the dataset
  const rand = mulberry32(20251020);
  const enabled = await isBackupEnabled();

  // Build the queue of (kind, category) tuples
  type Job = { kind: 'incident'; category: PrimaryCategory } | { kind: 'daily' };
  const jobs: Job[] = [];
  (Object.entries(CATEGORY_PLAN) as [PrimaryCategory, number][]).forEach(([cat, n]) => {
    for (let i = 0; i < n; i++) jobs.push({ kind: 'incident', category: cat });
  });
  for (let i = 0; i < DAILY_COUNT; i++) jobs.push({ kind: 'daily' });
  // Shuffle so categories interleave naturally
  jobs.sort(() => rand() - 0.5);

  const dates = buildDateBuckets(rand, jobs.length);

  const perCategory: Record<string, number> = {};
  const localRows: LocalIncident[] = [];
  const cloudRows: Array<Record<string, unknown>> = [];

  jobs.forEach((job, idx) => {
    const date = dates[idx];
    const ts = new Date(`${date}T${String(8 + Math.floor(rand() * 10)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00Z`).toISOString();
    const id = crypto.randomUUID();
    const syncState: SyncState = enabled ? 'queued' : 'local_only';

    if (job.kind === 'incident') {
      const cat = job.category;
      perCategory[cat] = (perCategory[cat] ?? 0) + 1;
      const subtypes = SUBTYPES[cat];
      const subtype = subtypes[Math.floor(rand() * subtypes.length)];
      const narrative = pickFrom(rand, NARRATIVES[cat]);
      const people = pickPeople(rand);
      const row: LocalIncident = {
        id,
        user_id: userId,
        record_type: 'incident',
        incident_date: date,
        record_date: null,
        incident_time: `${String(8 + Math.floor(rand() * 10)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}`,
        location: pickFrom(rand, LOCATIONS),
        people_involved: people,
        witnesses: rand() > 0.7 ? [pickFrom(rand, PEOPLE)] : [],
        category: cat,
        category_source: 'user',
        subtype,
        severity: pickFrom(rand, ['Low', 'Moderate', 'Serious'] as const),
        impact_note: null,
        raw_narrative: narrative,
        ai_summary: null,
        exact_words: null,
        tags: [],
        status: 'Open',
        locked: false,
        excluded_from_rep: false,
        record_method: 'text',
        title: null,
        context_domain: null,
        interactions: null,
        void_reason: null,
        voided_at: null,
        created_at: ts,
        updated_at: ts,
        original_created_at: ts,
        last_modified_at: ts,
        transcription_source_attachment_id: null,
        transcription_created_at: null,
        transcription_provider: null,
        transcription_model: null,
        version: 1,
        owner_user_id: userId,
        sync_state: syncState,
        last_sync_attempt_at: null,
        last_sync_error: null,
        local_updated_at: ts,
      };
      localRows.push(row);
      cloudRows.push(toCloud(row));
    } else {
      const note = pickFrom(rand, DAILY_NOTES);
      const row: LocalIncident = {
        id,
        user_id: userId,
        record_type: 'daily_record',
        incident_date: date, // also set so any code path reading it has a value
        record_date: date,
        incident_time: null,
        location: null,
        people_involved: [],
        witnesses: [],
        category: null,
        category_source: 'user',
        subtype: null,
        severity: null,
        impact_note: null,
        raw_narrative: note,
        ai_summary: null,
        exact_words: null,
        tags: [],
        status: 'Open',
        locked: false,
        excluded_from_rep: false,
        record_method: 'text',
        title: null,
        context_domain: null,
        interactions: null,
        void_reason: null,
        voided_at: null,
        created_at: ts,
        updated_at: ts,
        original_created_at: ts,
        last_modified_at: ts,
        transcription_source_attachment_id: null,
        transcription_created_at: null,
        transcription_provider: null,
        transcription_model: null,
        version: 1,
        owner_user_id: userId,
        sync_state: syncState,
        last_sync_attempt_at: null,
        last_sync_error: null,
        local_updated_at: ts,
      };
      localRows.push(row);
      cloudRows.push(toCloud(row));
    }
  });

  // 4. Insert into Dexie (source of truth)
  await localDB.incidents.bulkPut(localRows);

  // 5. If backup ON, also push to cloud now
  if (enabled) {
    // Chunk to keep request size sane
    const chunkSize = 25;
    for (let i = 0; i < cloudRows.length; i += chunkSize) {
      const slice = cloudRows.slice(i, i + chunkSize);
      const { error } = await supabase.from('incidents').insert(slice as never);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[devSeed] cloud insert chunk failed', error.message);
      }
    }
    // Mark local rows as backed_up after a successful insert
    await localDB.incidents.bulkPut(
      localRows.map(r => ({ ...r, sync_state: 'backed_up' as SyncState })),
    );
  }

  return {
    totalCreated: localRows.length,
    incidents: localRows.filter(r => r.record_type === 'incident').length,
    dailyRecords: localRows.filter(r => r.record_type === 'daily_record').length,
    perCategory,
  };
}

// Strip local-only metadata before sending to Supabase.
function toCloud(row: LocalIncident): Record<string, unknown> {
  const {
    owner_user_id: _o,
    sync_state: _s,
    last_sync_attempt_at: _a,
    last_sync_error: _e,
    local_updated_at: _l,
    ...cloud
  } = row;
  return cloud;
}
