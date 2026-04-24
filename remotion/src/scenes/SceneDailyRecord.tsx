import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';
import { ModeToggle } from '../components/ModeToggle';
import { MicButton } from '../components/MicButton';

export const SceneDailyRecord: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  // Toggle "switch" emphasis at f0..f12 — gentle settle
  const tintProgress = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  void tintProgress;

  return (
    <AbsoluteFill style={{ background: COLOR.bg, opacity: enter }}>
      <StatusBar />
      <ScreenHeader title="Record" />
      <ModeToggle mode="daily" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: -40 }}>
        <div style={{ fontSize: 15, color: COLOR.textMuted, fontWeight: 500 }}>Daily record</div>
        <MicButton tint={COLOR.gold} ringScale={0.15} />
        <div style={{ fontSize: 13, color: COLOR.textSubtle }}>One entry per day</div>
      </div>

      <BottomNav active="record" />
    </AbsoluteFill>
  );
};
