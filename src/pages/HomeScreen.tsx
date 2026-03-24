import PageHeader from '@/components/chronicle/PageHeader';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Heart } from 'lucide-react';
import heroImage from '@/assets/hero-chronicle.png';

const supportiveMessages = [
  "You don't need everything — just start with what you remember",
  "There's no wrong way to begin",
  "Small details matter later",
  "Writing things down can help you think more clearly",
  "You can always come back and add more",
];

const contextStatements = [
  "Having dates and specifics helps others understand your experience",
  "Clear records can make it easier to explain what happened",
  "Details written at the time are often more reliable than memory later",
];

const HomeScreen = () => {
  const picked = useMemo(() => {
    const day = new Date().getDate();
    return {
      primary: supportiveMessages[day % supportiveMessages.length],
      supporting: [
        supportiveMessages[(day + 1) % supportiveMessages.length],
        supportiveMessages[(day + 3) % supportiveMessages.length],
      ],
      context: contextStatements[day % contextStatements.length],
    };
  }, []);

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay },
  });

  return (
    <div className="min-h-screen bg-background pb-28 page-enter">
      <PageHeader title="Project Chronicle" hideHome />

      {/* Hero image */}
      <motion.div className="relative mb-2" {...fade(0)}>
        <div className="w-full max-w-lg mx-auto">
          <img
            src={heroImage}
            alt="Project Chronicle — Record events. Preserve evidence. Build clear timelines."
            className="w-full h-auto object-contain"
          />
          {/* Bottom gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
        </div>
      </motion.div>

      {/* Tagline — not duplicating image text, this is the bottom line */}
      <motion.div className="px-6 mb-10 text-center" {...fade(0.08)}>
        <p className="text-[14px] text-muted-foreground tracking-wide leading-relaxed">
          Turning scattered events into undeniable truth.
        </p>
      </motion.div>

      {/* Primary message */}
      <motion.div className="px-5 mb-3" {...fade(0.14)}>
        <div className="px-5 py-5 rounded-xl bg-primary/[0.06] border border-primary/12 shadow-[var(--shadow-card)]">
          <p className="text-[15px] text-foreground leading-relaxed font-medium">
            {picked.primary}
          </p>
        </div>
      </motion.div>

      {/* Supporting messages */}
      <motion.div className="px-5 mb-3 space-y-2.5" {...fade(0.2)}>
        {picked.supporting.map((msg, i) => (
          <div
            key={i}
            className="px-4 py-3.5 rounded-xl bg-card border border-border shadow-[var(--shadow-card)] text-[13px] text-foreground/70 leading-relaxed"
          >
            {msg}
          </div>
        ))}
      </motion.div>

      {/* Contextual message */}
      <motion.div className="px-5 mb-10" {...fade(0.26)}>
        <div className="px-4 py-3 rounded-xl bg-muted/30 border border-border/60">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {picked.context}
          </p>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div className="px-5" {...fade(0.32)}>
        <div className="text-center py-6 space-y-2">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Heart className="h-3.5 w-3.5 text-primary/50" strokeWidth={1.5} />
            <p className="text-[12px] font-medium text-foreground/50">
              Built with care
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
            Supported by early backers
          </p>
          <p className="text-[11px] text-muted-foreground/45">
            Thank you for being part of Project Chronicle
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default HomeScreen;
