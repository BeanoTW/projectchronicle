import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';
import { selectServices, deriveSeverityLevel, getToneMessage } from '@/lib/supportMapping';

interface SupportServicesProps {
  incidents: Tables<'incidents'>[];
}

const contextColors: Record<string, string> = {
  workplace: 'bg-primary/[0.08] text-primary border-primary/[0.12]',
  housing: 'bg-warm-accent-light text-warm-accent-foreground border-warm-accent/[0.15]',
  education: 'bg-rep text-rep-foreground border-rep-foreground/[0.12]',
  safety: 'bg-severity-serious/[0.08] text-severity-serious border-severity-serious/[0.12]',
  wellbeing: 'bg-severity-low/[0.08] text-severity-low border-severity-low/[0.12]',
  general: 'bg-muted text-muted-foreground border-border',
};

const SupportServices = ({ incidents }: SupportServicesProps) => {
  const services = useMemo(() => selectServices(incidents), [incidents]);
  const severity = useMemo(() => deriveSeverityLevel(incidents), [incidents]);
  const toneMessage = useMemo(() => getToneMessage(severity), [severity]);

  if (services.length === 0) return null;

  return (
    <div>
      <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Get support
      </p>

      {toneMessage && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-[14px] text-foreground/70 mb-4 leading-relaxed"
        >
          {toneMessage}
        </motion.p>
      )}

      <div className="space-y-3">
        {services.map((service, i) => (
          <motion.a
            key={service.id}
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 shadow-[var(--shadow-card)] group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${contextColors[service.context] || contextColors.general}`}>
                  {service.context === 'workplace' ? 'Work' :
                   service.context === 'housing' ? 'Housing' :
                   service.context === 'education' ? 'Education' :
                   service.context === 'safety' ? 'Safety' :
                   service.context === 'wellbeing' ? 'Wellbeing' : 'General'}
                </span>
              </div>
              <h3 className="text-[15px] font-semibold text-foreground leading-snug">{service.name}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-1">{service.description}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 ml-3 group-hover:text-primary transition-colors" />
          </motion.a>
        ))}
      </div>
    </div>
  );
};

export default SupportServices;
