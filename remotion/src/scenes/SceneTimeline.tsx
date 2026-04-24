import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';
import { Caption } from '../components/Caption';

interface CardProps {
  title: string;
  preview: string;
  meta: string;
  chip: string;
  chipBg: string;
  chipFg: string;
  chipBorder: string;
  freshChip?: boolean;
  faded?: boolean;
  ty?: number;
  opacity?: number;
}

const Card: React.FC<CardProps & { highlight?: number; isNew?: boolean }> = ({ title, preview, meta, chip, chipBg, chipFg, chipBorder, freshChip, faded, ty = 0, opacity = 1, highlight = 0, isNew = false }) => (
  <div style={{
    margin: '0 28px 14px',
    padding: '22px 24px',
    background: '#fff',
    border: `1px solid ${highlight > 0 ? COLOR.primary : COLOR.border}`,
    borderLeft: isNew ? `4px solid ${COLOR.primary}` : `1px solid ${COLOR.border}`,
    borderRadius: 20,
    boxShadow: highlight > 0
      ? `0 0 0 ${highlight * 4}px ${COLOR.primary}1f, 0 10px 26px -16px ${COLOR.shadow}`
      : `0 4px 14px -10px ${COLOR.shadow}`,
    opacity: faded ? 0.62 * opacity : opacity,
    transform: `translateY(${ty}px)`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: chipBg, border: `1px solid ${chipBorder}`, color: chipFg, fontSize: 13, fontWeight: 700, letterSpacing: '0.01em' }}>
        {chip}
      </div>
      {freshChip && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: COLOR.primary, color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', boxShadow: `0 4px 10px -6px ${COLOR.primary}aa` }}>
          <div style={{ width: 6, height: 6, borderRadius: 999, background: '#fff' }} />
          NEW
        </div>
      )}
    </div>
    <div style={{ fontSize: 22, color: COLOR.text, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.012em', lineHeight: 1.2 }}>{title}</div>
    <div style={{ fontSize: 16, color: COLOR.textMuted, lineHeight: 1.45, marginBottom: 12 }}>{preview}</div>
    <div style={{ fontSize: 13, color: COLOR.textSubtle, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{meta}</div>
  </div>
);

export const SceneTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const newCardSpring = spring({ frame: frame - 2, fps, config: { damping: 200 }, durationInFrames: 22 });
  const newTy = interpolate(newCardSpring, [0, 1], [-28, 0]);
  const highlight = interpolate(frame, [4, 30, 80], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <StatusBar />
      <ScreenHeader title="Timeline" eyebrow="Step 04 · Your records" />
      <div style={{ marginTop: 2 }}>
        <Card
          title="Workplace — Conduct concern"
          preview="Meeting with line manager in open-plan area…"
          meta="14 Mar · 14:32"
          chip="Workplace"
          chipBg={COLOR.primarySoft}
          chipFg={COLOR.primaryDark}
          chipBorder={`${COLOR.primary}66`}
          freshChip
          isNew
          ty={newTy}
          opacity={newCardSpring}
          highlight={highlight}
        />
        <Card
          title="Daily record"
          preview="Quiet day. No notable interactions to record."
          meta="13 Mar · 21:10"
          chip="Daily"
          chipBg={COLOR.goldSoft}
          chipFg="#7A6420"
          chipBorder={`${COLOR.gold}66`}
          faded
        />
        <Card
          title="Workplace — Communication"
          preview="Email follow-up after team meeting clarifying scope."
          meta="11 Mar · 09:48"
          chip="Workplace"
          chipBg={COLOR.primarySoft}
          chipFg={COLOR.primaryDark}
          chipBorder={`${COLOR.primary}55`}
          faded
        />
        <Card
          title="Home — Note"
          preview="Discussion about household responsibilities after dinner."
          meta="9 Mar · 19:22"
          chip="Home"
          chipBg="#EEF2EE"
          chipFg={COLOR.text}
          chipBorder={COLOR.border}
          faded
        />
      </div>
      <Caption text="Organised instantly" inAt={14} />
      <BottomNav active="timeline" />
    </AbsoluteFill>
  );
};
