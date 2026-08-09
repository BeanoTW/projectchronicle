// Phase 7 — developer switchboard for the V2 migration flags.
//
// "Full V2" turns every migrated route on at once for release testing. It never
// removes independence: an individual switch always wins over it, so a single
// route can still be rolled back on its own.
import { useSyncExternalStore } from 'react';
import {
  listFlags,
  subscribeToFlags,
  setFeatureOverride,
  setAllV2Override,
  getAllV2Override,
  clearFeatureOverrides,
  isFullV2Enabled,
} from '@/lib/featureFlags';

const DevV2FlagsPanel = () => {
  const state = useSyncExternalStore(
    subscribeToFlags,
    () => JSON.stringify({ flags: listFlags(), all: getAllV2Override() ?? null, full: isFullV2Enabled() }),
    () => JSON.stringify({ flags: [], all: null, full: false }),
  );
  const { flags, all, full } = JSON.parse(state) as {
    flags: Array<{ name: string; label: string; value: boolean; overridden: boolean }>;
    all: boolean | null;
    full: boolean;
  };

  return (
    <div className="mt-2 pt-2 border-t border-border">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-semibold text-foreground">V2 routes {full ? '(full V2)' : ''}</p>
        <button className="underline text-muted-foreground" onClick={() => clearFeatureOverrides()}>
          reset
        </button>
      </div>

      <label className="flex items-center gap-2 mb-1">
        <input
          type="checkbox"
          checked={all === true}
          onChange={e => setAllV2Override(e.target.checked ? true : null)}
        />
        <span className="text-foreground">Full V2 mode (all routes)</span>
      </label>

      {flags.map(f => (
        <label key={f.name} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={f.value}
            onChange={e => setFeatureOverride(f.name as never, e.target.checked)}
          />
          <span>{f.label}{f.overridden ? ' *' : ''}</span>
        </label>
      ))}
      <p className="mt-1 text-muted-foreground">* individually overridden — wins over full V2.</p>
    </div>
  );
};

export default DevV2FlagsPanel;
