import type { CSSProperties } from 'react';
import ChronicleMark from './ChronicleMark';

export interface ChronicleLockupProps {
  compact?: boolean;
  subtitle?: string;
  markSize?: number;
  className?: string;
  style?: CSSProperties;
}

const ChronicleLockup = ({
  compact = false,
  subtitle,
  markSize = compact ? 24 : 32,
  className,
  style,
}: ChronicleLockupProps) => (
  <span
    className={className}
    style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 8 : 10, minWidth: 0, ...style }}
  >
    <ChronicleMark size={markSize} />
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
      <span className="proto-serif" style={{ fontSize: compact ? 17 : 21, lineHeight: 1, whiteSpace: 'nowrap' }}>
        Chronicle
      </span>
      {!compact && subtitle && (
        <span style={{ marginTop: 3, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--p-muted)' }}>
          {subtitle}
        </span>
      )}
    </span>
  </span>
);

export default ChronicleLockup;
