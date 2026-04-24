import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR, FONT } from '../theme';

export const SceneClosing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 24 });
  const fadeOut = interpolate(frame, [42, 60], [1, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: COLOR.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, opacity: opacity * fadeOut }}>
      <div style={{ fontFamily: FONT.ui, fontSize: 22, fontWeight: 500, color: COLOR.text, textAlign: 'center', letterSpacing: '-0.005em' }}>
        Record it in your own words.
      </div>
      <div style={{ fontFamily: FONT.ui, fontSize: 14, fontWeight: 500, color: COLOR.textMuted, letterSpacing: '0.01em' }}>
        Your record stays yours
      </div>
      <div style={{ width: 60, height: 1, background: COLOR.primary, opacity: 0.6, marginTop: 4 }} />
      <div style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 18, letterSpacing: '0.18em', color: COLOR.textMuted }}>
        PROJECT&nbsp;CHRONICLE
      </div>
    </AbsoluteFill>
  );
};
