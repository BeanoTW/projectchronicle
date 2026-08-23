import type { ReactNode } from 'react';
import ChronicleMark from './ChronicleMark';

interface Props {
  children: ReactNode;
  role?: 'status' | 'alert';
  compact?: boolean;
  className?: string;
}

const ChronicleEmptyState = ({ children, role = 'status', compact = false, className = '' }: Props) => (
  <div
    className={`proto-empty proto-brand-empty ${className}`.trim()}
    role={role}
    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 8 : 12, textAlign: 'center' }}
  >
    <ChronicleMark size={compact ? 30 : 38} style={{ opacity: 0.72 }} />
    <div>{children}</div>
  </div>
);

export default ChronicleEmptyState;
