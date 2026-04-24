import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig, spring } from 'remotion';
import { COLOR } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';
import { ModeToggle } from '../components/ModeToggle';
import { MicButton } from '../components/MicButton';

export const SceneRecordVoice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 20 });
  // Cursor moves from upper-right to mic button between f30 and f60, then taps (scale 0.97) at f65
  const cursorX = interpolate(frame, [25, 60], [620, 540], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cursorY = interpolate(frame, [25, 60], [560, 880], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tap = interpolate(frame, [62, 68, 74], [1, 0.97, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cursorOpacity = interpolate(frame, [22, 30, 70, 75], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLOR.bg, opacity: enter }}>
      <StatusBar />
      <ScreenHeader title="Record" />
      <ModeToggle mode="voice" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: -40 }}>
        <div style={{ fontSize: 15, color: COLOR.textMuted, fontWeight: 500 }}>Tap to record</div>
        <div style={{ transform: `scale(${tap})` }}>
          <MicButton tint={COLOR.primary} ringScale={0} />
        </div>
        <div style={{ fontSize: 13, color: COLOR.textSubtle }}>Voice</div>
      </div>

      {/* Cursor dot */}
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

      <BottomNav active="record" />
    </AbsoluteFill>
  );
};
