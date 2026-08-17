// Shared V2 surface wrapper.
//
// All V2 product styles are scoped under `.proto-root`. The preview shell
// (src/v2/V2App.tsx) provides that ancestor; production routes do not have a
// preview shell, so every production-backed V2 screen must render this wrapper.
// It also supplies the page padding and bottom-navigation clearance that the
// preview shell's `.proto-main` provides, so presentation never depends on the
// data source.
//
// Navigation lives in the app shell (drawer on mobile, rail from tablet up), so
// the surface is presentation only.
import type { ReactNode } from 'react';
import '../styles.css';

interface Props {
  children: ReactNode;
  /** Optional extra class on the surface element. */
  className?: string;
}

const AppSurface = ({ children, className }: Props) => (
  <div className={`proto-root proto-surface${className ? ` ${className}` : ''}`} data-v2-surface="true">
    {children}
  </div>
);

export default AppSurface;
