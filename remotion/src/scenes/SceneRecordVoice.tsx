import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig, spring } from 'remotion';
import { COLOR } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';
import { ModeToggle } from '../components/ModeToggle';
import { MicButton } from '../components/MicButton';
import { Caption } from '../components/Caption';
import { TouchIndicator } from '../components/TouchIndicator';

export const SceneRecordVoice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 20 });
  const cursorX = interpolate(frame, [25, 55], [620, 540], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cursorY = interpolate(frame, [25, 55], [560, 880], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tap = interpolate(frame, [58, 64, 70], [1, 0.96, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cursorOpacity = interpolate(frame, [22, 30, 64, 68], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLOR.bg, opacity: enter }}>
      <StatusBar />
      <ScreenHeader title="Record" eyebrow="Step 02 · Capture" />
      <ModeToggle mode="voice" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, marginTop: -30 }}>
        <div style={{ fontSize: 17, color: COLOR.textMuted, fontWeight: 600, letterSpacing: '0.02em' }}>Tap to record</div>
        <div style={{ transform: `scale(${tap})` }}>
          <MicButton tint={COLOR.primary} ringScale={0} size={210} />
        </div>
        <div style={{ fontSize: 14, color: COLOR.textSubtle, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Voice</div>
      </div>

      <TouchIndicator x={540} y={770} at={60} />

      <div
        style={{
          position: 'absolute',
          left: cursorX,
          top: cursorY,
          width: 28,
          height: 28,
          borderRadius: 999,
          background: 'rgba(31,42,26,0.18)',
          border: '2px solid rgba(31,42,26,0.45)',
          opacity: cursorOpacity,
          pointerEvents: 'none',
        }}
      />

      <Caption text="Capture what happened" inAt={8} />
      <BottomNav active="record" />
    </AbsoluteFill>
  );
};
