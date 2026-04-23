import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import TutorialModal from '@/components/chronicle/TutorialModal';
import heroImage from '@/assets/auth-hero-sunrise.jpg';

const TUTORIAL_KEY = 'chronicle-tutorial-shown';

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

      {/* Hero — mirrors AuthHero treatment */}
      <div
        className="relative w-full overflow-hidden rounded-b-[28px] shadow-[0_8px_24px_-12px_hsl(220_30%_8%/0.35)]"
        style={{ height: 'min(38vh, 340px)', minHeight: 260 }}
      >
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        {/* Darkening overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, hsl(220 35% 8% / 0.35) 0%, hsl(220 35% 8% / 0.50) 55%, hsl(220 35% 8% / 0.72) 100%)',
          }}
        />
        {/* Bottom vignette for clean transition */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(180deg, transparent, hsl(220 35% 8% / 0.40))' }}
        />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-end px-6 pb-8">
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
            className="text-white font-serif text-[24px] sm:text-[26px] leading-[1.2] tracking-[-0.005em]"
            style={{ fontFamily: '"Cormorant Garamond", "Times New Roman", serif', fontWeight: 500 }}
          >
            When everything feels unclear, clarity matters.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            className="mt-3 text-[13px] leading-relaxed text-white/80 max-w-[340px]"
          >
            Project Chronicle helps you capture events as they happen — or record them later to build a clear timeline.
          </motion.p>
        </div>
      </div>

      {/* Value cards */}
      <motion.div className="px-5 pt-8 mb-10 space-y-2.5" {...fade(0.1)}>
        {VALUE_CARDS.map((card, i) => (
          <motion.div
            key={i}
            className="px-5 py-4 rounded-2xl bg-card border border-border shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.05)]"
            {...fade(0.18 + i * 0.06)}
          >
            <h3 className="text-[15px] font-semibold text-foreground mb-0.5 leading-snug tracking-[-0.005em]">
              {card.title}
            </h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {card.desc}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Footer */}
      <motion.div className="px-6" {...fade(0.4)}>
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
