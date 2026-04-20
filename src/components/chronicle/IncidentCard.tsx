import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Incident } from '@/hooks/useIncidents';
import CategoryBadge, { CategoryLabel } from './CategoryBadge';
import RecordTypeLabel from './RecordTypeLabel';
import RecordAgeChip from './RecordAgeChip';
import { CATEGORY_CARD_TINTS } from '@/lib/categories';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { displayTitle } from '@/lib/displayTitle';

interface IncidentCardProps {
  incident: Incident;
  /**
   * @deprecated Pattern/occurrence chips removed — interpretive output is no longer
   * shown on cards. Props retained for backwards compatibility but ignored.
   */
  showPatternLabel?: boolean;
  occurrenceLabel?: string | null;
  attachmentCount?: number;
  compact?: boolean;
  expandable?: boolean;
}

const IncidentCard = ({ incident, attachmentCount, compact, expandable }: IncidentCardProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { maskText, maskNames } = usePrivacy();
  const tint = incident.category ? CATEGORY_CARD_TINTS[incident.category as keyof typeof CATEGORY_CARD_TINTS] || '' : '';

  const handleClick = () => {
    if (expandable) {
      setExpanded(prev => !prev);
    } else {
      navigate(`/incident/${incident.id}`);
    }
  };

  const titleText = maskText(displayTitle(incident));
  const previewSource = incident.ai_summary || incident.raw_narrative;
  const previewText = previewSource ? maskText(previewSource) : '';

  if (compact) {
    const isVoided = !!incident.voided_at;
    return (
      <div className={isVoided ? 'opacity-50' : ''}>
        <button
          onClick={handleClick}
          className={`w-full text-left rounded-xl border border-border border-l-4 px-3.5 py-3.5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px transition-all duration-200 active:scale-[0.98] ${tint}`}
        >
          {/* Primary: record-type label. Secondary: category (incidents only). */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <RecordTypeLabel recordType={incident.record_type} />
            {incident.record_type !== 'daily_record' && (
              <CategoryLabel category={incident.category || ''} subtype={incident.subtype ?? undefined} />
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <h3 className={`text-[14px] font-semibold line-clamp-1 flex-1 leading-snug ${isVoided ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {isVoided && <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted rounded px-1.5 py-0.5 mr-1.5 no-underline inline-block">Voided</span>}
              {titleText}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap">
                {format(parseISO(incident.incident_date), 'dd MMM')}
              </span>
              {expandable ? (
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
              )}
            </div>
          </div>
          {previewText && (
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed line-clamp-2 mt-1">
              {previewText}
            </p>
          )}
          {(attachmentCount ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground/70">
                <Paperclip className="h-2.5 w-2.5" /> {attachmentCount}
              </span>
            </div>
          )}
        </button>
        <AnimatePresence>
          {expandable && expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mx-1 mt-1 px-3.5 py-3 rounded-lg border border-border/60 bg-card/50 space-y-2">
                {previewText && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {previewText}
                  </p>
                )}
                {incident.location && (
                  <p className="text-[11px] text-muted-foreground/60">📍 {maskText(incident.location)}</p>
                )}
                {incident.people_involved.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/60">People: {maskNames(incident.people_involved).join(', ')}</p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/incident/${incident.id}`); }}
                  className="text-[12px] text-primary font-medium pt-1 transition-colors hover:text-primary/80"
                >
                  View full record →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const isVoidedFull = !!incident.voided_at;
  return (
    <button
      onClick={() => navigate(`/incident/${incident.id}`)}
      className={`w-full text-left rounded-xl border border-border border-l-4 p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px transition-all duration-200 active:scale-[0.98] ${tint} ${isVoidedFull ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1">
          {/* Primary: record-type label. Secondary: category (incidents only). */}
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <RecordTypeLabel recordType={incident.record_type} />
            {incident.record_type !== 'daily_record' && (
              <CategoryLabel category={incident.category || ''} subtype={incident.subtype ?? undefined} />
            )}
          </div>
          <h3 className={`text-[15px] font-semibold line-clamp-1 leading-snug ${isVoidedFull ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {isVoidedFull && <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted rounded px-1.5 py-0.5 mr-1.5 no-underline inline-block">Voided</span>}
            {titleText}
          </h3>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0 mt-1" />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <RecordAgeChip incidentDate={incident.incident_date} createdAt={incident.created_at} />
      </div>

      {previewText && (
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed line-clamp-2 mb-2.5">
          {previewText}
        </p>
      )}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
        <span>{format(parseISO(incident.incident_date), 'dd MMM yyyy')}</span>
        {incident.location && (
          <>
            <span className="opacity-30">·</span>
            <span>{maskText(incident.location)}</span>
          </>
        )}
      </div>
    </button>
  );
};

export default IncidentCard;
