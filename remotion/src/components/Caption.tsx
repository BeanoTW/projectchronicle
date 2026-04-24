import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLOR, FONT } from '../theme';

interface Props {
  text: string;
  /** Optional secondary line, appears slightly later. */
  secondary?: string;
  /** Frame to start fade-in (relative to scene). Default 8. */
  inAt?: number;
  /** Frame to start fade-out (relative to scene). If undefined, holds to end-8. */
  outAt?: number;
  /** Bottom offset (px in design space). Default 200 — sits above bottom nav. */
  bottom?: number;
}

/**
 * Subtitle-style caption. Large, centred, immediately readable.
 * No box, no pill — clean text with a subtle gradient backdrop for legibility.
 */
export const Caption: React.FC<Props> = ({ text, secondary, inAt = 8, outAt, bottom = 200 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeOutStart = outAt ?? durationInFrames - 10;

  const opacity = interpolate(
    frame,
    [inAt, inAt + 8, fadeOutStart, fadeOutStart + 8],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const secondaryDelay = inAt + 15;
  const secondaryOpacity = interpolate(
    frame,
    [secondaryDelay, secondaryDelay + 8, fadeOutStart, fadeOutStart + 8],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 360,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        pointerEvents: 'none',
        paddingBottom: bottom,
        zIndex: 10,
      }}
    >
      {/* Subtle bottom gradient to lift captions off whatever sits behind */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, transparent 0%, transparent 30%, rgba(255,255,255,0.55) 70%, rgba(255,255,255,0.85) 100%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          fontFamily: FONT.ui,
          fontSize: 32,
          fontWeight: 500,
          color: COLOR.text,
          letterSpacing: '-0.01em',
          lineHeight: 1.35,
          textAlign: 'center',
          maxWidth: '80%',
          opacity,
          zIndex: 11,
          textShadow: '0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        {text}
      </div>
      {secondary && (
        <div
          style={{
            position: 'relative',
            marginTop: 14,
            fontFamily: FONT.ui,
            fontSize: 22,
            fontWeight: 500,
            color: COLOR.textMuted,
            letterSpacing: '-0.005em',
            lineHeight: 1.4,
            textAlign: 'center',
            maxWidth: '78%',
            whiteSpace: 'pre-line',
            opacity: secondaryOpacity,
            zIndex: 11,
          }}
        >
          {secondary}
        </div>
      )}
    </div>
  );
};
