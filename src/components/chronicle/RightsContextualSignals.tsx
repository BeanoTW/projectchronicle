import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';
import { deriveContextualSignals } from '@/lib/supportMapping';

interface Props {
  incidents: Tables<'incidents'>[];
}

const RightsContextualSignals = ({ incidents }: Props) => {
  const signals = useMemo(() => deriveContextualSignals(incidents), [incidents]);

  if (signals.length === 0) return null;

  return (
    <div>
      <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-4">
        What this may help with
      </p>
      <div className="space-y-3">
        {signals.map((signal, i) => (
          <motion.div
            key={signal.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            className="bg-primary/[0.03] border border-primary/[0.1] rounded-xl px-4 py-3"
          >
            <p className="text-[13px] font-semibold text-foreground leading-snug">{signal.message}</p>
            <p className="text-[12px] text-muted-foreground/80 leading-relaxed mt-0.5">{signal.guidance}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RightsContextualSignals;
