/**
 * Custom Chronicle nav icons.
 * Unified system: 24x24 viewBox, stroke 1.6 (active 1.8), round caps/joins,
 * currentColor — colour driven by parent.
 */
import { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { active?: boolean };

const base = (active?: boolean) => ({
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: active ? 1.8 : 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** Timeline — horizontal axis with anchored event nodes of varied emphasis. */
export const TimelineIcon = ({ active, ...p }: Props) => (
  <svg {...base(active)} {...p}>
    {/* Spine */}
    <line x1="3" y1="12" x2="21" y2="12" />
    {/* Node 1 — small */}
    <circle cx="6.5" cy="12" r="1.2" />
    {/* Node 2 — emphasised (filled) */}
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    {/* Node 3 — medium */}
    <circle cx="17.5" cy="12" r="1.6" />
    {/* Tick marks above emphasised node */}
    <line x1="12" y1="6.5" x2="12" y2="8.5" opacity="0.7" />
  </svg>
);

/** Calendar — minimal grid, single highlighted date marker. */
export const CalendarIcon = ({ active, ...p }: Props) => (
  <svg {...base(active)} {...p}>
    {/* Frame */}
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    {/* Top binding line */}
    <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
    {/* Hangers */}
    <line x1="8" y1="3.5" x2="8" y2="6" />
    <line x1="16" y1="3.5" x2="16" y2="6" />
    {/* Highlighted date dot */}
    <circle cx="12" cy="14.75" r="1.7" fill="currentColor" stroke="none" />
    {/* Subtle record indicators */}
    <circle cx="7.5" cy="14.75" r="0.6" fill="currentColor" stroke="none" opacity="0.55" />
    <circle cx="16.5" cy="14.75" r="0.6" fill="currentColor" stroke="none" opacity="0.55" />
  </svg>
);

/** Record — mic inside a defined capture boundary. Center action. */
export const RecordIcon = ({ active, ...p }: Props) => (
  <svg {...base(active)} {...p}>
    {/* Capture boundary */}
    <circle cx="12" cy="12" r="9" />
    {/* Mic capsule */}
    <rect x="9.75" y="6.75" width="4.5" height="8" rx="2.25" fill="currentColor" stroke="none" />
    {/* Mic stand arc */}
    <path d="M7.5 12.25 a4.5 4.5 0 0 0 9 0" />
    {/* Stand */}
    <line x1="12" y1="16.75" x2="12" y2="18.25" />
    {/* Signature node — base dot motif */}
    <circle cx="12" cy="19.5" r="0.6" fill="currentColor" stroke="none" opacity="0.7" />
  </svg>
);

/** My Record — document with structured ruled lines + verification mark. */
export const MyRecordIcon = ({ active, ...p }: Props) => (
  <svg {...base(active)} {...p}>
    {/* Document with folded corner */}
    <path d="M6 3.5 h8.5 L19 8 v11.5 a1.5 1.5 0 0 1 -1.5 1.5 h-11.5 a1.5 1.5 0 0 1 -1.5 -1.5 v-14.5 a1.5 1.5 0 0 1 1.5 -1.5 z" />
    <path d="M14.25 3.5 v4.25 h4.5" />
    {/* Structured ruled lines */}
    <line x1="8" y1="12.5" x2="14" y2="12.5" opacity="0.85" />
    <line x1="8" y1="15" x2="15.5" y2="15" opacity="0.85" />
    {/* Verification tick */}
    <path d="M9 17.75 l1.4 1.3 l3.1 -3" opacity="0.9" />
  </svg>
);

/** Support — shield with information mark. */
export const SupportIcon = ({ active, ...p }: Props) => (
  <svg {...base(active)} {...p}>
    {/* Shield */}
    <path d="M12 3 L4.5 5.75 v5.5 c0 4.5 3.25 8.25 7.5 9.5 c4.25 -1.25 7.5 -5 7.5 -9.5 v-5.5 z" />
    {/* Information mark */}
    <circle cx="12" cy="9.75" r="0.8" fill="currentColor" stroke="none" />
    <line x1="12" y1="12" x2="12" y2="15.75" />
  </svg>
);
