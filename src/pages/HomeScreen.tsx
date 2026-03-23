import { useNavigate } from 'react-router-dom';
import { Mic, FileText, Paperclip, BarChart3, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import IncidentCard from '@/components/chronicle/IncidentCard';
import PageHeader from '@/components/chronicle/PageHeader';
import { motion } from 'framer-motion';

const guidanceItems = [
  {
    icon: FileText,
    text: 'Write what happened in your own words',
  },
  {
    icon: Paperclip,
    text: 'Add evidence when you have it',
  },
  {
    icon: BarChart3,
    text: 'See patterns over time in Insights',
  },
];

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

  return (
    <div className="min-h-screen bg-background pb-28 page-enter">
      <PageHeader title="Welcome" hideHome />
      <div className="px-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            Capture what happened, as it happens.
            <br />
            <span className="text-muted-foreground/70">You can always add more later.</span>
          </p>
        </motion.div>
      </div>

      {/* Primary CTA */}
      <div className="px-5 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Button
            onClick={() => navigate('/record')}
            className="w-full h-14 text-[16px] font-semibold rounded-xl shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.35)]"
            size="lg"
          >
            <Mic className="h-5 w-5 mr-2" />
            Record Incident
          </Button>
        </motion.div>
      </div>

      {/* Quick Guidance */}
      <motion.div
        className="px-5 mb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <div className="space-y-2">
          {guidanceItems.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-card border border-border shadow-[var(--shadow-card)]"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[13px] text-foreground/80 leading-snug">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Light Status */}
      {!isLoading && totalIncidents > 0 && (
        <motion.div
          className="px-5 mb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-3">
            Your record
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { value: totalIncidents, label: 'Incidents' },
              { value: withEvidence, label: 'With evidence' },
              { value: withWitnesses, label: 'With witnesses' },
            ].map((stat, i) => (
              <div
                key={i}
                className="text-center py-3.5 rounded-xl bg-card border border-border shadow-[var(--shadow-card)]"
              >
                <div className="text-[20px] font-bold text-foreground">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Activity */}
      {recentIncidents.length > 0 && (
        <motion.div
          className="px-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
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
