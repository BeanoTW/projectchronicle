import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COLOR } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';
import { ModeToggle } from '../components/ModeToggle';
import { MicButton } from '../components/MicButton';

export const SceneRecording: React.FC = () => {
  const frame = useCurrentFrame();
  // Subtle ring breathing (no exaggerated pulse) — sinusoidal 0..0.4
  const ring = (Math.sin(frame / 9) + 1) / 2 * 0.4;
  // Timer 0:00 → 0:08 across f0..f72 then "Saving recording…" f74..end
  const seconds = Math.min(8, Math.floor(interpolate(frame, [0, 72], [0, 8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  const showSaving = frame >= 74;
  const timer = `0:${seconds.toString().padStart(2, '0')}`;

  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <StatusBar />
      <ScreenHeader title="Record" />
      <ModeToggle mode="voice" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, marginTop: -40 }}>
        {!showSaving ? (
          <>
            <div style={{ fontSize: 36, fontWeight: 600, color: COLOR.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>{timer}</div>
            <MicButton tint={COLOR.destructive} ringScale={ring} recording />
            <div style={{ fontSize: 13, color: COLOR.textMuted }}>Recording</div>
          </>
        ) : (
          <>
            <div style={{ width: 28, height: 28, borderRadius: 999, border: `3px solid ${COLOR.border}`, borderTopColor: COLOR.primary, transform: `rotate(${(frame - 74) * 18}deg)` }} />
            <div style={{ fontSize: 15, color: COLOR.textMuted, fontWeight: 500 }}>Saving recording…</div>
          </>
        )}
      </div>
      <BottomNav active="record" />
    </AbsoluteFill>
  );
};
