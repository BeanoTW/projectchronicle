import React, { useRef, useEffect, useCallback, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import type { Incident } from '@/hooks/useIncidents';
import CategoryBadge from './CategoryBadge';

interface Props {
  incidents: Incident[];
  isPartOfPattern: (inc: Incident) => boolean;
}

const ChronologyTimeline = ({ incidents, isPartOfPattern }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateTransforms = useCallback(() => {
    if (!containerRef.current) return;
    const viewportCenter = window.innerHeight / 2;

    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elCenter - viewportCenter);
      const maxDistance = window.innerHeight * 0.6;
      const ratio = Math.min(distance / maxDistance, 1);

      // Opacity: 1 at center, 0.6 at edges
      const opacity = 1 - ratio * 0.4;
      // Scale: 1 at center, 0.97 at edges
      const scale = 1 - ratio * 0.03;
      // Subtle horizontal drift: 0 at center, 3px outward at edges
      const side = i % 2 === 0 ? -1 : 1;
      const drift = ratio * 3 * side;

      el.style.opacity = `${opacity}`;
      el.style.transform = `scale(${scale}) translateX(${drift}px)`;
    });

    nodeRefs.current.forEach((el, i) => {
      if (!el) return;
      const itemEl = itemRefs.current[i];
      if (!itemEl) return;
      const rect = itemEl.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elCenter - viewportCenter);
      const maxDistance = window.innerHeight * 0.6;
      const ratio = Math.min(distance / maxDistance, 1);

      const glowSize = (1 - ratio) * 4;
      el.style.boxShadow = `0 0 0 ${glowSize}px hsl(var(--primary) / ${0.15 + (1 - ratio) * 0.15})`;
      el.style.opacity = `${0.5 + (1 - ratio) * 0.5}`;
    });
  }, []);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateTransforms);
  }, [updateTransforms]);

  useEffect(() => {
    if (!mounted) return;
    window.addEventListener('scroll', onScroll, { passive: true });
    // Initial calculation
    updateTransforms();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [mounted, onScroll, updateTransforms]);

  return (
    <div ref={containerRef} className="center-timeline pt-4 pb-8">
      {incidents.map((inc, i) => {
        const side = i % 2 === 0 ? 'left' : 'right';
        return (
          <motion.div
            key={inc.id}
            ref={(el) => { itemRefs.current[i] = el; }}
            initial={{ opacity: 0, x: side === 'left' ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.4) }}
            className={`center-timeline-item center-timeline-item--${side}`}
            style={{ willChange: 'transform, opacity' }}
          >
            <div
              ref={(el) => { nodeRefs.current[i] = el; }}
              className="center-timeline-node"
              style={{ willChange: 'box-shadow, opacity', transition: 'box-shadow 0.15s ease-out, opacity 0.15s ease-out' }}
            />
            <div className="w-full max-w-[75%]">
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-200">
                <span className="text-[10px] text-muted-foreground/60 block mb-1">
                  {format(parseISO(inc.incident_date), 'dd MMM yyyy')}
                </span>
                <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2 mb-1.5">
                  {inc.title || 'Untitled incident'}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {inc.category && <CategoryBadge category={inc.category} />}
                  {isPartOfPattern(inc) && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-muted-foreground/50 border border-border/60">
                      Repeated
                    </span>
                  )}
                  {inc.locked && <span className="text-primary text-[10px]">🔒</span>}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ChronologyTimeline;
