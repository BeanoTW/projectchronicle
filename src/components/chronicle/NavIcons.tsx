/**
 * Chronicle nav icons — Concept 3 Final.
 * 24x24 viewBox, stroke 1.75 (active 2), round caps/joins, currentColor.
 * Subtle green accents driven via `accent` prop class on specific elements.
 */
import { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { active?: boolean };

const base = (active?: boolean) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: active ? 2 : 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** Timeline — three horizontal lines with leading circular nodes. */
export const TimelineIcon = ({ active, ...p }: Props) => (
  <svg {...base(active)} {...p}>
    {/* Nodes */}
    <circle cx="5" cy="6.5" r="1.6" />
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="5" cy="17.5" r="1.6" />
    {/* Lines */}
    <line x1="9" y1="6.5" x2="20" y2="6.5" />
    <line x1="9" y1="12" x2="20" y2="12" />
    <line x1="9" y1="17.5" x2="17" y2="17.5" />
  </svg>
);

/** Calendar — minimal grid with one green-accented day dot. */
export const CalendarIcon = ({ active, ...p }: Props) => (
  <svg {...base(active)} {...p}>
    {/* Frame */}
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    {/* Header divider */}
    <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
    {/* Hangers */}
    <line x1="8" y1="3.25" x2="8" y2="6" />
    <line x1="16" y1="3.25" x2="16" y2="6" />
    {/* Grid dots */}
    <circle cx="8" cy="13" r="0.85" fill="currentColor" stroke="none" opacity="0.55" />
    <circle cx="12" cy="13" r="0.85" fill="currentColor" stroke="none" opacity="0.55" />
    <circle cx="16" cy="13" r="0.85" fill="currentColor" stroke="none" opacity="0.55" />
    <circle cx="8" cy="17" r="0.85" fill="currentColor" stroke="none" opacity="0.55" />
    {/* Highlighted day — green accent */}
    <circle cx="16" cy="17" r="1.5" className="text-primary" fill="currentColor" stroke="none" />
  </svg>
);

/** Record — waveform bars (used inside the elevated green button). */
export const RecordIcon = ({ active, ...p }: Props) => (
  <svg
    width={28}
    height={28}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <line x1="6" y1="10" x2="6" y2="14" />
    <line x1="9.5" y1="7.5" x2="9.5" y2="16.5" />
    <line x1="13" y1="5" x2="13" y2="19" />
    <line x1="16.5" y1="8" x2="16.5" y2="16" />
    <line x1="20" y1="10.5" x2="20" y2="13.5" />
  </svg>
);

/** My Record — document with structured lines and one green accent line. */
export const MyRecordIcon = ({ active, ...p }: Props) => (
  <svg {...base(active)} {...p}>
    {/* Document with folded corner */}
    <path d="M6.5 3.25 h7.5 L18.5 7.75 v12 a1.5 1.5 0 0 1 -1.5 1.5 h-10.5 a1.5 1.5 0 0 1 -1.5 -1.5 v-15 a1.5 1.5 0 0 1 1.5 -1.5 z" />
    <path d="M14 3.25 v4.5 h4.5" />
    {/* Structured lines */}
    <line x1="8.25" y1="12.5" x2="15.5" y2="12.5" />
    {/* Green accent line */}
    <line x1="8.25" y1="15.5" x2="13" y2="15.5" className="text-primary" strokeWidth={active ? 2.4 : 2.2} />
    <line x1="8.25" y1="18.25" x2="14.5" y2="18.25" opacity="0.85" />
  </svg>
);

/** Support — open book with central "i" and subtle eye at base. */
export const SupportIcon = ({ active, ...p }: Props) => (
  <svg {...base(active)} {...p}>
    {/* Open book — two pages meeting at spine */}
    <path d="M3.5 6.5 c2.5 -1 5.5 -1 8.5 0.5 c3 -1.5 6 -1.5 8.5 -0.5 v11 c-2.5 -1 -5.5 -1 -8.5 0.5 c-3 -1.5 -6 -1.5 -8.5 -0.5 z" />
    {/* Spine */}
    <line x1="12" y1="7" x2="12" y2="18.5" opacity="0.5" />
    {/* Page lines — left */}
    <line x1="5.5" y1="9.5" x2="9.75" y2="9.75" opacity="0.7" />
    <line x1="5.5" y1="12" x2="9.75" y2="12.25" opacity="0.7" />
    {/* Page lines — right */}
    <line x1="14.25" y1="9.75" x2="18.5" y2="9.5" opacity="0.7" />
    <line x1="14.25" y1="12.25" x2="18.5" y2="12" opacity="0.7" />
    {/* Central "i" — green accent */}
    <circle cx="12" cy="9" r="0.65" className="text-primary" fill="currentColor" stroke="none" />
    <line x1="12" y1="10.5" x2="12" y2="13" className="text-primary" strokeWidth={active ? 2.2 : 2} />
    {/* Subtle eye at base centre */}
    <path d="M10 16.25 q2 -1.5 4 0" className="text-primary" opacity="0.9" />
    <circle cx="12" cy="16.1" r="0.5" className="text-primary" fill="currentColor" stroke="none" />
  </svg>
);
