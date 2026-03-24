import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import heroImage from '@/assets/hero-chronicle.png';
import landscapeImage from '@/assets/landscape-hero.jpg';

const quotes = [
  "You can always come back and add more.",
  "You do not need everything — just start with what you remember.",
  "Small details matter later.",
  "Clarity builds over time.",
  "A clear record can make all the difference.",
  "Start with what happened.",
];

const QuoteStrip = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const posRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const speed = 0.35; // px per frame

    const tick = () => {
      if (!paused) {
        posRef.current += speed;
        // Loop when first set scrolls out
        if (posRef.current >= el.scrollWidth / 2) {
          posRef.current = 0;
        }
        el.scrollLeft = posRef.current;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [paused]);

  // Duplicate quotes for seamless loop
  const items = [...quotes, ...quotes];

  return (
    <div
      ref={scrollRef}
      className="overflow-hidden scrollbar-hide select-none"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="flex items-center whitespace-nowrap py-5">
        {items.map((q, i) => (
          <span key={i} className="flex items-center shrink-0">
            <span className="text-[13px] text-muted-foreground/70 font-medium px-5 italic">
              {q}
            </span>
            <span className="w-1 h-1 rounded-full bg-primary/30 shrink-0" />
          </span>
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

const HomeScreen = () => {
  return (
    <div className="min-h-screen bg-background pb-28 page-enter">
      {/* Hero — large, anchored to top */}
      <motion.div className="relative" {...fade(0)}>
        <div className="w-full px-3 pt-3">
          <img
            src={heroImage}
            alt="Project Chronicle — Record events. Preserve evidence. Build clear timelines."
            className="w-full h-auto object-contain max-w-md mx-auto"
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </motion.div>

      {/* Core message */}
      <motion.div className="px-8 mt-1 mb-6 text-center" {...fade(0.08)}>
        <p className="text-[19px] font-bold text-foreground leading-snug tracking-tight">
          Turning scattered events
          <br />
          into undeniable truth.
        </p>
      </motion.div>

      {/* Quote strip */}
      <motion.div className="mb-6 border-y border-border/40" {...fade(0.14)}>
        <QuoteStrip />
      </motion.div>

      {/* Landscape photo section */}
      <motion.div className="relative w-full mb-8" {...fade(0.2)}>
        <div className="relative w-full overflow-hidden" style={{ minHeight: '40vh' }}>
          <img
            src={landscapeImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/60" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-8 py-16" style={{ minHeight: '40vh' }}>
            <h2 className="text-[20px] font-semibold text-white leading-tight mb-3 tracking-tight">
              When everything feels unclear,
              <br />
              clarity matters.
            </h2>
            <p className="text-[14px] text-white/75 leading-relaxed max-w-xs">
              Project Chronicle helps you capture events as they happen — so you're never relying on memory alone.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Value cards */}
      <motion.div className="px-5 mb-10 space-y-3.5" {...fade(0.28)}>
        {[
          {
            title: "Record what happened",
            desc: "Write it down while it's fresh. Small details matter later.",
          },
          {
            title: "See the bigger picture",
            desc: "Your events, organised in order. Patterns become visible over time.",
          },
          {
            title: "Know your position",
            desc: "Understand where you stand with structured, reliable records.",
          },
        ].map((card, i) => (
          <motion.div
            key={i}
            className="px-5 py-5 rounded-2xl bg-card border border-border shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.05)]"
            {...fade(0.32 + i * 0.05)}
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
      <motion.div className="px-6" {...fade(0.48)}>
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
