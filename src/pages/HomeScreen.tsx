import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import TutorialModal from '@/components/chronicle/TutorialModal';

const TUTORIAL_KEY = 'chronicle-tutorial-shown';

// ── Carousel content ─────────────────────────────────────────
// First card is mandatory and fixed. Additional cards are calm and factual.
type Slide = { headline: string; sub?: string };

const SLIDES: Slide[] = [
  {
    headline: 'When everything feels unclear, clarity matters.',
    sub: 'Project Chronicle helps you capture events as they happen — or record them later to build a clear timeline.',
  },
  { headline: 'Start with what you remember.' },
  { headline: 'Small details matter later.' },
  { headline: 'Your record builds over time.' },
];

// ── Auto-scrolling carousel ──────────────────────────────────
const Carousel = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance every 5s, snap to the next card.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const next = (active + 1) % SLIDES.length;
      const target = el.querySelector<HTMLElement>(`[data-slide="${next}"]`);
      if (target) {
        el.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
        setActive(next);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [active, paused]);

  // Track which slide is closest to the left edge after manual swipe.
  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const slides = el.querySelectorAll<HTMLElement>('[data-slide]');
    let closest = 0;
    let min = Infinity;
    slides.forEach((s, i) => {
      const d = Math.abs(s.offsetLeft - el.scrollLeft);
      if (d < min) { min = d; closest = i; }
    });
    if (closest !== active) setActive(closest);
  };

  return (
    <div
      className="w-full"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            data-slide={i}
            className="snap-start shrink-0 w-full"
          >
            <div className="px-6 pt-12 pb-10 min-h-[320px] flex flex-col justify-center">
              <h2 className="text-[22px] font-semibold text-foreground leading-[1.25] tracking-[-0.01em] text-center">
                {slide.headline}
              </h2>
              {slide.sub && (
                <p className="text-[14px] text-muted-foreground leading-relaxed text-center mt-4 max-w-[320px] mx-auto">
                  {slide.sub}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Minimal indicators */}
      <div className="flex items-center justify-center gap-1.5 pb-5">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === active ? 'w-5 bg-foreground/60' : 'w-1 bg-foreground/15'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const VALUE_CARDS = [
  {
    title: 'Record what happened',
    desc: "Write it down while it's fresh. Small details matter later.",
  },
  {
    title: 'See the bigger picture',
    desc: 'Your events, organised in order.',
  },
  {
    title: 'Know your position',
    desc: 'Understand where you stand with structured, reliable records.',
  },
];

const HomeScreen = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const shown = localStorage.getItem(TUTORIAL_KEY);
    if (!shown) setShowTutorial(true);
  }, []);

  const closeTutorial = () => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setShowTutorial(false);
  };

  return (
    <div className="min-h-screen bg-background pb-28 page-enter">
      <TutorialModal open={showTutorial} onClose={closeTutorial} />

      {/* Carousel — first visible element, no spacing above */}
      <Carousel />

      {/* Value cards */}
      <motion.div className="px-5 mb-10 space-y-3.5" {...fade(0.1)}>
        {VALUE_CARDS.map((card, i) => (
          <motion.div
            key={i}
            className="px-5 py-5 rounded-2xl bg-card border border-border shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.05)]"
            {...fade(0.15 + i * 0.05)}
          >
            <h3 className="text-[15px] font-semibold text-foreground mb-1 leading-snug">
              {card.title}
            </h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {card.desc}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Footer */}
      <motion.div className="px-6" {...fade(0.35)}>
        <div className="text-center py-6 space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <Heart className="h-3.5 w-3.5 text-primary/50" strokeWidth={1.5} />
            <p className="text-[12px] font-medium text-foreground/45">Built with care</p>
          </div>
          <p className="text-[11px] text-muted-foreground/50">
            Thank you for being part of Project Chronicle
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default HomeScreen;
