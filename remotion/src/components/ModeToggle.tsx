import React from 'react';
import { COLOR } from '../theme';

interface Props {
  /** 'voice' | 'text' | 'daily' */
  mode: 'voice' | 'text' | 'daily';
  /** Optional override for the active tint */
  accent?: string;
}

export const ModeToggle: React.FC<Props> = ({ mode, accent }) => {
  const tabs: Array<{ key: 'voice' | 'text' | 'daily'; label: string }> = [
    { key: 'voice', label: 'Voice' },
    { key: 'text', label: 'Text' },
    { key: 'daily', label: 'Daily record' },
  ];
  const activeTint = accent ?? (mode === 'daily' ? COLOR.gold : COLOR.primary);
  return (
    <div style={{ margin: '0 28px', padding: 4, background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 14, display: 'flex', gap: 4 }}>
      {tabs.map((t) => {
        const active = t.key === mode;
        return (
          <div
            key={t.key}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 0',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              color: active ? COLOR.text : COLOR.textMuted,
              background: active ? '#fff' : 'transparent',
              border: active ? `1.5px solid ${activeTint}` : '1.5px solid transparent',
              boxShadow: active ? `0 1px 4px -1px ${COLOR.shadow}` : 'none',
            }}
          >
            {t.label}
          </div>
        );
      })}
    </div>
  );
};
