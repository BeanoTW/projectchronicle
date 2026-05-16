import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import TutorialModal from '@/components/chronicle/TutorialModal';
import heroImage from '@/assets/auth-hero-sunrise.jpg';

const TUTORIAL_KEY = 'chronicle-tutorial-shown';

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay },
});

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

      {/* Hero — brand anchor only */}
      <div
        className="relative w-full overflow-hidden rounded-b-[28px] shadow-[0_8px_24px_-12px_hsl(220_30%_8%/0.35)]"
        style={{ height: 'min(28vh, 240px)', minHeight: 200 }}
      >
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, hsl(220 35% 8% / 0.35) 0%, hsl(220 35% 8% / 0.45) 55%, hsl(220 35% 8% / 0.65) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{ background: 'linear-gradient(180deg, transparent, hsl(220 35% 8% / 0.40))' }}
        />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
            className="font-serif text-white tracking-[0.18em] text-[26px] sm:text-[30px] leading-none"
            style={{ fontFamily: '"Cormorant Garamond", "Times New Roman", serif', fontWeight: 500 }}
          >
            PROJECT&nbsp;CHRONICLE
          </motion.h1>

          <motion.svg
            initial={{ opacity: 0, scaleX: 0.85 }}
            animate={{ opacity: 0.85, scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
            width="120"
            height="14"
            viewBox="0 0 120 14"
            fill="none"
            className="mt-3"
            aria-hidden="true"
          >
            <line x1="0" y1="11" x2="42" y2="11" stroke="hsl(38 70% 70%)" strokeWidth="0.8" strokeOpacity="0.7" />
            <circle cx="46" cy="11" r="1.1" fill="hsl(38 70% 70%)" fillOpacity="0.8" />
            <path d="M50 11 L58 4 L64 8 L70 2 L76 8 L84 11" stroke="hsl(38 75% 72%)" strokeWidth="0.9" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx="86" cy="11" r="1.1" fill="hsl(38 70% 70%)" fillOpacity="0.8" />
            <line x1="90" y1="11" x2="120" y2="11" stroke="hsl(38 70% 70%)" strokeWidth="0.8" strokeOpacity="0.7" />
          </motion.svg>
        </div>
      </div>

      {/* Editorial introduction */}
      <section className="px-5 pt-10 pb-4">
        <motion.h2
          {...fadeUp(0.1)}
          className="text-[32px] sm:text-[38px] font-semibold tracking-[-0.02em] text-foreground leading-[1.1]"
          style={{ fontFamily: '"Cormorant Garamond", "Times New Roman", serif', fontWeight: 500 }}
        >
          Welcome
        </motion.h2>

        <motion.p
          {...fadeUp(0.2)}
          className="mt-5 text-[15px] sm:text-[16px] leading-[1.65] text-foreground/80 max-w-lg"
        >
          Chronicle's first priority is keeping your records safe and preserved exactly as you entered them.
        </motion.p>

        <motion.div {...fadeUp(0.28)} className="mt-8 mb-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <motion.div {...fadeUp(0.32)} className="space-y-4">
          <p className="text-[15px] sm:text-[16px] leading-[1.65] text-foreground/80 max-w-lg">
            People are often advised to email important records to themselves so there is a clear timeline if they ever need it later.
          </p>
          <p className="text-[15px] sm:text-[16px] leading-[1.65] text-foreground/80 max-w-lg">
            Over time this becomes difficult to manage: screenshots get lost, messages become scattered, and important details become harder to organise.
          </p>
          <p className="text-[15px] sm:text-[16px] leading-[1.65] text-foreground/80 max-w-lg">
            Chronicle is designed to make that process simpler, clearer, and more structured — while keeping privacy and long-term record preservation at the centre of the experience.
          </p>
        </motion.div>

        <motion.div {...fadeUp(0.4)} className="mt-8 mb-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Built around — merged with the old three pillars */}
        <motion.div {...fadeUp(0.44)} className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
            Built around
          </p>
          <ul className="space-y-2">
            {[
              'Local-first storage — your records live on your device by default',
              'Optional cloud sync, where available',
              'Original wording preserved exactly as entered',
              'Structured exports when you need them',
            ].map((line) => (
              <li key={line} className="flex items-baseline gap-3 text-[14px] sm:text-[15px] leading-[1.55] text-foreground/80">
                <span aria-hidden className="mt-[2px] h-1 w-1 rounded-full bg-primary/60 flex-shrink-0 translate-y-[-3px]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div {...fadeUp(0.5)} className="mt-8 mb-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* "What Chronicle is not" — pulled forward from /about to do real positioning work */}
        <motion.div {...fadeUp(0.54)} className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
            What Chronicle is not
          </p>
          <ul className="space-y-2">
            {[
              'Not a legal service — Chronicle does not give legal advice',
              'Not an interpreter — your entries are not rewritten or characterised',
              'Not a reporting channel — Chronicle does not contact your employer for you',
            ].map((line) => (
              <li key={line} className="flex items-baseline gap-3 text-[14px] sm:text-[15px] leading-[1.55] text-foreground/75">
                <span aria-hidden className="mt-[2px] h-1 w-1 rounded-full bg-muted-foreground/50 flex-shrink-0 translate-y-[-3px]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </section>

      {/* Quiet footer — no indie/heart language */}
      <motion.div className="px-6 pt-10" {...fade(0.6)}>
        <div className="text-center py-6 space-y-1">
          <p className="text-[11px] text-muted-foreground/55 leading-relaxed">
            Independently developed and maintained in the UK.
          </p>
          <p className="text-[11px] text-muted-foreground/45">
            General information only — not legal advice.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default HomeScreen;
