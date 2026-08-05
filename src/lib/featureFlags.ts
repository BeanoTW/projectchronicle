// Chronicle migration feature flags (Phase 6).
//
// Each migrated production route is wrapped in a flag so V1 and V2 UI can
// coexist. Rollback is a configuration change (flip the default below, or a
// per-device override), never a code revert.
//
// Override precedence: URL query > localStorage > default.
//   ?ff=v2Entry:1,v2Notebook:0     — sets and persists per-device overrides
//   ?ff=reset                      — clears all overrides

export type FeatureFlag = 'v2Entry' | 'v2Notebook' | 'v2Capture' | 'v2Dossier';

/** Production defaults. Flip a value to roll a route forward or back. */
export const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  v2Entry: false,
  v2Notebook: false,
  v2Capture: false,
  v2Dossier: false,
};

export const FLAG_LABELS: Record<FeatureFlag, string> = {
  v2Entry: 'V2 record view (/incident/:id)',
  v2Notebook: 'V2 notebook (/timeline)',
  v2Capture: 'V2 capture (/record)',
  v2Dossier: 'V2 dossier (/export)',
};

const STORAGE_KEY = 'chronicle.flags';
const FLAG_NAMES = Object.keys(FLAG_DEFAULTS) as FeatureFlag[];

const isFlag = (v: string): v is FeatureFlag => (FLAG_NAMES as string[]).includes(v);

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

const writeOverrides = (next: Partial<Record<FeatureFlag, boolean>>) => {
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
  const next = { ...readOverrides() };
  for (const part of raw.split(',')) {
    const [name, value] = part.split(':');
    if (isFlag(name)) next[name] = value !== '0' && value !== 'false';
  }
  writeOverrides(next);
};

export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  const override = readOverrides()[flag];
  return override ?? FLAG_DEFAULTS[flag];
};

export const setFeatureOverride = (flag: FeatureFlag, value: boolean | null) => {
  const next = { ...readOverrides() };
  if (value === null) delete next[flag];
  else next[flag] = value;
  writeOverrides(next);
};

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
