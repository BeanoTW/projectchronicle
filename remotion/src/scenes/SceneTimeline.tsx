import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLOR } from '../theme';
import { StatusBar, ScreenHeader, BottomNav } from '../components/ScreenChrome';

const Card: React.FC<{ title: string; date: string; chip: string; chipBg: string; chipFg: string; chipBorder: string; faded?: boolean; tx?: number; opacity?: number; freshChip?: boolean }> = ({ title, date, chip, chipBg, chipFg, chipBorder, faded, tx = 0, opacity = 1, freshChip }) => (
  <div style={{ margin: '0 28px 14px', padding: 18, background: COLOR.bg, border: `1px solid ${COLOR.border}`, borderRadius: 16, boxShadow: `0 2px 10px -6px ${COLOR.shadow}`, opacity: faded ? 0.65 * opacity : opacity, transform: `translateY(${tx}px)` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, background: chipBg, border: `1px solid ${chipBorder}`, color: chipFg, fontSize: 11, fontWeight: 600 }}>
        {chip}
      </div>
      <div style={{ fontSize: 11, color: COLOR.textMuted }}>{date}</div>
    </div>
    <div style={{ fontSize: 15, color: COLOR.text, fontWeight: 600, marginBottom: 4 }}>{title}</div>
    {freshChip && (
      <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: COLOR.primarySoft, color: COLOR.primaryDark, fontSize: 10, fontWeight: 600 }}>
        Recorded just now
      </div>
    )}
  </div>
);

export const SceneTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // New card slides in at f20
  const newCardSpring = spring({ frame: frame - 20, fps, config: { damping: 200 }, durationInFrames: 22 });
  const newTy = interpolate(newCardSpring, [0, 1], [-12, 0]);

  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <StatusBar />
      <ScreenHeader title="Timeline" />
      <div style={{ marginTop: 4 }}>
        <Card title="Workplace · Conduct concern" date="14 Mar · 14:32" chip="Workplace" chipBg={COLOR.primarySoft} chipFg={COLOR.primaryDark} chipBorder={`${COLOR.primary}55`} tx={newTy} opacity={newCardSpring} freshChip />
        <Card title="Daily record" date="13 Mar" chip="Daily" chipBg={COLOR.goldSoft} chipFg="#7A6420" chipBorder={`${COLOR.gold}66`} faded />
        <Card title="Workplace · Communication" date="11 Mar" chip="Workplace" chipBg={COLOR.primarySoft} chipFg={COLOR.primaryDark} chipBorder={`${COLOR.primary}55`} faded />
        <Card title="Home · Note" date="9 Mar" chip="Home" chipBg="#EEF2EE" chipFg={COLOR.text} chipBorder={COLOR.border} faded />
      </div>
      <BottomNav active="timeline" />
    </AbsoluteFill>
  );
};
