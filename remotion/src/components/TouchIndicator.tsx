import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface Props {
  x: number;
  y: number;
  /** Frame at which the touch happens. */
  at: number;
  size?: number;
  color?: string;
}

/**
 * Soft tap indicator: a faint circle that fades in, scales out, and disappears.
 * Subtle — meant to suggest a touch without grabbing attention.
 */
export const TouchIndicator: React.FC<Props> = ({
  x,
  y,
  at,
  size = 110,
  color = 'rgba(31,42,26,0.18)',
}) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  const opacity = interpolate(local, [0, 4, 22, 30], [0, 0.55, 0.25, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(local, [0, 30], [0.4, 1.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (local < 0 || local > 32) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        opacity,
        transform: `scale(${scale})`,
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  );
};
