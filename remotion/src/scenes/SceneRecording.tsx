import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COLOR } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';
import { ModeToggle } from '../components/ModeToggle';
import { MicButton } from '../components/MicButton';
import { Caption } from '../components/Caption';

export const SceneRecording: React.FC = () => {
  const frame = useCurrentFrame();
  // Subtle ring breathing — sinusoidal 0..0.55 (slightly stronger so "Recording" reads clearly)
  const ring = (Math.sin(frame / 9) + 1) / 2 * 0.55;
  // Timer 0:00 → 0:09 across f0..f85, then "Saving recording…" f88..end
  const seconds = Math.min(9, Math.floor(interpolate(frame, [0, 85], [0, 9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  const showSaving = frame >= 88;
  const timer = `0:${seconds.toString().padStart(2, '0')}`;

  // Pulsing red dot for "Recording" label
  const dotPulse = (Math.sin(frame / 7) + 1) / 2; // 0..1

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: COLOR.textMuted, fontWeight: 600 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: COLOR.destructive, opacity: 0.4 + dotPulse * 0.6 }} />
              Recording
            </div>
          </>
        ) : (
          <>
            <div style={{ width: 28, height: 28, borderRadius: 999, border: `3px solid ${COLOR.border}`, borderTopColor: COLOR.primary, transform: `rotate(${(frame - 88) * 18}deg)` }} />
            <div style={{ fontSize: 15, color: COLOR.textMuted, fontWeight: 500 }}>Saving recording…</div>
          </>
        )}
      </div>
      <Caption text="Recorded in your own words" inAt={10} />
      <BottomNav active="record" />
    </AbsoluteFill>
  );
};
