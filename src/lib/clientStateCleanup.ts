// Phase 11 — one-time obsolete client state cleanup.
//
// Chronicle used to ship a V1/V2 split: feature flags, tester rollout markers,
// navigation-ownership state and a separate prototype database. None of that
// exists any more, but a returning browser can still hold those keys and, in
// the worst case, an old cached app shell. This module removes ONLY that
// obsolete state.
//
// It never touches:
//   - canonical records (IndexedDB `chronicle_local`)
//   - the Supabase auth session
//   - live preferences (`chronicle.theme`, privacy shield, lock config)

const CLEANUP_MARKER = 'chronicle.cleanup.phase11';

/** Exact obsolete keys (localStorage + sessionStorage). */
export const OBSOLETE_EXACT_KEYS = [
  'chronicle.v2Flags',
  'chronicle.v2.flags',
  'chronicle.featureFlags',
  'chronicle.flags',
  'chronicle.fullV2',
  'chronicle.v2.fullMode',
  'chronicle.v2.enabled',
  'chronicle.tester',
  'chronicle.testerOptIn',
  'chronicle.navOwnership',
  'chronicle.nav.owner',
  'chronicle.layout',
  'chronicle.layout.pref',
  'chronicle.layoutPreference',
  'chronicle.preview',
  'chronicle.previewMode',
  'chronicle.prototype',
  'chronicle.migration.complete',
  'chronicle.appVersionSwitch',
] as const;

/** Any key starting with one of these prefixes is obsolete. */
export const OBSOLETE_KEY_PREFIXES = [
  'chronicle.v2',
  'chronicle-v2',
  'chronicle.proto',
  'chronicle-proto',
  'chronicle.flag',
  'chronicle-flag',
  'v2.',
  'v2:',
] as const;

/** Prototype/preview databases that no longer back any screen. */
export const OBSOLETE_DATABASES = ['chronicle_prototype', 'chronicle_v2', 'chronicle_preview'];

const isObsolete = (key: string): boolean =>
  (OBSOLETE_EXACT_KEYS as readonly string[]).includes(key) ||
  OBSOLETE_KEY_PREFIXES.some(p => key.startsWith(p));

const purgeStore = (store: Storage | null): string[] => {
  if (!store) return [];
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (k && isObsolete(k)) doomed.push(k);
  }
  doomed.forEach(k => { try { store.removeItem(k); } catch { /* ignore */ } });
  return doomed;
};

const safe = (fn: () => Storage | null): Storage | null => {
  try { return fn(); } catch { return null; }
};

/**
 * Removes obsolete keys. Safe to call repeatedly; the marker only prevents the
 * heavier one-time work (database + cache deletion).
 */
export const cleanupObsoleteClientState = (): { removed: string[]; firstRun: boolean } => {
  const local = safe(() => (typeof localStorage === 'undefined' ? null : localStorage));
  const session = safe(() => (typeof sessionStorage === 'undefined' ? null : sessionStorage));

  const removed = [...purgeStore(local), ...purgeStore(session)];

  let firstRun = false;
  try { firstRun = local?.getItem(CLEANUP_MARKER) !== '1'; } catch { /* ignore */ }

  if (firstRun) {
    // Prototype databases: user records never lived here.
    try {
      OBSOLETE_DATABASES.forEach(name => { indexedDB.deleteDatabase(name); });
    } catch { /* ignore */ }

    // A stale service-worker cache is the only way an old app shell can still
    // be served. Records are not cached there, so dropping it is safe.
    if (typeof caches !== 'undefined') {
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .catch(() => { /* ignore */ });
    }

    try { local?.setItem(CLEANUP_MARKER, '1'); } catch { /* ignore */ }
  }

  return { removed, firstRun };
};
