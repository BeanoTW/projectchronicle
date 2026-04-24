import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR, FONT } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';

const Field: React.FC<{ label: string; value: React.ReactNode; delay: number }> = ({ label, value, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 18 });
  const ty = interpolate(opacity, [0, 1], [6, 0]);
  return (
    <div style={{ opacity, transform: `translateY(${ty}px)` }}>
      <div style={{ fontSize: 13, color: COLOR.textMuted, textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 18, color: COLOR.text, fontWeight: 500, lineHeight: 1.4 }}>{value}</div>
    </div>
  );
};

export const SceneStructured: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLOR.bg, fontFamily: FONT.ui }}>
      <StatusBar />
      <ScreenHeader title="Review" />
      <div style={{ margin: '0 28px', padding: '32px 30px 34px', background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 26 }}>
        <Field label="Date" value="14 March 2025" delay={4} />
        <Field label="Recorded" value="14 March 2025 · 14:32" delay={12} />
        <Field
          label="Category"
          delay={20}
          value={
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: COLOR.primarySoft, border: `1px solid ${COLOR.primary}55`, color: COLOR.primaryDark, fontSize: 14, fontWeight: 600 }}>
              Workplace
            </div>
          }
        />
        <Field label="Subtype" value="Conduct concern" delay={28} />
        <div style={{ height: 1, background: COLOR.border, margin: '4px 0' }} />
        <Field
          label="Narrative"
          delay={38}
          value={
            <div style={{ fontSize: 17, color: COLOR.text, fontWeight: 400, lineHeight: 1.6 }}>
              Meeting with line manager in open-plan area around 14:25.
              <br />
              Discussion became tense regarding workload expectations.
              <br />
              Raised concern about communication tone.
            </div>
          }
        />
      </div>
      <BottomNav active="record" />
    </AbsoluteFill>
  );
};
