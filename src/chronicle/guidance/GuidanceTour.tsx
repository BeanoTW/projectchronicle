// Reusable guidance runtime: spotlight + contextual tooltip + step progression.
//
// Screens supply steps only. Everything below — target resolution, scrolling,
// responsive positioning, keyboard handling, focus management, completion —
// lives here so no screen ever needs its own tutorial implementation.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GuidanceEndReason, GuidanceStep } from './guidanceModel';
import '@/chronicle/styles.css';

interface Props {
  steps: GuidanceStep[];
  open: boolean;
  /** Accessible name for the guidance dialog. */
  label: string;
  onEnd: (reason: GuidanceEndReason) => void;
  /** Optional extra action offered on the final step (e.g. Start recording). */
  finalAction?: { label: string; onClick: () => void };
  /** Copy shown above the buttons on the last step. */
  finalNote?: string;
  testId?: string;
}

interface Box { top: number; left: number; width: number; height: number }

const PAD = 8;
const GAP = 12;
const MARGIN = 12;

const visible = (el: Element | null): el is HTMLElement => {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.hidden) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const cs = window.getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
};

const resolveTarget = (step: GuidanceStep): HTMLElement | null => {
  for (const sel of step.targets ?? []) {
    const el = document.querySelector(sel);
    if (visible(el)) return el;
  }
  return null;
};

const GuidanceTour = ({ steps, open, label, onEnd, finalAction, finalNote, testId }: Props) => {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  useEffect(() => {
    if (open) {
      setIndex(0);
      returnFocus.current = document.activeElement as HTMLElement | null;
    } else {
      setSpot(null);
      setPos(null);
    }
  }, [open]);

  /* Measure the current target, scrolling it into view when it is off-screen.
     Nothing is ever highlighted unless it is actually on the page. */
  const measure = useCallback(() => {
    if (!open || !step) return;
    const el = resolveTarget(step);
    if (!el) { setSpot(null); return; }
    const r = el.getBoundingClientRect();
    setSpot({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [open, step]);

  useEffect(() => {
    if (!open || !step) return;
    const el = resolveTarget(step);
    if (el) {
      const r = el.getBoundingClientRect();
      const off = r.top < 72 || r.bottom > window.innerHeight - 220;
      if (off) {
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      }
    }
    const t = window.setTimeout(measure, 260);
    measure();
    return () => window.clearTimeout(t);
  }, [open, step, index, measure]);

  useEffect(() => {
    if (!open) return;
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [open, measure]);

  /* Position the card against the spotlight, clamped inside the viewport so it
     can never clip, overflow horizontally, or sit under fixed navigation. */
  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(360, vw - MARGIN * 2);
    const h = cardRef.current.offsetHeight || 200;

    if (!spot) {
      setPos({ top: Math.max(MARGIN, (vh - h) / 2), left: Math.max(MARGIN, (vw - width) / 2), width });
      return;
    }

    const below = spot.top + spot.height + GAP + PAD;
    const above = spot.top - GAP - PAD - h;
    const fitsBelow = below + h <= vh - MARGIN;
    const fitsAbove = above >= MARGIN;
    let top: number;
    if (step?.prefer === 'top' && fitsAbove) top = above;
    else if (fitsBelow) top = below;
    else if (fitsAbove) top = above;
    else top = Math.max(MARGIN, vh - h - MARGIN);

    const centre = spot.left + spot.width / 2 - width / 2;
    const left = Math.min(Math.max(MARGIN, centre), vw - width - MARGIN);
    setPos({ top, left, width });
  }, [open, spot, index, step]);

  const end = useCallback((reason: GuidanceEndReason) => {
    onEnd(reason);
    const el = returnFocus.current;
    if (el && document.contains(el)) window.setTimeout(() => el.focus?.(), 0);
  }, [onEnd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); end('skipped'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, end]);

  // Focus lands on the guidance card, not trapped: Tab still reaches the page,
  // and Escape always exits.
  useEffect(() => {
    if (open && cardRef.current) cardRef.current.focus();
  }, [open, index]);

  if (!open || !step || typeof document === 'undefined') return null;

  return createPortal(
    <div className="proto-root proto-guide" data-testid={testId ?? 'guidance-tour'}>
      <div className="proto-guide-scrim" onClick={() => end('skipped')} aria-hidden />
      {spot && (
        <div
          className="proto-guide-spot"
          aria-hidden
          style={{
            top: spot.top - PAD,
            left: spot.left - PAD,
            width: spot.width + PAD * 2,
            height: spot.height + PAD * 2,
          }}
        />
      )}
      <div
        ref={cardRef}
        className="proto-guide-card"
        role="dialog"
        aria-modal="false"
        aria-label={label}
        aria-live="polite"
        tabIndex={-1}
        style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { opacity: 0 }}
      >
        <p className="proto-guide-count">Step {index + 1} of {steps.length}</p>
        <h2 className="proto-guide-title">{step.title}</h2>
        <p className="proto-guide-body">{step.body}</p>
        {last && finalNote && <p className="proto-guide-final">{finalNote}</p>}

        <div className="proto-guide-actions">
          {index > 0 && (
            <button type="button" className="proto-btn" onClick={() => setIndex(i => Math.max(0, i - 1))}>
              Back
            </button>
          )}
          {!last && (
            <>
              <button type="button" className="proto-btn" data-variant="ghost" onClick={() => end('skipped')}>
                Skip
              </button>
              <button type="button" className="proto-btn" data-variant="primary"
                onClick={() => setIndex(i => Math.min(steps.length - 1, i + 1))}>
                Next
              </button>
            </>
          )}
          {last && (
            <>
              {finalAction && (
                <button type="button" className="proto-btn" onClick={() => { end('done'); finalAction.onClick(); }}>
                  {finalAction.label}
                </button>
              )}
              <button type="button" className="proto-btn" data-variant="primary" onClick={() => end('done')}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GuidanceTour;
