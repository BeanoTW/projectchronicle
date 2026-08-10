// Developer-only palette switcher (temporary).
//
// Renders nothing for ordinary users: gated behind the same developer
// allowlist / dev-build check as the rest of the developer tooling.
import { useEffect, useState } from 'react';
import { useDevMode } from '@/contexts/DevModeContext';
import { PALETTES, applyPalette, readPalette, setPalette, type PaletteId } from '@/lib/themeLab';
import { useTheme } from '@/contexts/ThemeContext';
import '@/chronicle/styles.css';

const ThemeLabSwitcher = () => {
  const { canAccessDevPanel } = useDevMode();
  const { mode, setMode, resolved } = useTheme();
  const [active, setActive] = useState<PaletteId>(() => readPalette());

  // Keep <html data-palette> in sync even on first paint / hard reload.
  useEffect(() => {
    applyPalette(active);
  }, [active]);

  if (!canAccessDevPanel) return null;

  return (
    <div className="proto-themelab" data-testid="theme-lab">
      <span className="proto-themelab-title">Palette lab</span>
      {PALETTES.map(p => (
        <button
          key={p.id}
          data-active={active === p.id}
          title={p.note}
          onClick={() => {
            setPalette(p.id);
            setActive(p.id);
          }}
        >
          {p.label}
        </button>
      ))}
      <div className="proto-themelab-row">
        <button
          data-active={mode !== 'dark'}
          onClick={() => setMode('light')}
          aria-label="Preview light mode"
        >
          Light
        </button>
        <button
          data-active={resolved === 'dark'}
          onClick={() => setMode('dark')}
          aria-label="Preview dark mode"
        >
          Dark
        </button>
      </div>
    </div>
  );
};

export default ThemeLabSwitcher;
