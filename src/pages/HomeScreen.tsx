import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import IncidentCard from '@/components/chronicle/IncidentCard';
import PageHeader from '@/components/chronicle/PageHeader';
import { motion } from 'framer-motion';

const HomeScreen = () => {
  const navigate = useNavigate();
  const { data: incidents, isLoading } = useIncidents();
  const { data: evidence } = useEvidence();

  const totalIncidents = incidents?.length ?? 0;
  const withEvidence = incidents?.filter(i =>
    evidence?.some(e => e.incident_id === i.id)
  ).length ?? 0;
  const withWitnesses = incidents?.filter(i => i.witnesses && i.witnesses.length > 0).length ?? 0;
  const recentIncidents = incidents?.slice(0, 2) ?? [];

  // Simple reflections based on data
  const reflections: string[] = [];
  if (incidents && incidents.length > 0) {
    const categories = incidents.map(i => i.category).filter(Boolean);
    const catCounts: Record<string, number> = {};
    categories.forEach(c => { catCounts[c!] = (catCounts[c!] || 0) + 1; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    if (topCat && topCat[1] > 1) {
      reflections.push(`${topCat[0]} appears frequently in your records`);
    }
    if (incidents.length >= 3) {
      const dates = incidents.map(i => new Date(i.incident_date).getTime()).sort();
      const gaps = dates.slice(1).map((d, i) => d - dates[i]);
      const shortGaps = gaps.filter(g => g < 7 * 24 * 60 * 60 * 1000);
      if (shortGaps.length > gaps.length * 0.5) {
        reflections.push('Some incidents were recorded within short time periods');
      }
    }
    if (withEvidence === 0 && totalIncidents > 0) {
      reflections.push('None of your records have evidence attached yet');
    }
  }

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  });

  return (
    <div className="min-h-screen bg-background pb-28 page-enter">
      <PageHeader title="Your Record" hideHome />

      {/* Opening text */}
      <motion.div className="px-5 mb-8" {...fade(0)}>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          You're building a record over time.
        </p>
        <p className="text-[13px] text-muted-foreground/60 leading-relaxed mt-1">
          Everything here reflects what you've captured so far. You can add to this whenever you're ready.
        </p>
      </motion.div>

      {/* Record overview stats */}
      {!isLoading && totalIncidents > 0 && (
        <motion.div className="px-5 mb-8" {...fade(0.1)}>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { value: totalIncidents, label: 'Incidents' },
              { value: withEvidence, label: 'With evidence' },
              { value: withWitnesses, label: 'With witnesses' },
            ].map((stat, i) => (
              <div
                key={i}
                className="text-center py-4 rounded-xl bg-card border border-border shadow-[var(--shadow-card)]"
              >
                <div className="text-[22px] font-bold text-foreground">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {!isLoading && totalIncidents === 0 && (
        <motion.div className="px-5 mb-8" {...fade(0.1)}>
          <div className="text-center py-8 rounded-xl bg-card border border-border shadow-[var(--shadow-card)]">
            <p className="text-[14px] text-muted-foreground">No incidents recorded yet</p>
            <p className="text-[12px] text-muted-foreground/50 mt-1">Use the Record button below when you're ready</p>
          </div>
        </motion.div>
      )}

      {/* Reflections */}
      {reflections.length > 0 && (
        <motion.div className="px-5 mb-8" {...fade(0.15)}>
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-3">
            Observations
          </h2>
          <div className="space-y-2">
            {reflections.map((text, i) => (
              <div
                key={i}
                className="px-4 py-3 rounded-xl bg-card border border-border shadow-[var(--shadow-card)] text-[13px] text-muted-foreground leading-relaxed"
              >
                {text}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent records */}
      {recentIncidents.length > 0 && (
        <motion.div className="px-5" {...fade(0.2)}>
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
    </div>
  );
};

export default HomeScreen;
