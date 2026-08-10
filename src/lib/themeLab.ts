// Temporary palette laboratory (design evaluation only).
//
// Switches the whole application between four candidate colour systems by
// setting `data-palette` on <html>. Palettes are pure CSS-variable overrides
// declared in src/chronicle/styles.css — no component reads a palette value,
// and nothing here touches stored user data.
//
// This mechanism is intentionally temporary: remove this file, the switcher
// component and the `[data-palette=...]` blocks once a direction is chosen.

export type PaletteId =
  | 'current'
  | 'refined-paper'
  | 'slate-sage'
  | 'ink-blue'
  | 'modern'
  | 'green-slate'
  | 'graphite-emerald'
  | 'stone-olive'
  | 'midnight-green';

export const PALETTES: { id: PaletteId; label: string; note: string }[] = [
  { id: 'current', label: 'Current', note: 'Shipping paper / ink / brass' },
  { id: 'refined-paper', label: 'A · Refined Paper', note: 'Soft off-white, neutral ink, cleaner bronze' },
  { id: 'slate-sage', label: 'B · Slate & Sage', note: 'Neutral slate with a desaturated sage accent' },
  { id: 'ink-blue', label: 'C · Ink & Blue', note: 'Cool neutrals with a muted blue accent' },
  { id: 'modern', label: 'D · Modern Chronicle', note: 'Graphite neutrals with a muted clay accent' },
  { id: 'green-slate', label: 'E · Green & Slate', note: 'Cool slate neutrals with a clear considered green' },
  { id: 'graphite-emerald', label: 'F · Graphite & Emerald', note: 'Neutral graphite with a brighter emerald accent' },
  { id: 'stone-olive', label: 'G · Stone & Olive', note: 'Warm stone paper with a dry olive green' },
  { id: 'midnight-green', label: 'H · Midnight & Green', note: 'Deep slate-navy neutrals with a green accent' },
];

const STORAGE_KEY = 'chronicle.paletteLab';

const isPaletteId = (v: unknown): v is PaletteId =>
  typeof v === 'string' && PALETTES.some(p => p.id === v);

export const readPalette = (): PaletteId => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isPaletteId(v)) return v;
  } catch {
    // ignore
  }
  return 'current';
};

/** Applies the palette to <html>. Never writes application data. */
export const applyPalette = (id: PaletteId) => {
  const root = document.documentElement;
  if (id === 'current') root.removeAttribute('data-palette');
  else root.setAttribute('data-palette', id);
};

export const setPalette = (id: PaletteId) => {
  applyPalette(id);
  try {
    if (id === 'current') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
};
