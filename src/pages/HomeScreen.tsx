import PageHeader from '@/components/chronicle/PageHeader';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Heart } from 'lucide-react';

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

const processNotes = [
  "Many workplace issues are resolved before reaching a formal hearing",
  "Clear timelines are often important in formal processes",
  "Keeping your own record is a reasonable and responsible thing to do",
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
      process: processNotes[day % processNotes.length],
    };
  }, []);

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  });

  return (
    <div className="min-h-screen bg-background pb-28 page-enter">
      <PageHeader title="Project Chronicle" hideHome />

      {/* Welcome subtitle */}
      <motion.div className="px-5 mb-8" {...fade(0)}>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          A quiet space to build your record, at your own pace.
        </p>
      </motion.div>

      {/* Primary message — highlighted */}
      <motion.div className="px-5 mb-3" {...fade(0.06)}>
        <div className="px-5 py-5 rounded-xl bg-primary/[0.06] border border-primary/12 shadow-[var(--shadow-card)]">
          <p className="text-[15px] text-foreground leading-relaxed font-medium">
            {picked.primary}
          </p>
        </div>
      </motion.div>

      {/* Supporting messages */}
      <motion.div className="px-5 mb-3 space-y-2.5" {...fade(0.12)}>
        {picked.supporting.map((msg, i) => (
          <div
            key={i}
            className="px-4 py-3.5 rounded-xl bg-card border border-border shadow-[var(--shadow-card)] text-[13px] text-foreground/70 leading-relaxed"
          >
            {msg}
          </div>
        ))}
      </motion.div>

      {/* Contextual message — muted */}
      <motion.div className="px-5 mb-10" {...fade(0.18)}>
        <div className="px-4 py-3 rounded-xl bg-muted/30 border border-border/60">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {picked.context}
          </p>
        </div>
      </motion.div>

      {/* Support section */}
      <motion.div className="px-5" {...fade(0.24)}>
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
