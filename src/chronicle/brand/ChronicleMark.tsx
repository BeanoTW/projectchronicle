import type { CSSProperties, SVGProps } from 'react';
import { CHRONICLE_MARK, CHRONICLE_MARK_VIEWBOX } from './markGeometry';

export interface ChronicleMarkProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  size?: number;
  /** Accessible label. Omit for decorative usage. */
  label?: string;
}

const ChronicleMark = ({ size = 28, label, style, ...props }: ChronicleMarkProps) => {
  const decorative = !label;
  const mergedStyle: CSSProperties = {
    display: 'block',
    flex: '0 0 auto',
    ...style,
  };

  return (
    <svg
      viewBox={CHRONICLE_MARK_VIEWBOX}
      width={size}
      height={size}
      fill="none"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={label}
      style={mergedStyle}
      {...props}
    >
      <path d={CHRONICLE_MARK.page} stroke="var(--p-ink, currentColor)" strokeWidth="3" strokeLinejoin="round" />
      <path d={CHRONICLE_MARK.fold} stroke="var(--p-ink, currentColor)" strokeWidth="3" strokeLinejoin="round" />
      <path d={CHRONICLE_MARK.spine} stroke="var(--p-brass, currentColor)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d={CHRONICLE_MARK.timeline} stroke="var(--p-brass, currentColor)" strokeWidth="2.4" strokeLinecap="round" />
      {CHRONICLE_MARK.nodes.map(y => (
        <circle key={y} cx="11.5" cy={y} r="3.2" fill="var(--p-paper, white)" stroke="var(--p-brass, currentColor)" strokeWidth="2.4" />
      ))}
    </svg>
  );
};

export default ChronicleMark;
