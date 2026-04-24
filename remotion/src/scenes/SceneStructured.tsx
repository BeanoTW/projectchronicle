import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR, FONT } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';
import { Caption } from '../components/Caption';

const Field: React.FC<{ label: string; value: React.ReactNode; delay: number }> = ({ label, value, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 18 });
  const ty = interpolate(opacity, [0, 1], [6, 0]);
  return (
    <div style={{ opacity, transform: `translateY(${ty}px)`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: COLOR.primaryDark, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, color: COLOR.text, fontWeight: 500, lineHeight: 1.4 }}>{value}</div>
    </div>
  );
};

export const SceneStructured: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const narrativeSpring = spring({ frame: frame - 38, fps, config: { damping: 200 }, durationInFrames: 22 });
  const narrativeTy = interpolate(narrativeSpring, [0, 1], [10, 0]);

  return (
    <AbsoluteFill style={{ background: COLOR.bg, fontFamily: FONT.ui }}>
      <StatusBar />
      <ScreenHeader title="Review" eyebrow="Step 03 · Structured record" />

      {/* Metadata block — clean grid, 2 columns */}
      <div style={{
        margin: '0 28px 16px',
        padding: '26px 28px',
        background: COLOR.surface,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 22,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '22px 28px',
        boxShadow: `0 6px 18px -14px ${COLOR.shadow}`,
      }}>
        <Field label="Date" value="14 March 2025" delay={4} />
        <Field label="Recorded" value="14 Mar · 14:32" delay={10} />
        <Field
          label="Category"
          delay={18}
          value={
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: COLOR.primarySoft, border: `1px solid ${COLOR.primary}66`, color: COLOR.primaryDark, fontSize: 14, fontWeight: 700 }}>
              Workplace
            </div>
          }
        />
        <Field label="Subtype" value="Conduct concern" delay={26} />
      </div>

      {/* Hero narrative block */}
      <div style={{
        margin: '0 28px',
        padding: '28px 30px 30px',
        background: '#fff',
        border: `1px solid ${COLOR.border}`,
        borderLeft: `4px solid ${COLOR.primary}`,
        borderRadius: 22,
        boxShadow: `0 18px 40px -28px ${COLOR.shadow}`,
        opacity: narrativeSpring,
        transform: `translateY(${narrativeTy}px)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 18, height: 3, background: COLOR.primary, borderRadius: 2 }} />
          <div style={{ fontSize: 12, color: COLOR.primaryDark, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}>Narrative</div>
        </div>
        <div style={{ fontSize: 20, color: COLOR.text, fontWeight: 400, lineHeight: 1.65, letterSpacing: '-0.005em' }}>
          Meeting with line manager in open-plan area around 14:25.
          <br />
          Discussion became tense regarding workload expectations.
          <br />
          Raised concern about communication tone.
        </div>
      </div>

      <Caption text="Structured into a clear record" inAt={10} />
      <BottomNav active="record" />
    </AbsoluteFill>
  );
};
