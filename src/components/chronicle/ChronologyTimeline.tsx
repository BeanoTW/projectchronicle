import React, { useRef, useEffect, useCallback, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, User } from 'lucide-react';
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

    let closestIdx = -1;
    let closestDist = Infinity;

    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elCenter - viewportCenter);
      const maxDistance = window.innerHeight * 0.6;
      const ratio = Math.min(distance / maxDistance, 1);

      if (distance < closestDist) { closestDist = distance; closestIdx = i; }

      const opacity = 1 - ratio * 0.4;
      const scale = 1 - ratio * 0.03;
      const side = i % 2 === 0 ? -1 : 1;
      const drift = ratio * 3 * side;

      el.style.opacity = `${opacity}`;
      el.style.transform = `scale(${scale}) translateX(${drift}px)`;
    });

    if (closestIdx !== focusedIndex) setFocusedIndex(closestIdx);

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
  }, [focusedIndex]);

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

  const navigate = useNavigate();
  const isFocused = (i: number) => i === focusedIndex;
  const isExpanded = (id: string) => expandedId === id;
  const previewLines = (i: number) => isFocused(i) ? 'line-clamp-3' : 'line-clamp-2';

  return (
    <div ref={containerRef} className="center-timeline pt-4 pb-8">
      {incidents.map((inc, i) => {
        const side = i % 2 === 0 ? 'left' : 'right';
        const expanded = isExpanded(inc.id);
        const previewText = inc.ai_summary || inc.raw_narrative;

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
              <button
                onClick={() => setExpandedId(expanded ? null : inc.id)}
                className="w-full text-left rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98] transition-all duration-200"
              >
                <span className="text-[10px] text-muted-foreground/60 block mb-1">
                  {format(parseISO(inc.incident_date), 'dd MMM yyyy')}
                </span>
                <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2 mb-1">
                  {inc.title || 'Untitled incident'}
                </p>
                {previewText && (
                  <p className={`text-[12px] text-muted-foreground/70 leading-relaxed mb-1.5 ${previewLines(i)}`}>
                    {previewText}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1">
                  {inc.category && <CategoryBadge category={inc.category} />}
                  {isPartOfPattern(inc) && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-muted-foreground/50 border border-border/60">
                      Repeated
                    </span>
                  )}
                  {inc.locked && <span className="text-primary text-[10px]">🔒</span>}
                </div>
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mx-1 mt-1 px-3.5 py-3 rounded-lg border border-border/60 bg-card/50 space-y-2">
                      {previewText && (
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                          {previewText}
                        </p>
                      )}
                      {inc.location && (
                        <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {inc.location}
                        </p>
                      )}
                      {inc.people_involved.length > 0 && (
                        <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                          <User className="h-3 w-3" /> {inc.people_involved.join(', ')}
                        </p>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/incident/${inc.id}`); }}
                        className="text-[12px] text-primary font-medium pt-1 transition-colors hover:text-primary/80"
                      >
                        View full record →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ChronologyTimeline;
