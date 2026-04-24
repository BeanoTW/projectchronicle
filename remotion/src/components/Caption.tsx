import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLOR, FONT } from '../theme';

interface Props {
  text: string;
  /** Frame to start fade-in (relative to scene). Default 12. */
  inAt?: number;
  /** Frame to start fade-out (relative to scene). If undefined, holds to end. */
  outAt?: number;
}

/**
 * Lower-third caption. Small, muted, neutral. Sits below the UI content area
 * but above the bottom nav so it never overlaps interactive UI.
 */
export const Caption: React.FC<Props> = ({ text, inAt = 12, outAt }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeOutStart = outAt ?? durationInFrames - 14;

  const opacity = interpolate(
    frame,
    [inAt, inAt + 14, fadeOutStart, fadeOutStart + 12],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const ty = interpolate(frame, [inAt, inAt + 14], [6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 116, // sits just above the 96px bottom nav with breathing room
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity,
        transform: `translateY(${ty}px)`,
        zIndex: 5,
      }}
    >
      <div
        style={{
          fontFamily: FONT.ui,
          fontSize: 15,
          fontWeight: 500,
          color: COLOR.textMuted,
          letterSpacing: '0.01em',
          padding: '8px 18px',
          background: 'rgba(255,255,255,0.86)',
          borderRadius: 999,
          border: `1px solid ${COLOR.border}`,
          boxShadow: `0 2px 10px -6px ${COLOR.shadow}`,
        }}
      >
        {text}
      </div>
    </div>
  );
};
