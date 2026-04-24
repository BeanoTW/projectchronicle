import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR, FONT } from '../theme';

export const SceneWordmark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 28 });
  const lineProgress = interpolate(frame, [12, 50], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const eyebrowOpacity = interpolate(frame, [18, 36], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at center, ${COLOR.bg} 0%, ${COLOR.surface} 100%)`,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 22,
    }}>
      <div
        style={{
          opacity,
          fontFamily: FONT.display,
          fontWeight: 500,
          fontSize: 64,
          letterSpacing: '0.20em',
          color: COLOR.text,
        }}
      >
        PROJECT&nbsp;CHRONICLE
      </div>
      <div style={{ width: 320, height: 2, background: COLOR.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${lineProgress * 100}%`, height: '100%', background: COLOR.primary }} />
      </div>
      <div style={{
        fontFamily: FONT.ui,
        fontSize: 14,
        fontWeight: 700,
        color: COLOR.primaryDark,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        opacity: eyebrowOpacity,
        marginTop: 6,
      }}>
        A clear record, kept safely
      </div>
    </AbsoluteFill>
  );
};
