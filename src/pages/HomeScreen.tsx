import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useIncidents } from '@/hooks/useIncidents';
import IncidentCard from '@/components/chronicle/IncidentCard';
import PageHeader from '@/components/chronicle/PageHeader';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

const supportiveMessages = [
  "You don't need everything — just start with what you remember",
  "Small details matter later",
  "You can always come back and add more",
  "There's no wrong way to begin",
  "Writing things down can help you think more clearly",
];

const contextStatements = [
  "Clear records can make it easier to explain what happened",
  "Details written at the time are often more reliable than memory later",
  "Having dates and specifics helps others understand your experience",
];

const processNotes = [
  "Many workplace issues are resolved before reaching a formal hearing",
  "Clear timelines are often important in formal processes",
  "Keeping your own record is a reasonable and responsible thing to do",
];

const HomeScreen = () => {
  const navigate = useNavigate();
  const { data: incidents } = useIncidents();
  const recentIncidents = incidents?.slice(0, 2) ?? [];

  // Pick consistent messages per session using date-based seed
  const picked = useMemo(() => {
    const day = new Date().getDate();
    return {
      reminders: [
        supportiveMessages[day % supportiveMessages.length],
        supportiveMessages[(day + 2) % supportiveMessages.length],
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

      {/* Welcome */}
      <motion.div className="px-5 mb-6" {...fade(0)}>
        <p className="text-[15px] text-foreground/80 leading-relaxed">
          A quiet space to build your record, at your own pace.
        </p>
      </motion.div>

      {/* Supportive reminders */}
      <motion.div className="px-5 mb-6" {...fade(0.08)}>
        <div className="space-y-2.5">
          {picked.reminders.map((msg, i) => (
            <div
              key={i}
              className="px-4 py-3.5 rounded-xl bg-card border border-border shadow-[var(--shadow-card)] text-[13px] text-foreground/70 leading-relaxed"
            >
              {msg}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Reality context */}
      <motion.div className="px-5 mb-6" {...fade(0.14)}>
        <div className="px-4 py-3.5 rounded-xl bg-primary/[0.04] border border-primary/10 shadow-[var(--shadow-card)]">
          <p className="text-[13px] text-foreground/70 leading-relaxed">
            {picked.context}
          </p>
        </div>
      </motion.div>

      {/* Process context */}
      <motion.div className="px-5 mb-8" {...fade(0.2)}>
        <div className="px-4 py-3.5 rounded-xl bg-info/[0.04] border border-info/10 shadow-[var(--shadow-card)]">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {picked.process}
          </p>
        </div>
      </motion.div>

      {/* Recent records */}
      {recentIncidents.length > 0 && (
        <motion.div className="px-5 mb-8" {...fade(0.26)}>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Recent
            </h2>
            <button
              onClick={() => navigate('/timeline')}
              className="flex items-center gap-0.5 text-[11px] font-medium text-primary"
            >
              View all
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {recentIncidents.map(incident => (
              <IncidentCard key={incident.id} incident={incident} compact />
            ))}
          </div>
        </motion.div>
      )}

      {/* Community / support */}
      <motion.div className="px-5" {...fade(0.32)}>
        <div className="text-center py-5">
          <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
            Built with care · Supported by early backers
          </p>
          <p className="text-[10px] text-muted-foreground/35 mt-1">
            Thank you for being part of Project Chronicle
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default HomeScreen;
