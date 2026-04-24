import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR, FONT } from '../theme';

export const SceneClosing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 24 });

  const primaryOpacity = interpolate(frame, [6, 18, 78, 88], [0, 1, 1, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const secondaryOpacity = interpolate(frame, [22, 34, 78, 88], [0, 1, 1, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordmarkOpacity = interpolate(frame, [40, 56, 80, 88], [0, 1, 1, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const accentWidth = interpolate(frame, [10, 30], [0, 80], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${COLOR.bg} 0%, ${COLOR.surface} 100%)`,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 24,
        opacity: enter,
        padding: '0 80px',
      }}
    >
      {/* Top accent line */}
      <div style={{ width: accentWidth, height: 3, background: COLOR.primary, borderRadius: 2, opacity: primaryOpacity, marginBottom: 8 }} />
      <div
        style={{
          fontFamily: FONT.ui,
          fontSize: 48,
          fontWeight: 700,
          color: COLOR.text,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          opacity: primaryOpacity,
          lineHeight: 1.15,
        }}
      >
        Your record stays yours
      </div>
      <div
        style={{
          fontFamily: FONT.ui,
          fontSize: 24,
          fontWeight: 500,
          color: COLOR.textMuted,
          textAlign: 'center',
          letterSpacing: '-0.005em',
          lineHeight: 1.5,
          whiteSpace: 'pre-line',
          opacity: secondaryOpacity,
          maxWidth: 720,
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
          marginTop: 14,
        }}
      />
      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: 500,
          fontSize: 20,
          letterSpacing: '0.22em',
          color: COLOR.textMuted,
          opacity: wordmarkOpacity,
        }}
      >
        PROJECT&nbsp;CHRONICLE
      </div>
    </AbsoluteFill>
  );
};
