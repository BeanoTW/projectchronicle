import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';

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

const Card: React.FC<CardProps> = ({ title, preview, meta, chip, chipBg, chipFg, chipBorder, freshChip, faded, ty = 0, opacity = 1 }) => (
  <div style={{ margin: '0 28px 14px', padding: '20px 22px', background: COLOR.bg, border: `1px solid ${COLOR.border}`, borderRadius: 18, boxShadow: `0 2px 10px -6px ${COLOR.shadow}`, opacity: faded ? 0.72 * opacity : opacity, transform: `translateY(${ty}px)` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: chipBg, border: `1px solid ${chipBorder}`, color: chipFg, fontSize: 13, fontWeight: 600 }}>
        {chip}
      </div>
      {freshChip && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: COLOR.primarySoft, color: COLOR.primaryDark, fontSize: 12, fontWeight: 600 }}>
          Recorded just now
        </div>
      )}
    </div>
    <div style={{ fontSize: 18, color: COLOR.text, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.005em' }}>{title}</div>
    <div style={{ fontSize: 15, color: COLOR.textMuted, lineHeight: 1.45, marginBottom: 10 }}>{preview}</div>
    <div style={{ fontSize: 12.5, color: COLOR.textSubtle, fontWeight: 500, letterSpacing: '0.02em' }}>{meta}</div>
  </div>
);

export const SceneTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // New card slides in at f15
  const newCardSpring = spring({ frame: frame - 15, fps, config: { damping: 200 }, durationInFrames: 22 });
  const newTy = interpolate(newCardSpring, [0, 1], [-12, 0]);

  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <StatusBar />
      <ScreenHeader title="Timeline" />
      <div style={{ marginTop: 2 }}>
        <Card
          title="Workplace — Conduct concern"
          preview="Meeting with line manager in open-plan area…"
          meta="14 Mar · 14:32"
          chip="Workplace"
          chipBg={COLOR.primarySoft}
          chipFg={COLOR.primaryDark}
          chipBorder={`${COLOR.primary}55`}
          freshChip
          ty={newTy}
          opacity={newCardSpring}
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
      <BottomNav active="timeline" />
    </AbsoluteFill>
  );
};
