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
 * Subtitle-style caption. Large, prominent, and instantly readable.
 * Sits in the lower third with subtle background support for clarity.
 */
export const Caption: React.FC<Props> = ({ text, inAt = 12, outAt }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeOutStart = outAt ?? durationInFrames - 18;

  const opacity = interpolate(
    frame,
    [inAt, inAt + 16, fadeOutStart, fadeOutStart + 14],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const ty = interpolate(frame, [inAt, inAt + 16], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 180,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        pointerEvents: 'none',
        paddingBottom: 40,
        zIndex: 10,
      }}
    >
      {/* Subtle gradient background for caption readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, transparent 0%, transparent 20%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.95) 100%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          fontFamily: FONT.ui,
          fontSize: 24,
          fontWeight: 600,
          color: COLOR.text,
          letterSpacing: '-0.01em',
          padding: '14px 28px',
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 999,
          border: `1.5px solid ${COLOR.borderStrong}`,
          boxShadow: `0 4px 20px -8px ${COLOR.shadow}`,
          opacity,
          transform: `translateY(${ty}px)`,
          zIndex: 11,
        }}
      >
        {text}
      </div>
    </div>
  );
};
