// Phase 12 — canonical signed-out shell.
//
// Every unauthenticated Chronicle surface (landing, log in, sign up, forgotten
// password, reset password) renders through this shell so the first screen a
// user sees uses the same paper/ink design system as Notebook, Capture and My
// Record. No legacy hero imagery, gradients or glass styling.
import type { ReactNode } from 'react';
import '../styles.css';

interface Props {
  /** Page heading (h1). Always rendered — one per screen. */
  title: ReactNode;
  /** One short supporting line under the heading. */
  lede?: ReactNode;
  children: ReactNode;
  /** Optional desktop-only second column (landing uses it). */
  aside?: ReactNode;
  /** Small print under the panel. */
  footer?: ReactNode;
  /** Wider two-column composition for the landing screen. */
  wide?: boolean;
}

const AuthShell = ({ title, lede, children, aside, footer, wide }: Props) => (
  <div className="proto-root proto-auth" data-auth-shell="true">
    <div className={`proto-auth-grid${wide ? ' proto-auth-grid-wide' : ''}`}>
      <main className="proto-auth-panel">
        <p className="proto-auth-brand">Chronicle</p>
        <h1 className="proto-h1 proto-auth-title">{title}</h1>
        {lede && <p className="proto-auth-lede">{lede}</p>}
        {children}
        {footer && <div className="proto-auth-footer">{footer}</div>}
      </main>
      {aside && <aside className="proto-auth-aside">{aside}</aside>}
    </div>
  </div>
);

export default AuthShell;
