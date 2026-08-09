// Shared V2 surface wrapper.
//
// All V2 product styles are scoped under `.proto-root`. The preview shell
// (src/v2/V2App.tsx) provides that ancestor; production routes do not have a
// preview shell, so every production-backed V2 screen must render this wrapper.
// It also supplies the page padding and bottom-navigation clearance that the
// preview shell's `.proto-main` provides, so presentation never depends on the
// data source.
//
// Phase 9: the surface also carries the shell's secondary control — a compact
// top-right Settings entry point, subordinate to Notebook / Capture / My Record.
import type { ReactNode } from 'react';
import SettingsControl from '@/components/chronicle/SettingsControl';
import '../styles.css';

interface Props {
  children: ReactNode;
  /** Optional extra class on the surface element. */
  className?: string;
  /** Settings itself (and previews) hide the control. */
  hideSettingsControl?: boolean;
}

const AppSurface = ({ children, className, hideSettingsControl }: Props) => (
  <div className={`proto-root proto-surface${className ? ` ${className}` : ''}`} data-v2-surface="true">
    {!hideSettingsControl && <SettingsControl />}
    {children}
  </div>
);

export default AppSurface;
