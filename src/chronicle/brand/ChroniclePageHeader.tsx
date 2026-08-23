import type { ReactNode } from 'react';
import ChronicleMark from './ChronicleMark';

interface ChroniclePageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

const ChroniclePageHeader = ({
  title,
  subtitle,
  eyebrow = 'Chronicle',
  actions,
  className,
}: ChroniclePageHeaderProps) => (
  <header className={`proto-brandhead${className ? ` ${className}` : ''}`}>
    <div className="proto-brandhead-copy">
      <p className="proto-brandhead-kicker">{eyebrow}</p>
      <h1 className="proto-h1">{title}</h1>
      {subtitle && <div className="proto-help proto-brandhead-subtitle">{subtitle}</div>}
    </div>
    <div className="proto-brandhead-side">
      {actions && <div className="proto-brandhead-actions">{actions}</div>}
      <div className="proto-brandhead-stamp" aria-hidden="true">
        <ChronicleMark size={44} />
        <span className="proto-brandhead-stampcopy">
          <span>Bound record</span>
          <small>Kept in order</small>
        </span>
      </div>
    </div>
  </header>
);

export default ChroniclePageHeader;
