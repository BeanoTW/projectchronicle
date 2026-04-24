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

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, marginTop: 80 }}>
        <div style={{ fontSize: 16, color: COLOR.textMuted, fontWeight: 500 }}>Daily record</div>
        <MicButton tint={COLOR.gold} ringScale={0.15} />
        <div style={{ fontSize: 14, color: COLOR.textSubtle }}>One entry per day</div>
        <div style={{ marginTop: 18, padding: '12px 20px', background: COLOR.goldSoft, border: `1px solid ${COLOR.gold}55`, borderRadius: 12, fontSize: 13, color: '#7A6420', fontWeight: 500, maxWidth: 380, textAlign: 'center', lineHeight: 1.45 }}>
          A short entry to capture the day, even when nothing notable happened.
        </div>
      </div>

      <BottomNav active="record" />
    </AbsoluteFill>
  );
};
