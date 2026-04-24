import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COLOR } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';
import { ModeToggle } from '../components/ModeToggle';
import { MicButton } from '../components/MicButton';
import { Caption } from '../components/Caption';

export const SceneRecording: React.FC = () => {
  const frame = useCurrentFrame();
  const ring = (Math.sin(frame / 9) + 1) / 2 * 0.6;
  const seconds = Math.min(9, Math.floor(interpolate(frame, [0, 85], [0, 9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  const showSaving = frame >= 88;
  const timer = `0:${seconds.toString().padStart(2, '0')}`;
  const dotPulse = (Math.sin(frame / 7) + 1) / 2;

  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <StatusBar />
      <ScreenHeader title="Record" eyebrow="Step 02 · Recording" />
      <ModeToggle mode="voice" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, marginTop: -30 }}>
        {!showSaving ? (
          <>
            <div style={{ fontSize: 64, fontWeight: 700, color: COLOR.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', lineHeight: 1 }}>{timer}</div>
            <MicButton tint={COLOR.destructive} ringScale={ring} recording size={210} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderRadius: 999, background: '#FBECEB', border: `1px solid ${COLOR.destructive}33`, fontSize: 15, color: COLOR.destructive, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              <div style={{ width: 9, height: 9, borderRadius: 999, background: COLOR.destructive, opacity: 0.4 + dotPulse * 0.6 }} />
              Recording
            </div>
          </>
        ) : (
          <>
            <div style={{ width: 32, height: 32, borderRadius: 999, border: `3.5px solid ${COLOR.border}`, borderTopColor: COLOR.primary, transform: `rotate(${(frame - 88) * 18}deg)` }} />
            <div style={{ fontSize: 16, color: COLOR.textMuted, fontWeight: 600 }}>Saving recording…</div>
          </>
        )}
      </div>
      <Caption text="Recorded in your own words" inAt={10} />
      <BottomNav active="record" />
    </AbsoluteFill>
  );
};
