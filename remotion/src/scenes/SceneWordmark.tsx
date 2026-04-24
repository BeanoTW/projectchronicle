import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR, FONT } from '../theme';

export const SceneWordmark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 28 });
  const lineProgress = interpolate(frame, [12, 50], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return (
    <AbsoluteFill style={{ background: COLOR.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 22 }}>
      <div
        style={{
          opacity,
          fontFamily: FONT.display,
          fontWeight: 500,
          fontSize: 56,
          letterSpacing: '0.18em',
          color: COLOR.text,
        }}
      >
        PROJECT&nbsp;CHRONICLE
      </div>
      <div style={{ width: 280, height: 2, background: COLOR.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${lineProgress * 100}%`, height: '100%', background: COLOR.primary }} />
      </div>
    </AbsoluteFill>
  );
};
