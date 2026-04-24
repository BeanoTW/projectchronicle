import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR, FONT } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';
import { Caption } from '../components/Caption';

const DocLine: React.FC<{ width: number; opacity: number }> = ({ width, opacity }) => (
  <div style={{ height: 6, width, background: COLOR.border, borderRadius: 3, opacity }} />
);

export const SceneExport: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const docOpacity = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 22 });
  const docTy = interpolate(docOpacity, [0, 1], [12, 0]);
  const sheet = spring({ frame: frame - 40, fps, config: { damping: 200 }, durationInFrames: 26 });
  const sheetTy = interpolate(sheet, [0, 1], [240, 0]);

  return (
    <AbsoluteFill style={{ background: COLOR.bg, fontFamily: FONT.ui }}>
      <StatusBar />
      <ScreenHeader title="Export" eyebrow="Step 05 · Ready to share" />

      {/* Hero document preview card with corner ribbon */}
      <div style={{
        position: 'relative',
        margin: '0 28px',
        padding: 26,
        background: '#fff',
        border: `1px solid ${COLOR.border}`,
        borderRadius: 22,
        boxShadow: `0 18px 44px -22px ${COLOR.shadow}`,
        opacity: docOpacity,
        transform: `translateY(${docTy}px)`,
        display: 'flex',
        gap: 22,
        overflow: 'hidden',
      }}>
        {/* Corner ribbon */}
        <div style={{
          position: 'absolute',
          top: 18,
          right: -42,
          transform: 'rotate(35deg)',
          background: COLOR.primary,
          color: '#fff',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.16em',
          padding: '4px 50px',
          boxShadow: `0 4px 10px -4px ${COLOR.primary}aa`,
        }}>
          READY
        </div>

        {/* Mini document thumbnail */}
        <div style={{
          width: 130,
          height: 170,
          background: '#fff',
          border: `1px solid ${COLOR.border}`,
          borderRadius: 10,
          padding: 13,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          boxShadow: `0 8px 18px -10px ${COLOR.shadow}`,
        }}>
          <div style={{ height: 10, width: 36, background: COLOR.primary, borderRadius: 2, marginBottom: 4 }} />
          <DocLine width={100} opacity={0.92} />
          <DocLine width={72} opacity={0.7} />
          <div style={{ height: 4 }} />
          <DocLine width={104} opacity={0.5} />
          <DocLine width={94} opacity={0.5} />
          <DocLine width={100} opacity={0.5} />
          <DocLine width={66} opacity={0.5} />
          <DocLine width={86} opacity={0.5} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 3, background: COLOR.primary, borderRadius: 2 }} />
            <div style={{ fontSize: 11, color: COLOR.primaryDark, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Workplace Grievance</div>
          </div>
          <div style={{ fontSize: 24, color: COLOR.text, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.1 }}>Export ready</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <div style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 6, background: COLOR.primarySoft, color: COLOR.primaryDark, fontSize: 13, fontWeight: 700 }}>4 records</div>
            <div style={{ fontSize: 13, color: COLOR.textMuted, fontWeight: 500 }}>included</div>
          </div>
          <div style={{ fontSize: 13, color: COLOR.textSubtle, fontWeight: 600, letterSpacing: '0.02em' }}>9 Mar – 14 Mar 2025</div>
        </div>
      </div>

      {/* Share button — slight press at f36 */}
      {(() => {
        const press = interpolate(frame, [34, 38, 42], [1, 0.97, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <div style={{
            margin: '24px 28px 0',
            padding: '18px 0',
            textAlign: 'center',
            background: COLOR.primary,
            color: '#fff',
            fontWeight: 700,
            fontSize: 17,
            borderRadius: 16,
            opacity: docOpacity,
            letterSpacing: '0.02em',
            transform: `scale(${press})`,
            boxShadow: `0 12px 26px -12px ${COLOR.primary}cc`,
          }}>
            Share
          </div>
        );
      })()}

      {/* Generic share sheet */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '22px 26px 40px',
          background: '#fff',
          borderTop: `1px solid ${COLOR.border}`,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          boxShadow: `0 -14px 36px -14px ${COLOR.shadow}`,
          transform: `translateY(${sheetTy}px)`,
          opacity: sheet,
          zIndex: 10,
        }}
      >
        <div style={{ width: 44, height: 4, background: COLOR.border, borderRadius: 2, margin: '0 auto 18px' }} />
        <div style={{ fontSize: 14, color: COLOR.textMuted, fontWeight: 700, marginBottom: 16, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Share via</div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[0, 1, 2, 3].map((i) => {
            const iconSpring = spring({ frame: frame - (52 + i * 4), fps, config: { damping: 200 }, durationInFrames: 16 });
            const iconTy = interpolate(iconSpring, [0, 1], [10, 0]);
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: iconSpring, transform: `translateY(${iconTy}px)` }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: COLOR.surface, border: `1px solid ${COLOR.border}` }} />
                <div style={{ width: 40, height: 7, background: COLOR.border, borderRadius: 3 }} />
              </div>
            );
          })}
        </div>
      </div>

      <Caption text="Ready when you need it" inAt={10} outAt={92} />
      <BottomNav active="my" />
    </AbsoluteFill>
  );
};
