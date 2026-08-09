// Phase 11 — canonical shell regression tests.
//
// Guards the two release blockers: (1) every account gets the same app
// architecture, (2) desktop and mobile navigation are mutually exclusive and
// come from the same canonical shell.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppSideNav from '@/components/chronicle/AppSideNav';
import AppBottomNav from '@/components/chronicle/AppBottomNav';
import { cleanupObsoleteClientState } from '@/lib/clientStateCleanup';

vi.mock('@/contexts/PrivacyContext', () => ({
  usePrivacy: () => ({ enabled: false }),
}));

const SRC = join(process.cwd(), 'src');

const walk = (dir: string, out: string[] = []): string[] => {
  readdirSync(dir).forEach(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  });
  return out;
};

const sourceFiles = walk(SRC).filter(p => !p.includes(`${'/'}test${'/'}`));

describe('canonical app architecture — account independence', () => {
  it('no screen or layout branches on a specific email address', () => {
    const offenders = sourceFiles.filter(p => {
      if (p.endsWith('DevModeContext.tsx')) return false; // documented dev-panel allowlist
      return /@gmail\.com|@chronicle/.test(readFileSync(p, 'utf8'));
    });
    expect(offenders).toEqual([]);
  });

  it('no feature-flag module or V1/V2 switching survives', () => {
    const offenders = sourceFiles.filter(p =>
      /featureFlags|fullV2Mode|NavigationOwnership|v2Notebook|v2Capture|v2Dossier|v2Entry\b/.test(
        readFileSync(p, 'utf8').replace(/^\/\/.*$/gm, ''),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('the dev panel cannot change which screens render', () => {
    const screens = sourceFiles.filter(p => p.includes(`${'/'}pages${'/'}`));
    const usingDevMode = screens.filter(p => /useDevMode/.test(readFileSync(p, 'utf8')));
    expect(usingDevMode).toEqual([]);
  });
});

describe('obsolete client state cleanup', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes obsolete flag/rollout keys and keeps live preferences', () => {
    localStorage.setItem('chronicle.v2Flags', '{"v2Notebook":true}');
    localStorage.setItem('chronicle-v2-tester', '1');
    localStorage.setItem('chronicle.navOwnership', 'v1');
    localStorage.setItem('chronicle.theme', 'dark');
    sessionStorage.setItem('chronicle.capture.draft:user-1', 'keep me');

    const { removed } = cleanupObsoleteClientState();

    expect(removed).toEqual(expect.arrayContaining([
      'chronicle.v2Flags', 'chronicle-v2-tester', 'chronicle.navOwnership',
    ]));
    expect(localStorage.getItem('chronicle.theme')).toBe('dark');
    expect(sessionStorage.getItem('chronicle.capture.draft:user-1')).toBe('keep me');
  });

  it('is idempotent and never removes canonical keys', () => {
    localStorage.setItem('chronicle.lastUserId', 'user-1');
    cleanupObsoleteClientState();
    cleanupObsoleteClientState();
    expect(localStorage.getItem('chronicle.lastUserId')).toBe('user-1');
  });
});

describe('responsive navigation', () => {
  it('desktop rail exposes exactly the canonical destinations', () => {
    render(<MemoryRouter initialEntries={['/timeline']}><AppSideNav /></MemoryRouter>);
    ['Notebook', 'Capture', 'My Record', 'Settings'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.queryByText('Home')).toBeNull();
  });

  it('mobile bar is hidden at the desktop breakpoint and vice versa', () => {
    const { container: bar } = render(
      <MemoryRouter initialEntries={['/timeline']}><AppBottomNav /></MemoryRouter>,
    );
    // Bottom bar disappears exactly where the rail appears (lg / 1024px).
    expect(bar.querySelector('[data-testid="v2-bottom-nav"]')?.className).toContain('lg:hidden');

    const railCss = readFileSync(join(SRC, 'chronicle/styles.css'), 'utf8');
    expect(railCss).toMatch(/\.proto-root\.proto-sidenav \{ display: none; \}/);
    expect(railCss).toMatch(/@media \(min-width: 1024px\)/);
  });

  it('the shell never renders a legacy navigation component', () => {
    const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
    expect(app).not.toMatch(/DesktopSideNav|HomeScreen/);
    expect(app).toMatch(/AppSideNav/);
    expect(app).toMatch(/AppBottomNav/);
  });
});

describe('canonical routes', () => {
  const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');

  it.each([
    ['/timeline', 'NotebookScreen'],
    ['/record', 'CaptureScreen'],
    ['/record/details/:id', 'CaptureDetailsScreen'],
    ['/incident/:id', 'EntryScreen'],
    ['/export', 'MyRecordScreen'],
    ['/settings', 'SettingsScreen'],
  ])('%s renders %s unconditionally inside the shell', (path, screenName) => {
    const line = app.split('\n').find(l => l.includes(`path="${path}"`));
    expect(line).toBeTruthy();
    expect(line).toContain(screenName);
    expect(line).toContain('AppLayout');
  });

  it('retired surfaces map to canonical screens', () => {
    ['/home', '/calendar', '/my-record', '/v2/*', '/prototype/*'].forEach(p => {
      const line = app.split('\n').find(l => l.includes(`path="${p}"`));
      expect(line).toContain('Navigate');
    });
  });
});

describe('desktop layouts exist for every primary surface', () => {
  const css = readFileSync(join(SRC, 'chronicle/styles.css'), 'utf8');
  it.each([
    ['notebook list', '.proto-root .proto-list'],
    ['entry reading layout', '.proto-root .proto-entrylayout'],
    ['capture column', '.proto-root .proto-capture'],
    ['my record split pane', '.proto-root .proto-split'],
    ['settings grid', '.proto-root .proto-settings-grid'],
  ])('%s has a desktop rule', (_name, selector) => {
    expect(css).toContain(selector);
  });
});
