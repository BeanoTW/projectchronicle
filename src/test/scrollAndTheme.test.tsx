// Scroll + palette regression coverage.
//
// Guards this pass's two fixes: (1) no screen carries duplicated viewport
// height / bottom-nav spacing that produces a large blank scroll region,
// (2) forward navigation starts the destination at the top while Back is
// left to the browser, (3) palette switching is presentation-only.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import ScrollRestoration, { resetScroll } from '@/components/chronicle/ScrollRestoration';
import { PALETTES, applyPalette, readPalette, setPalette } from '@/lib/themeLab';

const css = readFileSync(join(process.cwd(), 'src/chronicle/styles.css'), 'utf8');

describe('layout — no excess scroll below content', () => {
  it('viewport height is claimed only by the true page roots', () => {
    // A blanket `.proto-root { min-height: 100dvh }` stacked viewport heights
    // for every nested .proto-root (surface, bottom nav, side rail).
    const rootBlock = css
      .slice(css.indexOf('.proto-root {'), css.indexOf('.proto-serif'))
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rootBlock).not.toMatch(/min-height:\s*100dvh/);
    expect(css).toMatch(/\.proto-root\.proto-shell\s*\{[^}]*min-height:\s*100dvh/);
  });

  it('bottom-nav clearance is not duplicated by the page surface', () => {
    const surface = css.slice(css.indexOf('.proto-root.proto-surface {'));
    const block = surface.slice(0, surface.indexOf('}'));
    expect(block).not.toMatch(/env\(safe-area-inset-bottom/);
    expect(block).not.toMatch(/padding-bottom:\s*calc\(1\d\dpx/);
  });

  it('the single bottom spacer still keeps final controls above the nav', () => {
    const nav = readFileSync(join(process.cwd(), 'src/components/chronicle/AppBottomNav.tsx'), 'utf8');
    expect(nav).toMatch(/height: 72/);
    expect(nav).toMatch(/env\(safe-area-inset-bottom/);
  });
});

const Probe = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
};

describe('route scroll restoration', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  it('resets every scroll owner, including the desktop shell container', () => {
    const shell = document.createElement('div');
    shell.className = 'proto-shell-main';
    shell.scrollTop = 500;
    document.body.appendChild(shell);
    resetScroll();
    expect(shell.scrollTop).toBe(0);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    shell.remove();
  });

  it('scrolls to top on forward navigation', () => {
    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <ScrollRestoration />
        <Routes>
          <Route path="/timeline" element={<Probe to="/export" />} />
          <Route path="/export" element={<div>My Record</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('leaves POP (Back/Forward) restoration to the browser', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/chronicle/ScrollRestoration.tsx'), 'utf8');
    expect(src).toMatch(/navigationType === 'POP'\) return/);
  });
});

describe('palette laboratory', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-palette');
  });

  it('exposes four candidate directions plus the current palette', () => {
    expect(PALETTES.map(p => p.id)).toEqual([
      'current', 'refined-paper', 'slate-sage', 'ink-blue', 'modern',
    ]);
  });

  it('every direction defines light and dark token sets', () => {
    PALETTES.filter(p => p.id !== 'current').forEach(p => {
      expect(css).toContain(`:root[data-palette="${p.id}"] .proto-root`);
      expect(css).toContain(`:root.dark[data-palette="${p.id}"] .proto-root`);
    });
  });

  it('switching only sets a presentation attribute and its own key', () => {
    localStorage.setItem('chronicle.records', 'untouched');
    setPalette('ink-blue');
    expect(document.documentElement.getAttribute('data-palette')).toBe('ink-blue');
    expect(readPalette()).toBe('ink-blue');
    expect(localStorage.getItem('chronicle.records')).toBe('untouched');

    setPalette('current');
    expect(document.documentElement.hasAttribute('data-palette')).toBe(false);
    expect(localStorage.getItem('chronicle.records')).toBe('untouched');
  });

  it('palettes are token-only, so all screens keep identical functionality', () => {
    PALETTES.filter(p => p.id !== 'current').forEach(p => {
      applyPalette(p.id);
      const block = css.slice(css.indexOf(`:root[data-palette="${p.id}"] .proto-root`));
      const decls = block.slice(0, block.indexOf('}'));
      // Only custom properties may be declared by a palette.
      decls
        .split('\n')
        .filter(l => l.includes(':') && !l.includes('data-palette'))
        .forEach(l => expect(l.trim().startsWith('--p-')).toBe(true));
    });
  });
});
