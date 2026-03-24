import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import heroImage from '@/assets/hero-chronicle.png';
import landscapeImage from '@/assets/landscape-hero.jpg';

const HomeScreen = () => {
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay },
  });

  return (
    <div className="min-h-screen bg-background pb-28 page-enter">
      {/* Hero image — dominant, ~65vh on mobile */}
      <motion.div className="relative" {...fade(0)}>
        <div className="w-full flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <img
            src={heroImage}
            alt="Project Chronicle — Record events. Preserve evidence. Build clear timelines."
            className="w-full h-auto object-contain px-4 max-w-lg"
          />
        </div>
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </motion.div>

      {/* Core message */}
      <motion.div className="px-6 -mt-6 mb-12 text-center" {...fade(0.1)}>
        <p className="text-[18px] font-semibold text-foreground leading-snug tracking-tight">
          Turning scattered events into undeniable truth.
        </p>
      </motion.div>

      {/* Landscape photo section */}
      <motion.div className="relative w-full mb-12" {...fade(0.2)}>
        <div
          className="relative w-full overflow-hidden"
          style={{ minHeight: '44vh' }}
        >
          <img
            src={landscapeImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />

          {/* Text over image */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-8 py-20" style={{ minHeight: '44vh' }}>
            <h2 className="text-[20px] font-semibold text-white leading-tight mb-4 tracking-tight">
              When everything feels unclear,
              <br />
              clarity matters.
            </h2>
            <p className="text-[14px] text-white/80 leading-relaxed max-w-sm">
              Project Chronicle helps you capture events as they happen — so you're never relying on memory alone.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Value cards */}
      <motion.div className="px-6 mb-10 space-y-4" {...fade(0.3)}>
        {[
          {
            title: "Record what happened",
            desc: "Write it down while it's fresh. Small details matter later.",
          },
          {
            title: "Build a clear timeline",
            desc: "See your events in order. Patterns become visible over time.",
          },
          {
            title: "Know your position",
            desc: "Understand where you stand with structured, reliable records.",
          },
        ].map((card, i) => (
          <motion.div
            key={i}
            className="px-6 py-5 rounded-2xl bg-card border border-border shadow-[0_2px_12px_-4px_hsl(var(--foreground)/0.06)] transition-all"
            {...fade(0.35 + i * 0.06)}
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
      <motion.div className="px-6" {...fade(0.55)}>
        <div className="text-center py-8 space-y-1.5">
          <div className="flex items-center justify-center gap-1.5">
            <Heart className="h-3.5 w-3.5 text-primary/50" strokeWidth={1.5} />
            <p className="text-[12px] font-medium text-foreground/45">
              Built with care
            </p>
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
