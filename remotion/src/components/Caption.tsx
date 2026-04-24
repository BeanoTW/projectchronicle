import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLOR, FONT } from '../theme';

interface Props {
  text: string;
  secondary?: string;
  inAt?: number;
  outAt?: number;
  bottom?: number;
}

/**
 * Subtitle-style caption — large, centred, with a small pear-green accent
 * underline to give it presence without feeling like a marketing pop-up.
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

  // Underline draws in just after the text
  const underline = interpolate(
    frame,
    [inAt + 4, inAt + 18],
    [0, 1],
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
        height: 380,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        pointerEvents: 'none',
        paddingBottom: bottom,
        zIndex: 10,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, transparent 0%, transparent 28%, rgba(255,255,255,0.65) 65%, rgba(255,255,255,0.92) 100%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          fontFamily: FONT.ui,
          fontSize: 38,
          fontWeight: 600,
          color: COLOR.text,
          letterSpacing: '-0.015em',
          lineHeight: 1.25,
          textAlign: 'center',
          maxWidth: '84%',
          opacity,
          zIndex: 11,
        }}
      >
        {text}
      </div>
      {/* Accent underline */}
      <div
        style={{
          position: 'relative',
          marginTop: 14,
          width: 56 * underline,
          height: 3,
          background: COLOR.primary,
          borderRadius: 2,
          opacity: opacity * 0.9,
          zIndex: 11,
        }}
      />
      {secondary && (
        <div
          style={{
            position: 'relative',
            marginTop: 14,
            fontFamily: FONT.ui,
            fontSize: 24,
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
