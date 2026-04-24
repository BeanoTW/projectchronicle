import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR, FONT } from '../theme';

export const SceneClosing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 24 });

  // Primary line fades in early
  const primaryOpacity = interpolate(frame, [6, 18, 78, 88], [0, 1, 1, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Secondary trust line appears ~0.5s (15 frames) after primary
  const secondaryOpacity = interpolate(frame, [22, 34, 78, 88], [0, 1, 1, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Wordmark settles in last
  const wordmarkOpacity = interpolate(frame, [40, 56, 80, 88], [0, 1, 1, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: COLOR.bg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 22,
        opacity: enter,
        padding: '0 80px',
      }}
    >
      <div
        style={{
          fontFamily: FONT.ui,
          fontSize: 36,
          fontWeight: 500,
          color: COLOR.text,
          textAlign: 'center',
          letterSpacing: '-0.01em',
          opacity: primaryOpacity,
          lineHeight: 1.3,
        }}
      >
        Your record stays yours
      </div>
      <div
        style={{
          fontFamily: FONT.ui,
          fontSize: 22,
          fontWeight: 500,
          color: COLOR.textMuted,
          textAlign: 'center',
          letterSpacing: '-0.005em',
          lineHeight: 1.45,
          whiteSpace: 'pre-line',
          opacity: secondaryOpacity,
        }}
      >
        {'Stored locally by default\nEncrypted when synced'}
      </div>
      <div
        style={{
          width: 60,
          height: 1,
          background: COLOR.primary,
          opacity: 0.5 * wordmarkOpacity,
          marginTop: 10,
        }}
      />
      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: 500,
          fontSize: 18,
          letterSpacing: '0.18em',
          color: COLOR.textMuted,
          opacity: wordmarkOpacity,
        }}
      >
        PROJECT&nbsp;CHRONICLE
      </div>
    </AbsoluteFill>
  );
};
