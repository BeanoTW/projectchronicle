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
      <path
        d={CHRONICLE_MARK.back}
        stroke="var(--p-ink, currentColor)"
        strokeOpacity="0.5"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={CHRONICLE_MARK.front}
        stroke="var(--p-ink, currentColor)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d={CHRONICLE_MARK.spine}
        stroke="var(--p-brass, currentColor)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {CHRONICLE_MARK.stitches.map(y => (
        <path
          key={y}
          d={`M9.5 ${y}H21.5`}
          stroke="var(--p-brass, currentColor)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
};

export default ChronicleMark;
