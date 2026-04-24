import React from 'react';
import { COLOR } from '../theme';

interface Props {
  /** 0..1, ring strength */
  ringScale?: number;
  /** Border tint — pear green by default, gold for daily */
  tint?: string;
  /** Recording state — show inner stop square instead of mic */
  recording?: boolean;
  size?: number;
}

export const MicButton: React.FC<Props> = ({ ringScale = 0, tint = COLOR.primary, recording = false, size = 180 }) => (
  <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {/* Outer subtle ring */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 999,
        border: `2px solid ${tint}`,
        opacity: 0.18 + ringScale * 0.22,
        transform: `scale(${1 + ringScale * 0.18})`,
      }}
    />
    <div
      style={{
        width: size - 36,
        height: size - 36,
        borderRadius: 999,
        background: '#fff',
        border: `2.5px solid ${tint}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 12px 30px -16px ${tint}aa`,
      }}
    >
      {recording ? (
        <div style={{ width: 32, height: 32, borderRadius: 6, background: COLOR.destructive }} />
      ) : (
        <MicGlyph color={tint} />
      )}
    </div>
  </div>
);

const MicGlyph: React.FC<{ color: string }> = ({ color }) => (
  <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="3" width="6" height="12" rx="3" stroke={color} strokeWidth="2" />
    <path d="M5 11a7 7 0 0 0 14 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M12 18v3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
