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
      <div style={{ margin: '0 28px', padding: 22, background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 18, opacity: docOpacity, display: 'flex', gap: 18 }}>
        {/* Mini document thumbnail */}
        <div style={{ width: 110, height: 146, background: '#fff', border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: 11, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: `0 6px 16px -10px ${COLOR.shadow}` }}>
          <DocLine width={84} opacity={0.9} />
          <DocLine width={62} opacity={0.7} />
          <div style={{ height: 4 }} />
          <DocLine width={86} opacity={0.5} />
          <DocLine width={78} opacity={0.5} />
          <DocLine width={82} opacity={0.5} />
          <DocLine width={56} opacity={0.5} />
          <DocLine width={70} opacity={0.5} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7 }}>
          <div style={{ fontSize: 12, color: COLOR.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Workplace Grievance</div>
          <div style={{ fontSize: 17, color: COLOR.text, fontWeight: 700, letterSpacing: '-0.005em' }}>Export ready</div>
          <div style={{ fontSize: 13, color: COLOR.text, fontWeight: 500 }}>4 records included</div>
          <div style={{ fontSize: 12, color: COLOR.textMuted }}>9 Mar – 14 Mar 2025</div>
        </div>
      </div>

      {/* Share button */}
      <div style={{ margin: '22px 28px 0', padding: '15px 0', textAlign: 'center', background: COLOR.primary, color: '#fff', fontWeight: 600, fontSize: 16, borderRadius: 14, opacity: docOpacity, letterSpacing: '0.01em' }}>
        Share
      </div>

      {/* Generic share sheet (no real app branding) — overlays bottom nav */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '22px 26px 40px',
          background: '#fff',
          borderTop: `1px solid ${COLOR.border}`,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          boxShadow: `0 -10px 30px -12px ${COLOR.shadow}`,
          transform: `translateY(${sheetTy}px)`,
          opacity: sheet,
          zIndex: 10,
        }}
      >
        <div style={{ width: 44, height: 4, background: COLOR.border, borderRadius: 2, margin: '0 auto 18px' }} />
        <div style={{ fontSize: 14, color: COLOR.textMuted, fontWeight: 600, marginBottom: 16 }}>Share via</div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: COLOR.surface, border: `1px solid ${COLOR.border}` }} />
              <div style={{ width: 40, height: 7, background: COLOR.border, borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="my" />
    </AbsoluteFill>
  );
};
