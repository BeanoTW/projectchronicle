// Prototype-only Dexie database.
// FULLY ISOLATED from production data:
//   - Separate IndexedDB database name: "chronicle_prototype"
//   - Separate table shape (prototype_entries) — does not mirror production `incidents`.
//   - No writes ever hit the production `chronicle_local` DB or Supabase.
//   - No Supabase client is imported from this module.
//
// Reset: call `resetPrototypeDB()` (wired to the shell's "Reset demo data" action)
// or manually delete the IndexedDB database "chronicle_prototype" via devtools.
import Dexie, { type Table } from 'dexie';

export type EntryStatus = 'sealed' | 'clarified' | 'in_dossier';

export interface PrototypeEntry {
  id: string;
  // Original brain-dump. Immutable after sealing.
  original_text: string;
  sealed_at: string;          // ISO — the moment Seal was pressed
  captured_at: string;        // ISO — start of typing session
  // Optional Review fields — filled after sealing, may be null.
  category: string | null;
  context: string | null;
  people: string[];
  event_date: string | null;  // ISO date (YYYY-MM-DD)
  event_time: string | null;  // HH:MM
  // Post-seal state.
  clarifications: Array<{ id: string; text: string; created_at: string }>;
  in_dossier: boolean;
  title: string | null;       // optional short label
}

export interface PrototypeMeta {
  key: string;
  value: string;
}

class PrototypeDB extends Dexie {
  entries!: Table<PrototypeEntry, string>;
  meta!: Table<PrototypeMeta, string>;

  constructor() {
    super('chronicle_prototype');
    this.version(1).stores({
      entries: 'id, sealed_at, event_date, in_dossier',
      meta: 'key',
    });
  }
}

export const protoDB = new PrototypeDB();

export const PROTOTYPE_DB_NAME = 'chronicle_prototype';

export async function resetPrototypeDB() {
  await protoDB.entries.clear();
  await protoDB.meta.clear();
  await seedPrototypeIfEmpty(true);
}

export async function seedPrototypeIfEmpty(force = false) {
  const count = await protoDB.entries.count();
  if (count > 0 && !force) return;
  const { seedEntries } = await import('./seed');
  await protoDB.entries.bulkPut(seedEntries());
  await protoDB.meta.put({ key: 'seeded_at', value: new Date().toISOString() });
}
