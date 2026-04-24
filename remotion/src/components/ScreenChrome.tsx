import React from 'react';
import { COLOR, FONT } from '../theme';

/** App status bar mock — neutral, no real time/operator branding. */
export const StatusBar: React.FC = () => (
  <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', fontSize: 14, color: COLOR.text, fontFamily: FONT.ui, fontWeight: 600 }}>
    <span>9:41</span>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 16, height: 10, borderRadius: 2, background: COLOR.text }} />
      <div style={{ width: 22, height: 10, border: `1.5px solid ${COLOR.text}`, borderRadius: 3 }} />
    </div>
  </div>
);

export const ScreenHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div style={{ padding: '12px 28px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ fontSize: 28, fontWeight: 700, color: COLOR.text, letterSpacing: '-0.01em' }}>{title}</div>
    {right}
  </div>
);

export const BottomNav: React.FC<{ active?: 'timeline' | 'calendar' | 'record' | 'my' | 'support' }> = ({ active = 'record' }) => {
  const items = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'record', label: 'Record', primary: true },
    { key: 'my', label: 'My Record' },
    { key: 'support', label: 'Support' },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 96, background: COLOR.bg, borderTop: `1px solid ${COLOR.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 16 }}>
      {items.map((it) => {
        const isActive = it.key === active;
        if ((it as any).primary) {
          return (
            <div key={it.key} style={{ width: 64, height: 64, borderRadius: 999, background: COLOR.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px -8px ${COLOR.primary}80`, marginTop: -28 }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: '#fff' }} />
            </div>
          );
        }
        return (
          <div key={it.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: isActive ? COLOR.primary : COLOR.borderStrong }} />
            <div style={{ fontSize: 10, color: isActive ? COLOR.text : COLOR.textMuted, fontWeight: 500 }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
};
