import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR, FONT } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';

const DocLine: React.FC<{ width: number; opacity: number }> = ({ width, opacity }) => (
  <div style={{ height: 6, width, background: COLOR.border, borderRadius: 3, opacity }} />
);

export const SceneExport: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Doc preview fades in f0..f20
  const docOpacity = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 22 });
  // Share sheet rises from bottom at f40
  const sheet = spring({ frame: frame - 40, fps, config: { damping: 200 }, durationInFrames: 26 });
  const sheetTy = interpolate(sheet, [0, 1], [240, 0]);

  return (
    <AbsoluteFill style={{ background: COLOR.bg, fontFamily: FONT.ui }}>
      <StatusBar />
      <ScreenHeader title="Export" />

      {/* Document preview card */}
      <div style={{ margin: '0 28px', padding: 20, background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 18, opacity: docOpacity, display: 'flex', gap: 16 }}>
        {/* Mini document thumbnail */}
        <div style={{ width: 96, height: 128, background: '#fff', border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: `0 6px 16px -10px ${COLOR.shadow}` }}>
          <DocLine width={72} opacity={0.9} />
          <DocLine width={56} opacity={0.7} />
          <div style={{ height: 4 }} />
          <DocLine width={76} opacity={0.5} />
          <DocLine width={68} opacity={0.5} />
          <DocLine width={72} opacity={0.5} />
          <DocLine width={48} opacity={0.5} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <div style={{ fontSize: 12, color: COLOR.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Workplace grievance</div>
          <div style={{ fontSize: 15, color: COLOR.text, fontWeight: 600 }}>Export ready</div>
          <div style={{ fontSize: 12, color: COLOR.textMuted }}>4 records · 14 Mar 2025</div>
        </div>
      </div>

      {/* Share button */}
      <div style={{ margin: '20px 28px 0', padding: '14px 0', textAlign: 'center', background: COLOR.primary, color: '#fff', fontWeight: 600, fontSize: 15, borderRadius: 14, opacity: docOpacity }}>
        Share
      </div>

      {/* Generic share sheet (no real app branding) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '20px 24px 36px',
          background: '#fff',
          borderTop: `1px solid ${COLOR.border}`,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow: `0 -10px 30px -12px ${COLOR.shadow}`,
          transform: `translateY(${sheetTy}px)`,
          opacity: sheet,
        }}
      >
        <div style={{ width: 40, height: 4, background: COLOR.border, borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontSize: 13, color: COLOR.textMuted, fontWeight: 600, marginBottom: 14 }}>Share via</div>
        <div style={{ display: 'flex', gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: COLOR.surface, border: `1px solid ${COLOR.border}` }} />
              <div style={{ width: 36, height: 6, background: COLOR.border, borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="my" />
    </AbsoluteFill>
  );
};
