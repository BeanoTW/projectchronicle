// Chronicle migration feature flags (Phase 6).
//
// Each migrated production route is wrapped in a flag so V1 and V2 UI can
// coexist. Rollback is a configuration change (flip the default below, or a
// per-device override), never a code revert.
//
// Override precedence: URL query > localStorage > default.
//   ?ff=v2Entry:1,v2Notebook:0     — sets and persists per-device overrides
//   ?ff=reset                      — clears all overrides

export type FeatureFlag = 'v2Entry' | 'v2Notebook' | 'v2Capture' | 'v2Dossier' | 'v2Settings';

/** Production defaults. Flip a value to roll a route forward or back. */
export const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  v2Entry: false,
  v2Notebook: false,
  v2Capture: false,
  v2Dossier: false,
  v2Settings: false,
};

export const FLAG_LABELS: Record<FeatureFlag, string> = {
  v2Entry: 'V2 record view (/incident/:id)',
  v2Notebook: 'V2 notebook (/timeline)',
  v2Capture: 'V2 capture (/record)',
  v2Dossier: 'V2 dossier (/export)',
  v2Settings: 'V2 settings (/settings)',
};

const STORAGE_KEY = 'chronicle.flags';
const FLAG_NAMES = Object.keys(FLAG_DEFAULTS) as FeatureFlag[];

/**
 * Phase 7 convenience override: turns every V2 route on (or off) at once for
 * development and release testing. It never removes flag independence — an
 * individual override always wins over it:
 *
 *   individual override  >  v2All override  >  FLAG_DEFAULTS
 *
 *   ?ff=v2All:1                — full V2 mode
 *   ?ff=v2All:1,v2Dossier:0    — full V2 except the dossier
 *   ?ff=reset                  — back to defaults
 */
export const ALL_KEY = 'v2All';

const isFlag = (v: string): v is FeatureFlag => (FLAG_NAMES as string[]).includes(v);

const readRaw = (): Record<string, unknown> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const readAllOverride = (): boolean | undefined => {
  const v = readRaw()[ALL_KEY];
  return typeof v === 'boolean' ? v : undefined;
};

const readOverrides = (): Partial<Record<FeatureFlag, boolean>> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<FeatureFlag, boolean>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (isFlag(k) && typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
};

/** Persists the whole override object (individual flags + the v2All key). */
const writeRaw = (next: Record<string, unknown>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* storage unavailable — flags fall back to defaults */ }
  listeners.forEach(l => l());
};

const listeners = new Set<() => void>();

/** Applies `?ff=` overrides once at startup. Safe to call repeatedly. */
export const applyFlagOverridesFromUrl = () => {
  if (typeof window === 'undefined') return;
  const raw = new URLSearchParams(window.location.search).get('ff');
  if (!raw) return;
  if (raw === 'reset') {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    listeners.forEach(l => l());
    return;
  }
  const next = { ...readRaw() };
  for (const part of raw.split(',')) {
    const [name, value] = part.split(':');
    const on = value !== '0' && value !== 'false';
    if (isFlag(name)) next[name] = on;
    else if (name === ALL_KEY) next[ALL_KEY] = on;
  }
  writeRaw(next);
};

/**
 * Phase 8 — tester default-on.
 *
 * V2 is the normal experience in the tester/preview environments only. The
 * public production hosts keep the V1 defaults until tester acceptance is in.
 * Rollback stays a per-device configuration change:
 *   ?ff=v2All:0            — whole app back to V1
 *   ?ff=v2Capture:0        — one route back to V1
 */
export const TESTER_HOST_PATTERNS = [/(^|\.)lovable\.app$/, /^localhost$/, /^127\.0\.0\.1$/];

export const isTesterEnvironment = (host?: string): boolean => {
  const h = host ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  return TESTER_HOST_PATTERNS.some(re => re.test(h));
};

/** Defaults actually in force, before any per-device override. */
export const environmentDefault = (flag: FeatureFlag): boolean =>
  isTesterEnvironment() ? true : FLAG_DEFAULTS[flag];

export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  const override = readOverrides()[flag];
  if (override !== undefined) return override;      // individual flags stay independent
  const all = readAllOverride();
  if (all !== undefined) return all;
  return environmentDefault(flag);
};

/** True when every V2 route resolves to V2 — however that was reached. */
export const isFullV2Enabled = (): boolean => FLAG_NAMES.every(isFeatureEnabled);

export const setFeatureOverride = (flag: FeatureFlag, value: boolean | null) => {
  const next = { ...readRaw() };
  if (value === null) delete next[flag];
  else next[flag] = value;
  writeRaw(next);
};

/** Set (or clear, with `null`) the all-routes override. */
export const setAllV2Override = (value: boolean | null) => {
  const next = { ...readRaw() };
  if (value === null) delete next[ALL_KEY];
  else {
    next[ALL_KEY] = value;
    // Clearing individual overrides makes the switch predictable; they can be
    // set again afterwards and will continue to win.
    FLAG_NAMES.forEach(n => delete next[n]);
  }
  writeRaw(next);
};

export const getAllV2Override = (): boolean | undefined => readAllOverride();

export const clearFeatureOverrides = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  listeners.forEach(l => l());
};

export const subscribeToFlags = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const listFlags = () =>
  FLAG_NAMES.map(name => ({
    name,
    label: FLAG_LABELS[name],
    value: isFeatureEnabled(name),
    overridden: readOverrides()[name] !== undefined,
  }));
